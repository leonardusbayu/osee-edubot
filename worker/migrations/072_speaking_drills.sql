-- 072: Speaking Drill Engine
-- Listen-and-repeat drills: target phrase + IPA + prosody targets + difficulty
-- Tracks per-user drill attempts and best scores

CREATE TABLE IF NOT EXISTS speaking_drills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phrase TEXT NOT NULL,                -- target phrase the student must repeat
  ipa TEXT,                            -- IPA transcription of phrase
  category TEXT NOT NULL,              -- e.g. 'th_sounds', 'vowel_pairs', 'minimal_pairs', 'sentence_stress'
  difficulty TEXT DEFAULT 'intermediate', -- beginner, intermediate, advanced
  test_type TEXT DEFAULT 'ALL',        -- TOEFL_IBT, IELTS, TOEIC, ALL
  target_rhythm TEXT,                  -- expected stress pattern e.g. 'da-DA-da' (null for single words)
  common_mistake TEXT,                 -- what Indonesian speakers often get wrong
  tip TEXT,                            -- pronunciation tip
  cefr_level TEXT DEFAULT 'B1',        -- A1..C2 gating
  audio_cached INTEGER DEFAULT 0,      -- 1 if TTS audio is pre-cached
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drills_category ON speaking_drills(category, difficulty);
CREATE INDEX IF NOT EXISTS idx_drills_test ON speaking_drills(test_type, category);
CREATE INDEX IF NOT EXISTS idx_drills_cefr ON speaking_drills(cefr_level);

CREATE TABLE IF NOT EXISTS speaking_drill_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  drill_id INTEGER NOT NULL,
  transcription TEXT,                  -- what Whisper heard
  prosody_wpm INTEGER DEFAULT 0,
  prosody_pause_ratio REAL DEFAULT 0,
  prosody_fluency_score INTEGER DEFAULT 0,
  prosody_rhythm_score INTEGER DEFAULT 0,
  prosody_overall INTEGER DEFAULT 0,
  accuracy_score INTEGER DEFAULT 0,    -- 0-100, phrase-match accuracy
  combined_score INTEGER DEFAULT 0,    -- weighted blend of accuracy + prosody
  feedback TEXT,                       -- GPT-generated feedback
  audio_seconds REAL DEFAULT 0,        -- duration of voice message
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drill_attempts_user ON speaking_drill_attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_drill_attempts_drill ON speaking_drill_attempts(drill_id, combined_score);

-- Seed: 30+ listen-and-repeat drills across CEFR levels
INSERT INTO speaking_drills (phrase, ipa, category, difficulty, test_type, target_rhythm, common_mistake, tip, cefr_level) VALUES
  -- A1 single words
  ('three', '/θriː/', 'th_sounds', 'beginner', 'ALL', NULL, 'Indonesian speakers say "tree" without the /θ/ friction', 'Put your tongue tip between your teeth and blow air — feel the friction', 'A1'),
  ('thank you', '/θæŋk juː/', 'th_sounds', 'beginner', 'ALL', 'DA-da', '"tank you" — replaced /θ/ with /t/', 'Both words need /θ/. Tongue between teeth for "th"', 'A1'),
  ('this', '/ðɪs/', 'th_sounds', 'beginner', 'ALL', 'DA', '"dis" — replaced /ð/ with /d/', 'Voiced TH: tongue between teeth, vocal cords vibrating, no air burst', 'A1'),
  ('brother', '/ˈbrʌðər/', 'th_sounds', 'beginner', 'ALL', 'DA-da', '"bruh-der" — dropped the TH', 'Slow down. "BRUH-ther" with voiced TH in the middle', 'A1'),
  ('weather', '/ˈwɛðər/', 'th_sounds', 'beginner', 'ALL', 'DA-da', '"we-der" — dropped the TH', 'Think "we-ther" with tongue between teeth', 'A1'),

  -- A2 vowel pairs
  ('ship', '/ʃɪp/', 'vowel_pairs', 'beginner', 'ALL', NULL, 'Indonesian speakers say "sheep" (long /iː/)', 'Short /ɪ/ — mouth relaxed, tongue mid', 'A2'),
  ('sheep', '/ʃiːp/', 'vowel_pairs', 'beginner', 'ALL', NULL, 'Indonesian speakers say "ship" (short /ɪ/)', 'Long /iː/ — stretch the vowel, mouth smiles wide', 'A2'),
  ('bit', '/bɪt/', 'vowel_pairs', 'beginner', 'ALL', NULL, 'Said as "beat" (long vowel)', 'Short /ɪ/ — quick, relaxed', 'A2'),
  ('beat', '/biːt/', 'vowel_pairs', 'beginner', 'ALL', NULL, 'Said as "bit" (short vowel)', 'Long /iː/ — hold it for 2x longer', 'A2'),
  ('full', '/fʊl/', 'vowel_pairs', 'beginner', 'ALL', NULL, 'Said as "fool" (long /uː/)', 'Short /ʊ/ — lips rounded but relaxed', 'A2'),

  -- B1 word stress
  ('PHOtograph', '/ˈfoʊtəɡræf/', 'word_stress', 'intermediate', 'TOEFL_IBT', 'DA-da-da', 'phoTOgraph (stress on 2nd)', 'FO-to-graph — stress the first syllable', 'B1'),
  ('phoTOGraphy', '/fəˈtɑːɡrəfi/', 'word_stress', 'intermediate', 'ALL', 'da-DA-da-da', 'PHOtography (stress on 1st)', 'pho-TO-gra-phy — stress shifts to 2nd syllable in -graphy', 'B1'),
  ('IMport (noun)', '/ˈɪmpɔːrt/', 'word_stress', 'intermediate', 'ALL', 'DA-da', 'imPORT (verb stress on 2nd)', 'As noun: IM-port. As verb: im-PORT', 'B1'),
  ('RECord (noun)', '/ˈrekərd/', 'word_stress', 'intermediate', 'ALL', 'DA-da', 'reCORD (verb stress on 2nd)', 'As noun: REC-ord. As verb: re-CORD', 'B1'),

  -- B1 sentence stress
  ('I NEED your HELP', '/aɪ niːd jɔːr hɛlp/', 'sentence_stress', 'intermediate', 'TOEFL_IBT', 'da-DA-da-DA', 'Equal stress on every word', 'Stress "NEED" and "HELP" — content words carry meaning', 'B1'),
  ('The MEETING is toMORRow', '/ðə ˈmiːtɪŋ ɪz təˈmɑːroʊ/', 'sentence_stress', 'intermediate', 'TOEFL_IBT', 'da-DA-da-da-DA-da', 'Equal stress on all syllables', 'Content words (MEETING, toMORRow) are louder, longer, higher', 'B1'),

  -- B1 connected speech
  ('whaddya think', '/wʌdʒə θɪŋk/', 'connected_speech', 'intermediate', 'ALL', 'DA-da-DA', 'Said as 3 separate words "what do you think"', '"whaddya" = what-do-you linked together in casual speech', 'B1'),
  ('gonna', '/ˈɡʌnə/', 'connected_speech', 'intermediate', 'ALL', 'DA-da', 'Said as "going to" (3 syllables)', '"gonna" = going + to linked. 2 syllables, casual register', 'B1'),
  ('wanna', '/ˈwɑːnə/', 'connected_speech', 'intermediate', 'ALL', 'DA-da', 'Said as "want to" (3 syllables)', '"wanna" = want + to linked. 2 syllables, casual', 'B1'),

  -- B2 minimal pairs
  ('rice vs. rise', '/raɪs/', 'minimal_pairs', 'intermediate', 'ALL', 'DA', 'Both /s/ and /z/ pronounced the same way in some dialects', 'Final /s/ is unvoiced (rice), /z/ is voiced (rise). Feel the buzz', 'B2'),
  ('bat vs. bad', '/bæt/ vs. /bæd/', 'minimal_pairs', 'intermediate', 'ALL', 'DA', 'Final /t/ and /d/ blurred in Indonesian-influenced English', '/t/ is aspirated (puff of air), /d/ is not', 'B2'),

  -- B2 R and L
  ('right', '/raɪt/', 'r_and_l', 'intermediate', 'ALL', 'DA', 'Said as "light" (L substituted for R)', 'R: curl tongue back, don''t touch roof of mouth. L: tongue tip touches behind teeth', 'B2'),
  ('really', '/ˈriːəli/', 'r_and_l', 'intermediate', 'ALL', 'DA-da-da', 'Said as "leally"', 'Initial R in "really" — curl, don''t touch', 'B2'),

  -- C1 academic
  ('particularly', '/pərˈtɪkjələrli/', 'academic_vocab', 'advanced', 'TOEFL_IBT', 'da-DA-da-da-da', 'Stress on 1st syllable "PAR-ticularly"', 'par-TIC-u-lar-ly — stress on 2nd syllable', 'C1'),
  ('phenomenon', '/fəˈnɑːmɪnɑːn/', 'academic_vocab', 'advanced', 'TOEFL_IBT', 'da-DA-da-DA', 'Equal stress on all syllables', 'phe-NOM-e-non — 2nd syllable stressed, 3rd also gets secondary stress', 'C1'),
  ('laboratory', '/ˈlæbrətɔːri/', 'academic_vocab', 'advanced', 'IELTS', 'DA-da-da-da', 'la-BOR-a-tory (stress on 2nd)', 'LAB-ra-tor-y — stress on 1st syllable', 'C1'),
  ('psychology', '/saɪˈkɑːlədʒi/', 'academic_vocab', 'advanced', 'ALL', 'da-DA-da-da', 'PSY-chology (stress on 1st)', 'psy-CHOL-o-gy — silent P, stress on 2nd syllable', 'C1'),

  -- C2 academic phrases
  ('In other words', '/ɪn ˈʌðər wɜːrdz/', 'academic_phrases', 'advanced', 'IELTS', 'da-DA-da-DA', 'Equal stress on all words', 'In O-ther WORDS — stress "OTHER" and "WORDS"', 'C2'),
  ('On the other hand', '/ɑːn ði ˈʌðər hænd/', 'academic_phrases', 'advanced', 'TOEFL_IBT', 'da-da-DA-da-DA', 'Equal stress on all words', 'On the O-ther HAND — stress "OTHER" and "HAND"', 'C2'),

  -- Numbers and dates
  ('twenty twenty-five', '/ˈtwɛnti twɛnti faɪv/', 'numbers_dates', 'beginner', 'ALL', 'DA-da-DA-da-DA', 'Said with equal emphasis on every syllable', 'Stress the "twenty" parts and the final "five" naturally', 'A2'),
  ('three hundred and forty', '/θriː ˈhʌndrəd ən ˈfɔːrti/', 'numbers_dates', 'intermediate', 'ALL', 'DA-DA-da-da-DA-da', '"three HUNDRED forty" — too much stress on HUNDRED', 'Smooth flow: "three hun-dred an-d for-ty" with light "and"', 'B1'),

  -- Schwa sound
  ('about', '/əˈbaʊt/', 'schwa_sound', 'intermediate', 'ALL', 'a-DA', 'Said as "a-BOUT" with strong first syllable', 'a-BOUT — first syllable is schwa (unstressed /ə/)', 'B1'),
  ('taken', '/ˈteɪkən/', 'schwa_sound', 'intermediate', 'ALL', 'DA-da', '"TAY-ken" — strong second syllable', 'TAY-ken — final "en" is unstressed schwa', 'B1');
