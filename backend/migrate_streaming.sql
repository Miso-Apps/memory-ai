-- Migration: Add streaming_responses preference column
-- Run with: docker exec memory-ai-postgres psql -U memoryai -d memoryai < backend/migrate_streaming.sql

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS streaming_responses BOOLEAN DEFAULT TRUE;
