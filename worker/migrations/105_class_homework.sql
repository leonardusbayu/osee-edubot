-- 105: Class homework — teacher-assigned practice for a class. Teacher
-- can say "do 20 reading questions by Friday" and the class has a
-- trackable assignment. Completion is measured by the number of
-- attempt_answers a student submitted in the target section after
-- the homework was created.
CREATE TABLE IF NOT EXISTS class_homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  assigned_by INTEGER NOT NULL,
  section TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_class_homework_class
  ON class_homework (class_id, status);

-- Per-student completion records. One row per (homework_id, user_id)
-- tracks the number of questions completed in the target section.
CREATE TABLE IF NOT EXISTS homework_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  completed_count INTEGER DEFAULT 0,
  completed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(homework_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_homework_completions_user
  ON homework_completions (user_id, homework_id);