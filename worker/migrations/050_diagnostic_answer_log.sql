-- 050 — Per-answer durable log for diagnostic tests.
--
-- Why: previously the diagnostic test only stored a summary row in
-- `diagnostic_results` (aggregate scores + weaknesses blob). When a teacher
-- or admin wanted to see "which questions did this student get wrong in
-- their placement test?", the data wasn't there to show. Reports built via
-- buildStudentReport couldn't reconstruct the diagnostic session beyond
-- the aggregate.
--
-- This table writes one row per answer submitted, including the question
-- text and topic so we can surface it in reports even after the in-memory
-- question bank shifts. Backfill is NOT attempted — only new diagnostic
-- attempts after the worker that writes this table ships will have rows.
-- Tracks P1 BUGS.md #2.

CREATE TABLE IF NOT EXISTS diagnostic_question_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  question_index INTEGER NOT NULL,     -- position within the diagnostic (0-based)
  question_id INTEGER NOT NULL,        -- from the in-memory question bank
  section TEXT NOT NULL,               -- 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'writing'
  topic TEXT,                          -- skill_tag (e.g. 'articles', 'conditionals')
  question_text TEXT,                  -- snapshot so reports survive bank changes
  student_answer TEXT,                 -- what the student submitted
  correct_answer TEXT,                 -- canonical answer (NULL for free-text writing)
  is_correct INTEGER,                  -- 1/0/NULL (NULL = writing, AI-scored elsewhere)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_dqa_session ON diagnostic_question_answers(session_id, question_index);
CREATE INDEX IF NOT EXISTS idx_dqa_user ON diagnostic_question_answers(user_id, created_at DESC);
