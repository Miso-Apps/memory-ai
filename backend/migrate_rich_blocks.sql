-- Migration: Add RICH memory type and blocks column
-- Run with: docker exec -i memory-ai-postgres psql -U memoryai -d memoryai < migrate_rich_blocks.sql

-- Add 'rich' to the memorytype enum if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'rich'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'memorytype')
    ) THEN
        ALTER TYPE memorytype ADD VALUE 'rich';
    END IF;
END
$$;

-- Add blocks column if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'memories' AND column_name = 'blocks'
    ) THEN
        ALTER TABLE memories ADD COLUMN blocks JSONB;
    END IF;
END
$$;

-- Index for queries that filter on rich-type memories
CREATE INDEX IF NOT EXISTS idx_memories_blocks_gin ON memories USING GIN (blocks)
    WHERE blocks IS NOT NULL;
