-- 056 — Drop dead tables that have zero code references.
-- These tables were created during early development but are no longer used.
-- Removing them cleans up the schema and reduces confusion.

-- conversations: duplicate of conversation_messages, 0 code references
DROP TABLE IF EXISTS conversations;

-- skill_tracker: redundant with skill_progress, 0 code references
DROP TABLE IF EXISTS skill_tracker;

-- skill_trackers: redundant with skill_progress, 0 code references
DROP TABLE IF EXISTS skill_trackers;

-- student_skills: redundant with skill_progress, 0 code references
DROP TABLE IF EXISTS student_skills;
