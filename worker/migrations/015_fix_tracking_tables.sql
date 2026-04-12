-- Migration 015: Fix tracking tables schema + backfill from existing data
-- Fixes daily_study_logs UNIQUE constraint and populates empty analytics tables

-- ═══════════════════════════════════════════════════════
-- 1. Fix daily_study_logs: UNIQUE should be (user_id, log_date), not just log_date
-- ═══════════════════════════════════════════════════════

-- Recreate with correct constraint
CREATE TABLE IF NOT EXISTS daily_study_logs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  log_date TEXT NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  tests_completed INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  accuracy_percent INTEGER DEFAULT 0,
  top_section TEXT,
  weakest_section TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, log_date)
);

INSERT OR IGNORE INTO daily_study_logs_new
  (user_id, log_date, questions_answered, time_spent_seconds, messages_sent, sessions_count, tests_completed, correct_answers, accuracy_percent, top_section, weakest_section, updated_at)
SELECT user_id, log_date, questions_answered, time_spent_seconds, messages_sent, sessions_count, tests_completed, correct_answers, accuracy_percent, top_section, weakest_section, updated_at
FROM daily_study_logs;

DROP TABLE daily_study_logs;
ALTER TABLE daily_study_logs_new RENAME TO daily_study_logs;

CREATE INDEX IF NOT EXISTS idx_daily_study_logs_user ON daily_study_logs(user_id, log_date);

-- ═══════════════════════════════════════════════════════
-- 2. Backfill daily_study_logs from attempt_answers
-- ═══════════════════════════════════════════════════════

INSERT OR IGNORE INTO daily_study_logs (user_id, log_date, questions_answered, correct_answers, time_spent_seconds, tests_completed, accuracy_percent)
SELECT
  ta.user_id,
  date(aa.submitted_at) as log_date,
  COUNT(*) as questions_answered,
  SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
  SUM(COALESCE(aa.time_spent_seconds, 0)) as time_spent_seconds,
  COUNT(DISTINCT aa.attempt_id) as tests_completed,
  CASE WHEN COUNT(*) > 0
    THEN CAST(ROUND(CAST(SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS REAL) * 100 / COUNT(*)) AS INTEGER)
    ELSE 0 END as accuracy_percent
FROM attempt_answers aa
JOIN test_attempts ta ON aa.attempt_id = ta.id
WHERE aa.submitted_at IS NOT NULL
GROUP BY ta.user_id, date(aa.submitted_at);

-- ═══════════════════════════════════════════════════════
-- 3. Backfill skill_progress from attempt_answers
-- ═══════════════════════════════════════════════════════

INSERT INTO skill_progress (user_id, skill, test_type, practiced_at, questions_attempted, correct_answers, accuracy_percent, time_spent_seconds)
SELECT
  ta.user_id,
  aa.section as skill,
  ta.test_type,
  date(aa.submitted_at) as practiced_at,
  COUNT(*) as questions_attempted,
  SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
  CASE WHEN COUNT(*) > 0
    THEN CAST(ROUND(CAST(SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS REAL) * 100 / COUNT(*)) AS INTEGER)
    ELSE 0 END as accuracy_percent,
  SUM(COALESCE(aa.time_spent_seconds, 0)) as time_spent_seconds
FROM attempt_answers aa
JOIN test_attempts ta ON aa.attempt_id = ta.id
WHERE aa.submitted_at IS NOT NULL
GROUP BY ta.user_id, aa.section, ta.test_type, date(aa.submitted_at);

-- ═══════════════════════════════════════════════════════
-- 4. Backfill student_skills from attempt_answers
-- ═══════════════════════════════════════════════════════

INSERT OR IGNORE INTO student_skills (user_id, skill, score, total_attempts, correct_attempts, last_tested)
SELECT
  ta.user_id,
  aa.section as skill,
  CASE WHEN COUNT(*) > 0
    THEN CAST(ROUND(CAST(SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS REAL) * 100 / COUNT(*)) AS INTEGER)
    ELSE 0 END as score,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
  MAX(aa.submitted_at) as last_tested
FROM attempt_answers aa
JOIN test_attempts ta ON aa.attempt_id = ta.id
WHERE aa.submitted_at IS NOT NULL
GROUP BY ta.user_id, aa.section;

-- ═══════════════════════════════════════════════════════
-- 5. Backfill skill_tracker from attempt_answers
-- ═══════════════════════════════════════════════════════

INSERT OR IGNORE INTO skill_tracker (user_id, test_type, skill, attempts_count, last_updated)
SELECT
  ta.user_id,
  ta.test_type,
  aa.section as skill,
  COUNT(*) as attempts_count,
  MAX(aa.submitted_at) as last_updated
FROM attempt_answers aa
JOIN test_attempts ta ON aa.attempt_id = ta.id
WHERE aa.submitted_at IS NOT NULL
GROUP BY ta.user_id, ta.test_type, aa.section;

-- ═══════════════════════════════════════════════════════
-- 6. Create student_profiles for all onboarded users
-- ═══════════════════════════════════════════════════════

INSERT OR IGNORE INTO student_profiles (user_id, learning_pace, engagement_level)
SELECT id, 'normal', 'moderate'
FROM users
WHERE onboarding_complete = 1;

-- ═══════════════════════════════════════════════════════
-- 7. Backfill skill_weakness_summary from diagnostic + practice data
-- ═══════════════════════════════════════════════════════

INSERT OR IGNORE INTO skill_weakness_summary (
  user_id, grammar_score, vocab_score, reading_score, listening_score,
  writing_band, estimated_band, total_practice_questions
)
SELECT
  dr.user_id,
  dr.grammar_score,
  dr.vocab_score,
  dr.reading_score,
  dr.listening_score,
  dr.writing_band,
  dr.estimated_band,
  COALESCE((SELECT COUNT(*) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = dr.user_id), 0)
FROM diagnostic_results dr
WHERE dr.id IN (SELECT MAX(id) FROM diagnostic_results GROUP BY user_id);

-- ═══════════════════════════════════════════════════════
-- 8. Update practice accuracy in skill_weakness_summary
-- ═══════════════════════════════════════════════════════

UPDATE skill_weakness_summary SET
  listening_accuracy = (
    SELECT ROUND(CAST(SUM(CASE WHEN aa.is_correct=1 THEN 1 ELSE 0 END) AS REAL) * 100 / NULLIF(COUNT(*),0))
    FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = skill_weakness_summary.user_id AND aa.section = 'listening'
  ),
  reading_accuracy = (
    SELECT ROUND(CAST(SUM(CASE WHEN aa.is_correct=1 THEN 1 ELSE 0 END) AS REAL) * 100 / NULLIF(COUNT(*),0))
    FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = skill_weakness_summary.user_id AND aa.section = 'reading'
  ),
  speaking_accuracy = (
    SELECT ROUND(CAST(SUM(CASE WHEN aa.is_correct=1 THEN 1 ELSE 0 END) AS REAL) * 100 / NULLIF(COUNT(*),0))
    FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = skill_weakness_summary.user_id AND aa.section = 'speaking'
  ),
  writing_accuracy = (
    SELECT ROUND(CAST(SUM(CASE WHEN aa.is_correct=1 THEN 1 ELSE 0 END) AS REAL) * 100 / NULLIF(COUNT(*),0))
    FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = skill_weakness_summary.user_id AND aa.section = 'writing'
  ),
  last_updated = datetime('now');

-- ═══════════════════════════════════════════════════════
-- 9. Fix user streaks from actual activity data
-- ═══════════════════════════════════════════════════════

UPDATE users SET
  last_study_date = (
    SELECT MAX(date(aa.submitted_at))
    FROM attempt_answers aa
    JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = users.id
  )
WHERE id IN (
  SELECT DISTINCT ta.user_id FROM test_attempts ta
  JOIN attempt_answers aa ON aa.attempt_id = ta.id
);
