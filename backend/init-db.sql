-- Initialize PostgreSQL with pgvector extension
-- This script runs automatically when the database is first created

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create UUID extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE memoryai TO memoryai;

-- ── Migrations (idempotent — safe to re-run on existing databases) ────────────

-- Add 'photo' to the memorytype enum if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'PHOTO'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'memorytype')
    ) THEN
        ALTER TYPE memorytype ADD VALUE 'PHOTO';
    END IF;
END
$$;

-- Add image_url column to memories table if it doesn't already exist
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

-- ── Categories table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10) DEFAULT '📁',
    color VARCHAR(20) DEFAULT '#6B7280',
    description VARCHAR(255),
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(user_id, is_active);

-- ── User Preferences table ────────────────────────────────────────────────────

-- Create theme_mode enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'thememode') THEN
        CREATE TYPE thememode AS ENUM ('light', 'dark', 'auto');
    END IF;
END
$$;

-- Create default_capture_type enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'defaultcapturetype') THEN
        CREATE TYPE defaultcapturetype AS ENUM ('text', 'voice', 'photo', 'link');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    theme_mode thememode DEFAULT 'auto',
    accent_color VARCHAR(20) DEFAULT '#6366F1',
    default_capture_type defaultcapturetype DEFAULT 'text',
    auto_summarize BOOLEAN DEFAULT TRUE,
    auto_categorize BOOLEAN DEFAULT TRUE,
    ai_recall_enabled BOOLEAN DEFAULT TRUE,
    ai_suggestions_enabled BOOLEAN DEFAULT TRUE,
    recall_sensitivity VARCHAR(16) DEFAULT 'medium',
    proactive_recall_opt_in BOOLEAN DEFAULT TRUE,
    save_location BOOLEAN DEFAULT FALSE,
    analytics_enabled BOOLEAN DEFAULT TRUE,
    daily_digest BOOLEAN DEFAULT TRUE,
    reminder_notifications BOOLEAN DEFAULT TRUE,
    weekly_recap BOOLEAN DEFAULT TRUE,
    home_sections JSONB DEFAULT '{"unreviewed": true, "revisit": true, "on_this_day": true, "recent": true}',
    pinned_categories JSONB DEFAULT '[]',
    hidden_categories JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

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

-- ── Memory Radar events table ────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_radar_events_user_id ON radar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_radar_events_memory_id ON radar_events(memory_id);
CREATE INDEX IF NOT EXISTS idx_radar_events_event_type ON radar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_radar_events_created_at ON radar_events(created_at);

-- ── Add category columns to memories table ────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'memories' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE memories ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
        CREATE INDEX idx_memories_category_id ON memories(category_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'memories' AND column_name = 'category_confidence'
    ) THEN
        ALTER TABLE memories ADD COLUMN category_confidence INTEGER;
    END IF;
END
$$;

