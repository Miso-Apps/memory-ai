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

        # Email verification columns added to users table
        await conn.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local'"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ"
            )
        )
        # password_hash is now nullable (OAuth users have no password)
        await conn.execute(
            text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
        )
