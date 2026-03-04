"""User preferences model for personalization"""
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, func, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum
from app.database import Base


class ThemeMode(str, enum.Enum):
    """Theme preference enum"""
    LIGHT = "light"
    DARK = "dark"
    AUTO = "auto"


class DefaultCaptureType(str, enum.Enum):
    """Default capture mode preference"""
    TEXT = "text"
    VOICE = "voice"
    PHOTO = "photo"
    LINK = "link"


class UserPreferences(Base):
    """User preferences model for personalization"""
    __tablename__ = "user_preferences"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    # Appearance
    theme_mode = Column(Enum(ThemeMode), default=ThemeMode.AUTO)
    accent_color = Column(String(20), nullable=True, default="#6366F1")
    
    # Capture preferences
    default_capture_type = Column(Enum(DefaultCaptureType), default=DefaultCaptureType.TEXT)
    auto_summarize = Column(Boolean, default=True, server_default='true')
    auto_categorize = Column(Boolean, default=True, server_default='true')
    
    # AI features
    ai_recall_enabled = Column(Boolean, default=True, server_default='true')
    ai_suggestions_enabled = Column(Boolean, default=True, server_default='true')
    
    # Privacy
    save_location = Column(Boolean, default=False, server_default='false')
    analytics_enabled = Column(Boolean, default=True, server_default='true')
    
    # Notifications
    daily_digest = Column(Boolean, default=True, server_default='true')
    reminder_notifications = Column(Boolean, default=True, server_default='true')
    weekly_recap = Column(Boolean, default=True, server_default='true')
    
    # Home screen customization
    home_sections = Column(JSONB, default=lambda: {
        "unreviewed": True,
        "revisit": True,
        "on_this_day": True,
        "recent": True,
    })
    
    # Category preferences (pinned categories, hidden categories)
    pinned_categories = Column(JSONB, default=list)
    hidden_categories = Column(JSONB, default=list)
    
    # Language
    language = Column(String(10), default='en', server_default='en')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<UserPreferences for user {self.user_id}>"
