-- 046_question_exposure.sql
-- Tracks which user has seen which test_contents row, so the question selector
-- can prefer under-exposed items. Without this, ORDER BY RANDOM() keeps
-- serving the same 50–100 "lucky" questions from a 3,036-row bank while the
-- rest go unused.
--
-- Read path: JOIN test_contents LEFT JOIN question_exposure WHERE user_id = ?
--            ORDER BY exposure bucket (unseen first), then random tiebreak.
-- Write path: one UPSERT per question served (source tagged for diagnostics).

CREATE TABLE IF NOT EXISTS question_exposure (
  user_id INTEGER NOT NULL,              -- users.id
  content_id INTEGER NOT NULL,           -- test_contents.id
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  exposure_count INTEGER NOT NULL DEFAULT 1,
  source TEXT,                           -- 'test' | 'diagnostic' | 'lesson' | 'companion' | 'drill' | 'game'
  PRIMARY KEY (user_id, content_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (content_id) REFERENCES test_contents(id)
);

-- Covers the hot selector: "for this user, which content_ids were recently seen?"
CREATE INDEX IF NOT EXISTS idx_qexp_user_last_seen
  ON question_exposure(user_id, last_seen_at);

-- Reverse lookup for coverage dashboards ("how many students saw this question?")
CREATE INDEX IF NOT EXISTS idx_qexp_content
  ON question_exposure(content_id);
