-- Migration: Add lead source tracking
-- Run with: npx wrangler d1 execute edubot-db --remote --file=./migrations/002_lead_source.sql

-- Add source column to track where users come from
ALTER TABLE users ADD COLUMN source TEXT;

-- Create channel_posts table to track what we post
CREATE TABLE IF NOT EXISTS channel_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_type TEXT NOT NULL, -- 'vocab', 'quiz', 'grammar', 'idiom', 'spotlight', 'promo'
  post_content TEXT,
  message_id INTEGER,
  posted_at TEXT DEFAULT (datetime('now'))
);

-- Create channel_analytics table for channel metrics
CREATE TABLE IF NOT EXISTS channel_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL, -- 'post', 'click', 'signup'
  post_type TEXT,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
