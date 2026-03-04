from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, text, func
from pydantic import BaseModel
from typing import List
import uuid

from app.database import get_db
from app.models.memory import Memory
from app.models.user import User
from app.api.deps import get_current_user
from app.api.preferences import get_or_create_preferences
from app.services import ai_service

router = APIRouter()

_VALID_LANGS = {"en", "vi"}


async def _get_user_language(request: Request, db: AsyncSession, user_id) -> str:
    """Get user language from Accept-Language header (real-time) or DB preference (fallback)."""
    header_lang = (request.headers.get("accept-language") or "").split(",")[0].strip()[:2].lower()
    if header_lang in _VALID_LANGS:
        return header_lang
    prefs = await get_or_create_preferences(db, user_id)
    return (prefs.language or "en") if prefs else "en"


class GroupRequest(BaseModel):
    memory_ids: List[str]


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


@router.get("/search", response_model=dict)
async def semantic_search(
    q: str = Query(..., min_length=1, description="Natural language search query"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI-powered semantic search across all memories.

    Strategy:
      1. Generate an embedding for the query via OpenAI.
      2. If embeddings are available, perform pgvector cosine-distance search
         among the user's memories that have embeddings.
      3. Fall back to multi-field keyword ILIKE search when embeddings are
         unavailable (no OpenAI key or no embeddings stored yet).
      4. Return a merged, deduplicated result set.
    """
    import logging
    log = logging.getLogger(__name__)

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
            embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
            stmt = (
                select(
                    Memory,
                    Memory.embedding.cosine_distance(query_embedding).label("distance"),
                )
                .where(
                    and_(
                        Memory.user_id == current_user.id,
                        Memory.is_deleted == False,  # noqa: E712
                        Memory.embedding != None,    # noqa: E711
                    )
                )
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
    search_pattern = f"%{q}%"
    keyword_stmt = (
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
    keyword_results = await db.execute(keyword_stmt)
    for m in keyword_results.scalars().all():
        mid = str(m.id)
        if mid not in seen_ids:
            seen_ids.add(mid)
            results.append(_mem_to_dict(m))

    return {"query": q, "results": results[:limit], "total": len(results[:limit])}


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

    summary = await ai_service.generate_summary(content_to_summarise, mem_type, user_language)

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
    batch_size: int = Query(50, ge=1, le=200, description="Number of memories to process per call"),
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
                Memory.embedding == None,    # noqa: E711
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
        log.info("Backfilled embeddings for %d memories (user=%s)", processed, current_user.id)

    # Count remaining
    remaining_result = await db.execute(
        select(func.count()).where(
            and_(
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,  # noqa: E712
                Memory.embedding == None,    # noqa: E711
            )
        )
    )
    remaining = remaining_result.scalar() or 0

    return {
        "processed": processed,
        "failed": failed,
        "remaining": remaining,
    }
