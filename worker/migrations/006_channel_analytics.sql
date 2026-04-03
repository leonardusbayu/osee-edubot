-- Channel Analytics: track posts and referrals from channel
-- Enables per-post-type performance analysis and conversion funnel

-- Channel posts log (actual schema)
CREATE TABLE IF NOT EXISTS channel_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_type TEXT NOT NULL,         -- 'grammar_tip', 'speaking_cta', 'idiom', 'vocab', 'cta', 'quiz', 'spotlight'
  post_content TEXT,                -- Full text of the post
  message_id INTEGER,              -- Telegram message ID (if sent successfully)
  posted_at TEXT DEFAULT (datetime('now')),
  content_preview TEXT,             -- First 100 chars (truncated from post_content)
  sent_to_channel TEXT,            -- Channel username or ID
  status TEXT DEFAULT 'sent',      -- 'sent', 'failed'
  error_message TEXT
);

-- Track referral signups from channel links
CREATE TABLE IF NOT EXISTS channel_referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referred_at TEXT DEFAULT (datetime('now')),
  new_user_id INTEGER,
  referrer_code TEXT,              -- The referral code used
  source_channel TEXT,             -- Which channel they came from
  signup_context TEXT,             -- 'promo', 'quiz_channel', 'premium', etc.
  conversion_post_id INTEGER       -- FK to channel_posts if trackable
);

-- Hourly aggregation for quick dashboard queries
CREATE TABLE IF NOT EXISTS channel_hourly_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hour_bucket TEXT NOT NULL,      -- 'YYYY-MM-DD HH:00' format
  content_type TEXT NOT NULL,
  posts_sent INTEGER DEFAULT 0,
  posts_failed INTEGER DEFAULT 0,
  UNIQUE(hour_bucket, content_type)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_channel_posts_type ON channel_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_channel_posts_time ON channel_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_channel_referrals_time ON channel_referrals(referred_at);
CREATE INDEX IF NOT EXISTS idx_channel_hourly_bucket ON channel_hourly_stats(hour_bucket);
