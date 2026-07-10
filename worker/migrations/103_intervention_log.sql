-- 103: Intervention log — rate-limits automated nudges to one per type per 24h.
-- Used by services/intervention-engine.ts (hourly cron) to avoid spamming
-- students with repeated nudges for the same signal.
CREATE TABLE IF NOT EXISTS intervention_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  intervention_type TEXT NOT NULL,
  sent_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intervention_log_user_type_time
  ON intervention_log (user_id, intervention_type, sent_at);