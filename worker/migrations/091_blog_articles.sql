-- 091: Blog articles — internal blog powered by the worker.
-- Replaces osee.co.id/blog (which was broken — every channel post
-- linked there, 0 conversions). Worker endpoint /api/blog/article/<slug>
-- renders these as HTML. The channel now points to the worker, not
-- WordPress.

CREATE TABLE IF NOT EXISTS blog_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,                -- e.g. 'vocab', 'grammar', 'idiom', 'quiz', 'word_form'
  test_type TEXT,                     -- 'TOEFL_IBT', 'IELTS', 'TOEFL_ITP', 'TOEIC', or NULL
  body_html TEXT NOT NULL,
  meta_description TEXT,
  source_content_id INTEGER,          -- optional FK to test_contents if auto-generated
  source_attribution_id INTEGER,      -- optional FK to referral_attributions
  status TEXT DEFAULT 'published',    -- 'draft' | 'published' | 'archived'
  view_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_blog_topic ON blog_articles(topic, status);
CREATE INDEX IF NOT EXISTS idx_blog_test_type ON blog_articles(test_type, status);
CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_articles(slug);

-- Click log — for measuring channel → blog CTR + identifying which
-- articles get the most interest. Truncated monthly via cron.
CREATE TABLE IF NOT EXISTS blog_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  source TEXT,                         -- 'telegram_channel', 'telegram_bot', 'direct'
  user_agent TEXT,
  referrer TEXT,
  clicked_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_blog_clicks_slug ON blog_clicks(slug, clicked_at);
