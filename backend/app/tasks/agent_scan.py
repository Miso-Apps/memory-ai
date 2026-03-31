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
