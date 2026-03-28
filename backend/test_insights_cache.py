import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.database import init_db
import app.api.insights as insights_api


@pytest.mark.asyncio
async def test_weekly_recap_uses_cache(monkeypatch):
    await init_db()

    call_count = {"count": 0}

    async def fake_generate_weekly_recap(*args, **kwargs):
        call_count["count"] += 1
        return "Cached recap text"

    monkeypatch.setattr(insights_api, "_generate_weekly_recap", fake_generate_weekly_recap)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"insights_cache_{int(time.time())}@example.com"
        reg_res = await client.post(
            "/auth/register",
            json={"email": email, "password": "testpass123", "name": "Insights Cache"},
        )
        assert reg_res.status_code == 200, reg_res.text

        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        create_res = await client.post(
            "/memories/",
            json={"type": "text", "content": "Weekly recap cache test memory"},
            headers=headers,
        )
        assert create_res.status_code == 200, create_res.text

        first = await client.get("/insights/weekly-recap", headers=headers)
        assert first.status_code == 200, first.text
        first_payload = first.json()

        second = await client.get("/insights/weekly-recap", headers=headers)
        assert second.status_code == 200, second.text
        second_payload = second.json()

        assert first_payload["recap"] == "Cached recap text"
        assert second_payload["recap"] == "Cached recap text"
        assert call_count["count"] == 1
