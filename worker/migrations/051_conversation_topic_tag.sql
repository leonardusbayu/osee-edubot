-- 051 — Per-turn topic + confusion tagging on conversation_messages.
--
-- Why: conversation_messages logged every tutor exchange but with no
-- structured metadata. Reports built via buildStudentReport could only
-- show message COUNTS, never "this student spent 15 messages stuck on
-- passive voice" or "confusion signals spiked this week on inference."
-- chat_analysis.analyzeMessageTopic already exists to classify incoming
-- text; this migration gives it durable columns to write into.
--
-- Tracks P2 BUGS.md #3.

-- Both columns are nullable so existing rows (written before this
-- migration) keep working; the analyzer populates them on new writes.
ALTER TABLE conversation_messages ADD COLUMN topic TEXT;
ALTER TABLE conversation_messages ADD COLUMN is_confusion INTEGER DEFAULT 0;

-- Index for the admin-side "which topics does this user struggle with" query.
CREATE INDEX IF NOT EXISTS idx_conv_msgs_topic ON conversation_messages(user_id, topic, created_at DESC);
