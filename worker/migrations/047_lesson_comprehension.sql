-- 047_lesson_comprehension.sql
-- Supports "teach-then-check" flow where every teaching chunk from the tutor
-- ships with a comprehension micro-question (CQ). The webhook renders the CQ
-- as an inline keyboard and branches on correct/wrong/pause.
--
-- Tables:
--   lesson_cq_active    — at most one pending CQ per user (the one waiting
--                          for a button press). Unique by user_id.
--   lesson_cq_attempts  — full history of every CQ answered, so mental_model
--                          and later analytics can learn from patterns.
--
-- Additional:
--   student_profiles.lesson_paused — set to 1 when the student hit "tunggu
--                          dulu". Resumes clear it back to 0.

CREATE TABLE IF NOT EXISTS lesson_cq_active (
  user_id INTEGER PRIMARY KEY,
  plan_id INTEGER,
  step_index INTEGER,
  concept TEXT,                     -- the skill being taught (e.g. 'present_perfect')
  question TEXT NOT NULL,           -- the CQ stem
  options TEXT NOT NULL,            -- JSON array of strings: ['A text', 'B text', ...]
  correct_letter TEXT NOT NULL,     -- 'A' | 'B' | 'C' | 'D'
  strategy_used TEXT,               -- NULL on first try; 'analogy' | 'simpler' | 'example' | 'visual' on reteach
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lesson_cq_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id INTEGER,
  step_index INTEGER,
  concept TEXT,
  question TEXT,
  correct_letter TEXT,
  student_letter TEXT,
  was_correct INTEGER NOT NULL,     -- 0/1
  strategy_used TEXT,               -- which reteach strategy was in play (null = first try)
  attempt_num INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cq_attempts_user
  ON lesson_cq_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cq_attempts_concept
  ON lesson_cq_attempts(concept);

-- Add paused flag to student_profiles
ALTER TABLE student_profiles ADD COLUMN lesson_paused INTEGER DEFAULT 0;
ALTER TABLE student_profiles ADD COLUMN lesson_paused_at TEXT;
