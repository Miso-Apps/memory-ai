from sqlalchemy import Column, String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database import Base


class DecisionStatus(str):
    OPEN = "open"
    REVIEWED = "reviewed"
    ARCHIVED = "archived"


class DecisionMemory(Base):
    """Decision lifecycle entity for replay/review flows."""

    __tablename__ = "decision_memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    memory_id = Column(
        UUID(as_uuid=True),
        ForeignKey("memories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title = Column(Text, nullable=False)
    rationale = Column(Text, nullable=True)
    expected_outcome = Column(Text, nullable=True)
    revisit_at = Column(DateTime(timezone=True), nullable=True, index=True)
    status = Column(String(32), nullable=False, default="open", server_default="open")
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return f"<DecisionMemory {self.id} {self.status}>"
