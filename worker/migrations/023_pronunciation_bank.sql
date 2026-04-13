-- Pronunciation practice word/phrase bank
-- Categories aligned with TOEFL iBT, IELTS, TOEIC frameworks

CREATE TABLE IF NOT EXISTS pronunciation_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  ipa TEXT,                          -- IPA transcription e.g. /θɪŋk/
  category TEXT NOT NULL,            -- e.g. 'th_sounds', 'vowel_pairs', 'academic_vocab'
  subcategory TEXT,                  -- e.g. 'voiceless_th', 'long_vs_short'
  difficulty TEXT DEFAULT 'intermediate', -- beginner, intermediate, advanced
  test_type TEXT DEFAULT 'ALL',      -- TOEFL_IBT, IELTS, TOEIC, ALL
  part_of_speech TEXT,               -- noun, verb, adjective, etc.
  example_sentence TEXT,             -- sentence using the word
  common_mistake TEXT,               -- what Indonesian speakers often get wrong
  tip TEXT,                          -- pronunciation tip
  audio_cached INTEGER DEFAULT 0,    -- 1 if TTS audio is pre-cached
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_pronun_category ON pronunciation_bank(category, difficulty);
CREATE INDEX idx_pronun_test ON pronunciation_bank(test_type, category);
CREATE INDEX idx_pronun_difficulty ON pronunciation_bank(difficulty);
