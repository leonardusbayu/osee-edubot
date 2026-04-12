-- Migration 016: FSRS adaptive spaced repetition + Learning preferences system
-- 1. Add FSRS state to spaced_repetition
-- 2. Add learning preferences to student_profiles
-- 3. Create mental_model table for Theory-of-Mind tracking
-- 4. Create lesson_plans table for guided learning

-- ═══════════════════════════════════════════════════════
-- 1. FSRS state column on spaced_repetition
-- ═══════════════════════════════════════════════════════
ALTER TABLE spaced_repetition ADD COLUMN fsrs_state TEXT DEFAULT NULL;

-- ═══════════════════════════════════════════════════════
-- 2. Learning preferences on student_profiles (Ranedeer-inspired)
-- ═══════════════════════════════════════════════════════
ALTER TABLE student_profiles ADD COLUMN learning_style TEXT DEFAULT 'balanced';
-- Values: visual, verbal, active, reflective, balanced

ALTER TABLE student_profiles ADD COLUMN communication_style TEXT DEFAULT 'socratic';
-- Values: socratic, storytelling, formal, casual, direct

ALTER TABLE student_profiles ADD COLUMN depth_level TEXT DEFAULT 'intermediate';
-- Values: beginner, elementary, intermediate, advanced, expert

ALTER TABLE student_profiles ADD COLUMN target_band_score REAL DEFAULT NULL;
-- IELTS band or TOEFL score target

ALTER TABLE student_profiles ADD COLUMN study_goal TEXT DEFAULT NULL;
-- e.g., 'beasiswa luar negeri', 'kerja di perusahaan asing', 'sertifikasi'

ALTER TABLE student_profiles ADD COLUMN daily_study_target_min INTEGER DEFAULT 30;
-- Target study minutes per day

ALTER TABLE student_profiles ADD COLUMN preferred_language TEXT DEFAULT 'id';
-- 'id' = Indonesian, 'en' = English, 'mixed'

ALTER TABLE student_profiles ADD COLUMN personality_notes TEXT DEFAULT NULL;
-- AI-generated notes about student personality and communication patterns

ALTER TABLE student_profiles ADD COLUMN auto_detected_style TEXT DEFAULT NULL;
-- JSON: styles auto-detected from interaction patterns

-- ═══════════════════════════════════════════════════════
-- 3. Mental Model table — Theory-of-Mind engine
-- Tracks what the tutor believes the student knows/doesn't know
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS student_mental_model (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  concept TEXT NOT NULL,                    -- e.g., 'present_perfect_vs_past_simple'
  believed_understanding TEXT DEFAULT 'unknown',
  -- Values: unknown, misconception, partial, solid, mastered
  evidence TEXT DEFAULT '[]',               -- JSON array of evidence entries
  misconceptions TEXT DEFAULT '[]',         -- JSON array of detected misconceptions
  last_assessed_at TEXT,
  confidence REAL DEFAULT 0.5,              -- How confident the tutor is in this assessment
  times_assessed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, concept)
);

CREATE INDEX IF NOT EXISTS idx_mental_model_user ON student_mental_model(user_id);
CREATE INDEX IF NOT EXISTS idx_mental_model_understanding ON student_mental_model(believed_understanding);

-- ═══════════════════════════════════════════════════════
-- 4. Lesson Plans — Guided learning system
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lesson_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  plan_type TEXT DEFAULT 'personalized',
  -- Values: personalized, classroom, diagnostic_follow_up, weakness_drill
  target_skills TEXT DEFAULT '[]',          -- JSON array of target skill IDs
  lessons TEXT DEFAULT '[]',                -- JSON array of lesson steps
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  -- Values: active, completed, paused, expired
  difficulty_level INTEGER DEFAULT 3,       -- 1-5
  estimated_minutes INTEGER DEFAULT 30,
  progress_percent INTEGER DEFAULT 0,
  generated_by TEXT DEFAULT 'ai',           -- 'ai', 'teacher', 'system'
  class_id INTEGER DEFAULT NULL,            -- NULL = personal, otherwise classroom lesson
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_user ON lesson_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_status ON lesson_plans(status);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_class ON lesson_plans(class_id);

-- ═══════════════════════════════════════════════════════
-- 5. Lesson step completions — Track individual step results
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lesson_step_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_plan_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  -- Values: explanation, exercise, quiz, discussion, reflection
  score REAL DEFAULT NULL,
  time_spent_sec INTEGER DEFAULT 0,
  response_data TEXT DEFAULT NULL,          -- JSON: student's response
  feedback TEXT DEFAULT NULL,               -- AI-generated feedback
  completed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lesson_plan_id) REFERENCES lesson_plans(id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_step_results_plan ON lesson_step_results(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_lesson_step_results_user ON lesson_step_results(user_id);
