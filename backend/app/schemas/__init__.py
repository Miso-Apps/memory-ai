"""
Pydantic schemas for DukiAI Memory API
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ============ Memory Schemas ============


class MemoryType(str, Enum):
    TEXT = "text"
    LINK = "link"
    VOICE = "voice"
    PHOTO = "photo"
    RICH = "rich"


class MemoryBlock(BaseModel):
    """One block within a rich mixed-media memory."""

    type: str = Field(..., description="'text' | 'image' | 'voice' | 'link'")
    order_index: int = Field(..., ge=0)
    # text
    content: Optional[str] = Field(None, max_length=50000)
    # image
    image_url: Optional[str] = Field(None, max_length=512)
    thumbnail_url: Optional[str] = Field(None, max_length=512)
    caption: Optional[str] = Field(None, max_length=2000)
    # voice
    audio_url: Optional[str] = Field(None, max_length=512)
    transcription: Optional[str] = Field(None, max_length=50000)
    duration: Optional[int] = None  # seconds
    # link
    url: Optional[str] = Field(None, max_length=512)


class MemoryCreate(BaseModel):
    """Request schema for creating a memory"""

    type: MemoryType
    # content can be empty for voice memories where only an audio_url is provided
    content: str = Field("", max_length=50000)
    metadata: Optional[dict] = None
    # Voice-specific
    transcription: Optional[str] = Field(None, max_length=50000)
    audio_url: Optional[str] = Field(None, max_length=512)
    audio_duration: Optional[int] = None  # seconds
    # Photo-specific
    image_url: Optional[str] = Field(None, max_length=512)
    # Rich mixed-media
    blocks: Optional[List["MemoryBlock"]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "type": "text",
                "content": "Meeting notes: Discuss product launch timeline",
                "metadata": {"tags": ["work", "meeting"]},
            }
        }


class MemoryUpdate(BaseModel):
    """Request schema for updating a memory"""

    content: Optional[str] = Field(None, min_length=1, max_length=50000)
    metadata: Optional[dict] = None


class MemoryResponse(BaseModel):
    """Response schema for a single memory"""

    id: str
    user_id: str
    type: MemoryType
    content: str
    transcription: Optional[str] = None
    audio_url: Optional[str] = None
    audio_duration: Optional[int] = None
    image_url: Optional[str] = None
    ai_summary: Optional[str] = None
    metadata: Optional[dict] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    category_confidence: Optional[int] = None
    blocks: Optional[List["MemoryBlock"]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MemoryListResponse(BaseModel):
    """Response schema for listing memories"""

    memories: List[MemoryResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    next_offset: Optional[int] = None


# ============ AI Schemas ============


class RecallItem(BaseModel):
    """A memory with context for why it's being recalled"""

    memory: MemoryResponse
    reason: str = Field(..., description="Why this memory is relevant now")


class RecallResponse(BaseModel):
    """Response schema for AI recall suggestions"""

    items: List[RecallItem]


class RadarItem(BaseModel):
    """A memory card with explainable radar metadata."""

    memory: MemoryResponse
    reason: str
    reason_code: str
    confidence: int = Field(..., ge=0, le=100)
    action_hint: str


class RadarResponse(BaseModel):
    """Response schema for Memory Radar feed."""

    items: List[RadarItem]
    generated_at: datetime


class RadarEventCreate(BaseModel):
    """Request schema for radar interaction events."""

    memory_id: str
    event_type: str = Field(
        ..., pattern=r"^(served|opened|dismissed|acted|related_click)$"
    )
    reason_code: Optional[str] = Field(None, max_length=64)
    confidence: Optional[float] = Field(None, ge=0, le=100)
    context: Optional[dict] = None


class MemoryLinkCreate(BaseModel):
    target_memory_id: str
    link_type: str = Field("explicit", max_length=32)
    score: Optional[float] = Field(None, ge=0)
    explanation: Optional[str] = Field(None, max_length=500)


class MemoryLinkResponse(BaseModel):
    id: str
    source_memory_id: str
    target_memory_id: str
    link_type: str
    score: Optional[float] = None
    explanation: Optional[str] = None
    created_at: datetime


class DecisionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=1000)
    rationale: Optional[str] = Field(None, max_length=5000)
    expected_outcome: Optional[str] = Field(None, max_length=5000)
    revisit_at: Optional[datetime] = None
    memory_id: Optional[str] = None


class DecisionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=1000)
    rationale: Optional[str] = Field(None, max_length=5000)
    expected_outcome: Optional[str] = Field(None, max_length=5000)
    revisit_at: Optional[datetime] = None
    status: Optional[str] = Field(None, pattern=r"^(open|reviewed|archived)$")


class DecisionReview(BaseModel):
    status: str = Field("reviewed", pattern=r"^(reviewed|archived)$")


class DecisionResponse(BaseModel):
    id: str
    user_id: str
    memory_id: Optional[str] = None
    title: str
    rationale: Optional[str] = None
    expected_outcome: Optional[str] = None
    revisit_at: Optional[datetime] = None
    status: str
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class DecisionListResponse(BaseModel):
    items: List[DecisionResponse]
    total: int


class SearchResponse(BaseModel):
    """Response schema for semantic search"""

    query: str
    results: List[MemoryResponse]
    total: int


# ============ Auth Schemas ============


class UserCreate(BaseModel):
    """Request schema for user registration"""

    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    password: str = Field(..., min_length=8)
    name: Optional[str] = None


class UserLogin(BaseModel):
    """Request schema for user login"""

    email: str
    password: str


class TokenResponse(BaseModel):
    """Response schema for authentication tokens"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Response schema for user data"""

    id: str
    email: str
    name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Common Schemas ============


class StatusResponse(BaseModel):
    """Generic status response"""

    status: str
    message: Optional[str] = None


# ============ Category Schemas ============


class CategoryCreate(BaseModel):
    """Request schema for creating a category"""

    name: str = Field(..., min_length=1, max_length=100)
    icon: Optional[str] = Field("📁", max_length=10)
    color: Optional[str] = Field("#6B7280", max_length=20)
    description: Optional[str] = Field(None, max_length=255)


class CategoryUpdate(BaseModel):
    """Request schema for updating a category"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=10)
    color: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class CategoryResponse(BaseModel):
    """Response schema for a category"""

    id: str
    name: str
    icon: Optional[str] = "📁"
    color: Optional[str] = "#6B7280"
    description: Optional[str] = None
    is_system: bool = False
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ============ User Preferences Schemas ============


class ThemeModeEnum(str, Enum):
    LIGHT = "light"
    DARK = "dark"
    AUTO = "auto"


class DefaultCaptureEnum(str, Enum):
    TEXT = "text"
    VOICE = "voice"
    PHOTO = "photo"
    LINK = "link"


class HomeSections(BaseModel):
    """Home screen section visibility"""

    unreviewed: bool = True
    revisit: bool = True
    on_this_day: bool = True
    recent: bool = True


class UserPreferencesUpdate(BaseModel):
    """Request schema for updating user preferences"""

    theme_mode: Optional[ThemeModeEnum] = None
    accent_color: Optional[str] = Field(None, max_length=20)
    default_capture_type: Optional[DefaultCaptureEnum] = None
    auto_summarize: Optional[bool] = None
    auto_categorize: Optional[bool] = None
    ai_recall_enabled: Optional[bool] = None
    ai_suggestions_enabled: Optional[bool] = None
    streaming_responses: Optional[bool] = None
    save_location: Optional[bool] = None
    analytics_enabled: Optional[bool] = None
    daily_digest: Optional[bool] = None
    reminder_notifications: Optional[bool] = None
    weekly_recap: Optional[bool] = None
    home_sections: Optional[HomeSections] = None
    pinned_categories: Optional[List[str]] = None
    hidden_categories: Optional[List[str]] = None
    language: Optional[str] = Field(None, max_length=10)
    recall_sensitivity: Optional[str] = Field(None, pattern=r"^(low|medium|high)$")
    proactive_recall_opt_in: Optional[bool] = None


class UserPreferencesResponse(BaseModel):
    """Response schema for user preferences"""

    id: str
    user_id: str
    theme_mode: str = "auto"
    accent_color: Optional[str] = "#6366F1"
    default_capture_type: str = "text"
    auto_summarize: bool = True
    auto_categorize: bool = True
    ai_recall_enabled: bool = True
    ai_suggestions_enabled: bool = True
    streaming_responses: bool = True
    save_location: bool = False
    analytics_enabled: bool = True
    daily_digest: bool = True
    reminder_notifications: bool = True
    weekly_recap: bool = True
    home_sections: dict = {}
    pinned_categories: List[str] = []
    hidden_categories: List[str] = []
    language: str = "en"
    recall_sensitivity: str = "medium"
    proactive_recall_opt_in: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
