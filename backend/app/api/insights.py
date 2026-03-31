"""
Insights API — analytics & intelligence from users' historical memory data.

Endpoints:
  GET /insights/dashboard   — Activity heatmap, category breakdown, trends
  GET /insights/weekly-recap — AI-generated weekly summary of memories
  GET /insights/related/{memory_id} — Semantically related memories (embedding-based)
  GET /insights/streaks     — Detailed streak & consistency data
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, text, cast, Integer
from typing import Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from asyncio import Lock
import uuid
import logging

from app.database import get_db
from app.models.memory import Memory
from app.models.memory_link import MemoryLink
from app.models.radar_event import RadarEvent
from app.models.category import Category
from app.models.user import User
from app.api.deps import get_current_user
from app.api.preferences import get_or_create_preferences
from app.schemas import RadarEventCreate
from app.services import ai_service

log = logging.getLogger(__name__)
router = APIRouter()

_VALID_LANGS = {"en", "vi"}

# Lightweight in-process cache for expensive weekly recap generation.
# Keyed by user + language and invalidated by a signature of recent memories.
_WEEKLY_RECAP_CACHE_TTL_SECONDS = 60 * 15
_weekly_recap_cache: dict[str, dict] = {}
_weekly_recap_cache_lock = Lock()


def _weekly_recap_cache_key(user_id: uuid.UUID, language: str) -> str:
    return f"{user_id}:{language}"


def _weekly_recap_signature(memories: list[Memory]) -> str:
    if not memories:
        return "empty"
    return "|".join(
        f"{m.id}:{(m.updated_at or m.created_at).isoformat() if (m.updated_at or m.created_at) else 'none'}"
        for m in memories
    )


async def _weekly_recap_cache_get(cache_key: str, signature: str) -> Optional[dict]:
    now_ts = datetime.now(timezone.utc).timestamp()
    async with _weekly_recap_cache_lock:
        entry = _weekly_recap_cache.get(cache_key)
        if not entry:
            return None
        if entry.get("expires_at", 0) <= now_ts:
            _weekly_recap_cache.pop(cache_key, None)
            return None
        if entry.get("signature") != signature:
            return None
        return entry.get("data")


async def _weekly_recap_cache_set(cache_key: str, signature: str, data: dict) -> None:
    now_ts = datetime.now(timezone.utc).timestamp()
    async with _weekly_recap_cache_lock:
        _weekly_recap_cache[cache_key] = {
            "signature": signature,
            "expires_at": now_ts + _WEEKLY_RECAP_CACHE_TTL_SECONDS,
            "data": data,
        }


async def _get_user_language(request: Request, db: AsyncSession, user_id) -> str:
    header_lang = (
        (request.headers.get("accept-language") or "").split(",")[0].strip()[:2].lower()
    )
    if header_lang in _VALID_LANGS:
        return header_lang
    prefs = await get_or_create_preferences(db, user_id)
    return (prefs.language or "en") if prefs else "en"


@router.get("/dashboard", response_model=dict)
async def get_insights_dashboard(
    days: int = Query(30, ge=7, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Comprehensive insights dashboard built from user's historical data.

    Returns:
      - activity_heatmap: daily memory count for the past N days
      - category_breakdown: memories per category with percentages
      - type_breakdown: memories per type (text, voice, link, photo)
      - weekly_trend: memories per week for trend visualization
      - hourly_distribution: what hours of the day user captures most
      - top_days: most active days
      - growth: comparison of this period vs. previous period
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)
    base = and_(Memory.user_id == current_user.id, Memory.is_deleted == False)  # noqa: E712

    # ── 1. Activity heatmap (day → count) ──────────────────────────────────
    heatmap_q = await db.execute(
        select(
            func.date(Memory.created_at).label("day"),
            func.count().label("count"),
        )
        .where(and_(base, Memory.created_at >= start_date))
        .group_by(func.date(Memory.created_at))
        .order_by(text("day"))
    )
    activity_heatmap = [
        {"date": str(row.day), "count": row.count} for row in heatmap_q.all()
    ]

    # ── 2. Category breakdown ──────────────────────────────────────────────
    cat_q = await db.execute(
        select(
            Memory.category_id,
            func.count().label("count"),
        )
        .where(and_(base, Memory.created_at >= start_date))
        .group_by(Memory.category_id)
        .order_by(text("count DESC"))
    )
    cat_rows = cat_q.all()
    total_categorized = sum(r.count for r in cat_rows)
    category_breakdown = []
    for row in cat_rows:
        cat_info = {}
        if row.category_id:
            cat_result = await db.execute(
                select(Category).where(Category.id == row.category_id)
            )
            cat = cat_result.scalar_one_or_none()
            if cat:
                cat_info = {
                    "category_id": str(cat.id),
                    "name": cat.name,
                    "icon": cat.icon,
                    "color": cat.color,
                }
        category_breakdown.append(
            {
                **cat_info,
                "count": row.count,
                "percentage": round(row.count / total_categorized * 100, 1)
                if total_categorized > 0
                else 0,
            }
        )

    # ── 3. Type breakdown ──────────────────────────────────────────────────
    type_q = await db.execute(
        select(
            Memory.type,
            func.count().label("count"),
        )
        .where(and_(base, Memory.created_at >= start_date))
        .group_by(Memory.type)
    )
    total_typed = 0
    type_counts = {}
    for row in type_q.all():
        key = row.type.value if hasattr(row.type, "value") else str(row.type)
        type_counts[key] = row.count
        total_typed += row.count
    type_breakdown = [
        {
            "type": t,
            "count": c,
            "percentage": round(c / total_typed * 100, 1) if total_typed > 0 else 0,
        }
        for t, c in sorted(type_counts.items(), key=lambda x: -x[1])
    ]

    # ── 4. Weekly trend ────────────────────────────────────────────────────
    # Group by ISO week for a clean chart
    weekly_q = await db.execute(
        select(
            func.date_trunc("week", Memory.created_at).label("week_start"),
            func.count().label("count"),
        )
        .where(and_(base, Memory.created_at >= start_date))
        .group_by(text("week_start"))
        .order_by(text("week_start"))
    )
    weekly_trend = [
        {
            "week": row.week_start.isoformat() if row.week_start else None,
            "count": row.count,
        }
        for row in weekly_q.all()
    ]

    # ── 5. Hourly distribution ─────────────────────────────────────────────
    hourly_q = await db.execute(
        select(
            cast(func.extract("hour", Memory.created_at), Integer).label("hour"),
            func.count().label("count"),
        )
        .where(and_(base, Memory.created_at >= start_date))
        .group_by(text("hour"))
        .order_by(text("hour"))
    )
    # Fill all 24 hours
    hourly_map = {row.hour: row.count for row in hourly_q.all()}
    hourly_distribution = [
        {"hour": h, "count": hourly_map.get(h, 0)} for h in range(24)
    ]
    # Find peak hours
    peak_hour = (
        max(hourly_distribution, key=lambda x: x["count"])["hour"]
        if hourly_distribution
        else 12
    )

    # ── 6. Top active days ─────────────────────────────────────────────────
    top_days_q = await db.execute(
        select(
            func.date(Memory.created_at).label("day"),
            func.count().label("count"),
        )
        .where(and_(base, Memory.created_at >= start_date))
        .group_by(func.date(Memory.created_at))
        .order_by(text("count DESC"))
        .limit(5)
    )
    top_days = [{"date": str(row.day), "count": row.count} for row in top_days_q.all()]

    # ── 7. Growth vs. previous period ──────────────────────────────────────
    current_count = total_typed
    prev_q = await db.execute(
        select(func.count()).where(
            and_(base, Memory.created_at >= prev_start, Memory.created_at < start_date)
        )
    )
    prev_count = prev_q.scalar() or 0
    growth_pct = (
        round((current_count - prev_count) / prev_count * 100, 1)
        if prev_count > 0
        else (100.0 if current_count > 0 else 0.0)
    )

    # ── 8. Average memories per day ────────────────────────────────────────
    active_days = len(activity_heatmap)
    avg_per_day = round(current_count / days, 1) if days > 0 else 0

    # ── 9. Longest streak ──────────────────────────────────────────────────
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    streak = 0
    longest_streak = 0
    current_streak = 0
    day_cursor = today_start
    for _ in range(min(days, 365)):
        day_end = day_cursor + timedelta(days=1)
        day_result = await db.execute(
            select(func.count()).where(
                and_(base, Memory.created_at >= day_cursor, Memory.created_at < day_end)
            )
        )
        if (day_result.scalar() or 0) > 0:
            current_streak += 1
            if streak == 0:
                streak = current_streak
        else:
            if current_streak > 0:
                longest_streak = max(longest_streak, current_streak)
                current_streak = 0
            if streak == 0 and day_cursor == today_start:
                day_cursor -= timedelta(days=1)
                continue
        day_cursor -= timedelta(days=1)
    longest_streak = max(longest_streak, current_streak)

    return {
        "period_days": days,
        "total_memories": current_count,
        "active_days": active_days,
        "avg_per_day": avg_per_day,
        "current_streak": streak,
        "longest_streak": longest_streak,
        "peak_hour": peak_hour,
        "growth_percentage": growth_pct,
        "activity_heatmap": activity_heatmap,
        "category_breakdown": category_breakdown,
        "type_breakdown": type_breakdown,
        "weekly_trend": weekly_trend,
        "hourly_distribution": hourly_distribution,
        "top_days": top_days,
    }


@router.get("/weekly-recap", response_model=dict)
async def get_weekly_recap(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI-generated weekly recap summarizing themes, patterns, and highlights
    from the user's memories over the past 7 days.
    """
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    base = and_(Memory.user_id == current_user.id, Memory.is_deleted == False)  # noqa: E712

    # Fetch this week's memories
    result = await db.execute(
        select(Memory)
        .where(and_(base, Memory.created_at >= week_ago))
        .order_by(Memory.created_at.desc())
        .limit(50)
    )
    memories = result.scalars().all()

    user_language = await _get_user_language(request, db, current_user.id)
    cache_key = _weekly_recap_cache_key(current_user.id, user_language)
    signature = _weekly_recap_signature(memories)

    cached = await _weekly_recap_cache_get(cache_key, signature)
    if cached is not None:
        return {
            "period": {"start": week_ago.isoformat(), "end": now.isoformat()},
            **cached,
        }

    if not memories:
        payload = {
            "total_memories": 0,
            "recap": None,
            "highlights": [],
            "themes": [],
        }
        await _weekly_recap_cache_set(cache_key, signature, payload)
        return {
            "period": {"start": week_ago.isoformat(), "end": now.isoformat()},
            **payload,
        }

    # Build content summaries for AI
    memory_summaries = []
    for m in memories:
        content = m.ai_summary or m.transcription or m.content or ""
        mem_type = m.type.value if hasattr(m.type, "value") else str(m.type)
        day = m.created_at.strftime("%A") if m.created_at else "Unknown"
        memory_summaries.append(f"[{day}, {mem_type}] {content[:150]}")

    # Get counts by type and by category
    type_counts = defaultdict(int)
    cat_ids = set()
    for m in memories:
        t = m.type.value if hasattr(m.type, "value") else str(m.type)
        type_counts[t] += 1
        if m.category_id:
            cat_ids.add(m.category_id)

    # Get category names
    categories_used = []
    for cid in cat_ids:
        cat_result = await db.execute(select(Category).where(Category.id == cid))
        cat = cat_result.scalar_one_or_none()
        if cat:
            categories_used.append({"name": cat.name, "icon": cat.icon})

    # Generate AI recap
    recap_text = await _generate_weekly_recap(
        memory_summaries, dict(type_counts), categories_used, user_language
    )

    # Pick top 3 highlights (most interesting memories based on length & recency)
    sorted_mems = sorted(
        memories, key=lambda m: len(m.ai_summary or m.content or ""), reverse=True
    )
    highlights = []
    for m in sorted_mems[:3]:
        highlights.append(
            {
                "id": str(m.id),
                "type": m.type.value if hasattr(m.type, "value") else str(m.type),
                "content": (m.ai_summary or m.content or "")[:100],
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
        )

    payload = {
        "total_memories": len(memories),
        "by_type": dict(type_counts),
        "categories_used": categories_used,
        "recap": recap_text,
        "highlights": highlights,
    }

    await _weekly_recap_cache_set(cache_key, signature, payload)

    return {
        "period": {"start": week_ago.isoformat(), "end": now.isoformat()},
        **payload,
    }


async def _generate_weekly_recap(
    memory_summaries: list[str],
    type_counts: dict[str, int],
    categories: list[dict],
    language: str = "en",
) -> Optional[str]:
    """Use OpenAI to generate a personalized weekly recap."""
    if not ai_service._has_valid_key():
        # Fallback: generate a simple text recap without AI
        total = sum(type_counts.values())
        cat_names = (
            ", ".join(c["name"] for c in categories[:3])
            if categories
            else "various topics"
        )
        return (
            f"This week you saved {total} memories across {cat_names}. "
            f"You captured {type_counts.get('text', 0)} notes, "
            f"{type_counts.get('voice', 0)} voice memos, "
            f"{type_counts.get('link', 0)} links, and "
            f"{type_counts.get('photo', 0)} photos."
        )

    try:
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        summaries_text = "\n".join(f"- {s}" for s in memory_summaries[:30])
        lang_note = ai_service._language_instruction(language)

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a thoughtful personal assistant writing a weekly recap for a memory app user. "
                        "Analyze their saved memories and write a warm, personal 2-3 sentence summary highlighting: "
                        "1) Key themes they focused on this week "
                        "2) Any interesting patterns or connections between their memories "
                        "3) An encouraging note about their memory-capturing habit. "
                        "Be specific — reference actual topics from their notes. "
                        "Keep it under 60 words. Sound natural, not robotic."
                        + lang_note
                    ),
                },
                {
                    "role": "user",
                    "content": f"Here are my memories from this week:\n\n{summaries_text}",
                },
            ],
            max_tokens=150,
            temperature=0.7,
        )
        recap = (response.choices[0].message.content or "").strip()
        return recap or None
    except Exception as exc:
        log.warning("Weekly recap generation failed: %s", exc)
        return None


@router.get("/related/{memory_id}", response_model=dict)
async def get_related_memories(
    memory_id: str,
    limit: int = Query(
        5, ge=1, le=15, description="Number of related memories to return"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Find semantically related memories using embedding cosine similarity.

    Uses the existing pgvector embedding infrastructure to find memories
    whose content is conceptually related to the given memory.
    """
    try:
        mid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    # Get the source memory
    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == mid,
                Memory.user_id == current_user.id,
                Memory.is_deleted == False,
            )  # noqa: E712
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Memory not found")

    related = []
    added_ids: set[str] = set()

    # Strategy 0: Explicit links created by user
    explicit_q = await db.execute(
        select(MemoryLink, Memory)
        .join(Memory, Memory.id == MemoryLink.target_memory_id)
        .where(
            and_(
                MemoryLink.user_id == current_user.id,
                MemoryLink.source_memory_id == mid,
                Memory.is_deleted == False,  # noqa: E712
            )
        )
        .order_by(MemoryLink.created_at.desc())
        .limit(limit)
    )
    for link_row, mem in explicit_q.all():
        cat_info = {}
        if mem.category_id:
            cat_result = await db.execute(select(Category).where(Category.id == mem.category_id))
            cat = cat_result.scalar_one_or_none()
            if cat:
                cat_info = {
                    "category_name": cat.name,
                    "category_icon": cat.icon,
                    "category_color": cat.color,
                }

        mem_id = str(mem.id)
        related.append(
            {
                "id": mem_id,
                "type": mem.type.value if hasattr(mem.type, "value") else str(mem.type),
                "content": mem.ai_summary
                or (
                    mem.content[:120] + "..."
                    if len(mem.content or "") > 120
                    else mem.content
                ),
                "similarity": round(float(link_row.score), 3)
                if link_row.score is not None
                else None,
                "created_at": mem.created_at.isoformat() if mem.created_at else None,
                "link_type": link_row.link_type,
                "explanation": link_row.explanation,
                **cat_info,
            }
        )
        added_ids.add(mem_id)
        if len(related) >= limit:
            break

    # Strategy 1: Embedding-based similarity (if source has embedding)
    if source.embedding is not None and len(related) < limit:
        try:
            stmt = (
                select(
                    Memory,
                    Memory.embedding.cosine_distance(source.embedding).label(
                        "distance"
                    ),
                )
                .where(
                    and_(
                        Memory.user_id == current_user.id,
                        Memory.is_deleted == False,  # noqa: E712
                        Memory.embedding != None,  # noqa: E711
                        Memory.id != mid,  # exclude self
                    )
                )
                .order_by(text("distance"))
                .limit(limit - len(related))
            )
            vector_results = await db.execute(stmt)
            for row in vector_results.all():
                mem = row[0]
                distance = float(row[1])
                similarity = max(0.0, 1.0 - distance)
                if similarity > 0.10 and str(mem.id) not in added_ids:  # threshold for "related"
                    # Get category info
                    cat_info = {}
                    if mem.category_id:
                        cat_result = await db.execute(
                            select(Category).where(Category.id == mem.category_id)
                        )
                        cat = cat_result.scalar_one_or_none()
                        if cat:
                            cat_info = {
                                "category_name": cat.name,
                                "category_icon": cat.icon,
                                "category_color": cat.color,
                            }

                    related.append(
                        {
                            "id": str(mem.id),
                            "type": mem.type.value
                            if hasattr(mem.type, "value")
                            else str(mem.type),
                            "content": mem.ai_summary
                            or (
                                mem.content[:120] + "..."
                                if len(mem.content or "") > 120
                                else mem.content
                            ),
                            "similarity": round(similarity, 3),
                            "created_at": mem.created_at.isoformat()
                            if mem.created_at
                            else None,
                            "link_type": "semantic",
                            **cat_info,
                        }
                    )
                    added_ids.add(str(mem.id))
                    if len(related) >= limit:
                        break
        except Exception as exc:
            log.warning("Embedding similarity search failed: %s", exc)

    # Strategy 2: Fallback — same category, close in time
    if len(related) < limit and source.category_id:
        already_ids = {r["id"] for r in related}
        already_ids.add(str(mid))
        fallback_q = await db.execute(
            select(Memory)
            .where(
                and_(
                    Memory.user_id == current_user.id,
                    Memory.is_deleted == False,  # noqa: E712
                    Memory.category_id == source.category_id,
                    Memory.id != mid,
                    Memory.id.notin_(
                        [uuid.UUID(i) for i in already_ids if i != str(mid)]
                    )
                    if already_ids - {str(mid)}
                    else True,
                )
            )
            .order_by(
                func.abs(func.extract("epoch", Memory.created_at - source.created_at))
            )
            .limit(limit - len(related))
        )
        for mem in fallback_q.scalars().all():
            if str(mem.id) not in already_ids and str(mem.id) not in added_ids:
                cat_info = {}
                if mem.category_id:
                    cat_result = await db.execute(
                        select(Category).where(Category.id == mem.category_id)
                    )
                    cat = cat_result.scalar_one_or_none()
                    if cat:
                        cat_info = {
                            "category_name": cat.name,
                            "category_icon": cat.icon,
                            "category_color": cat.color,
                        }
                related.append(
                    {
                        "id": str(mem.id),
                        "type": mem.type.value
                        if hasattr(mem.type, "value")
                        else str(mem.type),
                        "content": mem.ai_summary
                        or (
                            mem.content[:120] + "..."
                            if len(mem.content or "") > 120
                            else mem.content
                        ),
                        "similarity": None,
                        "created_at": mem.created_at.isoformat()
                        if mem.created_at
                        else None,
                        "link_type": "temporal",
                        **cat_info,
                    }
                )
                added_ids.add(str(mem.id))

    return {
        "memory_id": memory_id,
        "related": related,
        "total": len(related),
    }


@router.post("/related/events", response_model=dict)
async def create_related_event(
    body: RadarEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Track related-memory click events for CTR instrumentation."""
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
        event_type="related_click",
        reason_code=body.reason_code or "related_memory",
        confidence=body.confidence,
        context=body.context or {},
    )
    db.add(event)
    await db.flush()

    return {"status": "ok", "event_id": str(event.id)}


@router.get("/streaks", response_model=dict)
async def get_streak_details(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Detailed streak and consistency data:
    - Current streak
    - Longest streak ever
    - Total active days
    - Consistency rate (% of days with at least 1 memory since first memory)
    - Monthly breakdown of active days
    """
    now = datetime.now(timezone.utc)
    base = and_(Memory.user_id == current_user.id, Memory.is_deleted == False)  # noqa: E712

    # Get first memory date
    first_q = await db.execute(select(func.min(Memory.created_at)).where(base))
    first_date = first_q.scalar()
    if not first_date:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "total_active_days": 0,
            "total_days_since_start": 0,
            "consistency_rate": 0,
            "monthly_activity": [],
        }

    # Get all active dates
    active_dates_q = await db.execute(
        select(func.date(Memory.created_at).label("day"))
        .where(base)
        .group_by(func.date(Memory.created_at))
        .order_by(text("day DESC"))
    )
    active_dates = sorted([row.day for row in active_dates_q.all()])
    total_active = len(active_dates)

    # Calculate streaks
    today = now.date()
    current_streak = 0
    longest_streak = 0
    temp_streak = 0

    # Check if today is active
    date_set = set(active_dates)
    check_date = today
    if check_date not in date_set:
        check_date = today - timedelta(days=1)

    while check_date in date_set:
        current_streak += 1
        check_date -= timedelta(days=1)

    # Calculate longest streak
    if active_dates:
        temp_streak = 1
        for i in range(1, len(active_dates)):
            if (active_dates[i] - active_dates[i - 1]).days == 1:
                temp_streak += 1
            else:
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 1
        longest_streak = max(longest_streak, temp_streak)

    # Days since start
    total_days_since_start = (
        today - first_date.date() if hasattr(first_date, "date") else today - first_date
    ).days + 1
    consistency_rate = (
        round(total_active / total_days_since_start * 100, 1)
        if total_days_since_start > 0
        else 0
    )

    # Monthly activity
    monthly = defaultdict(int)
    for d in active_dates:
        key = d.strftime("%Y-%m")
        monthly[key] += 1
    monthly_activity = [
        {"month": k, "active_days": v} for k, v in sorted(monthly.items())
    ]

    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_active_days": total_active,
        "total_days_since_start": total_days_since_start,
        "consistency_rate": consistency_rate,
        "first_memory_date": first_date.isoformat() if first_date else None,
        "monthly_activity": monthly_activity,
    }


@router.get("/recall-rate", response_model=dict)
async def get_recall_rate(
    days: int = Query(30, ge=7, le=90, description="Rolling time window in days"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return recall open-rate from radar served/opened events."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = and_(
        RadarEvent.user_id == current_user.id,
        RadarEvent.created_at >= since,
    )

    served_result = await db.execute(
        select(func.count()).where(and_(base, RadarEvent.event_type == "served"))
    )
    opened_result = await db.execute(
        select(func.count()).where(and_(base, RadarEvent.event_type == "opened"))
    )

    served = served_result.scalar() or 0
    opened = opened_result.scalar() or 0
    recall_rate = round((opened / served) * 100, 1) if served > 0 else 0.0

    return {
        "days": days,
        "served": served,
        "opened": opened,
        "recall_rate": recall_rate,
    }
