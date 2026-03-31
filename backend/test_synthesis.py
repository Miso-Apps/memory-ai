"""Integration test for POST /ai/synthesize."""
import asyncio
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db


@pytest.mark.asyncio
async def test_synthesize_requires_auth():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/ai/synthesize", json={"memory_ids": ["id1", "id2"]})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_synthesize_rejects_fewer_than_two_ids():
    await init_db()
    import time
    email = f"synth_{int(time.time())}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/auth/register", json={"email": email, "password": "pass123abc", "name": "T"})
        assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        r = await client.post("/ai/synthesize", json={"memory_ids": ["only-one"]}, headers=headers)
    assert r.status_code == 400
