-- Migration: Add payment tracking
-- Run with: npx wrangler d1 execute edubot-db --remote --file=./migrations/003_payment_tracking.sql

-- Payment requests for GoPay/manual methods
CREATE TABLE IF NOT EXISTS payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  days INTEGER NOT NULL,
  method TEXT DEFAULT 'gopay', -- 'gopay', 'bank_transfer', 'other'
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'cancelled', 'expired'
  payment_proof TEXT, -- optional: screenshot or reference
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  confirmed_at TEXT,
  confirmed_by INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add payment_history table
CREATE TABLE IF NOT EXISTS payment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'IDR',
  method TEXT NOT NULL, -- 'stars', 'gopay', 'bank_transfer', 'referral'
  stars_amount INTEGER, -- if paid with stars
  days_granted INTEGER NOT NULL,
  status TEXT DEFAULT 'completed',
  payment_id TEXT, -- external payment reference
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
