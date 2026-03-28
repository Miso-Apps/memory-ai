from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging

from app.database import get_db, AsyncSessionLocal
from app.models.memory import Memory
from app.models.user import User
from app.models import Category
from app.schemas import MemoryCreate, MemoryUpdate, MemoryListResponse, StatusResponse
from app.api.deps import get_current_user
from app.api.categories import ensure_system_categories
from app.api.preferences import get_or_create_preferences
from app.services import ai_service
from app.services.link_service import fetch_link_content

log = logging.getLogger(__name__)

router = APIRouter()

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


async def _generate_and_save_summary(
    memory_id: uuid.UUID, content: str, memory_type: str, language: str = "en"
) -> None:
    """Background task: generate AI summary and write it back to the DB."""
    # For links: fetch the page and summarise its content instead of the URL string
    if memory_type.upper() == "LINK":
        summary = await ai_service.fetch_and_summarize_link(content, language)
    else:
        summary = await ai_service.generate_summary(content, memory_type, language)
    if not summary:
        return
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Memory).where(Memory.id == memory_id))
            m = result.scalar_one_or_none()
            if m and not m.is_deleted:
                m.ai_summary = summary
                await session.commit()
                log.info("Auto-summary saved for memory %s", memory_id)
    except Exception as exc:
        log.warning("Failed to save auto-summary for memory %s: %s", memory_id, exc)


# Category cache to avoid repeated DB queries
_category_cache: dict[str, dict] = {}


async def _get_category_info(db: AsyncSession, category_id) -> dict:
    """Get category info by ID, with caching."""
    if not category_id:
        return {}

    cache_key = str(category_id)
    if cache_key in _category_cache:
        return _category_cache[cache_key]

    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()

    if cat:
        info = {
            "category_id": str(cat.id),
            "category_name": cat.name,
            "category_icon": cat.icon,
            "category_color": cat.color,
        }
        _category_cache[cache_key] = info
        return info

    return {}


def _to_dict(m: Memory, category_info: dict = None) -> dict:
    """Serialize a Memory ORM object to a dict the mobile app expects."""
    result = {
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
        "is_dismissed": m.is_deleted,  # deleted items shown as "dismissed" in UI
        "category_id": str(m.category_id) if m.category_id else None,
        "category_confidence": m.category_confidence,
        "last_viewed_at": m.last_viewed_at.isoformat() if m.last_viewed_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }

    # Add category info if provided
    if category_info:
        result.update(category_info)
    elif m.category_id:
        result["category_name"] = None
        result["category_icon"] = None
        result["category_color"] = None

    return result


# ============ CRUD Endpoints ============


async def _classify_and_save_category(
    memory_id: uuid.UUID, user_id: uuid.UUID, content: str, memory_type: str
) -> None:
    """Background task: auto-classify memory and save category."""
    try:
        async with AsyncSessionLocal() as session:
            # Get user's categories
            categories = await ensure_system_categories(session, user_id)
            if not categories:
                return

            # Check user preferences
            prefs = await get_or_create_preferences(session, user_id)
            if not prefs.auto_categorize:
                return

            # Prepare category list for classification
            cat_list = [
                {"id": str(c.id), "name": c.name, "description": c.description or ""}
                for c in categories
                if c.is_active
            ]

            # Classify content
            result = await ai_service.classify_content(content, memory_type, cat_list)

            if result.get("category_id"):
                mem_result = await session.execute(
                    select(Memory).where(Memory.id == memory_id)
                )
                m = mem_result.scalar_one_or_none()
                if m and not m.is_deleted:
                    m.category_id = uuid.UUID(result["category_id"])
                    m.category_confidence = result.get("confidence", 0)
                    await session.commit()
                    log.info(
                        "Auto-classified memory %s to category %s (confidence: %d%%)",
                        memory_id,
                        result["category_id"],
                        result.get("confidence", 0),
                    )
    except Exception as exc:
        log.warning("Auto-classification failed for memory %s: %s", memory_id, exc)


async def _generate_and_save_embedding(memory_id: uuid.UUID, content: str) -> None:
    """Background task: generate embedding vector and write it back to the DB."""
    embedding = await ai_service.generate_embedding(content)
    if not embedding:
        return
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Memory).where(Memory.id == memory_id))
            m = result.scalar_one_or_none()
            if m and not m.is_deleted:
                m.embedding = embedding
                await session.commit()
                log.info(
                    "Embedding saved for memory %s (dim=%d)", memory_id, len(embedding)
                )
    except Exception as exc:
        log.warning("Failed to save embedding for memory %s: %s", memory_id, exc)


@router.post("/", response_model=dict)
async def create_memory(
    memory: MemoryCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new memory for the authenticated user."""
    metadata = dict(memory.metadata or {})
    mem_type = memory.type.value if hasattr(memory.type, "value") else str(memory.type)

    # For link memories, enrich metadata with preview fields used by mobile UI.
    if mem_type.lower() == "link":
        try:
            link_content = await fetch_link_content(memory.content)
            image = (link_content.get("image") or "").strip()
            canonical_url = (link_content.get("url") or "").strip()

            if image.lower().startswith(("http://", "https://")):
                metadata.setdefault("og_image", image)
                metadata.setdefault("preview_image_url", image)
                metadata.setdefault("thumbnail_url", image)

            if canonical_url.lower().startswith(("http://", "https://")):
                metadata.setdefault("canonical_url", canonical_url)

            title = (link_content.get("title") or "").strip()
            description = (link_content.get("description") or "").strip()
            sitename = (link_content.get("sitename") or "").strip()
            if title:
                metadata.setdefault("title", title)
            if description:
                metadata.setdefault("description", description)
            if sitename:
                metadata.setdefault("site_name", sitename)
        except Exception as exc:
            log.debug("Link metadata enrichment skipped for %s: %s", memory.content, exc)

    m = Memory(
        user_id=current_user.id,
        type=memory.type,
        content=memory.content,
        transcription=memory.transcription,
        audio_url=memory.audio_url,
        audio_duration=memory.audio_duration,
        image_url=memory.image_url,
        extra_metadata=metadata,
    )
    db.add(m)
    await db.flush()

    # Fire-and-forget AI summary (skips silently if no OpenAI key)
    summary_content = memory.transcription or memory.content

    # Use Accept-Language header (real-time) or DB preference (fallback)
    user_language = await _get_user_language(request, db, current_user.id)

    background_tasks.add_task(
        _generate_and_save_summary, m.id, summary_content, mem_type, user_language
    )

    # Fire-and-forget embedding generation for semantic search
    background_tasks.add_task(_generate_and_save_embedding, m.id, summary_content)

    # Fire-and-forget auto-classification
    background_tasks.add_task(
        _classify_and_save_category, m.id, current_user.id, summary_content, mem_type
    )

    return _to_dict(m)


@router.get("/stats", response_model=dict)
async def get_memory_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return aggregate stats for the current user's memory collection."""
    base = and_(Memory.user_id == current_user.id, Memory.is_deleted == False)  # noqa: E712

    # Total memories
    total_result = await db.execute(select(func.count()).where(base))
    total = total_result.scalar() or 0

    # Counts by type
    type_result = await db.execute(
        select(Memory.type, func.count()).where(base).group_by(Memory.type)
    )
    by_type: dict[str, int] = {}
    for row in type_result.all():
        key = row[0].value if hasattr(row[0], "value") else str(row[0])
        by_type[key] = row[1]

    # Memories captured in the last 7 days
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_result = await db.execute(
        select(func.count()).where(and_(base, Memory.created_at >= week_ago))
    )
    this_week = week_result.scalar() or 0

    # Today count
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    today_result = await db.execute(
        select(func.count()).where(and_(base, Memory.created_at >= today_start))
    )
    today = today_result.scalar() or 0

    # Streak — consecutive days (up to today) with at least one memory
    streak = 0
    day_cursor = today_start
    for _ in range(365):  # cap at 1 year
        day_end = day_cursor + timedelta(days=1)
        day_result = await db.execute(
            select(func.count()).where(
                and_(base, Memory.created_at >= day_cursor, Memory.created_at < day_end)
            )
        )
        if (day_result.scalar() or 0) > 0:
            streak += 1
            day_cursor -= timedelta(days=1)
        else:
            # Allow skipping today if it just started, count from yesterday
            if streak == 0 and day_cursor == today_start:
                day_cursor -= timedelta(days=1)
                continue
            break

    return {
        "total": total,
        "by_type": by_type,
        "this_week": this_week,
        "today": today,
        "streak": streak,
    }


@router.get("/reminders", response_model=dict)
async def get_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return smart reminders for the home screen:
    - unreviewed: memories never viewed in detail
    - revisit: older memories worth revisiting (7-30 days old)
    - on_this_day: memories created on this date in previous months/years
    """
    now = datetime.now(timezone.utc)
    base = and_(Memory.user_id == current_user.id, Memory.is_deleted == False)  # noqa: E712

    # 1. Unreviewed — created but never opened in detail
    unreviewed_q = await db.execute(
        select(Memory)
        .where(and_(base, Memory.last_viewed_at == None))  # noqa: E711
        .order_by(Memory.created_at.desc())
        .limit(5)
    )
    unreviewed = [_to_dict(m) for m in unreviewed_q.scalars().all()]

    # 2. Revisit — between 7 and 90 days old, ordered by most forgotten
    revisit_start = now - timedelta(days=90)
    revisit_end = now - timedelta(days=7)
    revisit_q = await db.execute(
        select(Memory)
        .where(
            and_(
                base,
                Memory.created_at >= revisit_start,
                Memory.created_at <= revisit_end,
            )
        )
        .order_by(func.coalesce(Memory.last_viewed_at, Memory.created_at).asc())
        .limit(5)
    )
    revisit = [_to_dict(m) for m in revisit_q.scalars().all()]

    # 3. On this day — same day/month in previous years or months
    #    Enhanced: ±1 day window, enriched with time_ago context
    today_day = now.day
    today_month = now.month
    on_this_day_q = await db.execute(
        select(Memory)
        .where(
            and_(
                base,
                func.extract("day", Memory.created_at).between(
                    today_day - 1, today_day + 1
                ),
                func.extract("month", Memory.created_at) == today_month,
                Memory.created_at < now - timedelta(days=28),  # at least 4 weeks old
            )
        )
        .order_by(Memory.created_at.desc())
        .limit(8)
    )
    on_this_day = []
    for m in on_this_day_q.scalars().all():
        d = _to_dict(m)
        # Calculate how long ago
        if m.created_at:
            delta = now - m.created_at
            months_ago = int(delta.days / 30)
            years_ago = int(delta.days / 365)
            if years_ago >= 1:
                d["time_ago"] = f"{years_ago} year{'s' if years_ago > 1 else ''} ago"
                d["time_ago_months"] = months_ago
            else:
                d["time_ago"] = f"{months_ago} month{'s' if months_ago > 1 else ''} ago"
                d["time_ago_months"] = months_ago
        on_this_day.append(d)

    return {
        "unreviewed": unreviewed,
        "revisit": revisit,
        "on_this_day": on_this_day,
    }


@router.get("/dismissed", response_model=MemoryListResponse)
async def list_dismissed(
    limit: int = Query(100, le=200, ge=1),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List soft-deleted (dismissed) memories for the current user."""
    base_conditions = and_(Memory.user_id == current_user.id, Memory.is_deleted == True)  # noqa: E712

    total_result = await db.execute(select(func.count()).where(base_conditions))
    total = total_result.scalar() or 0

    result = await db.execute(
        select(Memory)
        .where(base_conditions)
        .order_by(Memory.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    items = [_to_dict(m) for m in result.scalars().all()]
    next_offset = offset + len(items)
    has_more = next_offset < total

    return {
        "memories": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": has_more,
        "next_offset": next_offset if has_more else None,
    }


@router.post("/{memory_id}/restore", response_model=dict)
async def restore_memory(
    memory_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore a soft-deleted memory (un-dismiss)."""
    try:
        mid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == mid,
                Memory.user_id == current_user.id,
                Memory.is_deleted == True,
            )  # noqa: E712
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Memory not found")

    m.is_deleted = False
    await db.flush()
    await db.refresh(m)
    return _to_dict(m)


@router.delete("/{memory_id}/permanent", response_model=StatusResponse)
async def permanently_delete_memory(
    memory_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a memory (hard delete, cannot be undone)."""
    try:
        mid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    result = await db.execute(
        select(Memory).where(and_(Memory.id == mid, Memory.user_id == current_user.id))
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Memory not found")

    await db.delete(m)
    await db.flush()
    return StatusResponse(
        status="permanently_deleted", message="Memory permanently deleted"
    )


@router.post("/{memory_id}/view", response_model=dict)
async def mark_viewed(
    memory_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record that the user has viewed this memory in detail."""
    try:
        mid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == mid,
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,
            )  # noqa: E712
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Memory not found")

    m.last_viewed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(m)
    return _to_dict(m)


@router.get("/", response_model=MemoryListResponse)
async def list_memories(
    type: Optional[str] = Query(
        None, description="Filter by type: text, link, voice, photo"
    ),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Text search in content"),
    limit: int = Query(100, le=200, ge=1),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List memories for the current user, newest first."""
    conditions = [
        Memory.user_id == current_user.id,
        Memory.is_deleted == False,  # noqa: E712
    ]
    if type:
        conditions.append(Memory.type == type)
    if category_id:
        try:
            cat_uuid = uuid.UUID(category_id)
            conditions.append(Memory.category_id == cat_uuid)
        except ValueError:
            pass  # Invalid UUID, ignore filter
    if search:
        # Search across content, transcription and AI summary
        search_pattern = f"%{search}%"
        conditions.append(
            or_(
                Memory.content.ilike(search_pattern),
                Memory.transcription.ilike(search_pattern),
                Memory.ai_summary.ilike(search_pattern),
            )
        )

    total_result = await db.execute(select(func.count()).where(and_(*conditions)))
    total = total_result.scalar() or 0

    result = await db.execute(
        select(Memory)
        .where(and_(*conditions))
        .order_by(Memory.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    # Fetch category info for all memories
    memories = result.scalars().all()
    results = []
    for m in memories:
        cat_info = await _get_category_info(db, m.category_id)
        results.append(_to_dict(m, cat_info))

    next_offset = offset + len(results)
    has_more = next_offset < total

    return {
        "memories": results,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": has_more,
        "next_offset": next_offset if has_more else None,
    }


@router.get("/{memory_id}", response_model=dict)
async def get_memory(
    memory_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single memory by ID (must be owned by current user)."""
    try:
        mid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == mid,
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,
            )  # noqa: E712
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Memory not found")
    return _to_dict(m)


@router.put("/{memory_id}", response_model=dict)
async def update_memory(
    memory_id: str,
    update: MemoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update content or metadata of an owned memory."""
    try:
        mid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == mid,
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,
            )  # noqa: E712
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Memory not found")

    if update.content is not None:
        m.content = update.content
    if update.metadata is not None:
        m.extra_metadata = update.metadata
    await db.flush()
    return _to_dict(m)


@router.delete("/{memory_id}", response_model=StatusResponse)
async def delete_memory(
    memory_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a memory (sets is_deleted=True). View in Dismissed."""
    try:
        mid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == mid,
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,
            )  # noqa: E712
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Memory not found")

    m.is_deleted = True
    await db.flush()
    return StatusResponse(status="deleted", message="Memory moved to Dismissed")
