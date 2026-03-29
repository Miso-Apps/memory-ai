from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database import Base


class MemoryLink(Base):
    """User-defined memory relationship edge."""

    __tablename__ = "memory_links"
    __table_args__ = (
        UniqueConstraint(
            "source_memory_id",
            "target_memory_id",
            "link_type",
            name="uq_memory_links_source_target_type",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_memory_id = Column(
        UUID(as_uuid=True),
        ForeignKey("memories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_memory_id = Column(
        UUID(as_uuid=True),
        ForeignKey("memories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    link_type = Column(String(32), nullable=False, default="explicit", server_default="explicit")
    score = Column(Float, nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<MemoryLink {self.source_memory_id} -> {self.target_memory_id}>"
