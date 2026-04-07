-- Migration 012: Student Cognitive Profile for Private Tutor
-- Tracks deep student behavior, learning patterns, and adaptive tutoring state

-- Living student profile — updated after every interaction
CREATE TABLE IF NOT EXISTS student_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,

  -- Cognitive patterns
  learning_pace TEXT DEFAULT 'normal',           -- slow, normal, fast (based on response times)
  avg_response_time_sec REAL DEFAULT 0,          -- average seconds to answer
  preferred_study_time TEXT DEFAULT NULL,         -- morning, afternoon, evening, night
  avg_session_minutes REAL DEFAULT 0,

  -- Engagement signals
  frustration_score REAL DEFAULT 0,              -- 0-1, computed from error streaks + short responses
  confidence_score REAL DEFAULT 0.5,             -- 0-1, computed from correct streaks + response certainty
  engagement_level TEXT DEFAULT 'moderate',       -- low, moderate, high, very_high
  consecutive_correct INTEGER DEFAULT 0,
  consecutive_wrong INTEGER DEFAULT 0,
  longest_correct_streak INTEGER DEFAULT 0,

  -- Error patterns (JSON arrays of most common mistake categories)
  grammar_errors TEXT DEFAULT '{}',              -- {"articles": 5, "tenses": 3, "sv_agreement": 2}
  vocab_errors TEXT DEFAULT '{}',
  reading_errors TEXT DEFAULT '{}',
  listening_errors TEXT DEFAULT '{}',

  -- Skill mastery levels (0-100 per sub-skill)
  skill_mastery TEXT DEFAULT '{}',               -- {"articles": 45, "tenses": 30, "prepositions": 60}

  -- Tutor state
  current_topic TEXT DEFAULT NULL,               -- what the tutor is currently teaching
  current_lesson_step INTEGER DEFAULT 0,         -- which step of the lesson we're on
  tutor_mode TEXT DEFAULT 'lesson',              -- lesson, exercise, review, free_chat
  socratic_depth INTEGER DEFAULT 0,              -- how many Socratic questions deep we are
  exercises_in_current_topic INTEGER DEFAULT 0,
  correct_in_current_topic INTEGER DEFAULT 0,

  -- Learning history summary
  topics_completed TEXT DEFAULT '[]',            -- JSON array of completed topic IDs
  topics_in_progress TEXT DEFAULT '[]',          -- JSON array of in-progress topics
  total_tutor_sessions INTEGER DEFAULT 0,
  total_tutor_messages INTEGER DEFAULT 0,
  last_tutor_topic TEXT DEFAULT NULL,
  last_interaction_at TEXT DEFAULT NULL,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles(user_id);

-- Detailed interaction log — every tutor exchange
CREATE TABLE IF NOT EXISTS tutor_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- Context
  topic TEXT NOT NULL,                           -- grammar_articles, tenses, reading_main_idea, etc.
  interaction_type TEXT NOT NULL,                 -- lesson, exercise, socratic_question, feedback, free_chat
  tutor_mode TEXT NOT NULL,                       -- lesson, exercise, review, free_chat

  -- Content
  tutor_message TEXT NOT NULL,
  student_response TEXT DEFAULT NULL,

  -- Assessment
  was_correct INTEGER DEFAULT NULL,              -- NULL if not an exercise, 0/1 if exercise
  error_category TEXT DEFAULT NULL,              -- what kind of mistake (articles, tenses, etc.)
  response_time_sec REAL DEFAULT NULL,           -- how long student took to respond
  confidence_signal TEXT DEFAULT NULL,            -- hedging, certain, confused, frustrated

  -- Tutor decisions
  difficulty_level INTEGER DEFAULT 1,            -- 1-5, what difficulty was this interaction
  socratic_step INTEGER DEFAULT 0,               -- which Socratic step (0 = direct teach)

  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tutor_interactions_user ON tutor_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tutor_interactions_topic ON tutor_interactions(user_id, topic);

-- Topic mastery tracking — granular per-topic progress
CREATE TABLE IF NOT EXISTS topic_mastery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic TEXT NOT NULL,

  -- Mastery metrics
  mastery_level INTEGER DEFAULT 0,               -- 0-100
  exercises_attempted INTEGER DEFAULT 0,
  exercises_correct INTEGER DEFAULT 0,
  accuracy_percent REAL DEFAULT 0,

  -- Difficulty progression
  current_difficulty INTEGER DEFAULT 1,          -- 1-5
  highest_difficulty_passed INTEGER DEFAULT 0,

  -- Timing
  first_attempted_at TEXT DEFAULT NULL,
  last_attempted_at TEXT DEFAULT NULL,
  last_reviewed_at TEXT DEFAULT NULL,
  next_review_at TEXT DEFAULT NULL,              -- spaced repetition for this topic

  -- Status
  status TEXT DEFAULT 'not_started',             -- not_started, learning, practicing, mastered, needs_review

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user ON topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_review ON topic_mastery(next_review_at);
