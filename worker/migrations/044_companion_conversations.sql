-- Companion conversations: tracks proactive re-engagement sessions
-- When the bot reaches out to idle students as a supportive companion
CREATE TABLE IF NOT EXISTS companion_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',       -- active, bridged, ended, expired
  tier INTEGER NOT NULL DEFAULT 1,             -- 1=gentle nudge, 2=check-in, 3=win-back
  turn_count INTEGER NOT NULL DEFAULT 0,       -- number of back-and-forth exchanges
  sentiment TEXT DEFAULT NULL,                  -- last detected sentiment: positive, neutral, negative, distressed
  bridge_attempted INTEGER NOT NULL DEFAULT 0,  -- whether bot tried to redirect to study
  bridge_accepted INTEGER DEFAULT NULL,         -- whether student accepted the redirect (1/0/null)
  initiated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT DEFAULT NULL,
  summary TEXT DEFAULT NULL                     -- brief AI summary of the conversation for context
);

CREATE INDEX IF NOT EXISTS idx_companion_user_status ON companion_conversations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_companion_initiated ON companion_conversations(initiated_at);

-- Companion messages: individual messages in companion conversations
CREATE TABLE IF NOT EXISTS companion_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES companion_conversations(id),
  role TEXT NOT NULL,           -- 'bot' or 'user'
  content TEXT NOT NULL,
  sentiment TEXT DEFAULT NULL,  -- detected sentiment for user messages
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_companion_msg_conv ON companion_messages(conversation_id, created_at);
