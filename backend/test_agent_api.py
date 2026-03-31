"""Integration tests for /agent endpoints."""
import pytest
import time
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db


@pytest.fixture(scope="function")
async def db_init():
    """Initialize database for each test."""
    await init_db()


@pytest.mark.asyncio
async def test_register_push_token(db_init):
    email = f"agent_{int(time.time() * 1000)}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/auth/register", json={"email": email, "password": "password123", "name": "T"})
        assert r.status_code == 200, f"Register failed: {r.text}"
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = await client.post(
            "/agent/notifications/register",
            json={"expo_push_token": "ExponentPushToken[test123]"},
            headers=headers,
        )
        assert r.status_code == 200, f"Register token failed: {r.text}"
        assert r.json().get("registered") is True


@pytest.mark.asyncio
async def test_get_insight_not_found(db_init):
    email = f"agent2_{int(time.time() * 1000)}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/auth/register", json={"email": email, "password": "password123", "name": "T"})
        assert r.status_code == 200, f"Register failed: {r.text}"
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = await client.get(f"/agent/insights/{uuid.uuid4()}", headers=headers)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
