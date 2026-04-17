-- Payment idempotency — adds UNIQUE index on payment_id for the Telegram Stars webhook
-- so duplicate payment notifications are rejected.
--
-- NOTE: the payment_id column already exists on star_transactions in production,
-- so we skip the ALTER TABLE. If you are bootstrapping a fresh DB, uncomment:
--   ALTER TABLE star_transactions ADD COLUMN payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_star_transactions_payment_id
  ON star_transactions(payment_id) WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_star_transactions_user_created
  ON star_transactions(user_id, created_at DESC);
