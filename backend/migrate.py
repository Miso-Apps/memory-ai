"""One-time migration: add photo type + image_url column to existing DB."""

import asyncio
import sys
from app.database import engine
from sqlalchemy import text


async def migrate():
    try:
        print("🔄 Connecting to database...")
        async with engine.begin() as conn:
            await conn.execute(
                text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_enum
                        WHERE enumlabel = 'photo'
                          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'memorytype')
                    ) THEN
                        ALTER TYPE memorytype ADD VALUE 'photo';
                    END IF;
                END
                $$;
            """)
            )
            await conn.execute(
                text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'memories' AND column_name = 'image_url'
                    ) THEN
                        ALTER TABLE memories ADD COLUMN image_url VARCHAR(512);
                    END IF;
                END
                $$;
            """)
            )
            await conn.execute(
                text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'user_preferences' AND column_name = 'recall_sensitivity'
                    ) THEN
                        ALTER TABLE user_preferences
                        ADD COLUMN recall_sensitivity VARCHAR(16) DEFAULT 'medium';
                    END IF;
                END
                $$;
            """)
            )
            await conn.execute(
                text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'user_preferences' AND column_name = 'proactive_recall_opt_in'
                    ) THEN
                        ALTER TABLE user_preferences
                        ADD COLUMN proactive_recall_opt_in BOOLEAN DEFAULT TRUE;
                    END IF;
                END
                $$;
            """)
            )
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS radar_events (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
                    event_type VARCHAR(32) NOT NULL,
                    reason_code VARCHAR(64),
                    confidence DOUBLE PRECISION,
                    context JSONB DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_radar_events_user_id ON radar_events(user_id);"
                )
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_radar_events_memory_id ON radar_events(memory_id);"
                )
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_radar_events_event_type ON radar_events(event_type);"
                )
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_radar_events_created_at ON radar_events(created_at);"
                )
            )
            print(
                "✅ Migration applied: photo/image updates + preferences + radar_events OK"
            )
    except Exception as e:
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        print(f"   Database URL: {engine.url}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(migrate())
