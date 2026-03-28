"""User Preferences API endpoints"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.database import get_db
from app.models import UserPreferences, User
from app.schemas import UserPreferencesUpdate
from app.api.deps import get_current_user

log = logging.getLogger(__name__)

router = APIRouter()


def _to_dict(p: UserPreferences) -> dict:
    """Serialize a UserPreferences ORM object to a dict."""
    return {
        "id": str(p.id),
        "user_id": str(p.user_id),
        "theme_mode": p.theme_mode.value
        if hasattr(p.theme_mode, "value")
        else str(p.theme_mode),
        "accent_color": p.accent_color,
        "default_capture_type": p.default_capture_type.value
        if hasattr(p.default_capture_type, "value")
        else str(p.default_capture_type),
        "auto_summarize": p.auto_summarize,
        "auto_categorize": p.auto_categorize,
        "ai_recall_enabled": p.ai_recall_enabled,
        "ai_suggestions_enabled": p.ai_suggestions_enabled,
        "recall_sensitivity": p.recall_sensitivity or "medium",
        "proactive_recall_opt_in": p.proactive_recall_opt_in
        if p.proactive_recall_opt_in is not None
        else True,
        "streaming_responses": p.streaming_responses
        if p.streaming_responses is not None
        else True,
        "save_location": p.save_location,
        "analytics_enabled": p.analytics_enabled,
        "daily_digest": p.daily_digest,
        "reminder_notifications": p.reminder_notifications,
        "weekly_recap": p.weekly_recap,
        "home_sections": p.home_sections or {},
        "pinned_categories": p.pinned_categories or [],
        "hidden_categories": p.hidden_categories or [],
        "language": p.language or "en",
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


async def get_or_create_preferences(db: AsyncSession, user_id) -> UserPreferences:
    """Get user preferences, creating default ones if they don't exist."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = UserPreferences(
            user_id=user_id,
            home_sections={
                "unreviewed": True,
                "revisit": True,
                "on_this_day": True,
                "recent": True,
            },
            pinned_categories=[],
            hidden_categories=[],
        )
        db.add(prefs)
        await db.flush()
        await db.refresh(prefs)

    return prefs


@router.get("/", response_model=dict)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's preferences."""
    prefs = await get_or_create_preferences(db, current_user.id)
    return _to_dict(prefs)


@router.put("/", response_model=dict)
async def update_preferences(
    update: UserPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user's preferences."""
    prefs = await get_or_create_preferences(db, current_user.id)

    # Update only provided fields
    if update.theme_mode is not None:
        from app.models.preferences import ThemeMode

        prefs.theme_mode = ThemeMode(update.theme_mode.value)

    if update.accent_color is not None:
        prefs.accent_color = update.accent_color

    if update.default_capture_type is not None:
        from app.models.preferences import DefaultCaptureType

        prefs.default_capture_type = DefaultCaptureType(
            update.default_capture_type.value
        )

    if update.auto_summarize is not None:
        prefs.auto_summarize = update.auto_summarize

    if update.auto_categorize is not None:
        prefs.auto_categorize = update.auto_categorize

    if update.ai_recall_enabled is not None:
        prefs.ai_recall_enabled = update.ai_recall_enabled

    if update.ai_suggestions_enabled is not None:
        prefs.ai_suggestions_enabled = update.ai_suggestions_enabled

    if update.recall_sensitivity is not None:
        prefs.recall_sensitivity = update.recall_sensitivity

    if update.proactive_recall_opt_in is not None:
        prefs.proactive_recall_opt_in = update.proactive_recall_opt_in

    if update.streaming_responses is not None:
        prefs.streaming_responses = update.streaming_responses

    if update.save_location is not None:
        prefs.save_location = update.save_location

    if update.analytics_enabled is not None:
        prefs.analytics_enabled = update.analytics_enabled

    if update.daily_digest is not None:
        prefs.daily_digest = update.daily_digest

    if update.reminder_notifications is not None:
        prefs.reminder_notifications = update.reminder_notifications

    if update.weekly_recap is not None:
        prefs.weekly_recap = update.weekly_recap

    if update.home_sections is not None:
        prefs.home_sections = update.home_sections.model_dump()

    if update.pinned_categories is not None:
        prefs.pinned_categories = update.pinned_categories

    if update.hidden_categories is not None:
        prefs.hidden_categories = update.hidden_categories

    if update.language is not None:
        prefs.language = update.language

    await db.flush()
    await db.refresh(prefs)
    return _to_dict(prefs)


@router.post("/reset", response_model=dict)
async def reset_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset preferences to defaults."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()

    if prefs:
        # Reset to defaults
        from app.models.preferences import ThemeMode, DefaultCaptureType

        prefs.theme_mode = ThemeMode.AUTO
        prefs.accent_color = "#6366F1"
        prefs.default_capture_type = DefaultCaptureType.TEXT
        prefs.auto_summarize = True
        prefs.auto_categorize = True
        prefs.ai_recall_enabled = True
        prefs.ai_suggestions_enabled = True
        prefs.recall_sensitivity = "medium"
        prefs.proactive_recall_opt_in = True
        prefs.streaming_responses = True
        prefs.save_location = False
        prefs.analytics_enabled = True
        prefs.daily_digest = True
        prefs.reminder_notifications = True
        prefs.weekly_recap = True
        prefs.home_sections = {
            "unreviewed": True,
            "revisit": True,
            "on_this_day": True,
            "recent": True,
        }
        prefs.pinned_categories = []
        prefs.hidden_categories = []
    else:
        prefs = await get_or_create_preferences(db, current_user.id)

    await db.flush()
    await db.refresh(prefs)
    return _to_dict(prefs)
