-- Migration 102: Channel micro-series engine — multi-day themed threads
--
-- A micro-series is a hardcoded sequence of bite-sized lessons (see
-- worker/src/services/channel-series.ts). Each part ends with a cliffhanger
-- that teases the next part ("Besok: ...") to build a habit loop — followers
-- come back tomorrow for the next installment.
--
-- This table tracks ONLY which part of which series posts next; the actual
-- series content lives in code (hardcoded SERIES array), not in the DB. We
-- keep a single active series at a time; when its parts are exhausted the
-- service marks it 'finished' and seeds the next series.

CREATE TABLE IF NOT EXISTS channel_series_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id TEXT NOT NULL,
  current_part INTEGER DEFAULT 0,   -- 0-based index of the NEXT part to post
  total_parts INTEGER,
  status TEXT DEFAULT 'active',     -- 'active' | 'finished'
  started_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(series_id)
);

-- Hot path: "find the currently active series" runs on every daily post.
CREATE INDEX IF NOT EXISTS idx_channel_series_status ON channel_series_state(status);
