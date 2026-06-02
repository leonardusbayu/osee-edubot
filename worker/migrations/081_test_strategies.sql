-- 081: Test Strategies — Pacing, Scoring Rubrics, Frameworks
-- Master strategy guide for TOEFL iBT 2026, TOEFL ITP, TOEIC, IELTS
-- Compiled from: Official ETS materials, Cambridge IELTS Band Descriptors,
--                Longman Course for the TOEFL Test, TOEIC Score Guide

CREATE TABLE IF NOT EXISTS test_strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_key TEXT UNIQUE NOT NULL,         -- e.g. 'toefl_ibt_pacing'
  test_type TEXT NOT NULL,                   -- 'TOEFL_IBT', 'TOEFL_ITP', 'TOEIC', 'IELTS', 'ALL'
  category TEXT NOT NULL,                    -- 'pacing', 'scoring', 'framework', 'approach', 'rubric'
  name TEXT NOT NULL,
  description TEXT,
  framework TEXT,                            -- structured framework/theory
  key_actions TEXT,                          -- newline-separated action steps
  examples TEXT,                             -- worked examples
  cefr_level TEXT DEFAULT 'B1',
  order_index INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ts_test ON test_strategies(test_type, category);

-- ===========================================================================
-- SECTION A: TOEFL iBT 2026 — Scoring & Strategy
-- Total score: 0-120 (each section 0-30)
-- Reading: 30 questions, 54-72 min
-- Listening: 28-39 questions, 41-57 min
-- Speaking: 4 tasks, 17 min
-- Writing: 2 tasks, 50 min
-- ===========================================================================

INSERT INTO test_strategies (strategy_key, test_type, category, name, description, framework, key_actions, examples, cefr_level, order_index) VALUES
  ('toefl_ibt_overview', 'TOEFL_IBT', 'approach', 'TOEFL iBT Test Overview',
   'Master overview of the 4 sections, timing, and scoring',
   'Section | Time | Tasks | Score\nReading | 54-72 min | 2 passages, 10 questions each | 0-30\nListening | 41-57 min | 3 lectures + 2 conversations | 0-30\nSpeaking | 17 min | 4 tasks | 0-30\nWriting | 50 min | 2 tasks | 0-30\nTotal: ~2 hours, 0-120',
   '1. Take a diagnostic test FIRST to know your baseline\n2. Target score: 80+ for most US universities, 100+ for top 20\n3. Weakest section = highest priority for improvement\n4. Practice with official materials (ETS, Barron''s, Cambridge)\n5. Test is computer-based — practice on a computer, not paper',
   'A student targeting 90+ should aim for: Reading 22, Listening 22, Speaking 22, Writing 24.',
   'B1', 1),

  ('toefl_ibt_pacing', 'TOEFL_IBT', 'pacing', 'TOEFL iBT Pacing Strategy',
   'Time allocation per question for each section',
   'Reading: 54-72 min / 30 questions = ~1.8-2.4 min/question. Don''t spend more than 3 min on one question.\nListening: 41-57 min / 28-39 questions = ~1.1-1.5 min/question. Audio plays once — no pausing.\nSpeaking: 17 min for 4 tasks. Task 1 = 60s, Tasks 2-4 = 60s each. 15-30s prep time per task.\nWriting: 50 min for 2 tasks. Task 1 = 20 min, Task 2 = 30 min.',
   '1. Practice with a stopwatch — strict timing\n2. Reading: skip hard passages, return later\n3. Listening: never stop the audio\n4. Speaking: use prep time to outline (not write full)\n5. Writing: 3-5 min for Task 1 outline, 5-7 min for Task 2 outline',
   'TOEFL iBT Reading: passage 1 (10 Q) = 20 min, passage 2 (10 Q) = 20 min, last 10 Q = 14 min.',
   'B1', 2),

  ('toefl_ibt_speaking_rubric', 'TOEFL_IBT', 'rubric', 'TOEFL iBT Speaking Rubric (0-4 raw, scaled to 0-30)',
   'How the 4 speaking tasks are scored by ETS raters',
   'Score | General | Development | Language | Delivery\n4 | Topic + 2 clear reasons | Reasons explained with examples | Grammar + vocab error-free | Fluent, natural pace\n3 | Topic + clear reasons | Reasons explained | Some grammar errors | Generally fluent\n2 | Topic + 1 reason | Reason partial | Frequent errors | Hesitant\n1 | Topic only or off-topic | Minimal development | Hard to understand | Slow, fragmented\n0 | Off-topic / no response',
   '1. Always state your opinion clearly (Task 1)\n2. Cover BOTH speakers'' opinions (Tasks 2-3)\n3. Use 2 reasons + 2 examples (all tasks)\n4. Speak continuously for the full time\n5. Use a range of grammar (present, past, future)\n6. Self-correct smoothly (don''t say "um" repeatedly)',
   'Task 1 sample answer: "I prefer to study in a group. First, group study helps me understand difficult concepts because my friends can explain in different ways. For example, when I was studying biology, my friend explained the concept more clearly than the textbook. Second, group study keeps me motivated. When I study alone, I often get distracted."',
   'B2', 3),

  ('toefl_ibt_writing_rubric', 'TOEFL_IBT', 'rubric', 'TOEFL iBT Writing Rubric (0-5 raw, scaled to 0-30)',
   'How the 2 writing tasks are scored by ETS raters',
   'Score | Task Response | Organization | Language | Grammar\n5 | Fully addresses the topic | Clear progression, well-organized | Wide range, accurate | Error-free\n4 | Addresses the topic | Well-organized | Some variety | Minor errors\n3 | Mostly addresses | Some organization | Limited variety | Noticeable errors\n2 | Limited | Limited organization | Limited range | Frequent errors\n1 | Minimal | Minimal | Very limited | Errors impede meaning',
   '1. Integrated task: 150-225 words in 20 min\n2. Independent task: 300+ words in 30 min\n3. Use 4-5 paragraph structure\n4. Use specific examples (not vague)\n5. Use complex sentences: conditionals, relative clauses, passive',
   'Integrated task 1: Read 3 points → Listen to 3 lecture points → Write how lecture challenges/supports reading. Structure: intro + 3 body paragraphs (one per point) + conclusion.',
   'B2', 4),

  ('toefl_ibt_listening_strategy', 'TOEFL_IBT', 'framework', 'TOEFL iBT Listening Strategy (HSE Method)',
   'HSE = Head + Structure + Engagement. A 3-step framework for taking notes during listening.',
   'H — HEAD: note the topic (e.g., "biology lecture on photosynthesis")\nS — STRUCTURE: identify the lecture type (chronological, compare-contrast, problem-solution)\nE — ENGAGEMENT: note main points, examples, transitions, and the lecturer''s opinion',
   '1. Read questions BEFORE listening (30s preview)\n2. Note HEAD (topic) and STRUCTURE (type)\n3. Listen for transitions: "first", "next", "however", "for example"\n4. Mark each main point with a number\n5. Note cause-effect: "X causes Y because..."\n6. For attitude questions, listen to TONE, not just words',
   'Lecture on "Types of Bridges": H = bridge engineering; S = compare-contrast (3 types); E = (1) beam bridges, (2) arch bridges, (3) suspension bridges. Each type has examples.',
   'B1', 5),

  ('toefl_ibt_speaking_template_independent', 'TOEFL_IBT', 'framework', 'TOEFL iBT Speaking Task 1 Template (Independent)',
   '4-sentence template for the independent speaking task (45s)',
   'Sentence 1: STATE THE OPINION (clearly)\nSentence 2-3: REASON 1 + EXAMPLE\nSentence 4-5: REASON 2 + EXAMPLE\nSentence 6: BRIEF CONCLUSION',
   '1. Opening: "I prefer/believe [OPINION]."\n2. Reason 1: "First, [REASON 1]. For example, [EXAMPLE]."\n3. Reason 2: "In addition, [REASON 2]. For example, [EXAMPLE]."\n4. Conclusion: "That''s why I [OPINION again]."',
   'Topic: "Do you prefer to study alone or in a group?"\nAnswer: "I prefer to study in a group. First, my friends can explain difficult concepts in different ways. For example, when I studied biology, my friend explained cells more clearly than the textbook. Second, group study keeps me motivated. When I study alone, I often get distracted. That''s why I prefer group study."',
   'B1', 6),

  ('toefl_ibt_speaking_template_integrated', 'TOEFL_IBT', 'framework', 'TOEFL iBT Speaking Task 2 Template (Campus)',
   'Template for the campus-announcement integrated task (60s)',
   '1. STATE the change in the announcement\n2. STATE the woman''s opinion + reason\n3. STATE the man''s opinion + reason',
   '1. Use REPORTING verbs: "The university announced that...", "The woman disagrees because...", "The man agrees because..."\n2. Be specific (not vague)\n3. Use transitions: "First", "Additionally", "However"\n4. Don''t give your own opinion',
   'Reading: "The library will close at 9 PM starting next week."\nW: "I disagree. I often study until 11 PM."\nM: "I agree. The new hours are better for my schedule."\nAnswer: "The university announced that the library will close at 9 PM. The woman disagrees because she often studies until 11 PM. The man agrees because the new hours fit his schedule."',
   'B2', 7),

  ('toefl_ibt_writing_template_integrated', 'TOEFL_IBT', 'framework', 'TOEFL iBT Writing Task 1 Template (Integrated)',
   'Template for the integrated writing task (150-225 words in 20 min)',
   'Paragraph 1: INTRO (paraphrase the topic + state that the lecture addresses the reading)\nParagraph 2: POINT 1 (reading) + LECTURE RESPONSE\nParagraph 3: POINT 2 (reading) + LECTURE RESPONSE\nParagraph 4: POINT 3 (reading) + LECTURE RESPONSE',
   '1. Use REPORTING verbs: "The reading states...", "The professor argues...", "The lecturer casts doubt on..."\n2. ALWAYS show the relationship (lecture supports/refutes/qualifies reading)\n3. Don''t give your own opinion\n4. Use 3 paragraph bodies (one per reading point)\n5. Use connecting words: "First", "Second", "Third"',
   'Reading: "Three reasons why dinosaurs went extinct."\nLecture: "Each of these theories has been refuted by new evidence."\nAnswer structure: Intro → Point 1 (refuted by X) → Point 2 (refuted by Y) → Point 3 (refuted by Z).',
   'B2', 8),

  ('toefl_ibt_writing_template_independent', 'TOEFL_IBT', 'framework', 'TOEFL iBT Writing Task 2 Template (Independent)',
   'Template for the independent writing task (300+ words in 30 min)',
   'Para 1: INTRO (hook + thesis)\nPara 2: REASON 1 + EXAMPLE\nPara 3: REASON 2 + EXAMPLE\nPara 4: COUNTER-ARGUMENT + REBUTTAL (optional)\nPara 5: CONCLUSION (restate thesis)',
   '1. Spend 5 min planning: opinion + 2 reasons + 2 examples\n2. Each body paragraph: topic sentence + explanation + example\n3. Use specific examples (a real situation, not hypothetical)\n4. Use complex sentences: conditionals, relative clauses, passive\n5. Check: 300+ words, no major grammar errors',
   'Topic: "Do you agree: technology makes people lazy?"\nThesis: I disagree.\nPara 2: Tech saves time (example: online banking)\nPara 3: Tech creates new jobs (example: app developers)\nPara 4: Counter: "Some say tech makes us lazy, but actually..."',
   'B2', 9),

-- ===========================================================================
-- SECTION B: TOEFL ITP — Paper-based, 3 sections, 140 questions, 115 min
-- Score: 310-677 (Level 1), 200-500 (Level 2)
-- ===========================================================================

  ('toefl_itp_overview', 'TOEFL_ITP', 'approach', 'TOEFL ITP Test Overview',
   'Master overview of the 3 sections, timing, and scoring',
   'Section | Time | Questions | Score\nListening | 35 min | 50 | 31-68\nStructure & Written Exp | 25 min | 40 | 31-68\nReading | 55 min | 50 | 31-67\nTotal: 115 min, score 310-677',
   '1. Paper-based test — no computer needed\n2. 3 sections must be completed in order\n3. Each section has its own time limit (no breaks within sections)\n4. Practice with paper tests (not online)\n5. Used mainly for institutional placement, not immigration',
   'A student targeting Level 1 (500+) should aim: Listening 50+, Structure 50+, Reading 50+.',
   'A2', 10),

  ('toefl_itp_pacing', 'TOEFL_ITP', 'pacing', 'TOEFL ITP Pacing Strategy',
   'Time per question for each section',
   'Listening: 35 min / 50 Q = 42s/Q. Audio plays once.\nStructure: 25 min / 40 Q = 37.5s/Q. Choose quickly.\nReading: 55 min / 50 Q = 66s/Q. Passages are 200-300 words.',
   '1. Listening: read question while others listen\n2. Structure: cover answers, read each fully\n3. Reading: read questions first (1-2 min)\n4. Skip hard questions, return at the end\n5. Mark answers on the answer sheet IMMEDIATELY',
   'Structure question: read both A and B in 15s, choose in 5s. Move to next.',
   'A2', 11),

  ('toefl_itp_structure_strategy', 'TOEFL_ITP', 'framework', 'TOEFL ITP Structure & Written Expression Strategy (BEFORE Method)',
   'BEFORE = Basic + Form + Order + Reference + Ending. 5-step framework.',
   'B — BASIC grammar (subject-verb agreement, tense)\nF — FORM (noun/verb/adj/adv — does the form fit?)\nO — ORDER (word order: adjective before noun, etc.)\nR — REFERENCE (pronouns: do they agree?)\nE — ENDING (-s, -ed, -ing, -ly)',
   '1. Read the ENTIRE sentence\n2. Check each option for: agreement, tense, word form, word order, pronoun\n3. For structure questions: substitute each option, see what fits\n4. For written expression: check the 4 underlined parts, then "no error"\n5. Use process of elimination',
   'Sentence: "The team are playing well." → "are" should be "is" (singular subject). Choose the option that has "is".',
   'B1', 12),

-- ===========================================================================
-- SECTION C: TOEIC — 2 sections, 200 questions, 120 min, 10-990 score
-- ===========================================================================

  ('toeic_overview', 'TOEIC', 'approach', 'TOEIC Test Overview',
   'Master overview of the 2 sections, 7 parts, and scoring',
   'Section | Part | Content | Questions | Time\nListening | 1 | Photographs | 6 | 4 min\nListening | 2 | Question-Response | 25 | 8 min\nListening | 3 | Conversations | 39 | 13 min\nListening | 4 | Talks | 30 | 10 min\nReading | 5 | Incomplete Sentences | 30 | 15 min\nReading | 6 | Text Completion | 16 | 10 min\nReading | 7 | Reading Comp (single/double/triple) | 54 | 50 min\nTotal: 200 questions, 120 min, 10-990 score per section',
   '1. TOEIC is about WORKPLACE English, not academic\n2. Each section: 5-495 raw score, scaled\n3. Common score goals: 600 (B1), 785 (B2), 900+ (C1)\n4. Practice with TOEIC-specific materials (ETS, Barron''s)\n5. Speed is critical — strict timing',
   'A student targeting 785+ should aim: Listening 400+, Reading 385+.',
   'A2', 20),

  ('toeic_pacing', 'TOEIC', 'pacing', 'TOEIC Pacing Strategy',
   'Time per question for each part',
   'Part 1: 6 Q / 4 min = 40s/Q\nPart 2: 25 Q / 8 min = 19s/Q (audio is short)\nPart 3: 39 Q / 13 min = 20s/Q (3 Q per conversation)\nPart 4: 30 Q / 10 min = 20s/Q (3 Q per talk)\nPart 5: 30 Q / 15 min = 30s/Q\nPart 6: 16 Q / 10 min = 37.5s/Q\nPart 7: 54 Q / 50 min = 55s/Q (multi-passage)',
   '1. Read questions BEFORE listening (Parts 3, 4)\n2. Part 2 is fastest — answer quickly, don''t overthink\n3. Part 7: skim first, then read in detail\n4. Skip hard questions, return at end\n5. Mark answers on the answer sheet as you go (no separate transfer time)',
   'Part 7 strategy: 1-2 min skim the passage, 30s per question. Total = 1.5 min per question for single, 2.5 min for double/triple.',
   'A2', 21),

  ('toeic_part7_strategy', 'TOEIC', 'framework', 'TOEIC Part 7 Strategy (READ-SCAN-ANSWER)',
   '3-step framework for reading comprehension',
   'R — READ the questions first (find keywords)\nS — SCAN the passage for the keywords\nA — ANSWER the question (find the matching sentence)',
   '1. Read all questions (and choices) for the passage first\n2. Note: who, what, when, where, why\n3. Scan the passage for keywords from the questions\n4. Read the relevant section in detail\n5. For "NOT mentioned" questions, scan for 3 mentioned things, then choose the absent one\n6. For double/triple passages, read BOTH before answering',
   'Email about a meeting. Q: "When is the meeting?"\nScan: look for dates in the email. Find: "Tuesday, March 15, 2025, at 2 PM."\nAnswer: Tuesday, March 15 at 2 PM.',
   'B1', 22),

  ('toeic_listening_strategy', 'TOEIC', 'framework', 'TOEIC Listening Strategy (Picture-Question-Conversation)',
   'PQC = Picture + Question + Conversation. 3-step framework for Listening parts 1-4.',
   'P — PICTURE: look at the photo (Part 1 only)\nQ — QUESTION: read the question carefully\nC — CONVERSATION/TALK: listen for the answer',
   '1. Part 1: look at the photo FIRST (10-15s), predict what''s happening\n2. Part 2: listen for the QUESTION type (who, what, where, when, why, how)\n3. Part 3 & 4: read all 3 questions BEFORE listening\n4. Note: who is speaking, where, what the topic is\n5. Listen for: numbers, dates, places, opinions',
   'Part 2 example:\nQ: "Where is the man going?"\nListen for: "I''m heading to..."\nAnswer: the airport / the office / etc.',
   'A2', 23),

  ('toeic_vocabulary_focus', 'TOEIC', 'approach', 'TOEIC Vocabulary Focus (600-word list)',
   'The TOEIC tests a specific vocabulary of ~600 business words',
   'Categories: Office (meeting, deadline, schedule), Travel (flight, hotel, reservation), Finance (budget, invoice, revenue), HR (employee, hire, salary), Marketing (advertise, brand, customer), Technology (software, install, update), Manufacturing (assemble, produce, ship)',
   '1. Learn the 600-word TOEIC list (Barron''s, ETS)\n2. Practice with TOEIC word lists\n3. Group by topic: office, travel, finance, etc.\n4. Note collocations: "make a decision", "attend a meeting"\n5. Use the words in context (write sentences)',
   'Office vocab: meeting, agenda, minutes, deadline, schedule, appointment, conference, presentation.\nCollocations: "schedule a meeting", "meet a deadline", "take minutes".',
   'B1', 24),

-- ===========================================================================
-- SECTION D: IELTS — 4 sections, 0-9 band each
-- Listening: 30 min, 40 Q
-- Reading: 60 min, 40 Q
-- Writing: 60 min, 2 tasks
-- Speaking: 11-14 min, face-to-face
-- ===========================================================================

  ('ielts_overview', 'IELTS', 'approach', 'IELTS Test Overview',
   'Master overview of the 4 sections, timing, and scoring',
   'Section | Time | Tasks | Score\nListening | 30 min + 10 min transfer | 40 Q | 0-9 band\nReading | 60 min | 40 Q | 0-9 band (Academic: 3 passages; GT: 5 sections)\nWriting | 60 min | 2 tasks | 0-9 band\nSpeaking | 11-14 min | 3 parts | 0-9 band\nTotal: ~2h 45 min, 0-9 band (each section averaged)',
   '1. Academic vs General Training: choose based on your goal\n2. Speaking may be on a different day\n3. Listening: 10 min transfer time at the end\n4. Reading: NO transfer time (write on the answer sheet)\n5. Writing: Task 2 is worth 2x Task 1',
   'Target band for university: 6.5+. Target for top universities: 7.0+. Target for immigration: varies by country.',
   'B1', 30),

  ('ielts_band_descriptors', 'IELTS', 'rubric', 'IELTS Band Descriptors (0-9)',
   'Official IELTS band descriptions for Writing and Speaking',
   'Band 9: Expert — full operational command, appropriate, accurate, fluent\nBand 8: Very good — fully operational with occasional inaccuracies\nBand 7: Good — operational command, occasional errors, flexible\nBand 6: Competent — generally effective, some errors\nBand 5: Modest — partial command, frequent errors\nBand 4: Limited — basic competence, many errors\nBand 3: Extremely limited — conveys meaning only with effort\nBand 2: Intermittent — no real communication\nBand 1: Non-user — no ability to use the language\nBand 0: Did not attempt',
   '1. For Writing Task 1: aim for Band 7+ = clear overview + key features + accurate description\n2. For Writing Task 2: aim for Band 7+ = clear position + well-developed + flexible vocabulary\n3. For Speaking: aim for Band 7+ = fluent with natural pace + wide vocabulary + clear pronunciation\n4. Avoid: one-word answers, memorized responses, no clear position',
   'Band 7 Writing Task 2 sample: Clear position (euthanasia is wrong), well-developed reasons (religious, ethical, medical risks), appropriate linking words, some flexible vocabulary (controversial, ethical, autonomy).',
   'B1', 31),

  ('ielts_writing_rubric', 'IELTS', 'rubric', 'IELTS Writing Task 1 & 2 Rubric',
   'How Writing is scored (4 criteria, each 0-9)',
   'Task 1: Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy\nTask 2: Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy\nEach criterion is scored 0-9, then averaged for the task. Task 2 is worth 2x Task 1.',
   'TASK 1:\n1. Task Achievement: 150+ words, accurate description, overview, key features, no opinion\n2. Coherence: 4 paragraphs (intro, overview, body 1, body 2)\n3. Lexical Resource: use specific vocabulary (rising, declining, fluctuating)\n4. Grammar: range of tenses (past, present), comparisons\n\nTASK 2:\n1. Task Response: 250+ words, clear position, all parts addressed\n2. Coherence: 4-5 paragraphs, clear progression, linking words\n3. Lexical Resource: paraphrasing, collocations, less common vocabulary\n4. Grammar: complex sentences (conditionals, passive, relative clauses)',
   'Task 1 example (150+ words):\n"The line graph shows the percentage of households with internet access from 2000 to 2020. Overall, internet access increased significantly in all four countries. [overview] In 2000, [body 1]... By 2020, [body 2]..."',
   'B2', 32),

  ('ielts_speaking_rubric', 'IELTS', 'rubric', 'IELTS Speaking Rubric (4 criteria, 0-9)',
   'How Speaking is scored',
   'Criterion | Description | Band 7+\nFluency & Coherence | Natural pace, few pauses, clear connections | Speak at length, no long pauses\nLexical Resource | Wide vocabulary, paraphrasing, idiomatic | Use less common words, paraphrase effectively\nGrammatical Range & Accuracy | Mix of complex and simple, error-free mostly | Use conditionals, passive, relative clauses\nPronunciation | Clear, natural intonation, easy to understand | Stress, rhythm, intonation matter',
   '1. Practice speaking for 2 min on any topic (Part 2)\n2. Extend answers (don''t give one-word answers)\n3. Use FILLERS: "well", "I mean", "you know"\n4. Use complex grammar: conditionals, passive, relative clauses\n5. Self-correct (don''t leave errors)\n6. Pronunciation: word stress, sentence rhythm',
   'Part 1 sample answer (Band 7+):\n"Well, I work as a teacher at a high school in Jakarta. I''ve been teaching there for about five years now, and I really enjoy it because I get to help students develop their English skills. What I find most rewarding is when a student finally understands a difficult concept — that moment is priceless."',
   'B2', 33),

  ('ielts_tfng_strategy', 'IELTS', 'framework', 'IELTS True/False/Not Given Strategy (3-Check Method)',
   '3-check method to distinguish TFNG from YNGG',
   'CHECK 1: Does the passage SAY the same thing as the statement? → TRUE / YES\nCHECK 2: Does the passage SAY THE OPPOSITE? → FALSE / NO\nCHECK 3: Is the passage SILENT on this? → NOT GIVEN\n\nKEY: NOT GIVEN ≠ FALSE\n- FALSE = the passage says the OPPOSITE\n- NOT GIVEN = the passage does not say anything about this',
   '1. Find the relevant part of the passage (keywords)\n2. Read it carefully\n3. Compare with the statement:\n   - Same meaning? → TRUE (T) or YES (Y)\n   - Opposite meaning? → FALSE (F) or NO (N)\n   - Silent? → NOT GIVEN (NG)\n4. The KEY test: if you can''t find the information, it''s NOT GIVEN (not F)',
   'Statement: "The Roman Empire lasted 1000 years."\nPassage: "The Roman Empire fell in 476 AD." (doesn''t say how long it lasted)\nAnswer: NOT GIVEN (the passage is silent, not contradictory)',
   'B2', 34),

  ('ielts_matching_headings_strategy', 'IELTS', 'framework', 'IELTS Matching Headings Strategy (ELIMINATE Method)',
   'How to match headings to paragraphs',
   'E — EXAMINE: read the headings list (themes)\nL — LIST: predict the main idea of each paragraph\nI — IDENTIFY: for each paragraph, find the main idea (first/last sentence)\nM — MATCH: pick the heading that BEST captures the main idea\nI — IGNORE: ignore specific details and examples\nN — NARROW: narrow down by eliminating similar headings\nA — ASSIGN: assign headings to paragraphs\nT — TEST: check that all headings are used appropriately',
   '1. Skim the headings list first (1-2 min)\n2. Read the FIRST sentence of each paragraph\n3. Read the LAST sentence of each paragraph\n4. For each paragraph, predict a one-sentence summary\n5. Match: the heading that matches your summary\n6. Eliminate: too specific (details), too general (whole passage)\n7. Check: some headings may not be used (there are usually more headings than paragraphs)',
   'Heading list: i) "The discovery of penicillin" ii) "How penicillin works" iii) "The future of antibiotics" iv) "Common uses of antibiotics"\nParagraph A: "In 1928, Alexander Fleming noticed..." → i) The discovery\nParagraph B: "Penicillin works by..." → ii) How it works',
   'B2', 35),

  ('ielts_writing_task1_strategy', 'IELTS', 'framework', 'IELTS Writing Task 1 Strategy (POPO Method)',
   'POPO = Paraphrase, Overview, Paragraph, Overview-check. 4-step method.',
   'P — PARAPHRASE the question (sentence 1, different words)\nO — OVERVIEW: state the 2-3 main trends (no details)\nP — PARAGRAPHS: 1-2 body paragraphs with specific data\nO — OVERVIEW-check: re-read the overview to ensure it matches the data',
   '1. Spend 3 min planning: identify main trends, key features\n2. Para 1: PARAPHRASE the question (do NOT copy)\n3. Para 2: OVERVIEW — 2-3 main trends (no numbers)\n4. Para 3: BODY 1 — first main feature with data\n5. Para 4: BODY 2 — second main feature with data\n6. Use comparison words: "while", "whereas", "in contrast"\n7. Use approximation: "approximately", "around", "roughly"\n8. NO OPINIONS — only describe what you see',
   'Question: "The graph shows internet access from 2000-2020."\nParaphrase: "The line graph illustrates the proportion of households with internet access in four countries over a 20-year period."\nOverview: "Overall, internet access increased in all four countries, with the most significant rise in South Korea."',
   'B2', 36),

  ('ielts_writing_task2_strategy', 'IELTS', 'framework', 'IELTS Writing Task 2 Strategy (TEEEL Method)',
   'TEEEL = Topic sentence, Explanation, Evidence, Evaluation, Link. 5-sentence body paragraph.',
   'T — TOPIC SENTENCE: state the main idea of the paragraph\nE — EXPLAIN: clarify the topic sentence (1-2 sentences)\nE — EVIDENCE: give an example (specific, not hypothetical)\nE — EVALUATE: explain why the example supports the topic sentence\nL — LINK: connect to the next paragraph or thesis',
   '1. Plan: opinion + 2-3 main ideas + examples (5 min)\n2. Para 1: INTRO — paraphrase + thesis\n3. Para 2-3: BODY — TEEEL for each main idea\n4. Para 4: COUNTER-ARGUMENT (optional) — acknowledge the other view, then refute\n5. Para 5: CONCLUSION — restate thesis in different words\n6. Use linking words: "Furthermore", "However", "In contrast", "Therefore"\n7. Use complex sentences: conditionals, passive, relative clauses',
   'Topic sentence: "Technology has improved education."\nExplanation: "It has made information more accessible."\nEvidence: "For example, students can now access online libraries."\nEvaluation: "This means that even students in remote areas can study."\nLink: "Furthermore, technology has also made learning more interactive."',
   'B2', 37),

  ('ielts_speaking_part2_strategy', 'IELTS', 'framework', 'IELTS Speaking Part 2 Strategy (1-2-1 Method)',
   'Structure: 1 opening sentence + 2-3 main points + 1 closing',
   'OPENING: 1 sentence stating what you''ll talk about\nPOINT 1: bullet 1 from the card (30-40s)\nPOINT 2: bullet 2 from the card (30-40s)\nPOINT 3: bullet 3 (or close) (30-40s)\nCLOSING: 1 sentence wrapping up',
   '1. Use the 1 min prep to make BRIEF notes (4-5 words per bullet)\n2. Cover ALL 4 bullets on the card\n3. Speak for the FULL 2 minutes (if you stop early, the examiner will ask "anything else?")\n4. Use the SAME tense consistently\n5. Use a range of grammar: past, present, conditional\n6. DON''T memorize — examiners can tell',
   'Card: "Describe a place you like to visit."\nOpening: "I''d like to talk about Bali."\nPoint 1: "It''s a beautiful island..."\nPoint 2: "I usually go with my family..."\nPoint 3: "The best time is in April..."\nClosing: "That''s why I love visiting Bali."',
   'B2', 38),

  ('ielts_reading_pacing', 'IELTS', 'pacing', 'IELTS Reading Pacing (Academic)',
   'Time per passage for Academic Reading',
   'Academic: 60 min / 3 passages = 20 min/passage\nGeneral Training: 60 min / 5 sections = 12 min/section (Sections 1-2 are easier; Sections 3-5 are harder)\n\nFor Academic:\n- Passage 1 (easiest): 18 min\n- Passage 2 (medium): 20 min\n- Passage 3 (hardest): 22 min\n- Transfer time: NONE (write on the answer sheet)\n\nQUESTION TYPES by difficulty:\n- Easiest: short answer, sentence completion, table completion\n- Medium: matching, multiple choice, summary completion\n- Hardest: matching headings, TFNG/YNGG, matching features',
   '1. Easy questions first (short answer, completion)\n2. Save TFNG and matching headings for last (hardest)\n3. Read questions first, scan for keywords\n4. Don''t leave blanks (no penalty for wrong answers)\n5. Practice with strict timing\n6. Time yourself: 20 min per passage',
   'Strategy: 1) Skim the passage (2 min), 2) Answer easy questions (10 min), 3) Answer hard questions (6 min), 4) Review (2 min).',
   'B2', 39),

  ('ielts_listening_pacing', 'IELTS', 'pacing', 'IELTS Listening Pacing (Predict-Write-Verify)',
   'Time strategy for IELTS Listening',
   '30 min audio + 10 min transfer = 40 min total\nYou have 30 seconds preview before each section.\n\nEach section has 10 questions. Audio plays ONCE.',
   '1. Use the 30s preview to read questions and predict answers\n2. Listen ONCE — don''t try to memorize\n3. Write answers WHILE listening (don''t wait)\n4. Use 10 min transfer time carefully:\n   - Check spelling (especially names, places)\n   - Check singular/plural\n   - Check word limit ("NO MORE THAN TWO WORDS")\n   - Make sure you''ve answered ALL 40 questions',
   'Predict: "What time does the meeting start?" → predict: a time.\nListen: "The meeting starts at 9 AM." → write "9 AM".\nTransfer: confirm spelling.',
   'A2', 40),

-- ===========================================================================
-- SECTION E: CROSS-TEST FRAMEWORKS (apply to all 4 tests)
-- ===========================================================================

  ('all_test_day_strategy', 'ALL', 'approach', 'Test Day Strategy (Universal)',
   'What to do on the day of the test',
   'BEFORE THE TEST:\n- Get 7-8 hours of sleep the night before\n- Eat a balanced breakfast\n- Bring ID, water, snack\n- Arrive 30 min early\n\nDURING THE TEST:\n- Read instructions carefully\n- Manage time strictly\n- Skip hard questions, return later\n- Don''t leave blanks (no penalty for wrong)\n- Stay calm — breathe deeply\n\nAFTER EACH SECTION:\n- Forget the previous section\n- Focus only on the next section\n- Don''t second-guess answers',
   '1. SLEEP: 7-8 hours the night before\n2. FOOD: light breakfast, no heavy meal\n3. WATER: bring water, stay hydrated\n4. ID: passport or national ID\n5. STRATEGY: skip hard questions, return later\n6. NO BLANKS: even if unsure, pick the best choice\n7. CALM: deep breaths between sections',
   'If you don''t know an answer: ELIMINATE obvious wrong choices, then pick the BEST remaining one. There''s no penalty for guessing.',
   'A2', 50),

  ('all_error_log', 'ALL', 'approach', 'Error Log Method',
   'Track your mistakes to improve faster',
   'For every wrong answer, log:\n- QUESTION TYPE (e.g., TFNG, inference, vocabulary)\n- WHY you got it wrong (e.g., misread, didn''t know word, ran out of time)\n- PATTERN (recurring error type)',
   '1. After every practice test, fill out an error log\n2. Categorize errors: vocabulary, grammar, strategy, time, careless\n3. Find the TOP 3 error types\n4. Focus on improving THOSE 3 areas\n5. Re-test 1-2 weeks later',
   'Error log example:\nQ Type | Why wrong | Pattern\nTFNG | Misread "NOT GIVEN" as "FALSE" | 4x in a row\nVocab | "permeable" unknown | study AWL\nInference | Too literal | read between lines',
   'A2', 51),

  ('all_active_recall', 'ALL', 'approach', 'Active Recall and Spaced Repetition',
   'The science of long-term memory',
   'Active recall = testing yourself (not just re-reading). Spaced repetition = reviewing at increasing intervals. Combined: the most efficient study method.',
   '1. After learning a topic, CLOSE your notes\n2. Try to RECALL what you learned (write it down or say it)\n3. CHECK against your notes — what did you miss?\n4. Review the missed items 1 day later, 3 days, 7 days, 14 days, 30 days\n5. Use the EduBot /vocab and /review features for spaced repetition',
   'Topic: TOEFL reading inference questions.\n1. Read the explanation.\n2. Close notes.\n3. Recall: 4 main strategies.\n4. Got 2/4. Review 1 day later.\n5. After 4 reviews: mastered.',
   'A2', 52),

  ('all_input_hypothesis', 'ALL', 'approach', 'Comprehensible Input Hypothesis (Krashen)',
   'Language is acquired through INPUT, not just studying grammar',
   'Linguist Stephen Krashen''s theory: language is acquired when we understand messages slightly above our current level (i+1). Reading, listening, and watching are INPUT activities that build fluency.',
   '1. Read English EVERY DAY (news, articles, books)\n2. Listen to English EVERY DAY (podcasts, videos)\n3. Choose content at your LEVEL (not too easy, not too hard)\n4. Use SUBTITLES in English (not Indonesian)\n5. Don''t look up every word — try to understand from context\n6. The more input, the more fluent you become',
   'Recommended daily input:\n- 30 min reading (BBC, VOA, The Guardian)\n- 30 min listening (podcasts: 6 Minute English, NPR)\n- 30 min watching (TED, YouTube)\nTotal: 1.5 hours/day of English input',
   'A2', 53)
;
