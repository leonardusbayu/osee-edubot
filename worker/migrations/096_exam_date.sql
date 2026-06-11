-- 096: exam-date countdown + taper plan (ROADMAP_M3 §2.3)
-- Stores the student's real exam date as ISO date (YYYY-MM-DD).
ALTER TABLE users ADD COLUMN exam_date TEXT;
