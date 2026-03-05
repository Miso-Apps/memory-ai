"""Category model for auto-classification of memories"""

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, func, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base


# Predefined system categories based on modern productivity apps
SYSTEM_CATEGORIES = [
    {
        "name": "Work",
        "icon": "💼",
        "color": "#3B82F6",
        "description": "Work-related notes, meetings, tasks",
    },
    {
        "name": "Personal",
        "icon": "👤",
        "color": "#8B5CF6",
        "description": "Personal thoughts and life events",
    },
    {
        "name": "Ideas",
        "icon": "💡",
        "color": "#F59E0B",
        "description": "Creative ideas and inspiration",
    },
    {
        "name": "Tasks",
        "icon": "✅",
        "color": "#10B981",
        "description": "To-dos and action items",
    },
    {
        "name": "Research",
        "icon": "🔬",
        "color": "#6366F1",
        "description": "Learning and research materials",
    },
    {
        "name": "Entertainment",
        "icon": "🎬",
        "color": "#EC4899",
        "description": "Movies, books, music, games",
    },
    {
        "name": "Health",
        "icon": "❤️",
        "color": "#EF4444",
        "description": "Health, fitness, wellness",
    },
    {
        "name": "Finance",
        "icon": "💰",
        "color": "#14B8A6",
        "description": "Financial notes and tracking",
    },
    {
        "name": "Travel",
        "icon": "✈️",
        "color": "#0EA5E9",
        "description": "Travel plans and memories",
    },
    {
        "name": "Recipes",
        "icon": "🍳",
        "color": "#F97316",
        "description": "Food and recipes",
    },
]


class Category(Base):
    """Category model for organizing memories"""

    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Category details
    name = Column(String(100), nullable=False)
    icon = Column(String(10), nullable=True, default="📁")
    color = Column(String(20), nullable=True, default="#6B7280")
    description = Column(String(255), nullable=True)

    # Flags
    is_system = Column(
        Boolean, default=False, server_default="false"
    )  # System-defined categories
    is_active = Column(Boolean, default=True, server_default="true")

    # Ordering
    sort_order = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return f"<Category {self.name}>"
