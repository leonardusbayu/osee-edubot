-- Migration: Add premium and referral tracking
-- Run with: npx wrangler d1 execute edubot-db --file=./migrations/001_premium_referral.sql --local OR --remote

-- Add premium tracking columns
ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN premium_until TEXT;
ALTER TABLE users ADD COLUMN referred_by INTEGER;
ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN referral_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN is_founding_student INTEGER DEFAULT 0;

-- Mark existing 20 founding students as free forever (update with actual user IDs)
-- This will be done programmatically in the code

-- Create teacher_subscriptions table for SaaS
CREATE TABLE IF NOT EXISTS teacher_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  status TEXT DEFAULT 'trial', -- 'trial', 'active', 'expired', 'cancelled'
  trial_ends TEXT,
  subscribed_at TEXT,
  expires_at TEXT,
  student_count INTEGER DEFAULT 0,
  monthly_rate INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Create referral_rewards table
CREATE TABLE IF NOT EXISTS referral_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  referee_id INTEGER NOT NULL,
  reward_type TEXT, -- 'trial_extension', 'free_days', 'free_months'
  reward_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'expired'
  created_at TEXT DEFAULT (datetime('now')),
  applied_at TEXT,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referee_id) REFERENCES users(id)
);

-- Create star_transactions table for Telegram Stars tracking
CREATE TABLE IF NOT EXISTS star_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'purchase', 'payment', 'refund', 'reward'
  description TEXT,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create teacher_pricing table for tier configuration
CREATE TABLE IF NOT EXISTS teacher_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_students INTEGER NOT NULL,
  max_students INTEGER NOT NULL,
  price_per_student INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Insert default pricing tiers (1-10: 50k, 11-30: 40k, 31-50: 30k, 51+: 500k flat)
INSERT INTO teacher_pricing (min_students, max_students, price_per_student) VALUES
  (1, 10, 50000),
  (11, 30, 40000),
  (31, 50, 30000),
  (51, 9999, 500000);
