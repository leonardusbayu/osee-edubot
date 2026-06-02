-- Migration 060: Style scores column + boss battle XP trigger fix
-- Adds style_scores JSON column to student_profiles for learning style detection

ALTER TABLE student_profiles ADD COLUMN style_scores TEXT DEFAULT NULL;
