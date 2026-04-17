-- 043_irt_learning_curves.sql
-- #1 Item Response Theory (2PL model) parameters
-- #2 Student ability estimates (theta)
-- #3 Per-student per-skill learning curves
-- #4 Forgetting curve snapshots

-- ─── IRT Item Parameters ────────────────────────────────────────────
-- Stores calibrated difficulty & discrimination for each question
CREATE TABLE IF NOT EXISTS irt_item_params (
  content_id INTEGER PRIMARY KEY,
  difficulty REAL NOT NULL DEFAULT 0.0,     -- b parameter (logit scale, -3 to +3)
  discrimination REAL NOT NULL DEFAULT 1.0, -- a parameter (0.2 to 3.0)
  guessing REAL NOT NULL DEFAULT 0.25,      -- c parameter (for 3PL, default 0.25 for 4-choice MCQ)
  total_responses INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  last_calibrated_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── IRT Student Ability (Theta) ────────────────────────────────────
-- Per-user per-skill theta estimates
CREATE TABLE IF NOT EXISTS irt_student_ability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,                       -- 'reading', 'listening', 'speaking', 'writing', 'grammar', 'vocabulary', 'overall'
  theta REAL NOT NULL DEFAULT 0.0,           -- ability estimate (logit scale)
  standard_error REAL NOT NULL DEFAULT 1.0,  -- SE of theta estimate
  responses_count INTEGER DEFAULT 0,
  last_updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, skill)
);
CREATE INDEX IF NOT EXISTS idx_irt_ability_user ON irt_student_ability(user_id);

-- ─── Learning Curve Data Points ─────────────────────────────────────
-- Tracks cumulative performance over time per skill for curve fitting
CREATE TABLE IF NOT EXISTS learning_curve_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,                       -- 'reading', 'listening', etc.
  practice_index INTEGER NOT NULL,           -- nth practice session in this skill (1, 2, 3...)
  accuracy REAL NOT NULL,                    -- accuracy in this session (0.0-1.0)
  cumulative_accuracy REAL NOT NULL,         -- running average accuracy up to this point
  session_size INTEGER NOT NULL,             -- number of questions in this session
  recorded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_lc_points_user_skill ON learning_curve_points(user_id, skill, practice_index);

-- ─── Learning Curve Model Fits ──────────────────────────────────────
-- Stores fitted curve parameters per student per skill
CREATE TABLE IF NOT EXISTS learning_curve_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  -- Power law: accuracy = a_max - (a_max - a_init) * n^(-rate)
  a_max REAL NOT NULL DEFAULT 0.9,           -- asymptotic accuracy ceiling
  a_init REAL NOT NULL DEFAULT 0.2,          -- initial accuracy
  rate REAL NOT NULL DEFAULT 0.3,            -- learning rate exponent
  -- Goodness of fit
  r_squared REAL,
  data_points INTEGER DEFAULT 0,
  -- Predictions
  predicted_accuracy_2w REAL,                -- predicted accuracy in 2 weeks
  predicted_ibt_section REAL,                -- predicted iBT section score
  last_fitted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, skill)
);
CREATE INDEX IF NOT EXISTS idx_lc_models_user ON learning_curve_models(user_id);

-- ─── Forgetting Curve Snapshots ─────────────────────────────────────
-- Tracks memory retention per concept/skill over time
CREATE TABLE IF NOT EXISTS forgetting_curve (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  memory_strength REAL NOT NULL DEFAULT 1.0,  -- S parameter (higher = slower decay)
  last_review_at TEXT NOT NULL,
  estimated_retention REAL NOT NULL DEFAULT 1.0, -- current R value (0-1)
  review_count INTEGER DEFAULT 1,
  avg_recall_rate REAL DEFAULT 1.0,           -- historical average recall
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, skill)
);
CREATE INDEX IF NOT EXISTS idx_fc_user ON forgetting_curve(user_id);

-- ─── Psychological Profile Metrics ──────────────────────────────────
-- Stores computed psychological/behavioral statistics per student
CREATE TABLE IF NOT EXISTS psych_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  -- Engagement metrics
  consistency_score REAL DEFAULT 0,          -- 0-100, based on study regularity
  persistence_score REAL DEFAULT 0,          -- 0-100, based on completion rate & retry behavior
  risk_tolerance REAL DEFAULT 0.5,           -- 0-1, based on guessing patterns
  -- Cognitive metrics
  processing_speed REAL DEFAULT 0,           -- avg time per correct answer (seconds)
  accuracy_under_pressure REAL DEFAULT 0,    -- accuracy in timed conditions vs untimed
  error_recovery_rate REAL DEFAULT 0,        -- rate of correcting wrong answers on retry
  -- Learning style indicators
  reading_preference REAL DEFAULT 0.5,       -- 0-1, preference for reading vs listening
  detail_orientation REAL DEFAULT 0.5,       -- 0-1, performance on detail vs inference questions
  stamina_index REAL DEFAULT 0.5,            -- 0-1, accuracy first half vs second half of session
  -- Computed at
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_psych_user ON psych_profile(user_id);
