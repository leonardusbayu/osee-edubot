-- 100: Personal weekly score targets — the binding agent that converts all
-- adaptive features into one visible weekly promise (docs/FEATURE_GOALS.md).
-- One row per (user, ISO week). Progress is computed live; only the goal
-- numbers and achievement state are stored.

CREATE TABLE IF NOT EXISTS weekly_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,            -- Monday date (WIB), YYYY-MM-DD
  topic TEXT,                          -- weakest topic to lift
  topic_start_pct INTEGER,             -- mastery/accuracy at week start
  topic_goal_pct INTEGER,              -- start + 10pp (capped 95)
  reviews_goal INTEGER NOT NULL DEFAULT 10,
  mock_due INTEGER NOT NULL DEFAULT 0, -- 1 = monthly mock expected this week
  status TEXT DEFAULT 'active',        -- active | achieved | expired
  achieved_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_targets_user ON weekly_targets(user_id, week_start DESC);
