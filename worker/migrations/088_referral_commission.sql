-- 088: Reseller referral / commission system
-- Resellers (users with role='reseller') own a referral code. When a
-- customer applies the code and buys a premium plan, the system creates a
-- pending commission attribution. After 7 days (anti-fraud hold), the
-- commission is confirmed and either auto-paid via Telegram Stars or
-- queued for manual bank transfer.
--
-- Three tables + one users column:
--   1. referral_codes     — the code itself, owned by one reseller
--   2. referral_attributions — immutable ledger: one row per (customer, payment)
--   3. reseller_payouts   — bank-transfer batches (Stars payouts don't need this)
--   + users.referral_code_applied TEXT — per-customer pending code (cleared on attribute)

-- 0. Add referral_code_applied column to users (tracks which code each user
-- has applied but not yet attributed). Cleared after the first successful
-- attribution. UNIQUE constraint on referral_attributions.customer_id means
-- a customer can only ever be attributed to one reseller.
ALTER TABLE users ADD COLUMN referral_code_applied TEXT;

-- 1. Referral codes (e.g. "BUDI03" → reseller_id=42)
CREATE TABLE IF NOT EXISTS referral_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  reseller_id INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  total_uses INTEGER DEFAULT 0,
  total_revenue_stars INTEGER DEFAULT 0,
  total_commission_stars INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (reseller_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_reseller ON referral_codes(reseller_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes(is_active);

-- 2. Attribution ledger. One row per (customer, payment) forever —
-- UNIQUE(customer_id) prevents a customer from being attributed twice.
-- Commission status flow: pending -> confirmed -> paid (or clawback at any point).
CREATE TABLE IF NOT EXISTS referral_attributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_id INTEGER NOT NULL,
  reseller_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  payment_id INTEGER,                     -- nullable: customer may apply code before buying
  plan_days INTEGER NOT NULL,
  plan_amount_stars INTEGER NOT NULL,
  commission_rate INTEGER NOT NULL,        -- snapshot at time of sale (default 20)
  commission_amount_stars INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',           -- pending|confirmed|paid|clawback
  confirmed_at TEXT,                      -- when it became payable (7d after purchase)
  paid_at TEXT,                           -- when actually paid out
  payout_method TEXT,                     -- 'stars' | 'bank'
  payout_reference TEXT,                  -- tx id for Stars, "manual-<batch>" for bank
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (code_id) REFERENCES referral_codes(id),
  FOREIGN KEY (reseller_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  UNIQUE(customer_id)
);
CREATE INDEX IF NOT EXISTS idx_attribution_status ON referral_attributions(status);
CREATE INDEX IF NOT EXISTS idx_attribution_reseller ON referral_attributions(reseller_id, status);
CREATE INDEX IF NOT EXISTS idx_attribution_payment ON referral_attributions(payment_id);
CREATE INDEX IF NOT EXISTS idx_attribution_created ON referral_attributions(created_at);

-- 3. Bank payout batches. Stars auto-payouts don't use this table —
-- they're written directly to referral_attributions.
CREATE TABLE IF NOT EXISTS reseller_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reseller_id INTEGER NOT NULL,
  total_amount_stars INTEGER NOT NULL,
  attribution_ids TEXT NOT NULL,           -- JSON array of attribution ids
  method TEXT NOT NULL,                    -- 'bank' (Stars bypasses this table)
  status TEXT DEFAULT 'pending',           -- pending|completed|failed
  reference TEXT,                          -- bank batch id or note
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (reseller_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON reseller_payouts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payouts_reseller ON reseller_payouts(reseller_id);
