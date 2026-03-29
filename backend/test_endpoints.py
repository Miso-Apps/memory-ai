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
        payload = r.json()
        print(
            f"GET /memories/ -> {r.status_code} keys={list(payload.keys())} count={len(payload.get('memories', []))}"
        )
        assert r.status_code == 200, f"list memories failed: {r.text}"
        assert isinstance(payload, dict), f"memories should be object, got {type(payload)}"
        assert "memories" in payload, "memories list key missing"
        assert "total" in payload, "total key missing"
        assert payload["total"] == 0, "new user should have 0 memories"
        assert len(payload["memories"]) == 0, "new user should have 0 memories"

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
        payload = r.json()
        assert payload["total"] == 1, f"should have total=1 after create, got {payload.get('total')}"
        assert len(payload["memories"]) == 1, f"should have 1 memory after create, got {len(payload['memories'])}"
        assert payload["memories"][0]["content"] == "Test memory from smoke test"
        print(f"  ✓ Memory persisted and retrieved correctly")

        # Test get single memory
        r = await client.get(f"/memories/{memory_id}", headers=headers)
        print(f"GET /memories/{memory_id[:8]}... -> {r.status_code}")
        assert r.status_code == 200, f"get memory failed: {r.text}"

        # Test delete memory
        r = await client.delete(f"/memories/{memory_id}", headers=headers)
        assert r.status_code == 200, f"delete failed: {r.text}"
        r = await client.get("/memories/", headers=headers)
        payload = r.json()
        assert payload["total"] == 0, "should have total=0 memories after delete"
        assert len(payload["memories"]) == 0, "should have 0 memories after delete"
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

        # Create a memory for radar tests
        r = await client.post(
            "/memories/",
            json={"type": "text", "content": "Radar test memory"},
            headers=headers,
        )
        assert r.status_code == 200, f"create memory for radar failed: {r.text}"
        radar_memory_id = r.json()["id"]

        # Test radar feed endpoint
        r = await client.get("/ai/radar?limit=6", headers=headers)
        print(f"GET /ai/radar -> {r.status_code} keys={list(r.json().keys())}")
        assert r.status_code == 200, f"radar feed failed: {r.text}"
        assert "items" in r.json(), "radar missing items key"
        assert "generated_at" in r.json(), "radar missing generated_at key"

        # Test radar feed with preference sensitivity update
        r = await client.put(
            "/preferences/",
            json={"recall_sensitivity": "low"},
            headers=headers,
        )
        assert r.status_code == 200, f"preferences update failed: {r.text}"
        assert r.json().get("recall_sensitivity") == "low"

        r = await client.get("/ai/radar?limit=3", headers=headers)
        assert r.status_code == 200, f"radar after sensitivity update failed: {r.text}"
        assert isinstance(r.json().get("items"), list), "radar items should be a list"

        # Test radar event logging
        r = await client.post(
            "/ai/radar/events",
            json={
                "memory_id": radar_memory_id,
                "event_type": "opened",
                "reason_code": "recently_saved",
                "confidence": 78,
                "context": {"screen": "recall"},
            },
            headers=headers,
        )
        print(f"POST /ai/radar/events -> {r.status_code} {r.json()}")
        assert r.status_code == 200, f"radar event logging failed: {r.text}"
        assert r.json().get("status") == "ok"
        assert "event_id" in r.json()

        # Test invalid radar event type validation
        r = await client.post(
            "/ai/radar/events",
            json={
                "memory_id": radar_memory_id,
                "event_type": "invalid",
            },
            headers=headers,
        )
        assert r.status_code == 422, f"invalid radar event should be 422, got {r.status_code}"

        # Test decision replay lifecycle
        r = await client.post(
            "/decisions/",
            json={
                "title": "Adopt weekly review ritual",
                "rationale": "Need better recall discipline",
                "expected_outcome": "Higher weekly recall usage",
            },
            headers=headers,
        )
        print(f"POST /decisions/ -> {r.status_code} {r.json()}")
        assert r.status_code == 200, f"create decision failed: {r.text}"
        decision_id = r.json()["id"]
        assert r.json()["status"] == "open"

        r = await client.get("/decisions/?status=open", headers=headers)
        assert r.status_code == 200, f"list decisions failed: {r.text}"
        assert r.json().get("total", 0) >= 1, "expected at least one open decision"

        r = await client.patch(
            f"/decisions/{decision_id}",
            json={"status": "reviewed"},
            headers=headers,
        )
        assert r.status_code == 200, f"update decision failed: {r.text}"
        assert r.json().get("status") == "reviewed"

        r = await client.post(
            f"/decisions/{decision_id}/review",
            json={"status": "archived"},
            headers=headers,
        )
        assert r.status_code == 200, f"review decision failed: {r.text}"
        assert r.json().get("status") == "archived"

        # Test explicit memory links
        r = await client.post(
            "/memories/",
            json={"type": "text", "content": "Source memory for link"},
            headers=headers,
        )
        assert r.status_code == 200, f"source memory create failed: {r.text}"
        source_memory_id = r.json()["id"]

        r = await client.post(
            "/memories/",
            json={"type": "text", "content": "Target memory for link"},
            headers=headers,
        )
        assert r.status_code == 200, f"target memory create failed: {r.text}"
        target_memory_id = r.json()["id"]

        r = await client.post(
            f"/memories/{source_memory_id}/links",
            json={
                "target_memory_id": target_memory_id,
                "link_type": "explicit",
                "explanation": "Directly connected decision context",
            },
            headers=headers,
        )
        print(f"POST /memories/{{id}}/links -> {r.status_code} {r.json()}")
        assert r.status_code == 200, f"create memory link failed: {r.text}"

        r = await client.get(f"/memories/{source_memory_id}/links", headers=headers)
        assert r.status_code == 200, f"list memory links failed: {r.text}"
        assert len(r.json()) >= 1, "expected at least one explicit link"

        r = await client.get(f"/insights/related/{source_memory_id}", headers=headers)
        assert r.status_code == 200, f"related with explicit links failed: {r.text}"
        assert r.json().get("total", 0) >= 1, "expected related memories"

        r = await client.post(
            "/insights/related/events",
            json={
                "memory_id": target_memory_id,
                "event_type": "related_click",
                "reason_code": "manual_link_click",
                "context": {"source_memory_id": source_memory_id},
            },
            headers=headers,
        )
        assert r.status_code == 200, f"track related event failed: {r.text}"
        assert r.json().get("status") == "ok"

        r = await client.delete(
            f"/memories/{source_memory_id}/links/{target_memory_id}",
            headers=headers,
        )
        assert r.status_code == 200, f"delete memory link failed: {r.text}"
        assert r.json().get("status") == "deleted"

        print()
        print("=" * 40)
        print("All endpoint tests PASSED!")
        print("=" * 40)


if __name__ == "__main__":
    asyncio.run(test())
