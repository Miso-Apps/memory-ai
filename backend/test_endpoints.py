"""Quick endpoint smoke tests using httpx ASGI transport."""
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db


async def test():
    # Create tables before running tests
    await init_db()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test health
        r = await client.get("/health")
        print(f"GET /health -> {r.status_code} {r.json()}")
        assert r.status_code == 200, f"health failed: {r.text}"

        import time
        test_email = f"test_{int(time.time())}@example.com"

        # Test register
        r = await client.post(
            "/auth/register",
            json={"email": test_email, "password": "testpass123", "name": "Test User"},
        )
        print(f"POST /auth/register -> {r.status_code} {r.json()}")
        assert r.status_code == 200, f"register failed: {r.text}"
        assert "access_token" in r.json(), "register missing access_token"
        assert "user" in r.json(), "register missing user"
        token = r.json()["access_token"]
        assert token != "mock_access_token", "token is still a mock!"
        print(f"  ✓ Real JWT issued: {token[:40]}...")
        headers = {"Authorization": f"Bearer {token}"}

        # Test login with same credentials
        r = await client.post(
            "/auth/login",
            json={"email": test_email, "password": "testpass123"},
        )
        print(f"POST /auth/login -> {r.status_code}")
        assert r.status_code == 200, f"login failed: {r.text}"
        assert r.json()["access_token"] != "mock_access_token", "login token is mock!"

        # Test wrong password returns 401
        r = await client.post("/auth/login", json={"email": test_email, "password": "wrong"})
        assert r.status_code == 401, f"wrong password should be 401, got {r.status_code}"
        print(f"  ✓ Wrong password correctly rejected")

        # Test list memories (should start empty for new user)
        r = await client.get("/memories/", headers=headers)
        print(f"GET /memories/ -> {r.status_code} type={type(r.json()).__name__} count={len(r.json())}")
        assert r.status_code == 200, f"list memories failed: {r.text}"
        assert isinstance(r.json(), list), f"memories should be list, got {type(r.json())}"
        assert len(r.json()) == 0, "new user should have 0 memories"

        # Test create memory
        r = await client.post(
            "/memories/",
            json={"type": "text", "content": "Test memory from smoke test"},
            headers=headers,
        )
        print(f"POST /memories/ -> {r.status_code} {r.json()}")
        assert r.status_code == 200, f"create memory failed: {r.text}"
        assert r.json()["id"] != "mock_id", "memory id is still mock!"
        memory_id = r.json()["id"]
        print(f"  ✓ Real memory created with id: {memory_id}")

        # Test list now returns 1 memory
        r = await client.get("/memories/", headers=headers)
        assert len(r.json()) == 1, f"should have 1 memory after create, got {len(r.json())}"
        assert r.json()[0]["content"] == "Test memory from smoke test"
        print(f"  ✓ Memory persisted and retrieved correctly")

        # Test get single memory
        r = await client.get(f"/memories/{memory_id}", headers=headers)
        print(f"GET /memories/{memory_id[:8]}... -> {r.status_code}")
        assert r.status_code == 200, f"get memory failed: {r.text}"

        # Test delete memory
        r = await client.delete(f"/memories/{memory_id}", headers=headers)
        assert r.status_code == 200, f"delete failed: {r.text}"
        r = await client.get("/memories/", headers=headers)
        assert len(r.json()) == 0, "should have 0 memories after delete"
        print(f"  ✓ Memory deleted (soft) and no longer listed")

        # Test recall
        r = await client.get("/ai/recall", headers=headers)
        print(f"GET /ai/recall -> {r.status_code} keys={list(r.json().keys())}")
        assert r.status_code == 200, f"recall failed: {r.text}"
        assert "items" in r.json(), "recall missing items key"

        # Test search
        r = await client.get("/ai/search?q=test", headers=headers)
        print(f"GET /ai/search?q=test -> {r.status_code} keys={list(r.json().keys())}")
        assert r.status_code == 200, f"search failed: {r.text}"

        print()
        print("=" * 40)
        print("All endpoint tests PASSED!")
        print("=" * 40)


if __name__ == "__main__":
    asyncio.run(test())
