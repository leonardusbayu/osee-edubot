-- Migration 101: Study squads — accountability groups of 3-5 friends (Phase 5.3)
--
-- A squad is a small invite-only group. Members see each other's streak and
-- whether they've studied today; the bot playfully calls out slackers.
-- One squad per user (enforced in service layer, not schema).

CREATE TABLE IF NOT EXISTS squads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS squad_members (
  squad_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (squad_id, user_id)
);

-- Fast "which squad is this user in" lookup (the hot path for every command).
CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(user_id);

-- invite_code already gets an implicit index from UNIQUE; created_by is for
-- admin/analytics queries ("squads made by user X").
CREATE INDEX IF NOT EXISTS idx_squads_created_by ON squads(created_by);
