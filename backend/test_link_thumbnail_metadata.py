import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.database import init_db
import app.api.memories as memories_api


@pytest.mark.asyncio
async def test_link_create_enriches_thumbnail_metadata(monkeypatch):
    async def fake_fetch_link_content(url: str):
        return {
            "url": url,
            "title": "Stub title",
            "description": "Stub description",
            "sitename": "StubSite",
            "image": "https://example.com/preview.jpg",
        }

    monkeypatch.setattr(memories_api, "fetch_link_content", fake_fetch_link_content)

    await init_db()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"thumb_{int(time.time())}@example.com"
        register_res = await client.post(
            "/auth/register",
            json={"email": email, "password": "testpass123", "name": "Thumb Test"},
        )
        assert register_res.status_code == 200, register_res.text

        token = register_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        create_res = await client.post(
            "/memories/",
            json={"type": "link", "content": "https://example.com/article"},
            headers=headers,
        )
        assert create_res.status_code == 200, create_res.text

        metadata = create_res.json().get("metadata") or {}

        assert metadata.get("og_image") == "https://example.com/preview.jpg"
        assert metadata.get("preview_image_url") == "https://example.com/preview.jpg"
        assert metadata.get("thumbnail_url") == "https://example.com/preview.jpg"
        assert metadata.get("canonical_url") == "https://example.com/article"
