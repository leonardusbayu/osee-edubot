-- Migration 059: Seasonal Events, Study Buddies, Notifications, Progress Snapshots
-- Adds tables for seasonal event tracking, study buddy system,
-- notification preferences, and weekly progress visualization.

-- Seasonal events tracking
CREATE TABLE IF NOT EXISTS seasonal_event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_id TEXT NOT NULL,                          -- e.g., '2026-01'
  seen_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_seasonal_event_user ON seasonal_event_log(user_id);

-- Study buddies (asynchronous social)
CREATE TABLE IF NOT EXISTS study_buddies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  buddy_id INTEGER NOT NULL,                       -- the other user
  status TEXT DEFAULT 'pending',                   -- pending, accepted, declined
  sent_at TEXT DEFAULT (datetime('now')),
  responded_at TEXT DEFAULT NULL,
  UNIQUE(user_id, buddy_id)
);

CREATE INDEX IF NOT EXISTS idx_study_buddies_user ON study_buddies(user_id);
CREATE INDEX IF NOT EXISTS idx_study_buddies_buddy ON study_buddies(buddy_id);
CREATE INDEX IF NOT EXISTS idx_study_buddies_status ON study_buddies(user_id, status);

-- Buddy activity feed (what your buddy did recently)
CREATE TABLE IF NOT EXISTS buddy_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  buddy_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,                     -- xp_earned, streak_milestone, badge_unlocked, boss_battle_won
  activity_data TEXT DEFAULT '{}',                 -- JSON with details
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_buddy_activity_user ON buddy_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_buddy_activity_recent ON buddy_activity(user_id, created_at DESC);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  daily_reminder INTEGER DEFAULT 1,                -- 0/1
  review_reminder INTEGER DEFAULT 1,               -- 0/1
  event_announcement INTEGER DEFAULT 1,            -- 0/1
  buddy_activity INTEGER DEFAULT 1,                -- 0/1
  motivational_nudge INTEGER DEFAULT 1,            -- 0/1
  quiet_hours_start TEXT DEFAULT '22:00',          -- don't notify during quiet hours
  quiet_hours_end TEXT DEFAULT '07:00',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- Progress snapshots (for weekly visualization)
CREATE TABLE IF NOT EXISTS progress_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  snapshot_date TEXT NOT NULL,                     -- YYYY-MM-DD
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,
  questions_answered INTEGER DEFAULT 0,
  accuracy_percent REAL DEFAULT 0,
  topics_mastered INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  league TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_progress_snapshots_user ON progress_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_snapshots_date ON progress_snapshots(snapshot_date);
