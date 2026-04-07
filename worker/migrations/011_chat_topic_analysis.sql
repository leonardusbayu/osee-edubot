-- Migration 011: Add topic tagging to conversation_messages
-- Purpose: Enable chat analysis for student weakness detection

-- Add topic column for categorizing chat messages
ALTER TABLE conversation_messages ADD COLUMN topic TEXT DEFAULT 'other';

-- Add metadata column for additional analysis data (e.g., question_id if chat is about a specific question)
ALTER TABLE conversation_messages ADD COLUMN metadata TEXT DEFAULT '{}';

-- Create indexes for efficient topic analysis
CREATE INDEX IF NOT EXISTS idx_cm_topic ON conversation_messages(topic);
CREATE INDEX IF NOT EXISTS idx_cm_user_topic ON conversation_messages(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_cm_created ON conversation_messages(created_at);

-- Create conversation_analytics table for aggregated insights
CREATE TABLE IF NOT EXISTS conversation_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    confusion_signals INTEGER DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, topic)
);

-- Create skill_weakness_summary table for 3-source weakness profiling
CREATE TABLE IF NOT EXISTS skill_weakness_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    -- Diagnostic scores (from diagnostic_results)
    grammar_score INTEGER,
    vocab_score INTEGER,
    reading_score INTEGER,
    listening_score INTEGER,
    writing_band REAL,
    estimated_band REAL,
    -- Practice accuracy (from attempt_answers)
    listening_accuracy REAL,
    reading_accuracy REAL,
    speaking_accuracy REAL,
    writing_accuracy REAL,
    total_practice_questions INTEGER,
    -- Chat analysis (from conversation_messages)
    top_chat_topics TEXT,  -- JSON array of top 5 topics
    confusion_topics TEXT,  -- JSON array of repeatedly confused topics
    chat_questions_count INTEGER,
    -- AI-generated insights
    ai_insights TEXT,  -- GPT analysis summary
    last_ai_analysis_at TEXT,
    last_updated TEXT DEFAULT (datetime('now'))
);

-- Create index for user lookup
CREATE INDEX IF NOT EXISTS idx_sws_user ON skill_weakness_summary(user_id);
