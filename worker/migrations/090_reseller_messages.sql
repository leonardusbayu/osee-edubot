-- 090: Reseller messages — for the dashboard-to-customer messaging feature
-- Per-customer 7-day rate limit. Each row is a single message sent from
-- a reseller to a customer. Used for both rate-limiting and history view.
-- We also have a daily reseller-wide cap (3 broadcasts/day) to prevent
-- mass-spam from any single reseller.
CREATE TABLE IF NOT EXISTS reseller_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reseller_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  message_text TEXT NOT NULL,
  broadcast_id TEXT NOT NULL,           -- groups all recipients of a single send
  sent_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (reseller_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_reseller_sent ON reseller_messages(reseller_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_customer_sent ON reseller_messages(customer_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_broadcast ON reseller_messages(broadcast_id);
