-- 071_vocabulary_cards.sql
-- Vocabulary trainer with FSRS-powered spaced repetition
-- Supports per-test (TOEFL iBT, IELTS, TOEIC, TOEFL ITP) and per-CEF R level
-- Indonesian memory hooks for better retention

-- Vocabulary cards: the content bank
CREATE TABLE IF NOT EXISTS vocabulary_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  phonetic TEXT,                        -- IPA pronunciation, e.g. /ɪɡˈzækt/
  cefr_level TEXT NOT NULL,             -- A1, A2, B1, B2, C1, C2
  test_type TEXT,                       -- TOEFL_IBT, IELTS, TOEIC, TOEFL_ITP, or NULL for all
  topic TEXT,                           -- academic, business, general, daily, idioms, phrasal_verbs
  difficulty INTEGER DEFAULT 3,         -- 1-5 (matches test_contents difficulty scale)
  definition TEXT NOT NULL,
  example_sentence TEXT,
  synonyms TEXT,                         -- JSON array
  antonyms TEXT,                        -- JSON array
  word_family TEXT,                     -- JSON array of related forms (decide → decision, decisive)
  idiom_or_phrasal TEXT,               -- For idioms/phrasal verbs: "pick up" → "to learn/acquire"
  indonesian_analogy TEXT,             -- Indonesian cultural memory hook
  audio_url TEXT,                       -- TTS URL if pre-generated
  tags TEXT,                            -- JSON array of search tags
  source TEXT DEFAULT 'curated',
  status TEXT DEFAULT 'active',          -- active, deprecated
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vocab_cefr ON vocabulary_cards(cefr_level);
CREATE INDEX IF NOT EXISTS idx_vocab_test ON vocabulary_cards(test_type);
CREATE INDEX IF NOT EXISTS idx_vocab_topic ON vocabulary_cards(topic);
CREATE INDEX IF NOT EXISTS idx_vocab_status ON vocabulary_cards(status);

-- Per-user vocabulary learning state (FSRS-powered)
CREATE TABLE IF NOT EXISTS vocabulary_learning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  vocab_id INTEGER NOT NULL,
  fsrs_state TEXT,                      -- JSON: {due, stability, difficulty, elapsed_days, reps, lapses, state}
  next_review TEXT,
  last_review TEXT,
  total_reviews INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,       -- Track accuracy per word
  last_quality INTEGER,                -- Last FSRS rating (1-4: again, hard, good, easy)
  streak INTEGER DEFAULT 0,             -- Consecutive correct days
  is_learned INTEGER DEFAULT 0,        -- 1 = has reached "learned" threshold
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (vocab_id) REFERENCES vocabulary_cards(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vocab_learn_user_vocab ON vocabulary_learning(user_id, vocab_id);
CREATE INDEX IF NOT EXISTS idx_vocab_learn_due ON vocabulary_learning(user_id, next_review);

-- Daily vocabulary cache (one card per user per day, to avoid repeats)
CREATE TABLE IF NOT EXISTS daily_vocab_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  vocab_id INTEGER NOT NULL,
  date_sent TEXT NOT NULL,             -- YYYY-MM-DD
  review_rating INTEGER,               -- User's self-rating: 1=again, 2=hard, 3=good, 4=easy
  sent_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (vocab_id) REFERENCES vocabulary_cards(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_vocab_user_date ON daily_vocab_cache(user_id, date_sent);
