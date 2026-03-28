from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncSession:
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        # session.close() is called automatically by the async context manager


async def init_db():
    """Initialize database - create pgvector extension and all tables"""
    # Prevent cross-event-loop connection reuse (important for async test runs).
    await engine.dispose()
    async with engine.begin() as conn:
        # Enable pgvector extension (idempotent)
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

        # Lightweight compatibility migration for evolving preferences schema.
        await conn.execute(
            text(
                "ALTER TABLE user_preferences "
                "ADD COLUMN IF NOT EXISTS recall_sensitivity VARCHAR(16) DEFAULT 'medium'"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE user_preferences "
                "ADD COLUMN IF NOT EXISTS proactive_recall_opt_in BOOLEAN DEFAULT TRUE"
            )
        )
