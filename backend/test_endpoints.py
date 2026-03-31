"""Quick endpoint smoke tests using httpx ASGI transport."""
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.main import app
from app.database import init_db, AsyncSessionLocal


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
        user_id = r.json()["user"]["id"]
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

        # Test reflection endpoint exists and returns expected payload
        r = await client.post(
            "/ai/reflect",
            json={"thought": "test memory", "limit": 5},
            headers=headers,
        )
        print(f"POST /ai/reflect -> {r.status_code} {r.json()}")
        assert r.status_code == 200, f"reflect failed: {r.text}"
        assert "insight" in r.json(), "reflect missing insight"
        assert "related_memories" in r.json(), "reflect missing related_memories"
        assert isinstance(r.json()["related_memories"], list)

        r = await client.post(
            "/memories/",
            json={"type": "text", "content": "Reflect source memory"},
            headers=headers,
        )
        assert r.status_code == 200, f"reflect source memory create failed: {r.text}"
        reflect_memory_id = r.json().get("id")

        # Reflection should support cache by memory_id and return markdown content
        r = await client.post(
            "/ai/reflect",
            json={
                "thought": "Test memory from smoke test",
                "memory_id": reflect_memory_id,
                "limit": 5,
            },
            headers=headers,
        )
        assert r.status_code == 200, f"reflect with memory_id failed: {r.text}"
        first_reflect = r.json()
        assert isinstance(first_reflect.get("cached"), bool), "reflect missing cached flag"
        assert first_reflect.get("insight", "").startswith("## "), "reflect insight should be markdown"

        r = await client.post(
            "/ai/reflect",
            json={
                "thought": "Test memory from smoke test",
                "memory_id": reflect_memory_id,
                "limit": 5,
            },
            headers=headers,
        )
        assert r.status_code == 200, f"second reflect with memory_id failed: {r.text}"
        second_reflect = r.json()
        assert second_reflect.get("cached") is True, "second reflect call should use cache"
        assert second_reflect.get("insight") == first_reflect.get("insight")

        # Create a memory for radar tests
        r = await client.post(
            "/memories/",
            json={"type": "text", "content": "Radar test memory"},
            headers=headers,
        )
        assert r.status_code == 200, f"create memory for radar failed: {r.text}"
        radar_memory_id = r.json()["id"]

        # Duplicate link captures should return 409 + existing memory reference
        r = await client.post(
            "/memories/",
            json={"type": "link", "content": "https://example.com/duplicate-check"},
            headers=headers,
        )
        assert r.status_code == 200, f"first link create failed: {r.text}"
        first_link_id = r.json().get("id")

        r = await client.post(
            "/memories/",
            json={"type": "link", "content": "https://example.com/duplicate-check/"},
            headers=headers,
        )
        assert r.status_code == 409, f"duplicate link should return 409, got {r.status_code}"
        assert r.json().get("existing_memory_id") == first_link_id

        # Test radar feed endpoint
        r = await client.get("/ai/radar?limit=6", headers=headers)
        print(f"GET /ai/radar -> {r.status_code} keys={list(r.json().keys())}")
        assert r.status_code == 200, f"radar feed failed: {r.text}"
        assert "items" in r.json(), "radar missing items key"
        assert "generated_at" in r.json(), "radar missing generated_at key"

        # Regression test: legacy NULL proactive_recall_opt_in must not hide radar cards.
        async with AsyncSessionLocal() as db:
            await db.execute(
                text(
                    """
                    UPDATE user_preferences
                    SET proactive_recall_opt_in = NULL
                    WHERE user_id = CAST(:user_id AS UUID)
                    """
                ),
                {"user_id": user_id},
            )
            await db.commit()

        r = await client.get("/ai/radar?limit=6", headers=headers)
        assert r.status_code == 200, f"radar with NULL proactive flag failed: {r.text}"
        assert len(r.json().get("items", [])) > 0, "radar should not be empty when proactive_recall_opt_in is NULL"

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

        # Test explicit pin-to-recall endpoint
        r = await client.post(f"/memories/{radar_memory_id}/pin", headers=headers)
        print(f"POST /memories/{{id}}/pin -> {r.status_code} {r.json()}")
        assert r.status_code == 200, f"pin memory failed: {r.text}"
        assert r.json().get("reason_code") == "user_pinned"

        # Add a served event so recall-rate has denominator
        r = await client.post(
            "/ai/radar/events",
            json={
                "memory_id": radar_memory_id,
                "event_type": "served",
                "reason_code": "user_pinned",
                "confidence": 100,
                "context": {"screen": "library"},
            },
            headers=headers,
        )
        assert r.status_code == 200, f"radar served event failed: {r.text}"

        # Test recall-rate metric endpoint
        r = await client.get("/insights/recall-rate?days=30", headers=headers)
        print(f"GET /insights/recall-rate -> {r.status_code} {r.json()}")
        assert r.status_code == 200, f"recall-rate failed: {r.text}"
        assert r.json().get("served", 0) >= 1
        assert r.json().get("opened", 0) >= 1
        assert isinstance(r.json().get("recall_rate"), (int, float))

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
