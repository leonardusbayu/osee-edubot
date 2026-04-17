-- 038_speaking_dimensions.sql
-- Per-dimension speaking scores stored separately for trend tracking.
-- The main speaking_sessions.score remains the overall band; this table
-- stores the 4-dimension breakdown so the mental model can track
-- "your pronunciation improved from 5.0 → 6.0 over the last month."

CREATE TABLE IF NOT EXISTS speaking_dimension_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  -- IELTS official 4 criteria
  fluency_coherence REAL,           -- Fluency & Coherence (IELTS) / Delivery (TOEFL)
  lexical_resource REAL,            -- Lexical Resource (IELTS) / Vocabulary (TOEFL)
  grammar_range REAL,               -- Grammatical Range & Accuracy
  pronunciation REAL,               -- Pronunciation
  -- Extended metrics
  relevancy_score REAL,             -- 0-1: how on-topic the response was
  word_count INTEGER,               -- total words in transcription
  speaking_rate REAL,               -- words per minute (estimated from duration)
  -- AI feedback per dimension
  fluency_note TEXT,
  lexical_note TEXT,
  grammar_note TEXT,
  pronunciation_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES speaking_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_speaking_dims_user
  ON speaking_dimension_scores(user_id, test_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_speaking_dims_session
  ON speaking_dimension_scores(session_id);

-- Writing criterion scores — same pattern for writing evaluation
CREATE TABLE IF NOT EXISTS writing_criterion_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER,               -- test_attempt that produced the essay
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  -- IELTS writing criteria
  task_achievement REAL,            -- Task Achievement / Task Response
  coherence_cohesion REAL,          -- Coherence & Cohesion
  lexical_resource REAL,            -- Lexical Resource
  grammar_range REAL,               -- Grammatical Range & Accuracy
  overall_band REAL,
  -- Extended
  relevancy_score REAL,             -- 0-1: on-topic gate
  word_count INTEGER,
  -- AI notes per criterion
  task_note TEXT,
  coherence_note TEXT,
  lexical_note TEXT,
  grammar_note TEXT,
  feedback_summary TEXT,            -- overall AI feedback in Indonesian
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_writing_criteria_user
  ON writing_criterion_scores(user_id, test_type, created_at DESC);
