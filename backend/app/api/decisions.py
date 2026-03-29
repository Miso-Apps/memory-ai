from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.decision_memory import DecisionMemory
from app.models.memory import Memory
from app.models.user import User
from app.schemas import (
    DecisionCreate,
    DecisionListResponse,
    DecisionResponse,
    DecisionReview,
    DecisionUpdate,
)

router = APIRouter()


def _to_dict(d: DecisionMemory) -> dict:
    return {
        "id": str(d.id),
        "user_id": str(d.user_id),
        "memory_id": str(d.memory_id) if d.memory_id else None,
        "title": d.title,
        "rationale": d.rationale,
        "expected_outcome": d.expected_outcome,
        "revisit_at": d.revisit_at,
        "status": d.status,
        "reviewed_at": d.reviewed_at,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
    }


@router.post("/", response_model=DecisionResponse)
async def create_decision(
    body: DecisionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memory_id = None
    if body.memory_id:
        try:
            memory_id = uuid.UUID(body.memory_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid memory_id")

        mem_q = await db.execute(
            select(Memory).where(
                and_(
                    Memory.id == memory_id,
                    Memory.user_id == current_user.id,
                    Memory.is_deleted == False,  # noqa: E712
                )
            )
        )
        if not mem_q.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Memory not found")

    record = DecisionMemory(
        user_id=current_user.id,
        memory_id=memory_id,
        title=body.title,
        rationale=body.rationale,
        expected_outcome=body.expected_outcome,
        revisit_at=body.revisit_at,
        status="open",
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return _to_dict(record)


@router.get("/", response_model=DecisionListResponse)
async def list_decisions(
    status: str | None = Query(None, pattern=r"^(open|reviewed|archived)$"),
    due_before: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = [DecisionMemory.user_id == current_user.id]
    if status:
        conditions.append(DecisionMemory.status == status)
    if due_before:
        conditions.append(DecisionMemory.revisit_at != None)  # noqa: E711
        conditions.append(DecisionMemory.revisit_at <= due_before)

    total_q = await db.execute(select(func.count()).where(and_(*conditions)))
    total = total_q.scalar() or 0

    result = await db.execute(
        select(DecisionMemory)
        .where(and_(*conditions))
        .order_by(DecisionMemory.revisit_at.asc().nullslast(), DecisionMemory.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [_to_dict(row) for row in result.scalars().all()]
    return {"items": items, "total": total}


@router.patch("/{decision_id}", response_model=DecisionResponse)
async def update_decision(
    decision_id: str,
    body: DecisionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        did = uuid.UUID(decision_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Decision not found")

    q = await db.execute(
        select(DecisionMemory).where(
            and_(DecisionMemory.id == did, DecisionMemory.user_id == current_user.id)
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Decision not found")

    if body.title is not None:
        row.title = body.title
    if body.rationale is not None:
        row.rationale = body.rationale
    if body.expected_outcome is not None:
        row.expected_outcome = body.expected_outcome
    if body.revisit_at is not None:
        row.revisit_at = body.revisit_at
    if body.status is not None:
        row.status = body.status
        if body.status == "reviewed":
            row.reviewed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(row)
    return _to_dict(row)


@router.post("/{decision_id}/review", response_model=DecisionResponse)
async def review_decision(
    decision_id: str,
    body: DecisionReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        did = uuid.UUID(decision_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Decision not found")

    q = await db.execute(
        select(DecisionMemory).where(
            and_(DecisionMemory.id == did, DecisionMemory.user_id == current_user.id)
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Decision not found")

    row.status = body.status
    row.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(row)
    return _to_dict(row)
