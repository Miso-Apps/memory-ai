"""Tests for Google OAuth native login behavior."""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import init_db
from app.main import app


@pytest.fixture(scope="function")
async def db_init():
    await init_db()


@pytest.mark.asyncio
async def test_google_login_accepts_secondary_ios_client_id_from_csv(db_init):
    """When GOOGLE_IOS_CLIENT_ID contains CSV values, backend should try each audience."""
    original_ios = settings.GOOGLE_IOS_CLIENT_ID
    original_web = settings.GOOGLE_CLIENT_ID

    settings.GOOGLE_IOS_CLIENT_ID = "ios-primary.apps.googleusercontent.com, ios-secondary.apps.googleusercontent.com"
    settings.GOOGLE_CLIENT_ID = ""

    def fake_verify_oauth2_token(id_token, request, audience):
        if audience == "ios-secondary.apps.googleusercontent.com":
            return {"email": "google-csv@example.com", "name": "CSV User"}
        raise ValueError("audience mismatch")

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with patch("google.oauth2.id_token.verify_oauth2_token", side_effect=fake_verify_oauth2_token):
                with patch("app.api.auth._email_transport_ready", return_value=False):
                    response = await client.post(
                        "/auth/google/login",
                        json={"id_token": "dummy-token"},
                    )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["user"]["email"] == "google-csv@example.com"
        assert data["user"]["auth_provider"] == "google"
        assert data["user"]["email_verified"] is True
        assert "access_token" in data
        assert "refresh_token" in data
    finally:
        settings.GOOGLE_IOS_CLIENT_ID = original_ios
        settings.GOOGLE_CLIENT_ID = original_web


@pytest.mark.asyncio
async def test_google_login_rejects_when_all_audiences_fail(db_init):
    """Invalid token should return 401 when all configured audiences fail verification."""
    original_ios = settings.GOOGLE_IOS_CLIENT_ID
    original_web = settings.GOOGLE_CLIENT_ID

    settings.GOOGLE_IOS_CLIENT_ID = "ios-primary.apps.googleusercontent.com"
    settings.GOOGLE_CLIENT_ID = "web-client.apps.googleusercontent.com"

    def fake_verify_oauth2_token(id_token, request, audience):
        raise ValueError(f"audience mismatch: {audience}")

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with patch("google.oauth2.id_token.verify_oauth2_token", side_effect=fake_verify_oauth2_token):
                response = await client.post(
                    "/auth/google/login",
                    json={"id_token": "dummy-token"},
                )

        assert response.status_code == 401, response.text
        assert "Invalid or expired Google token" in response.json().get("detail", "")
    finally:
        settings.GOOGLE_IOS_CLIENT_ID = original_ios
        settings.GOOGLE_CLIENT_ID = original_web