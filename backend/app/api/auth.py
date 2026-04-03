import asyncio
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional
import uuid
import httpx
import urllib.parse
import logging

from app.database import get_db
from app.config import settings
from app.models.user import User, AuthProvider
from app.schemas import UserCreate, UserLogin
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: str, token_type: str, expires: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": token_type,
        "iat": now,
        "exp": now + expires,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _issue_tokens(user_id: str) -> dict:
    return {
        "access_token": _create_token(
            user_id,
            "access",
            timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        ),
        "refresh_token": _create_token(
            user_id,
            "refresh",
            timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ),
    }


def _user_response(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "email_verified": user.email_verified or False,
        "auth_provider": user.auth_provider or AuthProvider.LOCAL.value,
    }


def _email_transport_ready() -> bool:
    """Return True when at least one email transport is available.

    Order of preference:
    1. Gmail API (GMAIL_REFRESH_TOKEN + OAuth credentials)
    2. SMTP (SMTP_HOST configured)
    3. Console logging in DEBUG mode (no real transport, but prevents hard failure)
    """
    return bool(settings.GMAIL_REFRESH_TOKEN or settings.SMTP_HOST or settings.DEBUG)


@router.post("/register")
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user.

    - Google users: verified immediately, tokens issued.
    - Local (email/password) users: if EMAIL_VERIFICATION_ENABLED, a
      verification email is sent and tokens are withheld until the user
      confirms their address. Otherwise tokens are issued immediately.
    """
    email = body.email.strip().lower()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Generate a 6-digit numeric OTP (zero-padded, e.g. "083741")
    verification_token = f"{secrets.randbelow(1_000_000):06d}"
    needs_verification = settings.EMAIL_VERIFICATION_ENABLED

    user = User(
        email=email,
        password_hash=_hash_password(body.password),
        name=body.name,
        auth_provider=AuthProvider.LOCAL.value,
        email_verified=not needs_verification,
        email_verification_token=verification_token if needs_verification else None,
        email_verification_expires=(
            datetime.now(timezone.utc) + timedelta(minutes=10)
            if needs_verification
            else None
        ),
    )
    db.add(user)
    await db.flush()

    # Send verification OTP email if enabled and a transport is configured
    if needs_verification and _email_transport_ready():
        try:
            from app.services import email_service

            await email_service.send_otp_email(
                user.email, verification_token, user.name
            )
        except Exception as exc:
            logger.error("Failed to send verification email: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Email delivery is currently unavailable. Please try again later.",
            ) from exc

    # If verification is required, withhold tokens until the user confirms
    if needs_verification and not user.email_verified:
        return {
            "message": (
                "Registration successful! Please check your email to verify "
                "your account before signing in."
            ),
            "email_verification_required": True,
        }

    tokens = _issue_tokens(str(user.id))
    return {"user": _user_response(user), **tokens}


@router.post("/login")
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate a user and return JWT tokens."""
    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # OAuth-only accounts cannot login with password
    if (
        user
        and user.auth_provider == AuthProvider.GOOGLE.value
        and not user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="This account uses Google sign-in. Please use the Google login button.",
        )

    if (
        not user
        or not user.password_hash
        or not _verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Block login for unverified local accounts when verification is enforced
    if (
        settings.EMAIL_VERIFICATION_ENABLED
        and user.auth_provider == AuthProvider.LOCAL.value
        and not user.email_verified
    ):
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before signing in. Check your inbox for the verification link.",
        )

    tokens = _issue_tokens(str(user.id))
    return {"user": _user_response(user), **tokens}


class RefreshRequest(BaseModel):
    refresh_token: str


class VerifyOtpRequest(BaseModel):
    email: str
    code: str


class ResendOtpRequest(BaseModel):
    email: str


@router.post("/refresh")
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for a new access token."""
    try:
        payload = jwt.decode(
            body.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id: str = payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    access_token = _create_token(
        user_id,
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token}


@router.post("/logout")
async def logout():
    """Logout (client should discard tokens)."""
    return {"message": "Logged out successfully"}


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------


@router.api_route("/verify-email", methods=["GET", "POST"])
async def verify_email(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Verify user email with the token sent via email.

    Idempotent: if the token was already used the endpoint returns
    already_verified=True without error, so double-clicks on the link
    don't confuse the user.

    Returns HTML on GET (browser click) and JSON on POST (API call).
    """
    normalized_token = (token or "").strip()

    # Registration may still be committing when the user clicks immediately.
    # Retry briefly to avoid spurious "invalid token" responses.
    user = None
    for _ in range(4):
        result = await db.execute(
            select(User).where(User.email_verification_token == normalized_token)
        )
        user = result.scalar_one_or_none()
        if user:
            break
        await asyncio.sleep(0.25)

    def _html_response(success: bool, already: bool = False) -> HTMLResponse:
        if success:
            heading = "Email verified!" if not already else "Already verified"
            body_text = (
                "Your Memory AI account is now active. Return to the app and sign in."
                if not already
                else "Your email was already confirmed. You can sign in to Memory AI."
            )
            color = "#6C63FF"
        else:
            heading = "Verification failed"
            body_text = (
                "This link is invalid or has expired. "
                "Open Memory AI and request a new verification email."
            )
            color = "#EF4444"

        return HTMLResponse(
            content=f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Memory AI — Email Verification</title>
<style>
  body{{margin:0;background:#F5F3F0;font-family:'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}}
  .card{{background:#fff;border-radius:20px;padding:40px 32px;max-width:420px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,0.08);text-align:center;}}
  .icon{{font-size:48px;margin-bottom:16px;}}
  h1{{color:{color};font-size:22px;margin:0 0 12px;}}
  p{{color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;}}
  a{{display:inline-block;background:{color};color:#fff;text-decoration:none;border-radius:999px;padding:12px 28px;font-weight:700;font-size:14px;}}
</style>
</head>
<body>
  <div class="card">
    <div class="icon">{"✓" if success else "✗"}</div>
    <h1>{heading}</h1>
    <p>{body_text}</p>
    <a href="memoryai://">Open Memory AI</a>
  </div>
</body>
</html>""",
            status_code=200,
        )

    if not user:
        return _html_response(success=False)

    if user.email_verified:
        return _html_response(success=True, already=True)

    if (
        user.email_verification_expires
        and datetime.now(timezone.utc) > user.email_verification_expires
    ):
        return _html_response(success=False)

    user.email_verified = True
    # Keep token intact — repeat clicks hit the already_verified path above
    await db.flush()

    # Send welcome email after successful verification
    if _email_transport_ready():
        try:
            from app.services import email_service

            await email_service.send_welcome_email(user.email, user.name)
        except Exception as exc:
            logger.error("Failed to send welcome email: %s", exc)

    return _html_response(success=True)


@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend email verification link (requires valid access token)."""
    if current_user.email_verified:
        return {"message": "Email already verified"}

    token = secrets.token_urlsafe(32)
    current_user.email_verification_token = token
    current_user.email_verification_expires = datetime.now(timezone.utc) + timedelta(
        hours=24
    )
    await db.flush()

    if _email_transport_ready():
        try:
            from app.services import email_service

            await email_service.send_verification_email(
                current_user.email, token, current_user.name
            )
        except Exception as exc:
            logger.error("Failed to resend verification email: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Email delivery is currently unavailable. Please try again later.",
            ) from exc

    return {"message": "Verification email sent"}


@router.post("/resend-verification-public")
async def resend_verification_public(
    body: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """Resend email verification link (public endpoint — requires email + password)."""
    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if (
        not user
        or not user.password_hash
        or not _verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.email_verified:
        return {"message": "Email already verified"}

    token = secrets.token_urlsafe(32)
    user.email_verification_token = token
    user.email_verification_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.flush()

    if _email_transport_ready():
        try:
            from app.services import email_service

            await email_service.send_verification_email(user.email, token, user.name)
        except Exception as exc:
            logger.error("Failed to resend verification email: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Email delivery is currently unavailable. Please try again later.",
            ) from exc

    return {"message": "Verification email sent"}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    """Verify a 6-digit OTP code and issue JWT tokens.

    Idempotent: already-verified users receive tokens without error.
    Returns 400 for both wrong code and expired code (same message to
    prevent enumeration attacks).
    """
    email = (body.email or "").strip().lower()
    code = (body.code or "").strip()

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="No account found for that email")

    # Idempotent: already verified → issue tokens
    if user.email_verified:
        tokens = _issue_tokens(str(user.id))
        return {"user": _user_response(user), **tokens}

    # Expired
    if (
        not user.email_verification_expires
        or datetime.now(timezone.utc) > user.email_verification_expires
    ):
        raise HTTPException(
            status_code=400,
            detail="Your code has expired. Please request a new one.",
        )

    # Wrong code — constant-time comparison to prevent timing attacks
    stored = (user.email_verification_token or "").strip()
    if not secrets.compare_digest(stored, code):
        raise HTTPException(
            status_code=400,
            detail="Incorrect or expired code. Please try again.",
        )

    # Mark verified, clear OTP fields
    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    await db.flush()

    tokens = _issue_tokens(str(user.id))
    return {"user": _user_response(user), **tokens}


@router.post("/resend-otp")
async def resend_otp(body: ResendOtpRequest, db: AsyncSession = Depends(get_db)):
    """Generate a new 6-digit OTP and resend it.

    Always returns 200 regardless of whether the email exists (no info leak).
    """
    email = (body.email or "").strip().lower()

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Silent no-op for unknown emails or already-verified accounts
    if not user or user.email_verified:
        return {"message": "If an account exists and is unverified, a new code has been sent."}

    # Generate new 6-digit code and reset expiry
    new_code = f"{secrets.randbelow(1_000_000):06d}"
    user.email_verification_token = new_code
    user.email_verification_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.flush()

    try:
        from app.services import email_service
        await email_service.send_otp_email(user.email, new_code, user.name)
    except Exception as exc:
        logger.error("Failed to resend OTP: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Email delivery is currently unavailable. Please try again later.",
        ) from exc

    return {"message": "If an account exists and is unverified, a new code has been sent."}


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------


class GoogleInitRequest(BaseModel):
    redirect_uri: str


class GoogleCallbackRequest(BaseModel):
    code: str
    redirect_uri: str


@router.post("/google/init")
async def google_init(body: GoogleInitRequest):
    """
    Initialize Google OAuth flow.
    Returns an auth_url for the client to open in a browser.

    The redirect_uri sent here MUST exactly match one of the
    "Authorized redirect URIs" registered in Google Cloud Console for
    the OAuth 2.0 client credential. Common values:
      • Expo Go (dev):   exp://<host>:<port>/--/auth/callback
      • Standalone iOS:  memoryai://auth/callback
      • Standalone Android: memoryai://auth/callback
    """
    google_client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
    google_client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "")
    if not google_client_id:
        raise HTTPException(
            status_code=501,
            detail="Google login is not configured: missing GOOGLE_CLIENT_ID",
        )
    if not google_client_secret:
        raise HTTPException(
            status_code=501,
            detail="Google login is not configured: missing GOOGLE_CLIENT_SECRET",
        )

    params = urllib.parse.urlencode(
        {
            "client_id": google_client_id,
            "redirect_uri": body.redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
        }
    )
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
    return {"auth_url": auth_url}


@router.post("/google/callback")
async def google_callback(
    body: GoogleCallbackRequest, db: AsyncSession = Depends(get_db)
):
    """
    Handle Google OAuth callback. Exchange code for tokens,
    create or login user, and return JWT tokens.

    Google-authenticated users always get email_verified=True because
    Google guarantees the address belongs to the OAuth subject.
    """
    google_client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
    google_client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "")
    if not google_client_id or not google_client_secret:
        raise HTTPException(status_code=501, detail="Google login is not configured")

    # Exchange authorization code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": body.code,
                "client_id": google_client_id,
                "client_secret": google_client_secret,
                "redirect_uri": body.redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to exchange Google code")

    token_data = token_response.json()
    id_token_str = token_data.get("id_token")
    if not id_token_str:
        raise HTTPException(status_code=401, detail="No ID token from Google")

    # Verify the ID token signature using Google's public keys
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    try:
        request = google_requests.Request()
        payload = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: google_id_token.verify_oauth2_token(
                id_token_str, request, google_client_id
            ),
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google ID token")

    email = payload.get("email")
    name = payload.get("name")
    if not email:
        raise HTTPException(status_code=401, detail="No email in Google token")

    # Find or create user — Google users are always email_verified
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            password_hash=None,  # OAuth users have no password
            name=name,
            auth_provider=AuthProvider.GOOGLE.value,
            email_verified=True,
        )
        db.add(user)
        await db.flush()
    else:
        # Ensure existing local accounts linked via Google are marked verified
        if not user.email_verified:
            user.email_verified = True
        if not user.auth_provider or user.auth_provider == AuthProvider.LOCAL.value:
            user.auth_provider = AuthProvider.GOOGLE.value
        await db.flush()

    tokens = _issue_tokens(str(user.id))
    return {"user": _user_response(user), **tokens}


# ---------------------------------------------------------------------------
# Account management (authenticated)
# ---------------------------------------------------------------------------


class ChangeEmailRequest(BaseModel):
    new_email: str
    password: Optional[str] = None  # Not required for Google accounts


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    password: Optional[str] = None  # Not required for Google accounts


@router.post("/change-email")
async def change_email(
    body: ChangeEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's email address."""
    new_email = body.new_email.strip().lower()

    # Validate new email format minimally
    if "@" not in new_email or "." not in new_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address")

    if new_email == current_user.email:
        raise HTTPException(
            status_code=400, detail="New email is the same as current email"
        )

    # Confirm password for local (non-OAuth) accounts
    if current_user.auth_provider == AuthProvider.LOCAL.value:
        if not body.password:
            raise HTTPException(
                status_code=400, detail="Password is required to change email"
            )
        if not current_user.password_hash or not _verify_password(
            body.password, current_user.password_hash
        ):
            raise HTTPException(status_code=401, detail="Incorrect password")

    # Check new email not already in use
    existing = await db.execute(select(User).where(User.email == new_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email address is already in use")

    current_user.email = new_email
    await db.flush()

    return {
        "message": "Email updated successfully",
        "user": _user_response(current_user),
    }


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's password."""
    # Google-only accounts have no password to change
    if (
        current_user.auth_provider == AuthProvider.GOOGLE.value
        and not current_user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="This account uses Google sign-in and has no password to change.",
        )

    if not current_user.password_hash or not _verify_password(
        body.current_password, current_user.password_hash
    ):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    if len(body.new_password) < 8:
        raise HTTPException(
            status_code=400, detail="New password must be at least 8 characters"
        )

    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password",
        )

    current_user.password_hash = _hash_password(body.new_password)
    await db.flush()

    return {"message": "Password updated successfully"}


@router.delete("/me")
async def delete_account(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the authenticated user's account and all their data."""
    from sqlalchemy import delete as sql_delete

    # Confirm password for local accounts
    if current_user.auth_provider == AuthProvider.LOCAL.value:
        if not body.password:
            raise HTTPException(
                status_code=400, detail="Password is required to delete account"
            )
        if not current_user.password_hash or not _verify_password(
            body.password, current_user.password_hash
        ):
            raise HTTPException(status_code=401, detail="Incorrect password")

    # Hard-delete the user; CASCADE takes care of memories, preferences, etc.
    await db.delete(current_user)
    await db.flush()

    return {"message": "Account deleted successfully"}


@router.get("/export")
async def export_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all of the authenticated user's data as JSON."""
    from app.models import Memory, UserPreferences, DecisionMemory, Category
    from sqlalchemy import select as sql_select

    # Memories
    mem_result = await db.execute(
        sql_select(Memory)
        .where(Memory.user_id == current_user.id)
        .order_by(Memory.created_at)
    )
    memories = mem_result.scalars().all()

    # Preferences
    pref_result = await db.execute(
        sql_select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = pref_result.scalar_one_or_none()

    # Decisions
    dec_result = await db.execute(
        sql_select(DecisionMemory)
        .where(DecisionMemory.user_id == current_user.id)
        .order_by(DecisionMemory.created_at)
    )
    decisions = dec_result.scalars().all()

    # User-created categories
    cat_result = await db.execute(
        sql_select(Category).where(Category.user_id == current_user.id)
    )
    categories = cat_result.scalars().all()

    def _safe(val):
        """Serialize UUIDs, datetimes, and enums to JSON-safe primitives."""
        if val is None:
            return None
        if hasattr(val, "isoformat"):
            return val.isoformat()
        return str(val)

    export = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": _user_response(current_user),
        "memories": [
            {
                "id": _safe(m.id),
                "type": m.type.value if hasattr(m.type, "value") else str(m.type),
                "content": m.content,
                "ai_summary": m.ai_summary,
                "audio_url": m.audio_url,
                "image_url": m.image_url,
                "category_id": _safe(m.category_id),
                "created_at": _safe(m.created_at),
                "updated_at": _safe(m.updated_at),
            }
            for m in memories
        ],
        "decisions": [
            {
                "id": _safe(d.id),
                "title": d.title,
                "rationale": d.rationale,
                "expected_outcome": d.expected_outcome,
                "status": d.status,
                "revisit_at": _safe(d.revisit_at),
                "created_at": _safe(d.created_at),
            }
            for d in decisions
        ],
        "categories": [
            {
                "id": _safe(c.id),
                "name": c.name,
                "icon": c.icon,
                "color": c.color,
            }
            for c in categories
        ],
        "preferences": (
            {
                "theme_mode": prefs.theme_mode.value
                if prefs and hasattr(prefs.theme_mode, "value")
                else (str(prefs.theme_mode) if prefs else None),
                "language": prefs.language if prefs else "en",
                "ai_recall_enabled": prefs.ai_recall_enabled if prefs else True,
                "auto_summarize": prefs.auto_summarize if prefs else True,
                "auto_categorize": prefs.auto_categorize if prefs else True,
            }
            if prefs
            else {}
        ),
    }

    return export


@router.delete("/me/memories")
async def delete_all_memories(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all memories for the authenticated user (account is kept)."""
    from sqlalchemy import delete as sql_delete
    from app.models import Memory

    # Confirm password for local accounts
    if current_user.auth_provider == AuthProvider.LOCAL.value:
        if not body.password:
            raise HTTPException(
                status_code=400, detail="Password is required to delete all data"
            )
        if not current_user.password_hash or not _verify_password(
            body.password, current_user.password_hash
        ):
            raise HTTPException(status_code=401, detail="Incorrect password")

    result = await db.execute(
        sql_delete(Memory).where(Memory.user_id == current_user.id)
    )
    deleted_count = result.rowcount
    await db.flush()

    return {"message": "All memories deleted", "count": deleted_count}


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: str, token_type: str, expires: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": token_type,
        "iat": now,
        "exp": now + expires,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _issue_tokens(user_id: str) -> dict:
    return {
        "access_token": _create_token(
            user_id,
            "access",
            timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        ),
        "refresh_token": _create_token(
            user_id,
            "refresh",
            timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ),
    }
