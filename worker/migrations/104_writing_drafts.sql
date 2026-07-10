-- 104: Writing drafts — stores every draft a student submits for a
-- writing question. Used by the AI writing coach (multi-draft loop)
-- to show progression: "Draft 1: 4.0 → Draft 2: 4.5 → Draft 3: 5.0".
-- Max 3 drafts per (user_id, content_id) — enforced in writing.ts.
CREATE TABLE IF NOT EXISTS writing_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content_id INTEGER,
  test_type TEXT,
  task_type TEXT,
  prompt TEXT,
  draft_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  overall_band REAL,
  criteria TEXT, -- JSON of per-criterion scores
  feedback TEXT,
  corrections TEXT, -- JSON array
  word_count INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_writing_drafts_user_content
  ON writing_drafts (user_id, content_id, draft_number);