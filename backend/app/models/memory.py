from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    DateTime,
    Boolean,
    ForeignKey,
    func,
    Enum,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
import uuid
import enum
from app.database import Base
from app.config import Settings

# Use configured embedding dimension (defaults to 1536 for pgvector index compatibility)
_settings = Settings()
EMBEDDING_DIM = _settings.EMBEDDING_DIM


class MemoryType(str, enum.Enum):
    """Memory type enum"""

    TEXT = "text"
    LINK = "link"
    VOICE = "voice"
    PHOTO = "photo"
    RICH = "rich"


class Memory(Base):
    """Memory model"""

    __tablename__ = "memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Memory type and content
    type = Column(Enum(MemoryType), nullable=False, index=True)
    content = Column(Text, nullable=False)

    # Category (auto-classified)
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category_confidence = Column(Integer, nullable=True)  # 0-100 confidence score

    # Voice-specific fields
    transcription = Column(Text, nullable=True)
    audio_url = Column(String(512), nullable=True)
    audio_duration = Column(Integer, nullable=True)  # Duration in seconds

    # Photo-specific fields
    image_url = Column(String(512), nullable=True)

    # Rich mixed-media blocks (ordered array of {type, order_index, ...})
    blocks = Column(JSONB, nullable=True)

    # AI-generated fields
    ai_summary = Column(Text, nullable=True)
    embedding = Column(
        Vector(EMBEDDING_DIM), nullable=True
    )  # pgvector embedding for semantic search

    # Metadata
    extra_metadata = Column("metadata", JSONB, default={}, server_default="{}")

    # Flags
    is_dismissed = Column(Boolean, default=False, server_default="false")
    is_deleted = Column(Boolean, default=False, server_default="false")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_viewed_at = Column(
        DateTime(timezone=True), nullable=True
    )  # tracks when user opened detail

    def __repr__(self):
        return f"<Memory {self.id} ({self.type})>"
