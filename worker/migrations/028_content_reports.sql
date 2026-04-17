-- Student-submitted content issue reports.
-- One-tap "Report issue" button on every question writes into this table.
-- Admin panel reviews + closes the reports.
CREATE TABLE IF NOT EXISTS content_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,          -- test_contents.id
  sub_index INTEGER,                    -- null for flat; 0..N for grouped sub-question
  user_id INTEGER,                      -- users.id (null allowed if anonymous/edge-case)
  reason_code TEXT NOT NULL,            -- 'wrong_answer' | 'broken_audio' | 'confusing_question' | 'broken_options' | 'typo' | 'other'
  free_text TEXT,                       -- optional user note
  section TEXT,                         -- denormalized for fast filtering
  question_type TEXT,                   -- denormalized for fast filtering
  attempt_id INTEGER,                   -- optional link to the test_attempts row
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'triaged' | 'fixed' | 'invalid'
  resolved_by INTEGER,                  -- admin user who closed it
  resolved_at TEXT,
  resolution_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (content_id) REFERENCES test_contents(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- Fast lookups for admin triage view (open reports, newest first)
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status, created_at DESC);
-- Count reports per content item (to auto-flag high-report items)
CREATE INDEX IF NOT EXISTS idx_content_reports_content ON content_reports(content_id);
-- Per-user report history (rate-limit abuse)
CREATE INDEX IF NOT EXISTS idx_content_reports_user ON content_reports(user_id, created_at DESC);
