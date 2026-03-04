"""One-time migration: add photo type + image_url column to existing DB."""
import asyncio
from app.database import engine
from sqlalchemy import text


async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text("""
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
        """))
        await conn.execute(text("""
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
        """))
        print("Migration applied: photo enum value + image_url column OK")


asyncio.run(migrate())
