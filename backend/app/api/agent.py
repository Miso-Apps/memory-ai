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
    """Mark an insight as opened."""
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
    """Dismiss an insight."""
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

    if not insight.dismissed_at:
        insight.dismissed_at = datetime.now(timezone.utc)
        await db.commit()
    return {"ok": True}
