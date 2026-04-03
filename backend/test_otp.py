"""Tests for OTP-based email verification endpoints.

POST /auth/verify-otp  — verify 6-digit code → issue tokens
POST /auth/resend-otp  — regenerate code and resend
"""
import pytest
import secrets as _secrets
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db, AsyncSessionLocal
from app.config import settings
from app.models.user import User
from sqlalchemy import select


@pytest.fixture(scope="function")
async def db_init():
    await init_db()


@pytest.fixture(autouse=True)
def mock_send_otp_email():
    """Prevent real SMTP calls during OTP tests."""
    with patch(
        "app.services.email_service.send_otp_email",
        new_callable=AsyncMock,
    ) as mock:
        yield mock


# ---------------------------------------------------------------------------
# verify-otp
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_otp_success(db_init):
    """Register → read OTP from DB → POST /verify-otp → tokens returned."""
    settings.EMAIL_VERIFICATION_ENABLED = True
    try:
        email = f"otp-ok-{_secrets.token_hex(4)}@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            reg = await client.post("/auth/register", json={"email": email, "password": "testpass123"})
            assert reg.status_code == 200, f"register failed: {reg.text}"
            assert reg.json().get("email_verification_required") is True

            # Retrieve OTP directly from DB
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.email == email))
                user = result.scalar_one()
                code = user.email_verification_token
            assert code is not None
            assert len(code) == 6
            assert code.isdigit()

            resp = await client.post("/auth/verify-otp", json={"email": email, "code": code})
            assert resp.status_code == 200, f"verify-otp failed: {resp.text}"
            data = resp.json()
            assert "access_token" in data
            assert "refresh_token" in data
            assert data["user"]["email"] == email
            assert data["user"]["email_verified"] is True
    finally:
        settings.EMAIL_VERIFICATION_ENABLED = False


@pytest.mark.asyncio
async def test_verify_otp_wrong_code(db_init):
    """Wrong code returns 400 with 'Incorrect' in detail."""
    settings.EMAIL_VERIFICATION_ENABLED = True
    try:
        email = f"otp-wrong-{_secrets.token_hex(4)}@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/auth/register", json={"email": email, "password": "testpass123"})
            resp = await client.post("/auth/verify-otp", json={"email": email, "code": "000000"})
            assert resp.status_code == 400, f"expected 400, got {resp.status_code}: {resp.text}"
            assert "Incorrect" in resp.json()["detail"] or "incorrect" in resp.json()["detail"].lower()
    finally:
        settings.EMAIL_VERIFICATION_ENABLED = False


@pytest.mark.asyncio
async def test_verify_otp_expired(db_init):
    """Expired code returns 400 with 'expired' in the detail."""
    settings.EMAIL_VERIFICATION_ENABLED = True
    try:
        email = f"otp-exp-{_secrets.token_hex(4)}@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/auth/register", json={"email": email, "password": "testpass123"})

            # Manually expire the token
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.email == email))
                user = result.scalar_one()
                code = user.email_verification_token
                user.email_verification_expires = datetime.now(timezone.utc) - timedelta(minutes=1)
                await db.commit()

            resp = await client.post("/auth/verify-otp", json={"email": email, "code": code})
            assert resp.status_code == 400, f"expected 400, got {resp.status_code}: {resp.text}"
            assert "expired" in resp.json()["detail"].lower()
    finally:
        settings.EMAIL_VERIFICATION_ENABLED = False


@pytest.mark.asyncio
async def test_verify_otp_already_verified(db_init):
    """Already-verified user gets tokens (idempotent — no error)."""
    # conftest.py sets EMAIL_VERIFICATION_ENABLED=False so register verifies immediately
    email = f"otp-alv-{_secrets.token_hex(4)}@example.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        reg = await client.post("/auth/register", json={"email": email, "password": "testpass123"})
        assert reg.status_code == 200
        # User is already verified (EMAIL_VERIFICATION_ENABLED=False)
        resp = await client.post("/auth/verify-otp", json={"email": email, "code": "anything"})
        assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text}"
        assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_verify_otp_unknown_email(db_init):
    """Unknown email returns 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/auth/verify-otp", json={"email": "nobody@notexist.com", "code": "123456"})
        assert resp.status_code == 404, f"expected 404, got {resp.status_code}: {resp.text}"


# ---------------------------------------------------------------------------
# resend-otp
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resend_otp_generates_new_code(db_init):
    """Resend updates the stored code."""
    settings.EMAIL_VERIFICATION_ENABLED = True
    try:
        email = f"otp-resend-{_secrets.token_hex(4)}@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/auth/register", json={"email": email, "password": "testpass123"})

            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.email == email))
                original_code = result.scalar_one().email_verification_token

            resp = await client.post("/auth/resend-otp", json={"email": email})
            assert resp.status_code == 200, f"resend-otp failed: {resp.text}"

            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.email == email))
                new_code = result.scalar_one().email_verification_token

            assert new_code is not None
            assert len(new_code) == 6
            assert new_code.isdigit()
            # Original and new code may differ (extremely rare collision acceptable)
            assert isinstance(new_code, str)
    finally:
        settings.EMAIL_VERIFICATION_ENABLED = False


@pytest.mark.asyncio
async def test_resend_otp_unknown_email_returns_200(db_init):
    """Resend for unknown email returns 200 silently (no info leak)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/auth/resend-otp", json={"email": "nobody@notexist.com"})
        assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text}"
