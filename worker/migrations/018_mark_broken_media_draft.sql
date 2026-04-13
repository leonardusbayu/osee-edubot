-- Mark questions with non-HTTP media URLs as draft (479 broken URLs)
-- These contain local file paths or placeholder strings that can't be played
-- Prevents broken audio from being served to students
UPDATE test_contents
SET status = 'draft', updated_at = datetime('now')
WHERE media_url IS NOT NULL
  AND media_url != ''
  AND media_url NOT LIKE 'http://%'
  AND media_url NOT LIKE 'https://%'
  AND status = 'published';

-- Mark invalid JSON record as draft
-- ID 4571 has malformed JSON that breaks question rendering
UPDATE test_contents
SET status = 'draft', updated_at = datetime('now')
WHERE id = 4571 AND status = 'published';
