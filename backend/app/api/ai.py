from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, text, func, inspect
from pydantic import BaseModel
from typing import List, Optional, Sequence
from datetime import datetime, timezone, timedelta
import hashlib
import uuid
import json
import logging

from app.database import get_db
from app.models.memory import Memory
from app.models.category import Category
from app.models.radar_event import RadarEvent
from app.models.user import User
from app.api.deps import get_current_user
from app.api.preferences import get_or_create_preferences
from app.schemas import RadarEventCreate
from app.services import ai_service

router = APIRouter()
log = logging.getLogger(__name__)

_VALID_LANGS = {"en", "vi"}


async def _get_user_language(request: Request, db: AsyncSession, user_id) -> str:
    """Get user language from Accept-Language header (real-time) or DB preference (fallback)."""
    header_lang = (
        (request.headers.get("accept-language") or "").split(",")[0].strip()[:2].lower()
    )
    if header_lang in _VALID_LANGS:
        return header_lang
    prefs = await get_or_create_preferences(db, user_id)
    return (prefs.language or "en") if prefs else "en"


class GroupRequest(BaseModel):
    memory_ids: List[str]


class ReflectRequest(BaseModel):
    thought: str
    limit: int = 5
    memory_id: Optional[str] = None


class SynthesizeRequest(BaseModel):
    memory_ids: List[str]


def _memory_to_response_payload(m: Memory) -> dict:
    """Build a MemoryResponse-compatible payload without triggering lazy loads."""
    row = m.__dict__
    state = inspect(m)

    def _as_str(value):
        return str(value) if value is not None else None

    identity = state.identity or ()
    memory_id = row.get("id") or (identity[0] if len(identity) > 0 else None)

    memory_type = row.get("type")
    if memory_type is not None and hasattr(memory_type, "value"):
        memory_type = memory_type.value

    created_at = row.get("created_at")
    updated_at = row.get("updated_at")

    return {
        "id": _as_str(memory_id),
        "user_id": _as_str(row.get("user_id")),
        "type": str(memory_type) if memory_type is not None else None,
        "content": row.get("content"),
        "transcription": row.get("transcription"),
        "audio_url": row.get("audio_url"),
        "audio_duration": row.get("audio_duration"),
        "image_url": row.get("image_url"),
        "ai_summary": row.get("ai_summary"),
        "metadata": row.get("extra_metadata"),
        "category_id": _as_str(row.get("category_id")),
        "category_name": None,
        "category_icon": None,
        "category_color": None,
        "category_confidence": row.get("category_confidence"),
        "created_at": created_at.isoformat() if created_at else None,
        "updated_at": updated_at.isoformat() if updated_at else None,
    }


def _radar_threshold_by_sensitivity(sensitivity: str) -> int:
    """Map user sensitivity setting to a minimum confidence threshold."""
    if sensitivity == "high":
        return 45
    if sensitivity == "low":
        return 70
    return 55


def _radar_reason(memory: Memory) -> tuple[str, str, str]:
    """Generate reason, reason_code and action_hint for a radar candidate."""
    mtype = memory.type.value if hasattr(memory.type, "value") else str(memory.type)
    if memory.category_id:
        return (
            "Related to one of your active categories",
            "category_match",
            "Review this while planning your next steps",
        )
    if mtype == "voice":
        return (
            "Voice memory worth revisiting",
            "voice_recap",
            "Open this and extract one action",
        )
    if mtype == "link":
        return (
            "Saved link that may matter now",
            "link_revisit",
            "Re-open and bookmark key takeaway",
        )
    return (
        "Recent memory likely relevant right now",
        "recently_saved",
        "Scan it and decide: keep, act, or dismiss",
    )


def _radar_confidence(memory: Memory) -> int:
    """Compute a simple confidence score based on recency and metadata."""
    now = datetime.now(timezone.utc)
    if not memory.created_at:
        return 50
    created_at = memory.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_days = max(0.0, (now - created_at).total_seconds() / 86400)

    # Recency baseline declines over ~2 weeks.
    score = 80 - min(40, age_days * 3)
    if memory.ai_summary:
        score += 6
    memory_type = (
        memory.type.value if hasattr(memory.type, "value") else str(memory.type)
    )
    if memory_type == "voice":
        score += 4
    return int(max(0, min(100, round(score))))


def _days_since_last_view(memory: Memory, now: datetime) -> int | None:
    if not memory.last_viewed_at:
        return None
    viewed_at = memory.last_viewed_at
    if viewed_at.tzinfo is None:
        viewed_at = viewed_at.replace(tzinfo=timezone.utc)
    return int(max(0, (now - viewed_at).total_seconds() / 86400))


def _hours_since_last_view(memory: Memory, now: datetime) -> float | None:
    if not memory.last_viewed_at:
        return None
    viewed_at = memory.last_viewed_at
    if viewed_at.tzinfo is None:
        viewed_at = viewed_at.replace(tzinfo=timezone.utc)
    return max(0.0, (now - viewed_at).total_seconds() / 3600)


def _on_this_day_years(memory: Memory, now: datetime) -> int | None:
    if not memory.created_at:
        return None
    created_at = memory.created_at
    if created_at.month != now.month or created_at.day != now.day:
        return None
    years = now.year - created_at.year
    return years if years >= 1 else None


def _cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    if len(a) != len(b) or len(a) == 0:
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y
    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    return dot / ((norm_a**0.5) * (norm_b**0.5))


def _semantic_cluster_memory_ids(memories: list[Memory]) -> set[str]:
    """Return memory ids belonging to a dense semantic neighborhood."""
    embedded = [
        m
        for m in memories
        if m.embedding is not None
        and isinstance(m.embedding, list)
        and len(m.embedding) > 0
    ]
    if len(embedded) < 3:
        return set()

    cluster_ids: set[str] = set()
    for idx, memory in enumerate(embedded):
        neighbors = 0
        for jdx, other in enumerate(embedded):
            if idx == jdx:
                continue
            similarity = _cosine_similarity(memory.embedding, other.embedding)
            if similarity >= 0.82:
                neighbors += 1
        if neighbors >= 2:
            cluster_ids.add(str(memory.id))
    return cluster_ids


def _radar_reason_enhanced(
    memory: Memory,
    now: datetime,
    pinned_ids: set[str],
    category_frequency_14d: dict[str, int],
    semantic_cluster_ids: set[str],
) -> tuple[str, str, str, int]:
    memory_id = str(memory.id)

    if memory_id in pinned_ids:
        return (
            "You marked this to revisit",
            "user_pinned",
            "Open this and reconnect the context",
            12,
        )

    years = _on_this_day_years(memory, now)
    if years is not None:
        year_text = "year" if years == 1 else "years"
        return (
            f"On this day {years} {year_text} ago",
            "on_this_day",
            "Revisit this memory and note what changed",
            8,
        )

    days_since_view = _days_since_last_view(memory, now)
    if days_since_view is not None and days_since_view > 7:
        return (
            f"Not reviewed for {days_since_view} days",
            "not_viewed",
            "Review quickly and decide the next action",
            6,
        )

    if memory.category_id:
        category_key = str(memory.category_id)
        if category_frequency_14d.get(category_key, 0) >= 3:
            return (
                "You have been thinking about this topic often",
                "repeated_topic",
                "Use this to connect your recent notes",
                7,
            )

    if memory_id in semantic_cluster_ids:
        return (
            "Related to your recent memory patterns",
            "semantic_cluster",
            "Open this to reconnect the cluster of ideas",
            5,
        )

    reason, reason_code, action_hint = _radar_reason(memory)
    return (reason, reason_code, action_hint, 0)


@router.get("/recall", response_model=dict)
async def get_recall(
    limit: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the user's most recent memories as recall suggestions."""
    result = await db.execute(
        select(Memory)
        .where(and_(Memory.user_id == current_user.id, Memory.is_deleted == False))  # noqa: E712
        .order_by(Memory.created_at.desc())
        .limit(limit)
    )
    memories = result.scalars().all()
    return {
        "items": [
            {
                "memory": {
                    "id": str(m.id),
                    "type": m.type.value if hasattr(m.type, "value") else str(m.type),
                    "content": m.content,
                    "ai_summary": m.ai_summary,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                    "updated_at": m.updated_at.isoformat() if m.updated_at else None,
                },
                "reason": "Recently saved",
            }
            for m in memories
        ]
    }


@router.get("/radar", response_model=dict)
async def get_radar(
    limit: int = Query(6, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a preference-aware proactive radar feed of recall cards."""
    prefs = await get_or_create_preferences(db, current_user.id)

    # Legacy rows can contain NULL for these flags. Treat NULL as enabled so
    # recall cards still render in the Recall tab.
    ai_recall_enabled = (
        prefs.ai_recall_enabled if prefs.ai_recall_enabled is not None else True
    )
    proactive_recall_opt_in = (
        prefs.proactive_recall_opt_in
        if prefs.proactive_recall_opt_in is not None
        else True
    )

    if not ai_recall_enabled or not proactive_recall_opt_in:
        return {"items": [], "generated_at": datetime.now(timezone.utc).isoformat()}

    min_confidence = _radar_threshold_by_sensitivity(
        prefs.recall_sensitivity or "medium"
    )

    result = await db.execute(
        select(Memory)
        .where(and_(Memory.user_id == current_user.id, Memory.is_deleted == False))  # noqa: E712
        .order_by(Memory.created_at.desc())
        .limit(30)
    )
    memories = result.scalars().all()

    now = datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(days=14)
    category_frequency_14d: dict[str, int] = {}
    for memory in memories:
        if not memory.category_id or not memory.created_at:
            continue
        created_at = memory.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at >= recent_cutoff:
            category_key = str(memory.category_id)
            category_frequency_14d[category_key] = (
                category_frequency_14d.get(category_key, 0) + 1
            )

    pinned_result = await db.execute(
        select(RadarEvent.memory_id)
        .where(
            and_(
                RadarEvent.user_id == current_user.id,
                RadarEvent.event_type == "acted",
                RadarEvent.reason_code == "user_pinned",
            )
        )
        .order_by(RadarEvent.created_at.desc())
        .limit(100)
    )
    pinned_ids = {str(row[0]) for row in pinned_result.all() if row[0] is not None}
    semantic_cluster_ids = _semantic_cluster_memory_ids(memories)

    items = []
    for memory in memories:
        viewed_hours = _hours_since_last_view(memory, now)
        if (
            viewed_hours is not None
            and viewed_hours < 24
            and str(memory.id) not in pinned_ids
        ):
            # Avoid immediately re-suggesting memories that were just opened.
            continue

        confidence = _radar_confidence(memory)
        reason, reason_code, action_hint, confidence_boost = _radar_reason_enhanced(
            memory, now, pinned_ids, category_frequency_14d, semantic_cluster_ids
        )
        confidence = max(0, min(100, confidence + confidence_boost))
        if confidence < min_confidence:
            continue
        items.append(
            {
                "memory": _memory_to_response_payload(memory),
                "reason": reason,
                "reason_code": reason_code,
                "confidence": confidence,
                "action_hint": action_hint,
            }
        )
        if len(items) >= limit:
            break

    return {
        "items": items,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/radar/events", response_model=dict)
async def create_radar_event(
    body: RadarEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log user interaction events for radar cards."""
    try:
        memory_id = uuid.UUID(body.memory_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Invalid memory_id")

    memory_result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == memory_id,
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,  # noqa: E712
            )
        )
    )
    memory = memory_result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    event = RadarEvent(
        user_id=current_user.id,
        memory_id=memory_id,
        event_type=body.event_type,
        reason_code=body.reason_code,
        confidence=body.confidence,
        context=body.context or {},
    )
    db.add(event)

    # When user opens a memory from the Recall tab, stamp last_viewed_at so
    # the 24-hour de-duplication filter in get_radar can suppress it.
    if body.event_type in ("opened", "dismissed"):
        memory.last_viewed_at = datetime.now(timezone.utc)

    await db.flush()

    return {"status": "ok", "event_id": str(event.id)}


@router.post("/reflect", response_model=dict)
async def reflect_on_thought(
    body: ReflectRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a concise reflection and return related memories."""
    thought = (body.thought or "").strip()
    if not thought:
        raise HTTPException(status_code=422, detail="thought is required")

    limit = max(1, min(10, int(body.limit or 5)))

    source_memory: Optional[Memory] = None
    if body.memory_id:
        try:
            source_memory_id = uuid.UUID(body.memory_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Invalid memory_id")

        source_result = await db.execute(
            select(Memory).where(
                and_(
                    Memory.id == source_memory_id,
                    Memory.user_id == current_user.id,
                    Memory.is_deleted == False,  # noqa: E712
                )
            )
        )
        source_memory = source_result.scalar_one_or_none()
        if not source_memory:
            raise HTTPException(status_code=404, detail="Memory not found")

    source_hash = hashlib.sha256(thought.encode("utf-8")).hexdigest()
    if source_memory:
        metadata = dict(source_memory.extra_metadata or {})
        reflection_cache = metadata.get("reflection_cache")
        if (
            isinstance(reflection_cache, dict)
            and reflection_cache.get("source_hash") == source_hash
            and isinstance(reflection_cache.get("insight_markdown"), str)
            and reflection_cache.get("insight_markdown", "").strip()
        ):
            cached_related_ids = [
                rid
                for rid in (reflection_cache.get("related_memory_ids") or [])
                if isinstance(rid, str)
            ]
            cached_related_memories: list[Memory] = []
            if cached_related_ids:
                parsed_ids: list[uuid.UUID] = []
                for rid in cached_related_ids:
                    try:
                        parsed_ids.append(uuid.UUID(rid))
                    except (TypeError, ValueError):
                        continue

                if parsed_ids:
                    related_result = await db.execute(
                        select(Memory)
                        .where(
                            and_(
                                Memory.user_id == current_user.id,
                                Memory.is_deleted == False,  # noqa: E712
                                Memory.id.in_(parsed_ids),
                            )
                        )
                        .order_by(Memory.created_at.desc())
                    )
                    cached_related_memories = related_result.scalars().all()

            return {
                "insight": reflection_cache["insight_markdown"],
                "related_memories": [
                    _memory_to_response_payload(memory)
                    for memory in cached_related_memories
                ],
                "cached": True,
                "format": "markdown",
            }

    search_pattern = f"%{thought}%"
    result = await db.execute(
        select(Memory)
        .where(
            and_(
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,  # noqa: E712
                or_(
                    Memory.content.ilike(search_pattern),
                    Memory.transcription.ilike(search_pattern),
                    Memory.ai_summary.ilike(search_pattern),
                ),
            )
        )
        .order_by(Memory.created_at.desc())
        .limit(limit)
    )
    related_memories = result.scalars().all()
    related_memory_payloads = [
        _memory_to_response_payload(memory) for memory in related_memories
    ]

    user_lang = await _get_user_language(request, db, current_user.id)
    snippets = [
        (m.ai_summary or m.transcription or m.content or "").strip()
        for m in related_memories
        if (m.ai_summary or m.transcription or m.content)
    ]

    insight = await ai_service.generate_reflection_markdown(
        thought,
        snippets,
        user_lang,
    )
    if not insight:
        if user_lang == "vi":
            insight = (
                "## Suy ngẫm\n\n"
                "Mình chưa thấy mẫu nổi bật từ các ký ức liên quan ở thời điểm này.\n\n"
                "### Tín hiệu từ ký ức\n"
                "- Chưa đủ tín hiệu để kết luận một chủ đề lặp lại.\n"
                "- Bạn có thể mở lại các ký ức gần nhất để thêm ngữ cảnh cụ thể.\n\n"
                "### Hành động tiếp theo\n"
                "1. Chọn một ký ức gần nhất và ghi thêm 1 ý chính bạn muốn làm rõ."
            )
        else:
            insight = (
                "## Reflection\n\n"
                "A strong pattern is not visible from related memories yet.\n\n"
                "### Signals from memories\n"
                "- Current evidence is limited for a clear recurring theme.\n"
                "- Adding one concrete takeaway can improve the signal quickly.\n\n"
                "### Next action\n"
                "1. Re-open one recent memory and write one specific takeaway."
            )

    if not insight.lstrip().startswith("##"):
        insight = f"## Reflection\n\n{insight.strip()}"

    if source_memory:
        metadata = dict(source_memory.extra_metadata or {})
        metadata["reflection_cache"] = {
            "source_hash": source_hash,
            "insight_markdown": insight,
            "related_memory_ids": [str(m.id) for m in related_memories],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        source_memory.extra_metadata = metadata
        await db.flush()

    return {
        "insight": insight,
        "related_memories": related_memory_payloads,
        "cached": False,
        "format": "markdown",
    }


@router.get("/search")
async def semantic_search(
    q: str = Query(..., min_length=1, description="Natural language search query"),
    limit: int = Query(20, ge=1, le=50),
    category_id: Optional[str] = Query(
        None, description="Filter results to this category UUID"
    ),
    with_summary: bool = Query(
        False, description="Generate AI insight summary of results (non-streaming)"
    ),
    stream: bool = Query(
        False, description="Stream the AI summary via SSE after returning results"
    ),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI-powered semantic search across all memories.

    Strategy:
      1. Generate an embedding for the query via OpenAI.
      2. If embeddings are available, perform pgvector cosine-distance search.
      3. Fall back to multi-field keyword ILIKE search.
      4. Return a merged, deduplicated result set.
      5. With with_summary=true: generate AI insight synchronously (JSON).
      6. With stream=true: return SSE — first event is the results, then
         token-by-token AI summary, then a "done" event.
    """
    import logging

    log = logging.getLogger(__name__)

    # Resolve optional category UUID filter
    category_uuid: Optional[uuid.UUID] = None
    if category_id:
        try:
            category_uuid = uuid.UUID(category_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Invalid category_id UUID")

    results: list[dict] = []
    seen_ids: set[str] = set()

    def _mem_to_dict(m: Memory, score: float | None = None) -> dict:
        d = {
            "id": str(m.id),
            "user_id": str(m.user_id),
            "type": m.type.value if hasattr(m.type, "value") else str(m.type),
            "content": m.content,
            "transcription": m.transcription,
            "audio_url": m.audio_url,
            "audio_duration": m.audio_duration,
            "image_url": m.image_url,
            "ai_summary": m.ai_summary,
            "metadata": m.extra_metadata,
            "is_dismissed": m.is_deleted,
            "category_id": str(m.category_id) if m.category_id else None,
            "category_confidence": m.category_confidence,
            "last_viewed_at": m.last_viewed_at.isoformat()
            if m.last_viewed_at
            else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        }
        if score is not None:
            d["relevance_score"] = round(score, 4)
        return d

    # ── 1. Try vector similarity search ────────────────────────────────────
    query_embedding = await ai_service.generate_embedding(q)
    if query_embedding is not None:
        try:
            # pgvector cosine distance: <=> operator; lower = more similar
            # We use raw SQL for the ordering since SQLAlchemy ORM doesn't
            # natively support pgvector operators in ORDER BY.
            vec_conditions = [
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,  # noqa: E712
                Memory.embedding != None,  # noqa: E711
            ]
            if category_uuid is not None:
                vec_conditions.append(Memory.category_id == category_uuid)
            stmt = (
                select(
                    Memory,
                    Memory.embedding.cosine_distance(query_embedding).label("distance"),
                )
                .where(and_(*vec_conditions))
                .order_by(text("distance"))
                .limit(limit)
            )
            vector_results = await db.execute(stmt)
            for row in vector_results.all():
                mem = row[0]
                distance = float(row[1])
                # Cosine distance range: 0 (identical) to 2 (opposite)
                # Convert to similarity score 0-1
                similarity = max(0.0, 1.0 - distance)
                # Only include reasonably relevant results (similarity > 0.3)
                if similarity > 0.3:
                    mid = str(mem.id)
                    if mid not in seen_ids:
                        seen_ids.add(mid)
                        results.append(_mem_to_dict(mem, similarity))
            log.info("Vector search for '%s' returned %d results", q, len(results))
        except Exception as exc:
            log.warning("Vector search failed, falling back to keyword: %s", exc)

    # ── 2. Keyword fallback (always runs to catch memories without embeddings) ─
    # Split query into words for better matching of multi-word queries
    words = [w.strip() for w in q.split() if w.strip()]
    if len(words) > 1:
        # Each word must appear in at least one searchable field
        word_conditions = []
        for word in words:
            wp = f"%{word}%"
            word_conditions.append(
                or_(
                    Memory.content.ilike(wp),
                    Memory.transcription.ilike(wp),
                    Memory.ai_summary.ilike(wp),
                )
            )
        keyword_filter = and_(*word_conditions)
    else:
        search_pattern = f"%{q}%"
        keyword_filter = or_(
            Memory.content.ilike(search_pattern),
            Memory.transcription.ilike(search_pattern),
            Memory.ai_summary.ilike(search_pattern),
        )

    kw_conditions = [
        Memory.user_id == current_user.id,
        Memory.is_deleted == False,  # noqa: E712
        keyword_filter,
    ]
    if category_uuid is not None:
        kw_conditions.append(Memory.category_id == category_uuid)
    keyword_stmt = (
        select(Memory)
        .where(and_(*kw_conditions))
        .order_by(Memory.created_at.desc())
        .limit(limit)
    )
    keyword_results = await db.execute(keyword_stmt)
    for m in keyword_results.scalars().all():
        mid = str(m.id)
        if mid not in seen_ids:
            seen_ids.add(mid)
            results.append(_mem_to_dict(m))

    # ── 3. Enrich results with category info ───────────────────────────────
    category_ids = set()
    for r in results:
        cid = r.get("category_id")
        if cid:
            try:
                category_ids.add(uuid.UUID(cid))
            except (ValueError, TypeError):
                pass

    category_map: dict[str, dict] = {}
    if category_ids:
        cat_result = await db.execute(
            select(Category).where(Category.id.in_(category_ids))
        )
        for cat in cat_result.scalars().all():
            category_map[str(cat.id)] = {
                "category_name": cat.name,
                "category_icon": cat.icon,
                "category_color": cat.color,
            }

    for r in results:
        cid = r.get("category_id")
        cat_info = category_map.get(cid, {}) if cid else {}
        r["category_name"] = cat_info.get("category_name")
        r["category_icon"] = cat_info.get("category_icon")
        r["category_color"] = cat_info.get("category_color")

    # ── 4. Streaming SSE response ──────────────────────────────────────────
    if stream:
        # Build snippets for AI summary
        snippets = []
        for r in results[:12]:
            text_content = (
                r.get("ai_summary") or r.get("transcription") or r.get("content") or ""
            )
            if text_content.strip():
                snippets.append(text_content.strip())

        user_lang = (
            await _get_user_language(request, db, current_user.id) if request else "en"
        )

        async def _stream_search():
            # First event: full results payload
            yield f"data: {json.dumps({'type': 'results', 'results': results[:limit], 'total': len(results[:limit])})}\n\n"
            # Then stream AI summary tokens
            if snippets:
                async for token in ai_service.stream_search_summary(
                    q, snippets, user_lang
                ):
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        return StreamingResponse(_stream_search(), media_type="text/event-stream")

    # ── 5. Non-streaming: optionally generate AI insight synchronously ──────
    ai_summary: Optional[str] = None
    if with_summary and results:
        # Build plain-text snippets for each result
        snippets = []
        for r in results[:12]:
            text_content = (
                r.get("ai_summary") or r.get("transcription") or r.get("content") or ""
            )
            if text_content.strip():
                snippets.append(text_content.strip())
        if snippets:
            user_lang = (
                await _get_user_language(request, db, current_user.id)
                if request
                else "en"
            )
            ai_summary = await ai_service.summarize_search_results(
                q, snippets, user_lang
            )

    return {
        "query": q,
        "results": results[:limit],
        "total": len(results[:limit]),
        "ai_summary": ai_summary,
    }


@router.post("/summarize/{memory_id}")
async def summarize_memory(
    memory_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate or regenerate AI summary for a memory.

    Uses GPT-4 to create a concise one-sentence summary.
    Returns the (possibly None) summary field — no error if OpenAI is not
    yet configured.
    """
    try:
        mid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == mid,
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,  # noqa: E712
            )
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Memory not found")

    # Use transcription text for voice memories if available
    content_to_summarise = m.transcription or m.content or ""
    mem_type = m.type.value if hasattr(m.type, "value") else str(m.type)

    # Use Accept-Language header or DB preference
    user_language = await _get_user_language(request, db, current_user.id)

    summary = await ai_service.generate_summary(
        content_to_summarise, mem_type, user_language
    )

    if summary:
        m.ai_summary = summary
        await db.flush()

    return {
        "memory_id": memory_id,
        "summary": summary,
        "ai_available": summary is not None,
    }


@router.post("/group", response_model=dict)
async def group_memories(
    body: GroupRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Use OpenAI to group memories by topic/category for personalized display.
    Returns groups with titles and the memory IDs belonging to each group.
    """
    if not body.memory_ids:
        return {"groups": []}

    # Fetch the memories
    uuids = []
    for mid in body.memory_ids:
        try:
            uuids.append(uuid.UUID(mid))
        except ValueError:
            continue

    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id.in_(uuids),
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,  # noqa: E712
            )
        )
    )
    memories = result.scalars().all()
    if not memories:
        return {"groups": []}

    # Build content map for AI
    memory_contents = {}
    for m in memories:
        mid = str(m.id)
        content = m.ai_summary or m.transcription or m.content or ""
        memory_contents[mid] = content[:200]  # truncate for token efficiency

    # Use Accept-Language header or DB preference
    user_language = await _get_user_language(request, db, current_user.id)

    groups = await ai_service.group_memories_by_topic(memory_contents, user_language)
    return {"groups": groups}


@router.post("/embeddings/backfill", response_model=dict)
async def backfill_embeddings(
    batch_size: int = Query(
        50, ge=1, le=200, description="Number of memories to process per call"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate embeddings for memories that don't have one yet.

    Processes up to `batch_size` memories per call.  Returns the number of
    memories processed and how many remain without embeddings.
    Call repeatedly until `remaining` reaches 0.
    """
    import logging

    log = logging.getLogger(__name__)

    # Find memories without embeddings
    result = await db.execute(
        select(Memory)
        .where(
            and_(
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,  # noqa: E712
                Memory.embedding == None,  # noqa: E711
            )
        )
        .order_by(Memory.created_at.desc())
        .limit(batch_size)
    )
    memories = result.scalars().all()

    processed = 0
    failed = 0
    for m in memories:
        content = m.transcription or m.content or ""
        if not content.strip():
            continue
        embedding = await ai_service.generate_embedding(content)
        if embedding:
            m.embedding = embedding
            processed += 1
        else:
            failed += 1

    if processed > 0:
        await db.flush()
        log.info(
            "Backfilled embeddings for %d memories (user=%s)",
            processed,
            current_user.id,
        )

    # Count remaining
    remaining_result = await db.execute(
        select(func.count()).where(
            and_(
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,  # noqa: E712
                Memory.embedding == None,  # noqa: E711
            )
        )
    )
    remaining = remaining_result.scalar() or 0

    return {
        "processed": processed,
        "failed": failed,
        "remaining": remaining,
    }


# ─── AI Chat (RAG) — Ask questions about your memories ────────────────────────


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    stream: bool = False


async def _retrieve_relevant_memories(
    db: AsyncSession, user_id: uuid.UUID, query: str, limit: int = 10
) -> list[dict]:
    """Retrieve the most relevant memories for RAG context using hybrid search."""
    results: list[dict] = []
    seen_ids: set[str] = set()

    # Strategy 1: Embedding similarity search
    query_embedding = await ai_service.generate_embedding(query)
    if query_embedding is not None:
        try:
            stmt = (
                select(
                    Memory,
                    Memory.embedding.cosine_distance(query_embedding).label("distance"),
                )
                .where(
                    and_(
                        Memory.user_id == user_id,
                        Memory.is_deleted == False,  # noqa: E712
                        Memory.embedding != None,  # noqa: E711
                    )
                )
                .order_by(text("distance"))
                .limit(limit)
            )
            vector_results = await db.execute(stmt)
            for row in vector_results.all():
                mem = row[0]
                distance = float(row[1])
                similarity = max(0.0, 1.0 - distance)
                if similarity > 0.15:
                    mid = str(mem.id)
                    if mid not in seen_ids:
                        seen_ids.add(mid)
                        # Get category
                        cat_name = None
                        if mem.category_id:
                            cat_r = await db.execute(
                                select(Category).where(Category.id == mem.category_id)
                            )
                            cat = cat_r.scalar_one_or_none()
                            if cat:
                                cat_name = cat.name
                        results.append(
                            {
                                "id": mid,
                                "type": mem.type.value
                                if hasattr(mem.type, "value")
                                else str(mem.type),
                                "content": mem.content or "",
                                "summary": mem.ai_summary or "",
                                "transcription": mem.transcription or "",
                                "category": cat_name,
                                "created_at": mem.created_at.isoformat()
                                if mem.created_at
                                else "",
                                "similarity": round(similarity, 3),
                            }
                        )
        except Exception as exc:
            log.warning("RAG vector search failed: %s", exc)

    # Strategy 2: Keyword fallback
    if len(results) < 3:
        pattern = f"%{query}%"
        kw_stmt = (
            select(Memory)
            .where(
                and_(
                    Memory.user_id == user_id,
                    Memory.is_deleted == False,  # noqa: E712
                    or_(
                        Memory.content.ilike(pattern),
                        Memory.transcription.ilike(pattern),
                        Memory.ai_summary.ilike(pattern),
                    ),
                )
            )
            .order_by(Memory.created_at.desc())
            .limit(5)
        )
        kw_results = await db.execute(kw_stmt)
        for mem in kw_results.scalars().all():
            mid = str(mem.id)
            if mid not in seen_ids:
                seen_ids.add(mid)
                cat_name = None
                if mem.category_id:
                    cat_r = await db.execute(
                        select(Category).where(Category.id == mem.category_id)
                    )
                    cat = cat_r.scalar_one_or_none()
                    if cat:
                        cat_name = cat.name
                results.append(
                    {
                        "id": mid,
                        "type": mem.type.value
                        if hasattr(mem.type, "value")
                        else str(mem.type),
                        "content": mem.content or "",
                        "summary": mem.ai_summary or "",
                        "transcription": mem.transcription or "",
                        "category": cat_name,
                        "created_at": mem.created_at.isoformat()
                        if mem.created_at
                        else "",
                        "similarity": None,
                    }
                )

    return results[:limit]


def _build_rag_context(memories: list[dict]) -> str:
    """Format retrieved memories into context for the LLM."""
    if not memories:
        return "No relevant memories found."

    parts = []
    for i, m in enumerate(memories, 1):
        content = m["summary"] or m["transcription"] or m["content"]
        # Truncate long content
        if len(content) > 500:
            content = content[:500] + "..."
        date_str = m["created_at"][:10] if m["created_at"] else "unknown date"
        cat_str = f" [{m['category']}]" if m.get("category") else ""
        type_str = m["type"]
        parts.append(f"Memory #{i} ({type_str}, {date_str}{cat_str}):\n{content}")

    return "\n\n".join(parts)


@router.post("/chat", response_model=dict)
async def chat_with_memories(
    body: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI Chat with your memories (RAG).

    Retrieves relevant memories based on the user's question, then uses GPT
    to generate an answer grounded in the user's own data. Returns the
    answer along with the source memory IDs used for context.

    Supports conversation history for multi-turn chats.
    """
    from openai import AsyncOpenAI
    from app.config import settings

    if not ai_service._has_valid_key():
        raise HTTPException(
            status_code=503, detail="AI features require an OpenAI API key."
        )

    user_language = await _get_user_language(request, db, current_user.id)

    # Count total memories for context
    total_q = await db.execute(
        select(func.count())
        .select_from(Memory)
        .where(
            and_(Memory.user_id == current_user.id, Memory.is_deleted == False)  # noqa: E712
        )
    )
    total_memories = total_q.scalar() or 0

    # Retrieve relevant memories
    relevant = await _retrieve_relevant_memories(
        db, current_user.id, body.message, limit=8
    )
    context = _build_rag_context(relevant)

    # Build conversation
    lang_inst = ai_service._language_instruction(user_language)
    system_prompt = (
        f"You are a personal memory assistant. The user has {total_memories} saved memories "
        f"(text notes, voice memos, links, photos). They are asking questions about their "
        f"own life and saved information.\n\n"
        f"RELEVANT MEMORIES:\n{context}\n\n"
        f"INSTRUCTIONS:\n"
        f"- Answer the user's question using ONLY the memories provided above.\n"
        f"- If the memories contain the answer, be specific and reference dates/details.\n"
        f"- If the memories don't contain enough information, say so honestly.\n"
        f"- Be conversational, warm, and helpful — you're their personal assistant.\n"
        f"- Keep answers concise but informative (2-4 sentences usually).\n"
        f"- When referencing memories, mention approximate dates when available."
        f"{lang_inst}"
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 10 turns)
    if body.history:
        for msg in body.history[-10:]:
            if msg.role in ("user", "assistant"):
                messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": body.message})

    # Stream or non-stream response
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    if body.stream:

        async def generate():
            try:
                stream = await client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=800,
                    stream=True,
                )
                # Send source memories first
                yield f"data: {json.dumps({'type': 'sources', 'sources': [{'id': m['id'], 'type': m['type'], 'content': (m['summary'] or m['content'])[:100], 'created_at': m['created_at'], 'similarity': m.get('similarity')} for m in relevant]})}\n\n"

                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield f"data: {json.dumps({'type': 'token', 'content': chunk.choices[0].delta.content})}\n\n"

                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            except Exception as exc:
                log.error("Chat stream error: %s", exc)
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    # Non-streaming
    try:
        completion = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=800,
        )
        answer = completion.choices[0].message.content or ""
    except Exception as exc:
        log.error("Chat completion failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to generate response")

    return {
        "answer": answer,
        "sources": [
            {
                "id": m["id"],
                "type": m["type"],
                "content": (m["summary"] or m["content"])[:100],
                "created_at": m["created_at"],
                "similarity": m.get("similarity"),
            }
            for m in relevant
        ],
        "total_memories": total_memories,
    }


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


@router.post("/chat/suggestions", response_model=dict)
async def get_chat_suggestions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate smart conversation starters based on user's memory patterns.

    Returns contextual questions the user might want to ask about their memories.
    Respects the Accept-Language header to return suggestions in the user's language.
    """
    from datetime import datetime, timezone, timedelta

    lang = await _get_user_language(request, db, current_user.id)

    now = datetime.now(timezone.utc)
    base = and_(Memory.user_id == current_user.id, Memory.is_deleted == False)  # noqa: E712

    suggestions = []

    # Get recent categories (raw names – will be localised inline for vi)
    cat_q = await db.execute(
        select(Category.name)
        .join(Memory, Memory.category_id == Category.id)
        .where(and_(base, Memory.created_at >= now - timedelta(days=30)))
        .group_by(Category.name)
        .order_by(func.count().desc())
        .limit(3)
    )
    top_cats = [r[0] for r in cat_q.all()]

    # Get memory count
    count_q = await db.execute(select(func.count()).select_from(Memory).where(base))
    total = count_q.scalar() or 0

    # Get type distribution
    type_q = await db.execute(
        select(Memory.type, func.count().label("cnt"))
        .where(base)
        .group_by(Memory.type)
        .order_by(text("cnt DESC"))
    )
    types = {
        r[0].value if hasattr(r[0], "value") else str(r[0]): r[1] for r in type_q.all()
    }

    # Build contextual suggestions (language-aware)
    if lang == "vi":
        if total == 0:
            suggestions = [
                "Bạn có thể giúp tôi gì?",
                "Tìm kiếm ký ức hoạt động như thế nào?",
            ]
        else:
            suggestions.append("Tôi đã lưu gì tuần này?")

            if top_cats:
                suggestions.append(f"Tóm tắt ký ức {top_cats[0].lower()} của tôi")
                if len(top_cats) > 1:
                    suggestions.append(
                        f"Có mô hình nào trong ghi chú {top_cats[1].lower()} của tôi không?"
                    )

            if types.get("link", 0) > 2:
                suggestions.append("Tôi đã lưu những bài viết nào gần đây?")
            if types.get("voice", 0) > 2:
                suggestions.append("Tôi đã nói về điều gì trong các ghi âm của mình?")
            if total > 20:
                suggestions.append("Chủ đề chính trong ký ức của tôi là gì?")
                suggestions.append("Tháng trước tôi tập trung vào điều gì?")
    else:
        if total == 0:
            suggestions = [
                "What can you help me with?",
                "How does memory search work?",
            ]
        else:
            suggestions.append("What did I save this week?")

            if top_cats:
                suggestions.append(f"Summarize my {top_cats[0].lower()} memories")
                if len(top_cats) > 1:
                    suggestions.append(
                        f"What patterns do you see in my {top_cats[1].lower()} notes?"
                    )

            if types.get("link", 0) > 2:
                suggestions.append("What articles have I saved recently?")
            if types.get("voice", 0) > 2:
                suggestions.append("What have I been talking about in my voice notes?")
            if total > 20:
                suggestions.append("What are the main themes in my memories?")
                suggestions.append("What was I focused on last month?")

    return {"suggestions": suggestions[:5]}
