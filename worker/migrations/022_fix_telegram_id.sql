-- Fix telegram_id stored as float text (e.g. "5694784154.0" → "5694784154")
-- This affects user lookup from the mini app and all telegram_id-based queries

UPDATE users SET telegram_id = CAST(CAST(telegram_id AS INTEGER) AS TEXT)
WHERE telegram_id LIKE '%.0';

-- Also fix any other tables that reference telegram_id
-- (referral_rewards, payment_requests, etc. reference user_id not telegram_id, so they're fine)
