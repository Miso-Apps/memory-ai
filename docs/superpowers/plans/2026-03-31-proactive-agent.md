# Proactive Memory Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proactive AI agent that detects patterns across memories (Intention Loop, Arc, Tension Detector), delivers push notifications that open directly into a pre-loaded AI chat, and adds a Synthesize button in the Library for on-demand multi-memory synthesis.

**Architecture:** Hybrid — event-driven intention extraction on every memory save (GPT-4o-mini background task), nightly APScheduler cron for Arc and Tension scans, Expo push notifications routed through the backend, and on-demand synthesis called from the mobile Library screen. All notifications land in the existing Chat screen with the agent's finding pre-loaded as the first message.

**Tech Stack:** Python FastAPI, SQLAlchemy async, PostgreSQL/pgvector, APScheduler, httpx (Expo push API), OpenAI GPT-4o/4o-mini, React Native Expo, expo-notifications, TypeScript.

---

## File Map

**New backend files:**
- `backend/app/models/intention.py` — SQLAlchemy Intention model
- `backend/app/models/agent_insight.py` — SQLAlchemy AgentInsight model
- `backend/app/models/device_token.py` — SQLAlchemy DeviceToken model
- `backend/app/services/agent_service.py` — GPT calls: extract_intention, synthesize_memories, detect_tension, synthesize_arc
- `backend/app/services/notification_service.py` — Expo push API sender
- `backend/app/tasks/agent_scan.py` — nightly cron: Arc + Tension + Intention Loop follow-up
- `backend/app/api/agent.py` — REST routes: GET insight, POST open/dismiss, POST register token

**Modified backend files:**
- `backend/app/api/memories.py` — add `_extract_and_save_intention` background task
- `backend/app/api/ai.py` — add `POST /ai/synthesize` endpoint
- `backend/app/main.py` — register agent router, start APScheduler
- `backend/requirements.txt` — add `apscheduler>=3.10.0,<4.0.0`

**New test files:**
- `backend/test_agent_service.py` — unit tests for GPT-calling functions (mocked)
- `backend/test_agent_scan.py` — unit tests for clustering and scan logic
- `backend/test_agent_api.py` — integration tests for agent endpoints

**Modified mobile files:**
- `mobile/app/_layout.tsx` — push token registration + notification tap handler
- `mobile/app/(tabs)/library.tsx` — Synthesize button, selection mode, bottom action bar
- `mobile/app/(tabs)/chat.tsx` — handle `agent_insight_id` and `synthesis_ids` params
- `mobile/services/api.ts` — add agentApi and synthesizeMemories
- `mobile/i18n/locales/en.ts` — new strings
- `mobile/i18n/locales/vi.ts` — new strings

---

## Task 1: New SQLAlchemy Models

**Files:**
- Create: `backend/app/models/intention.py`
- Create: `backend/app/models/agent_insight.py`
- Create: `backend/app/models/device_token.py`

The app uses `Base.metadata.create_all` on startup — no Alembic needed. Just create the model files and import them so SQLAlchemy registers them.

- [ ] **Step 1: Create the Intention model**

```python
# backend/app/models/intention.py
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Intention(Base):
    __tablename__ = "intentions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    memory_id = Column(UUID(as_uuid=True), ForeignKey("memories.id", ondelete="CASCADE"), nullable=False)
    extracted = Column(Text, nullable=False)
    follow_up_at = Column(DateTime(timezone=True), nullable=False)
    notified_at = Column(DateTime(timezone=True), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Create the AgentInsight model**

```python
# backend/app/models/agent_insight.py
import uuid
from sqlalchemy import Column, Text, String, DateTime, ARRAY, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class AgentInsight(Base):
    __tablename__ = "agent_insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    insight_type = Column(String(32), nullable=False)  # 'intention_loop' | 'arc' | 'tension'
    title = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    synthesis = Column(Text, nullable=False)      # full agent message shown in chat
    memory_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False)
    queued_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 3: Create the DeviceToken model**

```python
# backend/app/models/device_token.py
import uuid
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    expo_push_token = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

- [ ] **Step 4: Import new models in main.py so create_all registers them**

Add these imports at the top of `backend/app/main.py`, after the existing imports:

```python
# Register new models so Base.metadata.create_all picks them up
import app.models.intention  # noqa: F401
import app.models.agent_insight  # noqa: F401
import app.models.device_token  # noqa: F401
```

- [ ] **Step 5: Verify tables are created on startup**

```bash
cd backend && source venv/bin/activate
python -c "
import asyncio
from app.main import app  # triggers imports
from app.database import init_db
asyncio.run(init_db())
print('Tables created OK')
"
```

Expected: `Tables created OK` with no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/intention.py backend/app/models/agent_insight.py \
        backend/app/models/device_token.py backend/app/main.py
git commit -m "feat(agent): add Intention, AgentInsight, DeviceToken models"
```

---

## Task 2: agent_service.py — Core AI Functions

**Files:**
- Create: `backend/app/services/agent_service.py`
- Create: `backend/test_agent_service.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/test_agent_service.py
"""Unit tests for agent_service — all OpenAI calls are mocked."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_extract_intention_returns_text_when_found():
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "start learning Spanish"
    with patch("app.services.agent_service.AsyncOpenAI") as MockClient:
        MockClient.return_value.chat.completions.create = AsyncMock(return_value=mock_resp)
        from app.services import agent_service
        result = await agent_service.extract_intention("I should start learning Spanish this month")
    assert result == "start learning Spanish"


@pytest.mark.asyncio
async def test_extract_intention_returns_none_when_not_found():
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "NONE"
    with patch("app.services.agent_service.AsyncOpenAI") as MockClient:
        MockClient.return_value.chat.completions.create = AsyncMock(return_value=mock_resp)
        from app.services import agent_service
        result = await agent_service.extract_intention("The weather was nice today")
    assert result is None


@pytest.mark.asyncio
async def test_detect_tension_returns_true_for_contradiction():
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "YES"
    with patch("app.services.agent_service.AsyncOpenAI") as MockClient:
        MockClient.return_value.chat.completions.create = AsyncMock(return_value=mock_resp)
        from app.services import agent_service
        result = await agent_service.detect_tension("I want to quit my job", "I love my job and plan to stay")
    assert result is True


@pytest.mark.asyncio
async def test_detect_tension_returns_false_when_aligned():
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "NO"
    with patch("app.services.agent_service.AsyncOpenAI") as MockClient:
        MockClient.return_value.chat.completions.create = AsyncMock(return_value=mock_resp)
        from app.services import agent_service
        result = await agent_service.detect_tension("Exercise is good", "I should exercise more")
    assert result is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && source venv/bin/activate
pytest test_agent_service.py -v
```

Expected: errors like `ModuleNotFoundError: No module named 'app.services.agent_service'`

- [ ] **Step 3: Create agent_service.py**

```python
# backend/app/services/agent_service.py
"""Agent AI functions: intention extraction, synthesis, tension detection."""
import logging
from typing import Optional
from openai import AsyncOpenAI
from app.config import settings

log = logging.getLogger(__name__)


def _has_valid_key() -> bool:
    return bool(settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("sk-fake"))


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def extract_intention(content: str) -> Optional[str]:
    """Return the extracted intention phrase, or None if no intention found."""
    if not _has_valid_key():
        return None
    try:
        resp = await _client().chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=100,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You extract intentions from text. "
                        "An intention is a first-person statement of future action: "
                        "'I should', 'I want to', 'I need to', 'I plan to', 'I'm going to', "
                        "'I will', 'I must', 'I'd like to'. "
                        "If the text contains an intention, return ONLY the extracted intention phrase (max 80 chars). "
                        "If no intention, return NONE."
                    ),
                },
                {"role": "user", "content": content[:500]},
            ],
        )
        result = resp.choices[0].message.content.strip()
        if not result or result.upper() == "NONE":
            return None
        return result[:200]
    except Exception as exc:
        log.warning("extract_intention failed: %s", exc)
        return None


async def detect_tension(content1: str, content2: str) -> bool:
    """Return True if the two memory contents express contradictory stances."""
    if not _has_valid_key():
        return False
    try:
        resp = await _client().chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=10,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Do these two memories express opposing views, contradictory decisions, "
                        "or conflicting stances on the same topic? Reply only YES or NO."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Memory 1: {content1[:300]}\n\nMemory 2: {content2[:300]}",
                },
            ],
        )
        return resp.choices[0].message.content.strip().upper().startswith("YES")
    except Exception as exc:
        log.warning("detect_tension failed: %s", exc)
        return False


async def synthesize_arc(summaries: list[str], language: str = "en") -> str:
    """Synthesize a narrative from a cluster of related memory summaries."""
    lang_note = "Respond in Vietnamese." if language == "vi" else "Respond in English."
    bullets = "\n".join(f"- {s[:200]}" for s in summaries)
    try:
        resp = await _client().chat.completions.create(
            model="gpt-4o",
            temperature=0.3,
            max_tokens=300,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a thoughtful personal memory assistant. {lang_note} "
                        "Given a set of memories a person has saved over recent weeks, "
                        "write 2-3 sentences identifying the theme they've been exploring "
                        "and where their thinking seems to have landed. Be warm but direct. "
                        "End with one open question they haven't answered yet."
                    ),
                },
                {"role": "user", "content": f"Memories:\n{bullets}"},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        log.warning("synthesize_arc failed: %s", exc)
        return "I noticed a recurring theme in your recent memories."


async def synthesize_memories(contents: list[str], language: str = "en") -> str:
    """On-demand synthesis of user-selected memories."""
    lang_note = "Respond in Vietnamese." if language == "vi" else "Respond in English."
    bullets = "\n".join(f"- {c[:300]}" for c in contents)
    try:
        resp = await _client().chat.completions.create(
            model="gpt-4o",
            temperature=0.3,
            max_tokens=350,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a thoughtful personal memory assistant. {lang_note} "
                        "Given a set of memories the user selected, identify: "
                        "1) what they have in common, "
                        "2) any tensions or contradictions between them, "
                        "3) the key insight that connects them. "
                        "Be concise (3-5 sentences). Do not list bullet points — write as flowing prose."
                    ),
                },
                {"role": "user", "content": f"Selected memories:\n{bullets}"},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        log.warning("synthesize_memories failed: %s", exc)
        return "Here's what connects these memories."
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && source venv/bin/activate
pytest test_agent_service.py -v
```

Expected: 4 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/agent_service.py backend/test_agent_service.py
git commit -m "feat(agent): add agent_service with intention extraction, tension detection, synthesis"
```

---

## Task 3: Wire Intention Extraction into Memory Save

**Files:**
- Modify: `backend/app/api/memories.py`

- [ ] **Step 1: Write failing test**

```python
# backend/test_agent_scan.py  (create this file — more tests added in Task 7)
"""Tests for agent scan logic and integration."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_extract_and_save_intention_stores_when_found():
    """_extract_and_save_intention should insert an Intention row when GPT finds one."""
    import uuid
    from unittest.mock import AsyncMock, patch, MagicMock

    memory_id = uuid.uuid4()
    user_id = uuid.uuid4()

    with patch("app.services.agent_service.extract_intention", new=AsyncMock(return_value="learn Spanish")):
        with patch("app.api.memories.AsyncSessionLocal") as MockSession:
            mock_db = AsyncMock()
            MockSession.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            MockSession.return_value.__aexit__ = AsyncMock(return_value=False)

            from app.api.memories import _extract_and_save_intention
            await _extract_and_save_intention(memory_id, user_id, "I should learn Spanish")

            mock_db.add.assert_called_once()
            mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_extract_and_save_intention_skips_when_none():
    """_extract_and_save_intention should not insert when no intention found."""
    import uuid
    from unittest.mock import AsyncMock, patch

    memory_id = uuid.uuid4()
    user_id = uuid.uuid4()

    with patch("app.services.agent_service.extract_intention", new=AsyncMock(return_value=None)):
        with patch("app.api.memories.AsyncSessionLocal") as MockSession:
            mock_db = AsyncMock()
            MockSession.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            MockSession.return_value.__aexit__ = AsyncMock(return_value=False)

            from app.api.memories import _extract_and_save_intention
            await _extract_and_save_intention(memory_id, user_id, "The weather was nice")

            mock_db.add.assert_not_called()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && source venv/bin/activate
pytest test_agent_scan.py::test_extract_and_save_intention_stores_when_found \
       test_agent_scan.py::test_extract_and_save_intention_skips_when_none -v
```

Expected: `ImportError` — `_extract_and_save_intention` does not exist yet.

- [ ] **Step 3: Add the background task function to memories.py**

Find the block of existing background task functions near line 198 in `backend/app/api/memories.py` (after `_generate_and_save_embedding`). Add this function:

```python
async def _extract_and_save_intention(
    memory_id: uuid.UUID, user_id: uuid.UUID, content: str
) -> None:
    """Background task: extract intention from memory content and persist silently."""
    from datetime import timedelta
    from app.models.intention import Intention
    from app.services import agent_service

    extracted = await agent_service.extract_intention(content)
    if not extracted:
        return

    async with AsyncSessionLocal() as db:
        try:
            intention = Intention(
                user_id=user_id,
                memory_id=memory_id,
                extracted=extracted,
                follow_up_at=datetime.now(timezone.utc) + timedelta(days=21),
            )
            db.add(intention)
            await db.commit()
            log.info("Intention stored for memory %s: %.60s", memory_id, extracted)
        except Exception as exc:
            log.warning("Failed to store intention for memory %s: %s", memory_id, exc)
```

- [ ] **Step 4: Wire the background task into create_memory**

In `create_memory`, after the existing `background_tasks.add_task(_classify_and_save_category, ...)` line (around line 330), add:

```python
    background_tasks.add_task(
        _extract_and_save_intention, m.id, current_user.id, summary_content
    )
```

- [ ] **Step 5: Run tests**

```bash
cd backend && source venv/bin/activate
pytest test_agent_scan.py::test_extract_and_save_intention_stores_when_found \
       test_agent_scan.py::test_extract_and_save_intention_skips_when_none -v
```

Expected: 2 tests PASSED.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/memories.py backend/test_agent_scan.py
git commit -m "feat(agent): wire intention extractor into memory save pipeline"
```

---

## Task 4: POST /ai/synthesize Endpoint

**Files:**
- Modify: `backend/app/api/ai.py`
- Create: `backend/test_synthesis.py`

- [ ] **Step 1: Write failing test**

```python
# backend/test_synthesis.py
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
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_synthesize_rejects_fewer_than_two_ids():
    await init_db()
    import time
    email = f"synth_{int(time.time())}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/auth/register", json={"email": email, "password": "pass123", "name": "T"})
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        r = await client.post("/ai/synthesize", json={"memory_ids": ["only-one"]}, headers=headers)
    assert r.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && source venv/bin/activate
pytest test_synthesis.py -v
```

Expected: `test_synthesize_requires_auth` — FAIL (404, route doesn't exist). `test_synthesize_rejects_fewer_than_two_ids` — FAIL similarly.

- [ ] **Step 3: Add SynthesizeRequest schema and endpoint to ai.py**

Add near the top of `backend/app/api/ai.py`, alongside the other `class XRequest(BaseModel)` definitions:

```python
class SynthesizeRequest(BaseModel):
    memory_ids: List[str]
```

Add the endpoint near the end of `backend/app/api/ai.py` (before the last helper functions):

```python
@router.post("/synthesize", response_model=dict)
async def synthesize_memories(
    body: SynthesizeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Synthesize 2–20 user-selected memories into a single AI insight."""
    if len(body.memory_ids) < 2 or len(body.memory_ids) > 20:
        raise HTTPException(status_code=400, detail="Provide 2–20 memory IDs")

    try:
        ids = [uuid.UUID(mid) for mid in body.memory_ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memory ID format")

    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id.in_(ids),
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,  # noqa: E712
            )
        )
    )
    memories = result.scalars().all()
    if len(memories) < 2:
        raise HTTPException(status_code=404, detail="Not enough accessible memories found")

    contents = [m.ai_summary or m.content for m in memories]
    language = await _get_user_language(request, db, current_user.id)

    from app.services import agent_service
    synthesis = await agent_service.synthesize_memories(contents, language)

    return {
        "synthesis": synthesis,
        "memory_ids": [str(m.id) for m in memories],
    }
```

- [ ] **Step 4: Run tests**

```bash
cd backend && source venv/bin/activate
pytest test_synthesis.py -v
```

Expected: 2 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/ai.py backend/test_synthesis.py
git commit -m "feat(agent): add POST /ai/synthesize endpoint"
```

---

## Task 5: Agent Router (Insight Fetch + Token Registration)

**Files:**
- Create: `backend/app/api/agent.py`
- Modify: `backend/app/main.py`
- Modify: `backend/test_agent_api.py` (create)

- [ ] **Step 1: Write failing tests**

```python
# backend/test_agent_api.py
"""Integration tests for /agent endpoints."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db


@pytest.mark.asyncio
async def test_register_push_token():
    await init_db()
    import time
    email = f"agent_{int(time.time())}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/auth/register", json={"email": email, "password": "pass123", "name": "T"})
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = await client.post(
            "/agent/notifications/register",
            json={"expo_push_token": "ExponentPushToken[test123]"},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json().get("registered") is True


@pytest.mark.asyncio
async def test_get_insight_not_found():
    await init_db()
    import time, uuid
    email = f"agent2_{int(time.time())}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/auth/register", json={"email": email, "password": "pass123", "name": "T"})
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = await client.get(f"/agent/insights/{uuid.uuid4()}", headers=headers)
        assert r.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && source venv/bin/activate
pytest test_agent_api.py -v
```

Expected: FAIL — `/agent/...` routes don't exist (404).

- [ ] **Step 3: Create agent.py router**

```python
# backend/app/api/agent.py
"""Agent API: insight retrieval, push token registration."""
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.agent_insight import AgentInsight
from app.models.device_token import DeviceToken

router = APIRouter()
log = logging.getLogger(__name__)


class RegisterTokenRequest(BaseModel):
    expo_push_token: str


@router.post("/notifications/register", response_model=dict)
async def register_push_token(
    body: RegisterTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register or update an Expo push token for this user."""
    result = await db.execute(
        select(DeviceToken).where(DeviceToken.expo_push_token == body.expo_push_token)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.user_id = current_user.id  # re-claim if token was from another account
    else:
        db.add(DeviceToken(user_id=current_user.id, expo_push_token=body.expo_push_token))
    await db.commit()
    return {"registered": True}


@router.get("/insights/{insight_id}", response_model=dict)
async def get_agent_insight(
    insight_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a pre-generated agent insight for display in the chat screen."""
    try:
        iid = uuid.UUID(insight_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid insight ID")

    result = await db.execute(
        select(AgentInsight).where(
            and_(AgentInsight.id == iid, AgentInsight.user_id == current_user.id)
        )
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    return {
        "id": str(insight.id),
        "insight_type": insight.insight_type,
        "title": insight.title,
        "body": insight.body,
        "synthesis": insight.synthesis,
        "memory_ids": [str(mid) for mid in (insight.memory_ids or [])],
    }


@router.post("/insights/{insight_id}/open", response_model=dict)
async def mark_insight_opened(
    insight_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        iid = uuid.UUID(insight_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid insight ID")

    result = await db.execute(
        select(AgentInsight).where(
            and_(AgentInsight.id == iid, AgentInsight.user_id == current_user.id)
        )
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    if not insight.opened_at:
        insight.opened_at = datetime.now(timezone.utc)
        await db.commit()
    return {"ok": True}


@router.post("/insights/{insight_id}/dismiss", response_model=dict)
async def dismiss_insight(
    insight_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        iid = uuid.UUID(insight_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid insight ID")

    result = await db.execute(
        select(AgentInsight).where(
            and_(AgentInsight.id == iid, AgentInsight.user_id == current_user.id)
        )
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    insight.dismissed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Register the agent router in main.py**

In `backend/app/main.py`, add to the imports:

```python
from app.api import auth, memories, ai, storage, categories, preferences, insights, decisions, agent
```

And add the router registration after the existing `app.include_router(decisions.router, ...)` line:

```python
app.include_router(agent.router, prefix="/agent", tags=["Agent"])
```

- [ ] **Step 5: Run tests**

```bash
cd backend && source venv/bin/activate
pytest test_agent_api.py -v
```

Expected: 2 tests PASSED.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/agent.py backend/app/main.py backend/test_agent_api.py
git commit -m "feat(agent): add agent router — insight fetch, push token registration"
```

---

## Task 6: Notification Service (Expo Push)

**Files:**
- Create: `backend/app/services/notification_service.py`

No new tests needed — this wraps an external HTTP call (Expo push API). Tested via integration when the scanner runs.

- [ ] **Step 1: Create notification_service.py**

```python
# backend/app/services/notification_service.py
"""Send Expo push notifications to registered device tokens."""
import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.device_token import DeviceToken

log = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_to_user(db: AsyncSession, user_id, title: str, body: str, data: dict) -> bool:
    """
    Send a push notification to all registered devices for a user.
    Returns True if at least one message was sent successfully.
    """
    result = await db.execute(
        select(DeviceToken).where(DeviceToken.user_id == user_id)
    )
    tokens = result.scalars().all()
    if not tokens:
        log.debug("No push tokens for user %s — skipping notification", user_id)
        return False

    messages = [
        {
            "to": dt.expo_push_token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default",
        }
        for dt in tokens
    ]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
        resp.raise_for_status()
        log.info("Push sent to user %s (%d device(s))", user_id, len(tokens))
        return True
    except Exception as exc:
        log.warning("Push notification failed for user %s: %s", user_id, exc)
        return False
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/notification_service.py
git commit -m "feat(agent): add Expo push notification service"
```

---

## Task 7: APScheduler Setup + Nightly Agent Scan

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/tasks/agent_scan.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add APScheduler to requirements**

In `backend/requirements.txt`, add after the Celery line:

```
apscheduler>=3.10.0,<4.0.0
```

- [ ] **Step 2: Install it**

```bash
cd backend && source venv/bin/activate
pip install "apscheduler>=3.10.0,<4.0.0"
```

Expected: `Successfully installed apscheduler-3.x.x`

- [ ] **Step 3: Write failing tests for scan helpers**

Add to `backend/test_agent_scan.py` (the file created in Task 3):

```python
def test_cosine_similarity_same_vector():
    from app.tasks.agent_scan import _cosine_sim
    v = [1.0, 0.0, 0.0]
    assert abs(_cosine_sim(v, v) - 1.0) < 1e-6


def test_cosine_similarity_orthogonal_vectors():
    from app.tasks.agent_scan import _cosine_sim
    assert abs(_cosine_sim([1.0, 0.0], [0.0, 1.0])) < 1e-6


def test_cluster_embeddings_groups_similar():
    from app.tasks.agent_scan import _cluster_embeddings
    from unittest.mock import MagicMock

    def make_mem(emb):
        m = MagicMock()
        m.embedding = emb
        return m

    # Two very similar, one orthogonal
    m1 = make_mem([1.0, 0.01])
    m2 = make_mem([1.0, 0.02])
    m3 = make_mem([0.0, 1.0])
    clusters = _cluster_embeddings([m1, m2, m3], threshold=0.95)
    # m1 and m2 should be in one cluster; m3 in another
    assert len(clusters) == 2
    sizes = sorted(len(c) for c in clusters)
    assert sizes == [1, 2]
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd backend && source venv/bin/activate
pytest test_agent_scan.py::test_cosine_similarity_same_vector \
       test_agent_scan.py::test_cosine_similarity_orthogonal_vectors \
       test_agent_scan.py::test_cluster_embeddings_groups_similar -v
```

Expected: `ImportError` — `app.tasks.agent_scan` doesn't exist yet.

- [ ] **Step 5: Create backend/app/tasks/__init__.py**

```bash
mkdir -p backend/app/tasks && touch backend/app/tasks/__init__.py
```

- [ ] **Step 6: Create agent_scan.py**

```python
# backend/app/tasks/agent_scan.py
"""
Nightly agent scan: Arc detection, Tension detection, Intention Loop follow-up.
Run via APScheduler (see main.py). Each section is independent — failures in one
do not block the others.
"""
import logging
import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.memory import Memory
from app.models.intention import Intention
from app.models.agent_insight import AgentInsight
from app.services import agent_service, notification_service

log = logging.getLogger(__name__)

# ─── Math helpers ─────────────────────────────────────────────────────────────

def _cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _cluster_embeddings(memories: list, threshold: float = 0.82) -> list[list]:
    """Greedy cosine-similarity clustering."""
    clusters: list[list] = []
    assigned: set[int] = set()
    for i, m in enumerate(memories):
        if i in assigned or not m.embedding:
            continue
        cluster = [m]
        assigned.add(i)
        for j, n in enumerate(memories):
            if j <= i or j in assigned or not n.embedding:
                continue
            if _cosine_sim(m.embedding, n.embedding) >= threshold:
                cluster.append(n)
                assigned.add(j)
        clusters.append(cluster)
    return clusters


# ─── Frequency cap ────────────────────────────────────────────────────────────

async def _user_notified_recently(db: AsyncSession, user_id) -> bool:
    """Return True if user received an agent insight notification in last 24h."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await db.execute(
        select(AgentInsight).where(
            and_(
                AgentInsight.user_id == user_id,
                AgentInsight.sent_at >= cutoff,
            )
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _queue_and_send(
    db: AsyncSession,
    user_id,
    insight_type: str,
    title: str,
    body: str,
    synthesis: str,
    memory_ids: list,
) -> None:
    """Persist insight and send push notification."""
    insight = AgentInsight(
        user_id=user_id,
        insight_type=insight_type,
        title=title,
        body=body,
        synthesis=synthesis,
        memory_ids=memory_ids,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(insight)
    await db.flush()  # get insight.id before commit

    await notification_service.send_push_to_user(
        db,
        user_id,
        title=title,
        body=body,
        data={"agent_insight_id": str(insight.id)},
    )
    await db.commit()
    log.info("Queued %s insight for user %s", insight_type, user_id)


# ─── Arc Detector ─────────────────────────────────────────────────────────────

async def _scan_arc(db: AsyncSession, user_id) -> bool:
    """
    Find memory clusters with 5+ members in an 8-week window.
    Fire at most one Arc notification per cluster (tracked by memory_ids overlap).
    Returns True if a notification was sent.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(weeks=8)
    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.is_deleted == False,  # noqa: E712
                Memory.created_at >= cutoff,
                Memory.embedding.isnot(None),
            )
        )
    )
    memories = result.scalars().all()
    if len(memories) < 5:
        return False

    clusters = _cluster_embeddings(memories, threshold=0.82)
    large_clusters = [c for c in clusters if len(c) >= 5]
    if not large_clusters:
        return False

    # Check which clusters have already been notified (by memory_ids overlap)
    sent_result = await db.execute(
        select(AgentInsight).where(
            and_(
                AgentInsight.user_id == user_id,
                AgentInsight.insight_type == "arc",
            )
        )
    )
    sent_insights = sent_result.scalars().all()
    already_notified_ids: set[str] = set()
    for s in sent_insights:
        already_notified_ids.update(str(mid) for mid in (s.memory_ids or []))

    for cluster in sorted(large_clusters, key=len, reverse=True):
        cluster_ids = {str(m.id) for m in cluster}
        overlap = cluster_ids & already_notified_ids
        if len(overlap) >= 3:
            continue  # already notified about this cluster

        summaries = [m.ai_summary or m.content[:200] for m in cluster]
        synthesis = await agent_service.synthesize_arc(summaries)
        weeks = max(1, int((datetime.now(timezone.utc) - min(m.created_at for m in cluster)).days / 7))
        topic_preview = (cluster[0].ai_summary or cluster[0].content)[:40]

        await _queue_and_send(
            db,
            user_id,
            insight_type="arc",
            title="A theme has been building",
            body=f"Over {weeks} week{'s' if weeks > 1 else ''} you saved {len(cluster)} things about \"{topic_preview}...\". Here's where your thinking has landed.",
            synthesis=synthesis,
            memory_ids=[m.id for m in cluster],
        )
        return True

    return False


# ─── Tension Detector ─────────────────────────────────────────────────────────

async def _scan_tension(db: AsyncSession, user_id) -> bool:
    """
    Find pairs of memories that are topically similar but semantically contradictory,
    saved 14+ days apart. Returns True if a notification was sent.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.is_deleted == False,  # noqa: E712
                Memory.created_at >= cutoff,
                Memory.embedding.isnot(None),
            )
        ).order_by(Memory.created_at.desc()).limit(100)
    )
    memories = result.scalars().all()
    if len(memories) < 2:
        return False

    # Collect already-notified tension pairs
    sent_result = await db.execute(
        select(AgentInsight).where(
            and_(
                AgentInsight.user_id == user_id,
                AgentInsight.insight_type == "tension",
            )
        )
    )
    notified_pairs: set[frozenset] = set()
    for s in sent_result.scalars().all():
        if s.memory_ids and len(s.memory_ids) >= 2:
            notified_pairs.add(frozenset(str(mid) for mid in s.memory_ids[:2]))

    for i, m1 in enumerate(memories):
        for m2 in memories[i + 1:]:
            age_diff = abs((m1.created_at - m2.created_at).days)
            if age_diff < 14:
                continue
            pair_key = frozenset([str(m1.id), str(m2.id)])
            if pair_key in notified_pairs:
                continue
            if _cosine_sim(m1.embedding, m2.embedding) < 0.85:
                continue

            is_tension = await agent_service.detect_tension(
                m1.ai_summary or m1.content,
                m2.ai_summary or m2.content,
            )
            if not is_tension:
                continue

            older, newer = (m1, m2) if m1.created_at < m2.created_at else (m2, m1)
            older_month = older.created_at.strftime("%B")
            synthesis_text = (
                f"In {older_month} you saved: \"{(older.ai_summary or older.content)[:120]}\"\n\n"
                f"More recently you saved: \"{(newer.ai_summary or newer.content)[:120]}\"\n\n"
                "These seem to pull in different directions. Which reflects where you actually stand?"
            )
            await _queue_and_send(
                db,
                user_id,
                insight_type="tension",
                title="You've said two different things",
                body=f"In {older_month} you saved one view. More recently, a contradictory one. You haven't resolved this yet.",
                synthesis=synthesis_text,
                memory_ids=[older.id, newer.id],
            )
            return True

    return False


# ─── Intention Loop Follow-Up ─────────────────────────────────────────────────

async def _scan_intention_loop(db: AsyncSession, user_id) -> bool:
    """
    Check for intentions whose follow_up_at has passed and haven't been notified.
    Returns True if a notification was sent.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Intention).where(
            and_(
                Intention.user_id == user_id,
                Intention.follow_up_at <= now,
                Intention.notified_at.is_(None),
                Intention.dismissed_at.is_(None),
            )
        ).order_by(Intention.follow_up_at).limit(1)
    )
    intention = result.scalar_one_or_none()
    if not intention:
        return False

    # Check for follow-through: memories saved after intention with semantic similarity
    after_result = await db.execute(
        select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.is_deleted == False,  # noqa: E712
                Memory.created_at > intention.created_at,
                Memory.embedding.isnot(None),
            )
        )
    )
    later_memories = after_result.scalars().all()

    # Get the original memory's embedding for comparison
    orig_result = await db.execute(select(Memory).where(Memory.id == intention.memory_id))
    orig_memory = orig_result.scalar_one_or_none()

    related = []
    if orig_memory and orig_memory.embedding:
        related = [
            m for m in later_memories
            if _cosine_sim(orig_memory.embedding, m.embedding) >= 0.75
        ]

    weeks_ago = max(1, int((now - intention.created_at).days / 7))
    synthesis_text = (
        f"{weeks_ago} week{'s' if weeks_ago > 1 else ''} ago you captured this intention:\n\n"
        f"\"{intention.extracted}\"\n\n"
    )
    if related:
        synthesis_text += (
            f"Since then, you've saved {len(related)} related thing{'s' if len(related) > 1 else ''} — "
            "but I don't see clear follow-through yet. Is this still something you want to pursue?"
        )
    else:
        synthesis_text += "You haven't saved anything related since. Is this still on your mind?"

    memory_ids = [intention.memory_id] + [m.id for m in related[:3]]

    await _queue_and_send(
        db,
        user_id,
        insight_type="intention_loop",
        title="You said you'd follow up on this",
        body=f"{weeks_ago} week{'s' if weeks_ago > 1 else ''} ago you captured an intention. Still relevant?",
        synthesis=synthesis_text,
        memory_ids=memory_ids,
    )

    intention.notified_at = now
    await db.commit()
    return True


# ─── Main entry point ─────────────────────────────────────────────────────────

async def run_nightly_scan() -> None:
    """
    Nightly job: run all three scan types for all active users.
    Frequency cap: max 1 agent notification per user per 24h.
    Order: Intention Loop first (highest signal), then Arc, then Tension.
    """
    log.info("Nightly agent scan starting")
    async with AsyncSessionLocal() as db:
        from app.models.user import User
        users_result = await db.execute(select(User))
        users = users_result.scalars().all()

    for user in users:
        try:
            async with AsyncSessionLocal() as db:
                if await _user_notified_recently(db, user.id):
                    continue
                sent = await _scan_intention_loop(db, user.id)
                if sent:
                    continue
                sent = await _scan_arc(db, user.id)
                if sent:
                    continue
                await _scan_tension(db, user.id)
        except Exception as exc:
            log.error("Agent scan failed for user %s: %s", user.id, exc)

    log.info("Nightly agent scan complete")
```

- [ ] **Step 7: Run tests**

```bash
cd backend && source venv/bin/activate
pytest test_agent_scan.py -v
```

Expected: all tests PASSED (the scan tests mock GPT calls; the unit tests for `_cosine_sim` and `_cluster_embeddings` run without mocking).

- [ ] **Step 8: Wire APScheduler into main.py**

Replace the existing `lifespan` function in `backend/app/main.py` with:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone="UTC")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables + start nightly agent scan scheduler."""
    await init_db()
    from app.tasks.agent_scan import run_nightly_scan
    scheduler.add_job(run_nightly_scan, "cron", hour=2, minute=0, id="nightly_agent_scan")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)
```

- [ ] **Step 9: Smoke test startup**

```bash
cd backend && source venv/bin/activate
python -c "
import asyncio
from app.database import init_db
asyncio.run(init_db())
print('Startup OK')
"
```

Expected: `Startup OK` with no errors.

- [ ] **Step 10: Commit**

```bash
git add backend/requirements.txt backend/app/tasks/__init__.py \
        backend/app/tasks/agent_scan.py backend/app/main.py \
        backend/test_agent_scan.py
git commit -m "feat(agent): add nightly scan — Arc, Tension, Intention Loop + APScheduler"
```

---

## Task 8: Mobile — Install expo-notifications + Push Token Registration

**Files:**
- Modify: `mobile/package.json` (via npm install)
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Install expo-notifications**

```bash
cd mobile
npx expo install expo-notifications
```

Expected: package added to `node_modules` and `package.json`.

- [ ] **Step 2: Read current _layout.tsx to find auth check location**

Open `mobile/app/_layout.tsx` and identify where auth state is checked (look for `useAuthStore`, token checks, or `router.replace('/login')`). The push registration should run once when the user is authenticated.

- [ ] **Step 3: Add push token registration to _layout.tsx**

Add at the top of `mobile/app/_layout.tsx`, with the other imports:

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
```

Add this helper function before the root layout component:

```typescript
async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const { agentApi } = await import('../services/api');
    await agentApi.registerPushToken(tokenData.data);
  } catch (e) {
    console.warn('Push token registration failed:', e);
  }
}
```

Inside the root layout component, add a `useEffect` that calls this after auth is confirmed (find where `token` or `isAuthenticated` is truthy and add alongside it):

```typescript
useEffect(() => {
  if (!isAuthenticated) return;  // use your existing auth variable name
  registerForPushNotifications();

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const insightId = response.notification.request.content.data?.agent_insight_id as string | undefined;
    if (insightId) {
      router.push(`/chat?agent_insight_id=${insightId}`);
    }
  });
  return () => sub.remove();
}, [isAuthenticated]);
```

- [ ] **Step 4: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/app/_layout.tsx
git commit -m "feat(agent): register Expo push token + handle notification deep link"
```

---

## Task 9: Mobile — API Service Additions

**Files:**
- Modify: `mobile/services/api.ts`

- [ ] **Step 1: Add AgentInsight type and agentApi to api.ts**

Open `mobile/services/api.ts`. After the last existing export (before `export default api`), add:

```typescript
// ─── Agent API ────────────────────────────────────────────────────────────────

export interface AgentInsight {
  id: string;
  insight_type: 'intention_loop' | 'arc' | 'tension';
  title: string;
  body: string;
  synthesis: string;
  memory_ids: string[];
}

export interface SynthesisResult {
  synthesis: string;
  memory_ids: string[];
}

export const agentApi = {
  registerPushToken: async (expoPushToken: string): Promise<void> => {
    await api.post('/agent/notifications/register', { expo_push_token: expoPushToken });
  },

  getInsight: async (insightId: string): Promise<AgentInsight> => {
    const r = await api.get<AgentInsight>(`/agent/insights/${insightId}`);
    return r.data;
  },

  markOpened: async (insightId: string): Promise<void> => {
    await api.post(`/agent/insights/${insightId}/open`);
  },

  dismiss: async (insightId: string): Promise<void> => {
    await api.post(`/agent/insights/${insightId}/dismiss`);
  },

  synthesizeMemories: async (memoryIds: string[]): Promise<SynthesisResult> => {
    const r = await api.post<SynthesisResult>('/ai/synthesize', { memory_ids: memoryIds });
    return r.data;
  },
};
```

- [ ] **Step 2: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/services/api.ts
git commit -m "feat(agent): add agentApi and synthesizeMemories to API service"
```

---

## Task 10: Mobile — Library Synthesis UI

**Files:**
- Modify: `mobile/app/(tabs)/library.tsx`

- [ ] **Step 1: Add state variables for selection mode**

In `library.tsx`, find the existing `useState` declarations at the top of the component. Add:

```typescript
const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [isSynthesizing, setIsSynthesizing] = useState(false);
```

- [ ] **Step 2: Add toggle and synthesize handlers**

Inside the component, after the state declarations:

```typescript
const toggleSelectMode = useCallback(() => {
  setSelectMode((prev) => {
    if (prev) setSelectedIds(new Set());
    return !prev;
  });
}, []);

const toggleMemorySelection = useCallback((id: string) => {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}, []);

const handleSynthesize = useCallback(async () => {
  if (selectedIds.size < 2 || isSynthesizing) return;
  setIsSynthesizing(true);
  try {
    const ids = Array.from(selectedIds);
    setSelectMode(false);
    setSelectedIds(new Set());
    router.push(`/chat?synthesis_ids=${ids.join(',')}`);
  } finally {
    setIsSynthesizing(false);
  }
}, [selectedIds, isSynthesizing, router]);
```

- [ ] **Step 3: Add Synthesize button to the filter bar**

Find the filter chip row in the JSX (the row containing type filter chips like "All", "Text", etc.). Add the Synthesize button at the end of that row:

```tsx
<TouchableOpacity
  onPress={toggleSelectMode}
  style={[
    styles.synthesizeBtn,
    { backgroundColor: colors.brandAccentLight, borderColor: selectMode ? colors.brandAccent : 'transparent' },
  ]}
  accessibilityLabel={selectMode ? t('library.cancelSelect') : t('library.synthesize')}
>
  <Sparkles size={12} color={colors.brandAccent} />
  <Text style={[styles.synthesizeBtnText, { color: colors.brandAccent }]}>
    {selectMode
      ? selectedIds.size > 0
        ? t('library.selectedCount', { count: selectedIds.size })
        : t('library.cancelSelect')
      : t('library.synthesize')}
  </Text>
</TouchableOpacity>
```

- [ ] **Step 4: Make memory cards checkable in select mode**

Find where MemoryCard (or the memory list items) are rendered in the FlatList `renderItem`. Wrap each item with selection behavior:

```tsx
renderItem={({ item }) => (
  <TouchableOpacity
    onPress={() => {
      if (selectMode) {
        toggleMemorySelection(item.id);
      } else {
        router.push(`/memory/${item.id}`);
      }
    }}
    activeOpacity={0.85}
  >
    <View style={[
      styles.memoryCardWrapper,
      selectMode && selectedIds.has(item.id) && {
        borderColor: colors.brandAccent,
        borderWidth: 1.5,
        borderRadius: 12,
      },
    ]}>
      {selectMode && (
        <View style={[
          styles.checkbox,
          selectedIds.has(item.id) && { backgroundColor: colors.brandAccent, borderColor: colors.brandAccent },
        ]}>
          {selectedIds.has(item.id) && (
            <Text style={styles.checkboxTick}>✓</Text>
          )}
        </View>
      )}
      <MemoryCard
        memory={item}
        onPress={() => {
          if (selectMode) toggleMemorySelection(item.id);
          else router.push(`/memory/${item.id}`);
        }}
      />
    </View>
  </TouchableOpacity>
)}
```

- [ ] **Step 5: Add the bottom action bar**

In the JSX, just before the closing `</SafeAreaView>`, add:

```tsx
{selectMode && selectedIds.size > 0 && (
  <View style={[styles.actionBar, { backgroundColor: colors.brandAccentLight, borderColor: colors.brandAccent }]}>
    <Text style={[styles.actionBarText, { color: colors.textSecondary }]}>
      {t('library.selectedCount', { count: selectedIds.size })}
    </Text>
    <TouchableOpacity
      onPress={handleSynthesize}
      disabled={selectedIds.size < 2 || isSynthesizing}
      style={[
        styles.synthesizeActionBtn,
        { backgroundColor: colors.brandAccent },
        (selectedIds.size < 2 || isSynthesizing) && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.synthesizeActionBtnText, { color: colors.buttonText }]}>
        {isSynthesizing ? t('library.synthesizing') : t('library.synthesizeAction')}
      </Text>
    </TouchableOpacity>
  </View>
)}
```

- [ ] **Step 6: Add new StyleSheet entries**

In the `StyleSheet.create({...})` at the bottom of `library.tsx`, add:

```typescript
synthesizeBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  borderRadius: 20,
  paddingHorizontal: 12,
  paddingVertical: 5,
  borderWidth: 1.5,
  marginLeft: 'auto',
},
synthesizeBtnText: {
  fontSize: 11,
  fontWeight: '600',
},
memoryCardWrapper: {
  position: 'relative',
},
checkbox: {
  position: 'absolute',
  top: 12,
  left: -8,
  width: 20,
  height: 20,
  borderRadius: 10,
  borderWidth: 1.5,
  borderColor: 'rgba(255,255,255,0.3)',
  backgroundColor: 'transparent',
  zIndex: 10,
  alignItems: 'center',
  justifyContent: 'center',
},
checkboxTick: {
  fontSize: 11,
  color: 'white',
  fontWeight: '700',
},
actionBar: {
  position: 'absolute',
  bottom: 90,
  left: 16,
  right: 16,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderRadius: 14,
  borderWidth: 1.5,
  paddingHorizontal: 16,
  paddingVertical: 12,
},
actionBarText: {
  fontSize: 13,
},
synthesizeActionBtn: {
  borderRadius: 10,
  paddingHorizontal: 16,
  paddingVertical: 8,
},
synthesizeActionBtnText: {
  fontSize: 13,
  fontWeight: '600',
},
```

- [ ] **Step 7: Type-check and lint**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add mobile/app/(tabs)/library.tsx
git commit -m "feat(agent): add Synthesize button and selection mode to Library"
```

---

## Task 11: Mobile — Chat Deep Link Handling

**Files:**
- Modify: `mobile/app/(tabs)/chat.tsx`

- [ ] **Step 1: Add agentApi to the existing import in chat.tsx**

Find this line near the top of `chat.tsx`:

```typescript
import { chatApi, ChatMessage, ChatSource } from '../../services/api';
```

Replace it with:

```typescript
import { chatApi, agentApi, ChatMessage, ChatSource } from '../../services/api';
```

Then find `useLocalSearchParams` and extend it to accept the new params:

```typescript
const { memory_id, agent_insight_id, synthesis_ids } = useLocalSearchParams<{
  memory_id?: string;
  agent_insight_id?: string;
  synthesis_ids?: string;
}>();
```

- [ ] **Step 2: Add agent opening message state**

Find the existing message state declarations. Add:

```typescript
const [agentOpening, setAgentOpening] = useState<string | null>(null);
const [agentInsightId, setAgentInsightId] = useState<string | null>(null);
const [isLoadingAgent, setIsLoadingAgent] = useState(false);
```

- [ ] **Step 3: Add useEffect to load agent insight or synthesis on mount**

Inside the chat component, add:

```typescript
useEffect(() => {
  if (agent_insight_id) {
    loadAgentInsight(agent_insight_id);
  } else if (synthesis_ids) {
    loadSynthesis(synthesis_ids.split(','));
  }
}, [agent_insight_id, synthesis_ids]);

async function loadAgentInsight(insightId: string) {
  setIsLoadingAgent(true);
  try {
    const insight = await agentApi.getInsight(insightId);
    setAgentInsightId(insightId);
    setAgentOpening(insight.synthesis);
    await agentApi.markOpened(insightId);
  } catch (e) {
    console.warn('Failed to load agent insight:', e);
  } finally {
    setIsLoadingAgent(false);
  }
}

async function loadSynthesis(ids: string[]) {
  setIsLoadingAgent(true);
  try {
    const result = await agentApi.synthesizeMemories(ids);
    setAgentOpening(result.synthesis);
  } catch (e) {
    console.warn('Failed to load synthesis:', e);
  } finally {
    setIsLoadingAgent(false);
  }
}
```

- [ ] **Step 4: Render the agent opening message before the chat messages**

Find where the chat message list (`FlatList` or `ScrollView`) is rendered. Above the message list, add:

```tsx
{isLoadingAgent && (
  <View style={styles.agentLoadingRow}>
    <ActivityIndicator size="small" color={colors.brandAccent} />
    <Text style={[styles.agentLoadingText, { color: colors.textMuted }]}>
      {t('chat.agentThinking')}
    </Text>
  </View>
)}

{agentOpening && !isLoadingAgent && (
  <View style={[styles.agentOpeningCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
    <View style={[styles.agentOpeningHeader, { borderLeftColor: colors.brandAccent }]}>
      <Brain size={12} color={colors.brandAccent} />
      <Text style={[styles.agentOpeningLabel, { color: colors.brandAccent }]}>
        {t('chat.agentLabel')}
      </Text>
    </View>
    <SimpleMarkdown content={agentOpening} colors={colors} />
    <View style={styles.agentReplyChips}>
      {['chat.replyYes', 'chat.replyNo', 'chat.replyTellMore'].map((key) => (
        <TouchableOpacity
          key={key}
          onPress={() => {
            setInput(t(key));
          }}
          style={[styles.agentChip, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
        >
          <Text style={[styles.agentChipText, { color: colors.textSecondary }]}>{t(key)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
)}
```

- [ ] **Step 5: Add new StyleSheet entries to chat.tsx**

```typescript
agentLoadingRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  padding: 16,
},
agentLoadingText: {
  fontSize: 13,
},
agentOpeningCard: {
  margin: 16,
  borderRadius: 14,
  borderWidth: 1,
  padding: 14,
},
agentOpeningHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  borderLeftWidth: 2,
  paddingLeft: 8,
  marginBottom: 10,
},
agentOpeningLabel: {
  fontSize: 11,
  fontWeight: '600',
  letterSpacing: 0.5,
},
agentReplyChips: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 12,
},
agentChip: {
  borderRadius: 20,
  borderWidth: 1,
  paddingHorizontal: 12,
  paddingVertical: 5,
},
agentChipText: {
  fontSize: 12,
},
```

- [ ] **Step 6: Type-check and lint**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/(tabs)/chat.tsx
git commit -m "feat(agent): chat screen handles agent_insight_id and synthesis_ids params"
```

---

## Task 12: i18n Strings

**Files:**
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add English strings**

In `mobile/i18n/locales/en.ts`, find the `library` section and add:

```typescript
// library section — add these keys
synthesize: '✦ Synthesize',
cancelSelect: 'Cancel',
selectedCount: '{{count}} selected',
synthesizing: 'Synthesizing...',
synthesizeAction: 'Synthesize →',
```

In the `chat` section, add:

```typescript
// chat section — add these keys
agentLabel: 'Memory Agent',
agentThinking: 'Agent is thinking...',
replyYes: 'Yes, still relevant',
replyNo: "It's no longer relevant",
replyTellMore: 'Tell me more',
```

- [ ] **Step 2: Add Vietnamese strings**

In `mobile/i18n/locales/vi.ts`, add the same keys:

```typescript
// library section
synthesize: '✦ Tổng hợp',
cancelSelect: 'Hủy',
selectedCount: 'Đã chọn {{count}}',
synthesizing: 'Đang tổng hợp...',
synthesizeAction: 'Tổng hợp →',

// chat section
agentLabel: 'Tác nhân ký ức',
agentThinking: 'Đang phân tích...',
replyYes: 'Vẫn còn liên quan',
replyNo: 'Không còn liên quan nữa',
replyTellMore: 'Cho tôi biết thêm',
```

- [ ] **Step 3: Run i18n parity check**

```bash
cd mobile && npm run i18n:check
```

Expected: no missing keys reported.

- [ ] **Step 4: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/i18n/locales/en.ts mobile/i18n/locales/vi.ts
git commit -m "feat(i18n): add EN/VI strings for agent synthesis and chat"
```

---

## Task 13: Full Backend Test Run

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && source venv/bin/activate
pytest test_agent_service.py test_agent_scan.py test_synthesis.py test_agent_api.py -v
```

Expected: all tests PASSED.

- [ ] **Step 2: Run existing tests to verify no regressions**

```bash
cd backend && source venv/bin/activate
pytest -v --ignore=venv
```

Expected: all existing tests still passing.

- [ ] **Step 3: Run mobile type-check and lint**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit final verification**

```bash
git commit --allow-empty -m "chore: verify all tests pass for proactive agent feature"
```
