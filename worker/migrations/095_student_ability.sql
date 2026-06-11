-- 095: Student ability table for IRT ability-matched selection (ROADMAP_M3 §2.1)
-- Lightweight per-section theta estimate, updated incrementally after each
-- finished session. Kept separate from irt_student_ability (which is the
-- batch MLE/EAP estimate) so the incremental selector path is cheap + isolated.

CREATE TABLE IF NOT EXISTS student_ability (
  user_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  theta REAL DEFAULT 0,
  se REAL DEFAULT 1,
  response_count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, section)
);

CREATE INDEX IF NOT EXISTS idx_student_ability_user
  ON student_ability(user_id);
