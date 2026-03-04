-- Migration: Add categories and preferences tables
-- Run with: docker exec -i memoryai-postgres psql -U memoryai -d memoryai < migrate_categories.sql

-- Add category columns to memories table
ALTER TABLE memories ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS category_confidence INTEGER;

-- Create categories table if not exists
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
CREATE INDEX IF NOT EXISTS idx_memories_category_id ON memories(category_id);

-- Create enums if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'thememode') THEN
        CREATE TYPE thememode AS ENUM ('light', 'dark', 'auto');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'defaultcapturetype') THEN
        CREATE TYPE defaultcapturetype AS ENUM ('text', 'voice', 'photo', 'link');
    END IF;
END
$$;

-- Create user_preferences table if not exists
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
    save_location BOOLEAN DEFAULT FALSE,
    analytics_enabled BOOLEAN DEFAULT TRUE,
    daily_digest BOOLEAN DEFAULT TRUE,
    reminder_notifications BOOLEAN DEFAULT TRUE,
    weekly_recap BOOLEAN DEFAULT TRUE,
    home_sections JSONB DEFAULT '{"unreviewed": true, "revisit": true, "on_this_day": true, "recent": true}',
    pinned_categories JSONB DEFAULT '[]',
    hidden_categories JSONB DEFAULT '[]',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Add language column to existing user_preferences tables (idempotent)
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';

SELECT 'Migration completed successfully!' AS status;
