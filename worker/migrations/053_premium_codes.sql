-- 053 — Premium redemption codes.
--
-- Use case: teachers buy bulk premium access from the admin (typically via
-- bank transfer), admin generates a batch of single-use codes and hands
-- them to the teacher, teacher distributes to their students. Each student
-- redeems their code via /redeem in the bot → becomes premium for the
-- number of days baked into the code.
--
-- This bypasses the Telegram Stars friction (many Indonesian students
-- don't have iOS/Android billing configured) and lets the teacher own the
-- distribution relationship.
--
-- Code format: OSEE-XXXXX-XXXXX (5 chars × 2 groups, uppercase alphanum).
-- With 32^10 ≈ 1.1 × 10^15 combinations, brute-force is infeasible; we
-- also rate-limit /redeem to deter enumeration.

CREATE TABLE IF NOT EXISTS premium_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,              -- e.g. 'OSEE-7K3PM-9X2RH'
  days INTEGER NOT NULL,                  -- premium duration when redeemed
  batch_id TEXT,                          -- e.g. 'teacher_budi_mar2026' — groups codes from one sale
  notes TEXT,                             -- admin-visible memo
  created_at TEXT DEFAULT (datetime('now')),
  created_by INTEGER,                     -- admin users.id who generated this batch
  redeemed_at TEXT,                       -- NULL = still redeemable
  redeemed_by INTEGER,                    -- users.id who redeemed
  expires_at TEXT,                        -- NULL = code never expires before redemption
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (redeemed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_premium_codes_code ON premium_codes(code);
CREATE INDEX IF NOT EXISTS idx_premium_codes_batch ON premium_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_premium_codes_redeemed ON premium_codes(redeemed_at);
