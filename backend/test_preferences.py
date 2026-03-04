"""Test preferences endpoints - verifies MissingGreenlet fix."""
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db


async def test():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        import time
        email = f"preftest_{int(time.time())}@example.com"
        r = await client.post("/auth/register", json={"email": email, "password": "testpass123", "name": "Test"})
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # GET preferences
        r = await client.get("/preferences/", headers=headers)
        print(f"GET /preferences/ -> {r.status_code}")
        assert r.status_code == 200

        # PUT preferences (this was causing 500 MissingGreenlet)
        r = await client.put("/preferences/", headers=headers, json={"theme_mode": "dark"})
        print(f"PUT /preferences/ theme_mode=dark -> {r.status_code} theme={r.json().get('theme_mode')}")
        assert r.status_code == 200, f"PUT failed: {r.text}"
        assert r.json()["theme_mode"] == "dark"

        r = await client.put("/preferences/", headers=headers, json={"language": "vi"})
        print(f"PUT /preferences/ language=vi -> {r.status_code} lang={r.json().get('language')}")
        assert r.status_code == 200, f"PUT failed: {r.text}"
        assert r.json()["language"] == "vi"

        # Reset
        r = await client.post("/preferences/reset", headers=headers)
        print(f"POST /preferences/reset -> {r.status_code} theme={r.json().get('theme_mode')}")
        assert r.status_code == 200, f"Reset failed: {r.text}"
        assert r.json()["theme_mode"] == "auto"

        print()
        print("=" * 40)
        print("All preferences tests PASSED!")
        print("=" * 40)


if __name__ == "__main__":
    asyncio.run(test())
