-- Migration 058: Socratic Questioning Engine + Concept Review Cards + Boss Battles
-- Adds socratic_state JSON column to student_profiles
-- Adds concept_review_cards table for concept-level spaced repetition
-- Adds boss_battles table for 50 XP challenge battles

-- Socratic state tracking (JSON blob)
ALTER TABLE student_profiles ADD COLUMN socratic_state TEXT DEFAULT NULL;

-- Concept-level review cards (aggregated from question-level FSRS signals)
CREATE TABLE IF NOT EXISTS concept_review_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  concept TEXT NOT NULL,                           -- 'articles', 'tenses', 'prepositions', etc.

  -- FSRS fields
  stability REAL DEFAULT 0,                        -- how stable the memory is (days)
  difficulty REAL DEFAULT 0.5,                     -- how difficult this concept is for this student
  last_review TEXT DEFAULT NULL,                   -- last review date
  next_review TEXT DEFAULT NULL,                   -- next review due date
  reps INTEGER DEFAULT 0,                          -- number of reviews
  lapses INTEGER DEFAULT 0,                        -- number of times forgotten

  -- Aggregate signals
  total_questions_attempted INTEGER DEFAULT 0,     -- total questions on this concept
  total_correct INTEGER DEFAULT 0,                 -- total correct on this concept
  accuracy_percent REAL DEFAULT 0,                 -- running accuracy

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, concept)
);

CREATE INDEX IF NOT EXISTS idx_concept_review_user ON concept_review_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_concept_review_due ON concept_review_cards(next_review);

-- Indonesian analogy mappings cache (pre-built, AI can also add dynamically)
CREATE TABLE IF NOT EXISTS indonesian_analogies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept TEXT NOT NULL,                           -- 'articles', 'tenses', 'present_perfect', etc.
  analogy_id TEXT NOT NULL,                        -- unique slug
  analogy_text TEXT NOT NULL,                      -- the Indonesian analogy text
  category TEXT DEFAULT 'grammar',                 -- grammar, vocab, reading, listening
  usage_count INTEGER DEFAULT 0,                   -- how many times this analogy was used
  effectiveness_score REAL DEFAULT 0.5,            -- 0-1, improved when student gets it right after
  is_active INTEGER DEFAULT 1,                     -- 0 = disabled
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(concept, analogy_id)
);

CREATE INDEX IF NOT EXISTS idx_indonesian_analogies_concept ON indonesian_analogies(concept);

-- Boss battles table (50 XP challenge)
CREATE TABLE IF NOT EXISTS boss_battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  xp_threshold INTEGER NOT NULL,                   -- XP level when battle triggered
  questions TEXT NOT NULL,                         -- JSON array of question IDs
  current_question INTEGER DEFAULT 0,              -- 0-4
  correct_answers INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',                    -- active, won, lost
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_boss_battles_user ON boss_battles(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_battles_status ON boss_battles(user_id, status);

-- Seed Indonesian analogies for common grammar concepts
INSERT OR IGNORE INTO indonesian_analogies (concept, analogy_id, analogy_text, category) VALUES
  ('articles', 'ojol_spesifik', 'Articles itu kayak naik ojol. Kalau bilang "tumpang ojol" (a ojol) = ojol mana aja. Kalau bilang "tumpang ojol yang tadi" (the ojol) = spesifik, yang itu.', 'grammar'),
  ('articles', 'warung_pertama', 'Pertama kali sebut "ada warung baru" = a warung. Kedua kali "warungnya enak" = the warung — udah tau yang mana.', 'grammar'),
  ('tenses', 'foto_timeline', 'Tenses itu kayak foto vs video. Simple tense = foto (satu momen). Continuous = video (sedang berlangsung). Perfect = foto yang udah diambil tapi masih nyambung sampe sekarang.', 'grammar'),
  ('present_perfect', 'chat_history', 'Present Perfect itu kayak chat history. "I have eaten" = udah makan (dan masih ada bekasnya di chat history). Bukan "I ate" = udah makan (tutup chat, selesai).', 'grammar'),
  ('past_simple', 'album_foto', 'Simple Past itu kayak album foto lama. "I went to Bali" = foto di album, udah selesai, nggak berubah. Ada waktu spesifik: "last year", "yesterday".', 'grammar'),
  ('prepositions', 'paket_pos', 'Preposisi waktu itu kayak ngirim paket: AT = jam spesifik (at 3pm), ON = hari tertentu (on Monday), IN = bulan/tahun (in 2024).', 'grammar'),
  ('conditionals', 'andai_kata', 'Conditional itu kayak "andai" di Bahasa. "Andai aku kaya..." = nggak nyata (If I were rich). "Kalau hujan, aku bawa payung" = nyata (If it rains, I bring an umbrella).', 'grammar'),
  ('passive_voice', 'gosip', 'Passive voice itu kayak gosip — yang penting BERITANYA, bukan siapa yang ngomong. "The cake was eaten" = kue-nya dimakan (siapa? nggak penting).', 'grammar'),
  ('sv_agreement', 'pasangan_dance', 'Subject-Verb Agreement itu kayak pasangan dance. Satu pasang = verb + S (She dances). Banyak pasang = verb tanpa S (They dance).', 'grammar'),
  ('relative_clauses', 'deskripsi_teman', 'Relative clause itu kayak deskripsi teman. "Teman yang pake kacamata" = the friend who wears glasses. "Buku yang merah" = the book which is red.', 'grammar'),
  ('gerunds', 'kata_kerja_jadi_benda', 'Gerund itu kayak kata kerja yang jadi benda. "Swimming is fun" = "Berenang itu seru". Verb + ing = jadi noun.', 'grammar'),
  ('reported_speech', 'pesan_berantai', 'Reported speech itu kayak nerusin pesan berantai. Dia bilang "Aku lapar" → Dia bilang kalau dia lapar. Tense-nya mundur satu step.', 'grammar');
