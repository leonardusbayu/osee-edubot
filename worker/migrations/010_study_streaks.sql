-- 010_study_streaks.sql
-- Add persistent streak tracking to users table

ALTER TABLE users
ADD COLUMN current_streak INTEGER DEFAULT 0;

ALTER TABLE users
ADD COLUMN longest_streak INTEGER DEFAULT 0;

ALTER TABLE users
ADD COLUMN last_study_date TEXT;
