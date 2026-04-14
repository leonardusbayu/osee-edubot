-- Add payment_id column to star_transactions for idempotency
-- Allows the Telegram Stars webhook to reject duplicate payment notifications

ALTER TABLE star_transactions ADD COLUMN payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_star_transactions_payment_id
  ON star_transactions(payment_id) WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_star_transactions_user_created
  ON star_transactions(user_id, created_at DESC);
