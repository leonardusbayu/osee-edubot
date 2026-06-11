-- 092: Commission attribution for premium redemption codes + soft-cap flags
--
-- Closes the gap where teacher/reseller-sold premium_codes generated zero
-- tracked commission. Codes are prepaid, so redemption attributions are
-- created directly as status='confirmed' (no 7-day anti-fraud hold) in the
-- existing referral_attributions ledger — payout flows pick them up with
-- no new code paths.
--
--   1. premium_codes.owner_reseller_id — which reseller/teacher owns the
--      batch. NULL = house code, no commission.
--   2. commission_audit — append-only log of every attribution status
--      change (created/confirmed/paid/clawback/flagged) for reconciliation
--      and dispute handling.
--   3. users.reseller_flagged / reseller_flag_reason — soft-cap enforcement
--      target (>5 attributions/day or >50% clawback rate).

ALTER TABLE premium_codes ADD COLUMN owner_reseller_id INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_premium_codes_owner ON premium_codes(owner_reseller_id);

CREATE TABLE IF NOT EXISTS commission_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reseller_id INTEGER NOT NULL,
  attribution_id INTEGER,
  action TEXT NOT NULL,            -- attribution_created|confirmed|paid|clawback|paid_reversal_required|flagged|unflagged
  old_status TEXT,
  new_status TEXT,
  amount_stars INTEGER,
  triggered_by TEXT,               -- 'webhook'|'cron'|'manual'|'code_redemption'
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (reseller_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_commission_audit_reseller ON commission_audit(reseller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_commission_audit_attribution ON commission_audit(attribution_id);

ALTER TABLE users ADD COLUMN reseller_flagged INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN reseller_flag_reason TEXT;
