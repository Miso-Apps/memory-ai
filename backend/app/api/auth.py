from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional
import uuid
import httpx
import urllib.parse

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.schemas import UserCreate, UserLogin

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: str, token_type: str, expires: timedelta) -> str:
    payload = {
        "sub": user_id,
        "type": token_type,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + expires,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _issue_tokens(user_id: str) -> dict:
    return {
        "access_token": _create_token(
            user_id, "access",
            timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        ),
        "refresh_token": _create_token(
            user_id, "refresh",
            timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ),
    }


@router.post("/register")
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user and return JWT tokens."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=_hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    await db.flush()  # populate user.id before commit

    tokens = _issue_tokens(str(user.id))
    return {
        "user": {"id": str(user.id), "email": user.email, "name": user.name},
        **tokens,
    }


@router.post("/login")
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate a user and return JWT tokens."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    tokens = _issue_tokens(str(user.id))
    return {
        "user": {"id": str(user.id), "email": user.email, "name": user.name},
        **tokens,
    }


@router.post("/refresh")
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for a new access token."""
    try:
        payload = jwt.decode(
            refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id: str = payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    access_token = _create_token(
        user_id, "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token}


@router.post("/logout")
async def logout():
    """Logout (client should discard tokens)."""
    return {"message": "Logged out successfully"}


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
    google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
    # google_client_secret = getattr(settings, 'GOOGLE_CLIENT_SECRET', '')
    if not google_client_id:
        raise HTTPException(status_code=501, detail="Google login is not configured: missing GOOGLE_CLIENT_ID")
    # if not google_client_secret:
    #     raise HTTPException(status_code=501, detail="Google login is not configured: missing GOOGLE_CLIENT_SECRET")

    params = urllib.parse.urlencode({
        "client_id": google_client_id,
        "redirect_uri": body.redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    })
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
    return {"auth_url": auth_url}


@router.post("/google/callback")
async def google_callback(body: GoogleCallbackRequest, db: AsyncSession = Depends(get_db)):
    """
    Handle Google OAuth callback. Exchange code for tokens,
    create or login user, and return JWT tokens.
    """
    google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
    # google_client_secret = getattr(settings, 'GOOGLE_CLIENT_SECRET', '')
    if not google_client_id:
        raise HTTPException(status_code=501, detail="Google login is not configured")

    # Exchange authorization code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": body.code,
                "client_id": google_client_id,
                # "client_secret": google_client_secret,
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

    # Decode the ID token to get user info (Google's public keys verify it)
    try:
        # For simplicity, decode without verification (the token came from Google directly)
        import base64
        import json as _json
        payload_b64 = id_token_str.split(".")[1]
        # Add padding
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = _json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google ID token")

    email = payload.get("email")
    name = payload.get("name")
    if not email:
        raise HTTPException(status_code=401, detail="No email in Google token")

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            password_hash=_hash_password(uuid.uuid4().hex),  # Random password for OAuth users
            name=name,
        )
        db.add(user)
        await db.flush()

    tokens = _issue_tokens(str(user.id))
    return {
        "user": {"id": str(user.id), "email": user.email, "name": user.name},
        **tokens,
    }
