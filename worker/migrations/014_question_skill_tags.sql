-- Add skill tagging columns for granular weakness tracking
-- skill_tags: JSON array of testable micro-skills (e.g., ["main_idea","inference"])
-- cefr_level: A1/A2/B1/B2/C1/C2 alignment
-- bloom_level: Bloom's taxonomy cognitive level

ALTER TABLE test_contents ADD COLUMN skill_tags TEXT DEFAULT '[]';
ALTER TABLE test_contents ADD COLUMN cefr_level TEXT DEFAULT 'B1';
ALTER TABLE test_contents ADD COLUMN bloom_level TEXT DEFAULT 'understand';

-- Index for skill-based queries
CREATE INDEX IF NOT EXISTS idx_test_contents_skills ON test_contents(test_type, section, cefr_level);
CREATE INDEX IF NOT EXISTS idx_test_contents_status ON test_contents(status, test_type);
