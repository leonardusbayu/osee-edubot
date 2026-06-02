-- 080: Lesson Topics — Per-Test, Per-Section Question Types + Theory
-- Master syllabus covering TOEFL iBT 2026, TOEFL ITP, TOEIC, IELTS Academic + General
-- Compiled from: Official Guide to TOEFL Test (ETS, 4th ed), Cambridge IELTS 18,
--                Longman Complete Course for the TOEFL Test, Barron's IELTS,
--                TOEIC Official Test Preparation Manual, ETS TOEIC Rubrics

CREATE TABLE IF NOT EXISTS lesson_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_key TEXT UNIQUE NOT NULL,         -- e.g. 'toefl_ibt_reading_factual'
  test_type TEXT NOT NULL,               -- 'TOEFL_IBT', 'TOEFL_ITP', 'TOEIC', 'IELTS'
  section TEXT NOT NULL,                 -- 'reading', 'listening', 'speaking', 'writing', 'grammar', 'vocabulary', 'integrated'
  subcategory TEXT,                      -- e.g. 'question_type' or 'skill'
  name TEXT NOT NULL,                    -- human-readable title
  description TEXT,                      -- what this topic is
  theory TEXT,                           -- underlying theory/framework
  key_strategies TEXT,                   -- newline-separated strategy list
  common_mistakes TEXT,                  -- typical mistakes
  example_prompt TEXT,                   -- example question/prompt
  cefr_level TEXT DEFAULT 'B1',
  frequency TEXT DEFAULT 'medium',       -- 'high', 'medium', 'low' in this test
  order_index INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lt_test ON lesson_topics(test_type, section, order_index);
CREATE INDEX IF NOT EXISTS idx_lt_cefr ON lesson_topics(cefr_level);

-- ===========================================================================
-- SECTION A: TOEFL iBT 2026 (Computer-based) — 4 sections
-- Reading: 54-72 min, 30-40 questions across 2 passages (post-July 2023: 2 passages, 10 questions each)
-- Listening: 41-57 min, 28-39 questions
-- Speaking: 17 min, 4 tasks
-- Writing: 50 min, 2 tasks
-- Total: ~2 hours
-- Source: ETS Official Guide to the TOEFL Test 4th Edition
-- ===========================================================================

-- TOEFL IBT - READING (10 question types)
INSERT INTO lesson_topics (topic_key, test_type, section, subcategory, name, description, theory, key_strategies, common_mistakes, example_prompt, cefr_level, frequency, order_index) VALUES
  ('toefl_ibt_reading_factual', 'TOEFL_IBT', 'reading', 'question_type', 'Factual Information Questions',
   'Locate specific facts stated in the passage',
   'Tests ability to identify explicitly-stated information. Answer is found as a paraphrase in ONE sentence of one paragraph. Distractors come from other parts of the passage but do not answer the specific question.',
   '1. Read the question first to know what to look for\n2. Scan the passage for the keywords in the question\n3. Read the sentence containing the keyword carefully\n4. Match the paraphrase in the answer choice to the passage\n5. Eliminate choices that contradict or are out of scope',
   'Choosing an answer that is TRUE in the passage but does not answer the specific question asked. Selecting an answer from a different paragraph (true statement, wrong paragraph).',
   'According to the paragraph, what is true about X? A) It is large. B) It is fast. C) It is rare. D) It is dangerous.',
   'B1', 'high', 10),

  ('toefl_ibt_reading_negative', 'TOEFL_IBT', 'reading', 'question_type', 'Negative Factual Information Questions',
   'Identify which of four statements is NOT true in the passage',
   'The question contains NOT, EXCEPT, or LEAST. Three of the four choices are true according to the passage; one is false. Find the FALSE one.',
   '1. Mark the negation word (NOT/EXCEPT/LEAST) when you see the question\n2. Treat each choice as a TRUE/FALSE question against the passage\n3. The choice that is FALSE is your answer\n4. Beware: a choice can be partially true but contain a wrong detail',
   'Forgetting the negation and picking a true statement. Three choices are TRUE — students pick the first true one without checking all four.',
   'According to the passage, which of the following is NOT true about X?\nA) It is fast.\nB) It lives in water.\nC) It is the largest animal.\nD) It eats fish.',
   'B1', 'high', 11),

  ('toefl_ibt_reading_inference', 'TOEFL_IBT', 'reading', 'question_type', 'Inference Questions',
   'Draw a conclusion that is implied but not directly stated',
   'Tests critical thinking. The answer is NOT stated directly — it must be LOGICALLY CONCLUDED from evidence. Use the rule: if passage says A and B, and A leads to C, then the inference is C.',
   '1. Eliminate choices that CONTRADICT the passage\n2. Eliminate choices that are stated DIRECTLY in the passage (too easy)\n3. Eliminate choices that are OUT OF SCOPE\n4. The remaining choice is your inference\n5. Use the "If true, would passage still make sense?" test',
   'Choosing an answer that goes TOO FAR beyond what the passage supports. Choosing an answer that contradicts the passage.',
   'Which of the following can be inferred about X?\nA) It is fast.\nB) It might be endangered.\nC) It was discovered in 1900.\nD) It has fur.',
   'B2', 'high', 12),

  ('toefl_ibt_reading_rhetorical', 'TOEFL_IBT', 'reading', 'question_type', 'Rhetorical Purpose Questions',
   'Identify WHY the author mentioned a specific fact, used an example, or made a comparison',
   'Tests understanding of author''s intent. Why did the author include this? Common purposes: to illustrate, to contrast, to support an argument, to provide background, to anticipate counterargument.',
   '1. Read the surrounding sentences before and after the highlight\n2. Identify the function: example, contrast, cause-effect, elaboration, or transition\n3. Match the function to the answer choice\n4. Common patterns: "for example" = illustration; "however" = contrast',
   'Confusing rhetorical purpose with factual content. Picking a function that is logically possible but not the one the author actually used.',
   'Why does the author mention X in paragraph 2?\nA) To give an example of Y\nB) To contrast X with Y\nC) To define a new term\nD) To summarize the passage',
   'B2', 'medium', 13),

  ('toefl_ibt_reading_vocab', 'TOEFL_IBT', 'reading', 'question_type', 'Vocabulary Questions',
   'Determine meaning of a word or phrase in context',
   'Tests ability to infer meaning from context. The word usually has a meaning DIFFERENT from its common dictionary meaning. Substitute each choice back into the sentence.',
   '1. Read the FULL sentence containing the word\n2. Predict a meaning BEFORE looking at choices\n3. Substitute each choice into the sentence\n4. The one that makes the sentence logical is the answer\n5. Ignore the other dictionary meanings of the word',
   'Picking the most common dictionary meaning instead of the in-context meaning. Ignoring the surrounding context clues.',
   'The word "permeable" in paragraph 3 is closest in meaning to:\nA) solid B) transparent C) porous D) flexible',
   'B2', 'high', 14),

  ('toefl_ibt_reading_reference', 'TOEFL_IBT', 'reading', 'question_type', 'Reference Questions',
   'Identify what a pronoun or referent (e.g., "this", "such", "these") refers to',
   'Tests understanding of cohesion. The referent usually appears in the PRECEDING sentence. Substitute each choice back into the original sentence to test fit.',
   '1. Find the highlighted word in the passage\n2. Look at the sentence immediately BEFORE the highlight\n3. Try substituting each answer choice into the original\n4. The one that fits grammatically and logically is the answer',
   'Picking a noun that fits grammatically but not logically. Skipping over the actual referent.',
   'The word "they" in paragraph 4 refers to:\nA) scientists B) experiments C) animals D) results',
   'B1', 'medium', 15),

  ('toefl_ibt_reading_simplification', 'TOEFL_IBT', 'reading', 'question_type', 'Sentence Simplification Questions',
   'Choose a choice that has the SAME essential meaning as a highlighted sentence, but is simpler',
   'Tests paraphrase skills. Key content (subject, action, key terms) must be preserved. Supporting details can be dropped. Cause-effect relationships must be kept.',
   '1. Identify the KEY information in the highlighted sentence (who/what did what)\n2. Eliminate choices that change the meaning or omit key terms\n3. Eliminate choices that add NEW information not in the original\n4. The choice that keeps the essential meaning is the answer',
   'Omitting a key negation (not, never, except) in the paraphrase. Changing the cause-effect relationship.',
   'Highlighted: "Despite the heavy rain, the game continued."\nA) The game was cancelled.\nB) The game continued despite the rain.\nC) Rain caused the game to end.\nD) The rain was heavy.',
   'B2', 'medium', 16),

  ('toefl_ibt_reading_insert', 'TOEFL_IBT', 'reading', 'question_type', 'Insert Text Questions',
   'Choose where to insert a new sentence into a passage',
   'Tests understanding of logical flow. The new sentence usually starts with a transition word (however, therefore, for example) that connects to the previous AND following sentences.',
   '1. Read the FIRST and LAST words of the new sentence\n2. Look for transition words that connect to surrounding text\n3. Try each of the 4 black squares\n4. The position where the sentence fits LOGICALLY is the answer\n5. Check: the sentence must connect to BOTH the previous and following text',
   'Choosing a position where the sentence is grammatically correct but disrupts the logical flow. Ignoring the transition word at the start of the new sentence.',
   'Where would you insert: "However, this theory has been challenged."\n[ ] squares in the passage',
   'B2', 'medium', 17),

  ('toefl_ibt_reading_prose_summary', 'TOEFL_IBT', 'reading', 'question_type', 'Prose Summary Questions',
   'Select 3 of 6 choices that express the most important ideas of the passage (drag-and-drop in real test)',
   'Tests ability to identify MAIN ideas, not details. The 3 correct choices are all major ideas; the 3 wrong choices are true but minor details, or false statements.',
   '1. After reading the passage, identify the 2-3 main ideas\n2. For each of the 6 choices, decide: major idea or minor detail?\n3. Choose 3 that capture the essential meaning of the passage\n4. Avoid: details, examples, or any false statement',
   'Including details instead of main ideas. Picking 3 choices that are all about the same topic (need variety).',
   'An introductory sentence followed by 6 choices. Select 3 that express the most important ideas.',
   'B2', 'medium', 18),

  ('toefl_ibt_reading_fill_table', 'TOEFL_IBT', 'reading', 'question_type', 'Fill in a Table Questions',
   'Match categories to information from the passage (drag-and-drop)',
   'Tests ability to organize information. Categories are usually 2-3 in number, each with 2-3 subcategories.',
   '1. Read the table categories carefully\n2. For each category, find the matching information in the passage\n3. Drag the correct information to each cell\n4. Ensure all cells are filled correctly',
   'Confusing which category the information belongs to. Missing the nuances between similar categories.',
   'Table with 2 categories and 6 cells to fill. Match each piece of information from the passage.',
   'B2', 'medium', 19),

-- TOEFL IBT - LISTENING (5 question types)
  ('toefl_ibt_listening_main_idea', 'TOEFL_IBT', 'listening', 'question_type', 'Gist-Content (Main Idea) Questions',
   'Identify the main idea of a listening passage',
   'Tests ability to identify the central topic. Main idea is usually stated in the introduction or implied throughout. Choices often use synonyms of the actual main idea.',
   '1. Listen for the FIRST line of the conversation/talk (often states the topic)\n2. Note how speakers introduce the topic\n3. Choose the choice that is GENERAL enough to cover the whole passage\n4. Eliminate choices that are too specific (details)',
   'Choosing a detail as the main idea. Picking a topic that is mentioned but not the focus.',
   'What is the main topic of the conversation?\nA) Booking a hotel.\nB) A research project.\nC) Lost luggage.\nD) Studying abroad.',
   'B1', 'high', 20),

  ('toefl_ibt_listening_detail', 'TOEFL_IBT', 'listening', 'question_type', 'Gist-Purpose (Function) Questions',
   'Identify why the speaker mentions something or what the speaker''s purpose is',
   'Tests understanding of speaker intent. Why did the speaker say X? Function: to give an example, to ask for clarification, to change the subject, to express doubt.',
   '1. Listen to the tone of voice and context\n2. Identify the function: clarify, suggest, complain, request, etc.\n3. Match to the answer choice\n4. Pay attention to phrases like "I mean", "in other words", "well actually"',
   'Misinterpreting sarcasm or indirect speech. Confusing what was said with why it was said.',
   'Why does the professor say this: "Well, what I mean is..."\nA) To clarify a previous statement.\nB) To introduce a new topic.\nC) To summarize the lecture.\nD) To ask a question.',
   'B2', 'medium', 21),

  ('toefl_ibt_listening_detail_q', 'TOEFL_IBT', 'listening', 'question_type', 'Detail Questions',
   'Answer a specific question about a fact mentioned in the listening',
   'Tests ability to catch specific facts. The answer is stated directly, but may be paraphrased. Listen for numbers, dates, names, places, reasons.',
   '1. Read the question before listening (you get 30s preview)\n2. Listen for the specific fact being asked\n3. Match the fact to a choice (paraphrased)\n4. If you missed it, mark and move on (don''t lose points on next question)',
   'Missing a detail because of a missed keyword. Second-guessing the answer.',
   'According to the professor, when did the experiment begin?\nA) 1995 B) 2001 C) 2010 D) 2018',
   'B1', 'high', 22),

  ('toefl_ibt_listening_attitude', 'TOEFL_IBT', 'listening', 'question_type', 'Attitude Questions',
   'Identify the speaker''s attitude or opinion',
   'Tests ability to infer tone. Common attitudes: surprised, skeptical, enthusiastic, disappointed, neutral, confused. Listen to word choice, intonation, and context.',
   '1. Listen to the OVERALL tone of the speaker\n2. Note key adjectives/adverbs: unfortunately, surprisingly, clearly\n3. Match to the answer choice\n4. Distinguish between SIMILAR emotions (e.g., confused vs. surprised)',
   'Confusing similar attitudes (frustrated vs. angry). Ignoring tone of voice cues.',
   'What is the professor''s attitude toward the new theory?\nA) Skeptical B) Enthusiastic C) Indifferent D) Confused',
   'B2', 'medium', 23),

  ('toefl_ibt_listening_organization', 'TOEFL_IBT', 'listening', 'question_type', 'Connecting Information / Organization Questions',
   'Understand how ideas are connected in a lecture or how the lecture is organized',
   'Tests understanding of discourse. Two sub-types: (1) "What does the professor mean by X?" (paraphrase); (2) "How does the professor organize the information?" (sequence/structure).',
   '1. For paraphrase: substitute a simpler word/phrase for the highlighted word\n2. For organization: identify the structure (chronological, compare-contrast, cause-effect)\n3. Match to the answer choice',
   'Misunderstanding the discourse markers (however, therefore, for example).',
   'How does the professor organize the information?\nA) By comparing two theories.\nB) By describing a process step by step.\nC) By giving examples.\nD) By arguing against a position.',
   'B2', 'medium', 24),

-- TOEFL IBT - SPEAKING (4 task types)
  ('toefl_ibt_speaking_independent', 'TOEFL_IBT', 'speaking', 'question_type', 'Task 1: Independent Speaking',
   'Express personal opinion on a familiar topic (15s prep, 45s response)',
   'Tests ability to organize and express a personal opinion fluently. Rubric: general (topic + 2 reasons), development (reasons explained with examples), language (grammar + vocabulary), delivery (fluency + intonation).',
   '1. Use the 15s prep to plan: state opinion + 2 reasons\n2. Structure: Opening (opinion) → Reason 1 + example → Reason 2 + example → Conclusion\n3. Use transitions: "First of all", "In addition", "For example"\n4. Speak at a natural pace — don''t rush\n5. Use specific examples, not vague statements',
   'Going off-topic. Using lists without explanation. Speaking too fast or too slow. No clear opinion.',
   'Some people prefer to live in a city. Others prefer a small town. Which do you prefer and why?',
   'B1', 'high', 25),

  ('toefl_ibt_speaking_campus', 'TOEFL_IBT', 'speaking', 'question_type', 'Task 2: Integrated Speaking — Campus Announcement',
   'Read a passage + listen to a conversation + summarize the speakers'' opinions (30s prep, 60s response)',
   'Tests ability to integrate reading and listening. The reading announces a campus change; the conversation shows two students'' reactions (one agrees, one disagrees).',
   '1. Use the reading time to identify the CHANGE and the REASONS\n2. Listen for how each speaker reacts to the change\n3. In your response: state the change + the woman''s opinion + the man''s opinion\n4. Be specific: what does each speaker think? why?\n5. Don''t give your OWN opinion',
   'Missing one of the speakers'' opinions. Giving personal opinion. Being too vague (no specifics).',
   'Reading: University announces new dorm policy.\nConversation: Two students discuss it. Woman disagrees, man agrees.',
   'B2', 'high', 26),

  ('toefl_ibt_speaking_academic', 'TOEFL_IBT', 'speaking', 'question_type', 'Task 3: Integrated Speaking — Academic Lecture',
   'Read a passage + listen to a lecture + explain the concept with an example (30s prep, 60s response)',
   'Tests ability to explain a concept using a reading definition and a lecture example. The concept is defined in the reading; an example is given in the lecture.',
   '1. Read: identify the CONCEPT and its DEFINITION\n2. Listen: identify the EXAMPLE the professor gives\n3. In your response: state the concept → define it → give the example\n4. Show HOW the example illustrates the concept',
   'Just defining without giving the example. Giving the example without connecting it to the concept.',
   'Reading: "Mimicry is when one species resembles another for protection."\nLecture: Professor explains monarch and viceroy butterflies.',
   'B2', 'high', 27),

  ('toefl_ibt_speaking_academic_pair', 'TOEFL_IBT', 'speaking', 'question_type', 'Task 4: Integrated Speaking — Academic Pair',
   'Listen to a lecture + summarize the example explained (20s prep, 60s response)',
   'Tests ability to summarize a lecture. The lecture has a concept + an example. No reading passage in this task.',
   '1. Listen for the concept and the example\n2. In your response: state the concept → give the example → explain how the example illustrates the concept\n3. Use clear transitions',
   'Forgetting the concept. Only describing the example without connecting it back.',
   'Professor explains "operant conditioning" with an example of training a rat.',
   'B2', 'high', 28),

-- TOEFL IBT - WRITING (2 task types)
  ('toefl_ibt_writing_integrated', 'TOEFL_IBT', 'writing', 'question_type', 'Writing Task 1: Integrated Writing',
   'Read a passage + listen to a lecture + write a 150-225 word essay (20 min)',
   'Tests ability to show how the lecture challenges or supports the reading. The reading presents 3 theories/facts; the lecture refutes or supports them.',
   '1. Note the 3 points from the reading (numbered 1, 2, 3)\n2. Note how the lecture addresses each one (refutes/supports/qualifies)\n3. Structure: Intro (state topic) → Point 1 + lecture response → Point 2 + lecture response → Point 3 + lecture response → Conclusion (optional)\n4. Always use REPORTING verbs: "The professor argues that...", "The lecturer casts doubt on..."\n5. Don''t give your own opinion',
   'Giving personal opinion. Missing one of the 3 points. Just paraphrasing the reading without the lecture.',
   'Reading: 3 reasons why birds migrated south.\nLecture: 3 counter-arguments from the professor.',
   'B2', 'high', 29),

  ('toefl_ibt_writing_independent', 'TOEFL_IBT', 'writing', 'question_type', 'Writing Task 2: Independent Writing',
   'Write a 300+ word essay on a personal opinion topic (30 min)',
   'Tests ability to develop and organize an essay. Rubric: development, organization, language, grammar. ETS gives 0-5 raw, scaled to 0-30.',
   '1. Use the first 3-5 min to plan: choose opinion + 2-3 reasons + examples\n2. Structure: 4-5 paragraphs\n   - Intro: state topic + thesis\n   - Body 1: Reason 1 + example\n   - Body 2: Reason 2 + example\n   - Body 3: counter-argument + rebuttal (optional)\n   - Conclusion: restate thesis\n3. Use transitions: "First", "Moreover", "For example", "However"\n4. Use specific examples (not vague)\n5. Check: 300+ words, no major grammar errors',
   'No clear thesis. Vague examples ("for example, in life..."). Off-topic. Too short (<250 words).',
   'Do you agree or disagree with the following statement? It is better to study alone than in a group. Use specific reasons and examples to support your choice.',
   'B2', 'high', 30),

-- ===========================================================================
-- SECTION B: TOEFL ITP (Institutional Testing Program — paper-based)
-- 3 sections, 140 questions, 115 min total
-- Level 1: 500-677 score, Level 2: 460-549, Level 3: 337-459
-- Source: Longman Complete Course for the TOEFL Test
-- ===========================================================================

-- TOEFL ITP - LISTENING (Part 1: Short conversations, Part 2: Long conversations, Part 3: Talks)
  ('toefl_itp_listening_short', 'TOEFL_ITP', 'listening', 'question_type', 'Part A: Short Dialogues',
   '30 questions, 1-2 sentence dialogs, picture-based sometimes',
   'Tests basic listening comprehension. Each dialogue is between a man and a woman, followed by one question. The answer is usually NOT stated directly — you must infer.',
   '1. Read the question first\n2. Listen to the SECOND line (usually has the answer)\n3. Watch for: idioms, phrasal verbs, modal verbs (must, should, could)\n4. Eliminate choices that are factually wrong\n5. Watch out for "distractor" details that sound right but don''t answer the question',
   'Choosing a choice that sounds like what was said but doesn''t answer the question. Missing the implication.',
   'M: "I''m thinking of going to the concert."\nW: "Well, the tickets might be sold out by now."\nQ: What does the woman mean?\nA) She wants to go. B) The tickets are already gone. C) She will buy tickets. D) She is not sure.',
   'A2', 'high', 40),

  ('toefl_itp_listening_long', 'TOEFL_ITP', 'listening', 'question_type', 'Part B: Long Dialogues',
   '8 questions, 2-3 minute conversations, follow 5-6 question sequence',
   'Tests comprehension of longer interactions. Usually: problem + solution, request + response, or plan + discussion.',
   '1. Read the FIRST question to set context\n2. Listen for the main issue/problem\n3. Each subsequent question focuses on a detail\n4. Take brief notes: who, what, where, when\n5. Stay with the conversation — don''t give up if you miss one answer',
   'Missing the main topic. Trying to answer future questions based on past answers.',
   'M and W discuss a library project. W: "I can''t find the book on the shelf." M: "It might be in the reference section."',
   'B1', 'high', 41),

  ('toefl_itp_listening_talks', 'TOEFL_ITP', 'listening', 'question_type', 'Part C: Talks and Lectures',
   '12 questions, mini-lectures and announcements',
   'Tests academic listening. Talks are usually: announcements, short lectures, or explanations. They have clear structure: intro, main points, conclusion.',
   '1. Identify the type of talk (announcement vs. lecture)\n2. Listen for transition words: "first", "next", "finally", "in conclusion"\n3. Note the main idea + 2-3 supporting points\n4. For detail questions, scan your mental notes',
   'Missing the main idea. Getting lost in details. Confusing dates and numbers.',
   'Announcement: "The library will be closed on Sunday for maintenance. The new hours will start on Monday..."',
   'B1', 'high', 42),

-- TOEFL ITP - STRUCTURE & WRITTEN EXPRESSION
  ('toefl_itp_structure', 'TOEFL_ITP', 'writing', 'question_type', 'Part A: Structure (Complete the Sentence)',
   '15 questions, choose the best completion',
   'Tests grammar and sentence structure. Each item has an incomplete sentence and 4 choices. Choose the choice that best completes it grammatically and logically.',
   '1. Read the ENTIRE sentence with each choice\n2. Check: subject-verb agreement\n3. Check: parallel structure (and, but, or)\n4. Check: tense consistency\n5. Check: word order',
   'Choosing a choice that is grammatically correct but doesn''t make sense in the sentence.',
   '_______ by the side of the road, the car was unable to move.\nA) Broken B) Breaking C) Having broken D) It broke',
   'B1', 'high', 43),

  ('toefl_itp_written_exp', 'TOEFL_ITP', 'writing', 'question_type', 'Part B: Written Expression (Find the Error)',
   '25 questions, identify the underlined error (A, B, C, D) or "no error" (E)',
   'Tests grammar accuracy. Each sentence has 4 underlined parts and one NO ERROR choice. Find the part that contains an error.',
   '1. Read the entire sentence once\n2. Check each underlined part for common errors:\n   - A: subject-verb agreement\n   - B: verb tense\n   - C: word form (noun/verb/adj)\n   - D: word order or preposition\n3. If no error, choose E (D for paper tests: "no error")\n4. Common errors: singular/plural, tense, article (a/an/the), preposition',
   'Choosing D (no error) too quickly. Not checking all 4 underlined parts. Missing article errors.',
   'The team (A) are (B) playing (C) well this season (D) no error (E).',
   'B1', 'high', 44),

-- TOEFL ITP - READING
  ('toefl_itp_reading', 'TOEFL_ITP', 'reading', 'question_type', 'Reading Comprehension',
   '50 questions across 5 short passages, 5 questions per passage',
   'Tests reading comprehension. Passages are short (200-300 words). Questions: main idea, detail, inference, vocabulary, reference, insertion.',
   '1. Read the questions first (if possible)\n2. Read the passage and UNDERLINE main points\n3. Look for the main idea in the FIRST or LAST paragraph\n4. For detail questions, scan for keywords\n5. For inference, eliminate extreme choices',
   'Spending too much time on one passage. Missing main idea. Confusing "not true" with "true".',
   'Passage about photosynthesis. Q: According to the passage, what is chlorophyll?\nA) A plant. B) A green pigment. C) A type of light. D) A gas.',
   'B1', 'high', 45),

-- ===========================================================================
-- SECTION C: TOEIC (Test of English for International Communication)
-- 2 sections, 200 questions, 120 min total
-- Listening: 45 min, 100 questions (Parts 1-4)
-- Reading: 75 min, 100 questions (Parts 5-7)
-- Score: 10-990 (each section)
-- Source: TOEIC Official Test Preparation Manual, ETS
-- ===========================================================================

-- TOEIC - LISTENING
  ('toeic_listening_photos', 'TOEIC', 'listening', 'question_type', 'Part 1: Photographs',
   '6 questions, 1 photo per question, choose the best description',
   'Tests ability to describe what is happening in a picture. Each choice is a full sentence describing the photo. ONE choice is the ONLY correct description.',
   '1. Quickly scan the photo: people, action, location, objects\n2. Eliminate choices with WRONG subject, action, or location\n3. Watch for: wrong verb tense, wrong preposition of place, wrong number (singular/plural)\n4. The correct choice has ALL elements matching the photo',
   'Choosing a description that has some correct elements but ONE wrong detail. Ignoring the background.',
   'Photo: Two women sitting at a desk, one writing.\nA) The women are standing.\nB) One woman is writing.\nC) The women are cooking.\nD) A man is writing.',
   'A1', 'high', 50),

  ('toeic_listening_qr', 'TOEIC', 'listening', 'question_type', 'Part 2: Question-Response',
   '25 questions, listen to a question/statatement + 3 responses, choose the response',
   'Tests ability to understand and respond appropriately. The 3 responses are designed to be confusing — only ONE is appropriate.',
   '1. Listen for the KEY word in the question (when, where, who, what, why, how)\n2. Anticipate the answer type before hearing the choices\n3. Eliminate responses that don''t grammatically/ logically answer\n4. Watch for: tag questions, indirect questions, polite requests',
   'Falling for distractors that sound related but don''t answer. Missing tag questions.',
   'Q: "When does the meeting start?"\nA) At 9 AM. B) Yes, it does. C) In the conference room.',
   'A1', 'high', 51),

  ('toeic_listening_conversations', 'TOEIC', 'listening', 'question_type', 'Part 3: Conversations',
   '39 questions, 13 short conversations, 3 questions each',
   'Tests comprehension of workplace conversations. Topics: business meetings, travel, schedules, customer service, office problems.',
   '1. Read all 3 questions BEFORE listening\n2. Listen for: location, occupation, problem, solution\n3. Note names, dates, numbers\n4. For each question, scan your notes\n5. Watch for: the answer is usually stated in the conversation',
   'Missing the setting/occupation. Not taking notes. Confusing speakers'' opinions.',
   'Conversation: M asks W about a project deadline. W says it''s been pushed back a week. Q: What will happen?',
   'B1', 'high', 52),

  ('toeic_listening_talks', 'TOEIC', 'listening', 'question_type', 'Part 4: Talks',
   '30 questions, 10 short talks, 3 questions each',
   'Tests comprehension of workplace announcements and short talks. Topics: announcements, news reports, advertisements, recorded messages.',
   '1. Read all 3 questions first\n2. Identify the talk TYPE: announcement, advertisement, news?\n3. Listen for: who, what, when, where, why\n4. Note specific details: numbers, dates, places, names\n5. For "what is mainly discussed" questions, choose the GENERAL topic',
   'Confusing specific details. Missing the main topic. Choosing a choice that is true but not the main point.',
   'Announcement: "Attention shoppers. The store will close in 15 minutes..."\nQ: Where is this announcement taking place?\nA) Bank. B) Store. C) Airport. D) Restaurant.',
   'B1', 'high', 53),

-- TOEIC - READING
  ('toeic_reading_incomplete', 'TOEIC', 'reading', 'question_type', 'Part 5: Incomplete Sentences',
   '30 questions, choose the best word to complete the sentence',
   'Tests vocabulary and grammar. Each sentence has 4 choices: vocabulary, grammar, or word form. Context determines the answer.',
   '1. Read the entire sentence\n2. Identify the missing word type: noun, verb, adj, adv, prep\n3. Check grammar clues: subject-verb agreement, tense, comparison\n4. For vocabulary, use context clues\n5. Eliminate choices that don''t fit grammatically',
   'Picking a word that is grammatically correct but doesn''t fit the meaning. Missing singular/plural agreement.',
   'The company will _____ its new product next month.\nA) launch B) launching C) launched D) launches',
   'B1', 'high', 54),

  ('toeic_reading_text_completion', 'TOEIC', 'reading', 'question_type', 'Part 6: Text Completion',
   '16 questions, 4 passages with 4 blanks each',
   'Tests ability to fill in blanks in short passages. Each passage has 4 blanks with 4 choices each.',
   '1. Read the WHOLE passage first to understand context\n2. For each blank, read the SENTENCE before and after\n3. Check grammar: subject-verb agreement, verb tense, articles\n4. Check meaning: does the word fit logically?\n5. Use process of elimination',
   'Skipping the whole passage and filling blanks in isolation. Missing transitions.',
   'The meeting _____ at 3 PM. Please arrive on time.\nA) start B) starts C) starting D) started',
   'B1', 'high', 55),

  ('toeic_reading_single', 'TOEIC', 'reading', 'question_type', 'Part 7: Single Passages',
   '29 questions, 10 single passages, 2-3 questions each',
   'Tests comprehension of business documents. Passage types: emails, memos, notices, advertisements, articles, schedules.',
   '1. Skim the passage first (1-2 min)\n2. Note: who, what, when, where, why\n3. Read the questions\n4. Scan the passage for keywords\n5. For vocabulary in context, use surrounding words',
   'Spending too much time reading. Missing the question''s specific focus. Confusing "according to" with "what would the author say".',
   'Email: "The conference has been moved to Room 205..."\nQ: Where will the conference be held?\nA) Room 105 B) Room 205 C) Room 305 D) Online',
   'B1', 'high', 56),

  ('toeic_reading_double', 'TOEIC', 'reading', 'question_type', 'Part 7: Double Passages',
   '20 questions, 2-4 pairs of related passages, 5 questions each',
   'Tests ability to synthesize information from TWO related passages. Passages are usually: email + email, article + email, notice + email.',
   '1. Read BOTH passages fully\n2. Identify the connection between them (who wrote, what topic)\n3. For "what is true about BOTH" questions, find info in both\n4. For "why was passage 1 written" questions, read passage 1 only',
   'Mixing up information from the two passages. Not reading both before answering.',
   'Passage 1: Email from manager about meeting.\nPassage 2: Email reply from employee.\nQ: Why is the employee writing?',
   'B2', 'high', 57),

  ('toeic_reading_triple', 'TOEIC', 'reading', 'question_type', 'Part 7: Triple Passages',
   '15 questions, 1-2 sets of 3 related passages, 5 questions each',
   'Tests ability to synthesize information from THREE related passages. Common format: 3 emails on the same topic, or article + comment + reply.',
   '1. Read ALL THREE passages\n2. Identify the overall theme\n3. Note the perspective of each passage''s author\n4. For "NOT mentioned" questions, scan all three for the keyword',
   'Missing one passage entirely. Confusing authors'' viewpoints.',
   'Three reviews of the same restaurant. Q: What do they all agree on?',
   'B2', 'medium', 58),

-- ===========================================================================
-- SECTION D: IELTS Academic + General Training
-- 4 sections, scored 0-9 (band)
-- Listening: 30 min, 40 questions
-- Reading: 60 min, 40 questions
-- Writing: 60 min, 2 tasks
-- Speaking: 11-14 min, face-to-face
-- Source: Cambridge IELTS 18, Cambridge Grammar of English, Barron's IELTS
-- ===========================================================================

-- IELTS - LISTENING (4 sections)
  ('ielts_listening_s1', 'IELTS', 'listening', 'question_type', 'Section 1: Social Context (Everyday)',
   'Dialogue between 2 people in a social context (booking, ordering, asking for info)',
   'Tests understanding of everyday English. Usually a transaction: booking a hotel, asking for directions, ordering food. 10 questions: form completion, table completion, multiple choice, matching.',
   '1. Read all questions before listening (you have 1 min)\n2. Predict the type of answer: number, name, place\n3. Listen for SPELLING — names and places must be spelled correctly\n4. Singular vs plural matters (each word is counted)\n5. Write answers while listening (transfer time at the end)',
   'Missing a question because of distraction. Spelling errors. Singular/plural errors. Following accent issues.',
   'A woman calls a gym to ask about membership options. 10 questions about prices, times, services.',
   'A2', 'high', 60),

  ('ielts_listening_s2', 'IELTS', 'listening', 'question_type', 'Section 2: Monologue (Social)',
   'A single speaker in a social context (tour guide, welcome speech, information talk)',
   'Tests understanding of a monologue. 10 questions. Topics: tourism, education, community services, public events.',
   '1. Predict the answer type for each question\n2. Note the structure: intro, main points, conclusion\n3. Listen for: dates, places, prices, opening hours, names\n4. For matching questions, listen for synonyms of the items',
   'Missing the speaker''s main point. Confusing similar-sounding numbers.',
   'A tour guide describes a city walking tour. Q: When does the tour start?',
   'B1', 'high', 61),

  ('ielts_listening_s3', 'IELTS', 'listening', 'question_type', 'Section 3: Educational Discussion',
   'Discussion among 2-4 speakers in an educational context (students + tutor)',
   'Tests academic English in context. 10 questions. Common: 2-3 students discussing an assignment with a tutor.',
   '1. Identify the speakers and their roles\n2. Note: opinions, agreements, disagreements\n3. For "what does X think" questions, follow X''s statements\n4. Common types: multiple choice, matching, flow chart',
   'Confusing speakers'' opinions. Missing the academic vocabulary.',
   'Two students discuss their research with a tutor. Q: What does the tutor suggest?',
   'B2', 'high', 62),

  ('ielts_listening_s4', 'IELTS', 'listening', 'question_type', 'Section 4: Academic Lecture',
   'A single academic speaker (lecture, presentation)',
   'Tests academic listening. 10 questions. The lecture is on a single topic. Common: science, history, social science.',
   '1. Read all questions carefully\n2. Listen for the structure: introduction, main points, examples, conclusion\n3. Take brief notes during the lecture\n4. For sentence completion, listen for the EXACT word(s)\n5. For "which is NOT mentioned", eliminate 3 mentioned items',
   'Missing the main point. Running out of time to write answers. Spelling mistakes on key terms.',
   'A professor lectures on the history of the printing press. 10 questions on key dates, inventors, processes.',
   'B2', 'high', 63),

-- IELTS - READING (Academic 3 passages; General Training 5 sections)
  ('ielts_reading_question_types', 'IELTS', 'reading', 'question_type', 'Reading Question Types (All 14)',
   'Master list of all IELTS reading question types',
   'IELTS Academic has 3 long passages (700-900 words each). General Training has 5 sections. The 14 question types are common to both.',
   '1. Practice ALL 14 question types\n2. Learn specific strategies for each (see individual topics)\n3. Time management: 20 min per passage (Academic) or 12 min per section (GT)\n4. Read the questions FIRST, then skim the passage',
   'Not managing time. Getting stuck on one question. Not transferring answers (10 min at end).',
   'Passage on marine biology with 13 questions of various types.',
   'B2', 'high', 64),

  ('ielts_reading_matching_headings', 'IELTS', 'reading', 'question_type', 'Matching Headings',
   'Match a list of headings (i-xi) to paragraphs (A-H)',
   'Tests understanding of the MAIN IDEA of each paragraph. Headings are usually 1-2 sentences that capture the essence.',
   '1. Read the headings first to understand the themes\n2. Read the FIRST and LAST sentences of each paragraph\n3. Match the heading that captures the OVERALL idea\n4. Eliminate headings that are too specific (details)\n5. The first paragraph usually has a "general" heading',
   'Choosing a heading that mentions a detail but not the main idea. Matching by keyword overlap.',
   'List of 7 headings, 6 paragraphs. Match each paragraph to the best heading.',
   'B2', 'high', 65),

  ('ielts_reading_tfng', 'IELTS', 'reading', 'question_type', 'True / False / Not Given',
   'Decide if a statement agrees with the passage (T), contradicts it (F), or isn''t covered (NG)',
   'Tests ability to distinguish between explicit info, contradiction, and absence. NG is the most confusing.',
   '1. TRUE: statement is FACTUALLY correct based on the passage\n2. FALSE: statement CONTRADICTS the passage (opposite is true)\n3. NOT GIVEN: passage does NOT have the information (silence, not contradiction)\n4. The KEY: ask "Does the passage SAY this?"\n5. If the passage is silent on a detail, the answer is NG (not F)',
   'Choosing FALSE when the answer should be NOT GIVEN. Confusing "not true" with "not given".',
   'Passage: "The Roman Empire fell in 476 AD."\nStatement: "The Roman Empire was the greatest empire."\nAnswer: NOT GIVEN',
   'B2', 'high', 66),

  ('ielts_reading_yngng', 'IELTS', 'reading', 'question_type', 'Yes / No / Not Given',
   'Decide if a statement agrees with the writer''s view (Y), contradicts it (N), or isn''t stated (NG)',
   'Similar to TFNG but tests OPINIONS, not facts. Yes = writer would agree. No = writer would disagree. NG = writer doesn''t say.',
   '1. Look for the writer''s OPINION in the relevant paragraph\n2. YES: the statement matches the writer''s view\n3. NO: the statement contradicts the writer''s view\n4. NOT GIVEN: the writer does not address this point\n5. The KEY difference from TFNG: focus on OPINIONS',
   'Confusing with TFNG. Yes/No are about opinions, not facts.',
   'Passage: "I believe that technology is harmful to children."\nStatement: "The writer thinks technology is harmful."\nAnswer: YES',
   'B2', 'high', 67),

  ('ielts_reading_matching_features', 'IELTS', 'reading', 'question_type', 'Matching Features',
   'Match items (people, theories, places) to a list of features',
   'Tests ability to find specific information. Common: match 4 researchers to their theories, match 5 places to their features.',
   '1. Read the features list\n2. Scan the passage for the items\n3. Match each item to the feature that BEST describes it\n4. Each option can be used more than once or not at all',
   'Choosing based on first impression. Skimming the features list.',
   'Match 4 scientists to their discoveries.\nA) discovered X B) invented Y C) developed Z D) none of these',
   'B2', 'medium', 68),

  ('ielts_reading_matching_sentence_endings', 'IELTS', 'reading', 'question_type', 'Matching Sentence Endings',
   'Complete sentences by matching the first half to a list of endings',
   'Tests grammar and meaning. The first half usually contains a relative clause, the ending completes the idea.',
   '1. Read the first half of each sentence\n2. Predict the ending grammatically (verb, noun, clause?)\n3. Scan the passage for the key information\n4. Match: meaning must be correct AND grammar must fit',
   'Choosing an ending that fits grammar but not meaning. Ignoring context clues.',
   'Sentence start: "The new study suggests that..."\nEndings: A) ...climate change is real. B) ...more research is needed. C) ...was published in 2020.',
   'B2', 'medium', 69),

  ('ielts_reading_summary_completion', 'IELTS', 'reading', 'question_type', 'Summary Completion (with word list)',
   'Complete a summary using words from a given list (NOT from the passage)',
   'Tests vocabulary and reading. The summary is a paraphrase of part of the passage. Use the word list to fill blanks.',
   '1. Read the summary first\n2. Predict the type of word needed\n3. Find the relevant part of the passage\n4. Choose the word from the list that fits\n5. Check: spelling, grammar, singular/plural',
   'Using the wrong form (singular/plural). Choosing a word that doesn''t fit grammatically.',
   'Summary: "The study showed that X is _____ to human health."\nList: harmful, harm, harmless, harmed, harmfully',
   'B2', 'medium', 70),

  ('ielts_reading_flow_chart', 'IELTS', 'reading', 'question_type', 'Flow Chart Completion',
   'Complete a flow chart with NO MORE THAN TWO WORDS from the passage',
   'Tests ability to follow a process or sequence. The flow chart is a visual representation of the passage.',
   '1. Read the flow chart and identify the steps\n2. Find each step in the passage\n3. Use exact words from the passage (no synonyms)\n4. NO MORE THAN TWO WORDS (count carefully)\n5. Singular/plural: use the form in the passage',
   'Using too many words. Modifying the word form.',
   'Flow chart: Step 1: _____, Step 2: _____, Step 3: _____.',
   'B2', 'medium', 71),

  ('ielts_reading_mc', 'IELTS', 'reading', 'question_type', 'Multiple Choice (Reading)',
   'Choose 1 of 4 (A-D) for each question',
   'Tests detail and main idea. The answer is in the passage, but often paraphrased.',
   '1. Read the question first\n2. Scan the passage for keywords\n3. Read the relevant section\n4. Choose the answer that BEST matches\n5. Eliminate choices that are true but not the answer',
   'Choosing the first plausible answer. Not reading all choices.',
   'Q: According to the passage, what is X?\nA) It is a type of Y.\nB) It is found in Z.\nC) It is rare.\nD) It is dangerous.',
   'B2', 'high', 72),

-- IELTS - WRITING (2 tasks)
  ('ielts_writing_task1_academic', 'IELTS', 'writing', 'question_type', 'Writing Task 1: Academic (Describe a Graph/Diagram)',
   'Describe a graph, chart, diagram, or process in 150+ words (20 min)',
   'Tests ability to describe visual data. The graph/chart must be accurately described with key features highlighted. The rubric: task achievement, coherence, vocabulary, grammar.',
   '1. Spend 3 min PLANNING: identify the main trends, key features\n2. Structure (4 paragraphs):\n   - Intro: paraphrase the question\n   - Overview: 2-3 main trends (no details)\n   - Body 1: first main feature with specific data\n   - Body 2: second main feature with specific data\n3. Use comparison language: "while", "whereas", "compared to"\n4. Use approximation: "approximately", "around", "roughly"\n5. NO OPINIONS — only describe what you see',
   'Giving opinions. Listing data without grouping. No overview. Same tense throughout.',
   'The graph shows the percentage of households with internet access from 2000-2020. Summarize the information.',
   'B2', 'high', 73),

  ('ielts_writing_task1_general', 'IELTS', 'writing', 'question_type', 'Writing Task 1: General Training (Letter)',
   'Write a letter (formal, semi-formal, or informal) in 150+ words (20 min)',
   'Tests ability to write a letter for a specific purpose. Three tones: formal (to a company/manager), semi-formal (to a landlord/colleague), informal (to a friend).',
   '1. Identify the TONE: formal, semi-formal, or informal\n2. STRUCTURE:\n   - Greeting (Dear Sir/Madam, Dear Mr. X, Hi, etc.)\n   - Opening: state the purpose\n   - Body 1: first bullet point\n   - Body 2: second bullet point\n   - Body 3: third bullet point\n   - Closing: appropriate sign-off\n3. TONE markers:\n   - Formal: "I am writing to inform you that...", "Yours faithfully"\n   - Informal: "Hey, just wanted to tell you...", "Cheers/Bye"',
   'Using wrong tone (formal language in an informal letter). Missing bullet points. Not including all 3 reasons.',
   'You recently bought a product online, but it arrived damaged. Write a letter to the company. Include: what you bought, what the problem is, what you want them to do.',
   'B2', 'high', 74),

  ('ielts_writing_task2_essay', 'IELTS', 'writing', 'question_type', 'Writing Task 2: Essay',
   'Write a 250+ word essay in 40 min (opinion, discussion, problem/solution, advantages/disadvantages)',
   'Tests ability to write a clear, well-argued essay. Rubric: task response, coherence, vocabulary, grammar. 4 essay types: opinion, discussion, problem/solution, advantages/disadvantages.',
   '1. Spend 5 min PLANNING: choose position + 2 main ideas + examples\n2. STRUCTURE (4-5 paragraphs):\n   - Intro: paraphrase question + thesis\n   - Body 1: main idea 1 + example\n   - Body 2: main idea 2 + example\n   - Body 3: counter-argument + rebuttal (optional)\n   - Conclusion: restate thesis in different words\n3. Use linking words: "Furthermore", "However", "In contrast"\n4. Use complex sentences: relative clauses, conditionals, passive voice\n5. Check: 250+ words, clear position, well-developed',
   'No clear position. Listing ideas without examples. Repeating the same words. Short (under 250 words).',
   'Some people think the government should fund space exploration. Others think it should focus on solving problems on Earth. Discuss both views and give your opinion.',
   'B2', 'high', 75),

-- IELTS - SPEAKING (3 parts, 11-14 min)
  ('ielts_speaking_part1', 'IELTS', 'speaking', 'question_type', 'Speaking Part 1: Interview (4-5 min)',
   'Answer 4-6 questions on familiar topics (home, work, hobbies, daily routine)',
   'Tests fluency on familiar topics. Questions are simple, but you must speak for 1-2 minutes total. No long pauses.',
   '1. Answer directly (don''t repeat the question)\n2. Extend your answer (don''t just say "yes" or "no")\n3. Give reasons and examples\n4. Use a range of tenses naturally (present, past, future)\n5. Don''t memorize answers — examiners will notice',
   'One-word answers. Memorized answers. Long pauses. Over-complicating simple questions.',
   'Q: What do you do for work? A: I work as a teacher. I teach English at a high school in Jakarta. I love it because...',
   'B1', 'high', 76),

  ('ielts_speaking_part2', 'IELTS', 'speaking', 'question_type', 'Speaking Part 2: Cue Card (2-3 min)',
   'Speak for 2 minutes on a topic given on a card (1 min prep time)',
   'Tests ability to speak at length on a topic. The card has 4 bullet points — you should cover all of them. Speak for the FULL 2 minutes.',
   '1. Use the 1 min prep to make brief notes (DO NOT write full sentences)\n2. Cover ALL 4 bullet points\n3. Structure: Opening sentence + each bullet + a closing\n4. Use the SAME tense consistently\n5. Keep talking — the examiner will stop you at 2 min\n6. If you finish early, the examiner will ask you to elaborate',
   'Finishing in 1 minute. Missing bullet points. Memorizing answers (examiners can tell).',
   'Describe a book that has had a strong influence on you. You should say:\n- what the book is\n- when you read it\n- what it is about\n- explain why it has had a strong influence on you',
   'B2', 'high', 77),

  ('ielts_speaking_part3', 'IELTS', 'speaking', 'question_type', 'Speaking Part 3: Discussion (4-5 min)',
   'Answer 4-5 abstract questions related to Part 2 topic',
   'Tests ability to discuss abstract ideas. Questions are more complex and require opinion + justification. The examiner may challenge your view.',
   '1. Give a CLEAR opinion\n2. EXPLAIN why you have that opinion (reasons)\n3. Give EXAMPLES\n4. The examiner may ask "Why?" — be ready\n5. Use complex structures: conditionals, passive, relative clauses\n6. It''s OK to disagree with the examiner politely',
   'One-word answers. No clear opinion. Not justifying your view.',
   'Q: Some people say books are no longer important. Do you agree?\nA: I disagree. Although technology has changed how we read, books remain important because...',
   'B2', 'high', 78),

-- ===========================================================================
-- SECTION E: CROSS-CUTTING SKILLS (apply to all 4 tests)
-- ===========================================================================

  ('skill_speed_reading', 'ALL', 'reading', 'skill', 'Speed Reading Techniques',
   'Read faster while maintaining comprehension',
   'Tests reading speed. 250+ wpm for English. The eye fixates on key words, not every word. Subvocalization slows you down.',
   '1. Use a pointer (finger/pen) to guide your eyes\n2. Read in CHUNKS of 2-3 words, not word by word\n3. Stop subvocalization — hear the meaning, not the words\n4. Practice with timed reading passages\n5. Skim headings and bold text first',
   'Trying to read every word. Subvocalization. Re-reading.',
   'Practice with TOEFL/IELTS reading passages. Time yourself. Goal: 250 wpm with 80% comprehension.',
   'B1', 'high', 80),

  ('skill_scan_find', 'ALL', 'reading', 'skill', 'Scanning and Skimming',
   'Find specific information quickly (scan) or get the gist (skim)',
   'Two complementary reading skills. Skimming: read quickly to get the main idea. Scanning: look for specific keywords.',
   '1. SCANNING: move eyes quickly, looking for the keyword\n2. SKIMMING: read first and last sentences of each paragraph\n3. Use both depending on the question type\n4. Detail questions → scan. Main idea → skim',
   'Confusing skimming with scanning. Skipping too much information.',
   'Q: What year was X discovered? → Scan for years.\nQ: What is the passage mainly about? → Skim.',
   'B1', 'high', 81),

  ('skill_vocab_context', 'ALL', 'vocabulary', 'skill', 'Vocabulary from Context',
   'Guess word meaning from surrounding text',
   'Tests ability to infer meaning. Context clues: definitions, examples, contrasts, cause-effect, synonyms, antonyms.',
   '1. Read the SENTENCE containing the unknown word\n2. Read the sentences BEFORE and AFTER\n3. Look for definition: "X is a type of..."\n4. Look for example: "such as", "for example"\n5. Look for contrast: "however", "unlike"\n6. Look for synonym: "or", "in other words"',
   'Picking the first dictionary meaning. Ignoring the context entirely.',
   '"Permeable" in "Water passes through the permeable rock, that is, the rock has tiny holes." → means "porous".',
   'B2', 'high', 82),

  ('skill_summarize', 'ALL', 'writing', 'skill', 'Summarization Skills',
   'Condense long text into a short summary',
   'Tests ability to identify main ideas. A summary includes ONLY main ideas — no details, no examples, no opinions.',
   '1. Read the passage\n2. Identify the MAIN IDEA of each paragraph\n3. Combine the main ideas into a shorter text\n4. Keep the same MEANING, use different WORDS (paraphrase)\n5. Drop examples, details, and minor points',
   'Including too many details. Just copying phrases from the original. Adding personal opinions.',
   'Original: 300 words on photosynthesis. Summary: 50 words. "Photosynthesis is the process by which plants convert sunlight into energy."',
   'B2', 'medium', 83),

  ('skill_pacing', 'ALL', 'integrated', 'skill', 'Time Management and Pacing',
   'Allocate time across sections and questions',
   'Tests ability to manage time under pressure. Each test has a strict time limit. Running out of time = missing easy points.',
   '1. Know the time per question BEFORE the test\n2. Skip hard questions, return later\n3. Mark answers as you go (don''t leave blanks)\n4. Keep moving — don''t get stuck on one question\n5. Save 2-3 min for transferring answers (paper tests)\n6. Practice with strict timing',
   'Spending 5 min on one question. Leaving answers blank. Rushing the last 10 questions.',
   'TOEFL iBT Reading: 54 min, 30 questions = ~1.8 min/question. IELTS Reading: 60 min, 40 questions = 1.5 min/question.',
   'B1', 'high', 84),

  ('skill_paraphrase', 'ALL', 'integrated', 'skill', 'Paraphrasing Skills',
   'Restate something in different words with the same meaning',
   'Tests vocabulary and sentence structure. Used in writing, speaking, and reading. The key: same MEANING, different WORDS.',
   '1. Identify the KEY TERMS in the original\n2. Use SYNONYMS for key terms (where possible)\n3. Change the SENTENCE STRUCTURE (active to passive, etc.)\n4. Use REPORTING VERBS in writing: "states", "argues", "claims"\n5. DO NOT change the meaning',
   'Changing the meaning. Using synonyms that don''t fit. Failing to change sentence structure.',
   'Original: "Photosynthesis converts sunlight into energy."\nParaphrase: "Plants use photosynthesis to transform solar radiation into usable energy."',
   'B2', 'high', 85),

  ('skill_speaking_fluency', 'ALL', 'speaking', 'skill', 'Speaking Fluency',
   'Speak at a natural pace without long pauses',
   'Tests ability to speak smoothly. Fluency ≠ speed. Pauses are OK (1-2s), but LONG pauses hurt the score.',
   '1. Use FILLERS: "well", "I mean", "you know"\n2. Don''t STOP and THINK silently — say something\n3. Use simple structures with confidence\n4. Practice shadowing (repeat after audio)\n5. Record yourself and listen back',
   'Stopping mid-sentence. Speaking too fast (nervousness). Long pauses.',
   'Practice: Listen to a podcast. Pause. Repeat the speaker''s last sentence. Keep up.',
   'B1', 'high', 86),

  ('skill_writing_coherence', 'ALL', 'writing', 'skill', 'Coherence and Cohesion (Writing)',
   'Organize ideas logically and connect them with linking words',
   'Tests logical organization. Coherence = logical flow. Cohesion = linking words and reference. Each paragraph should have ONE main idea.',
   '1. Each paragraph = ONE main idea\n2. Use TOPIC SENTENCE at the start of each paragraph\n3. Use LINKING WORDS: "First", "However", "For example", "In contrast"\n4. Use REFERENCE: "this", "such", "these" to connect to previous sentences\n5. CONCLUSION should RESTATE the thesis (not introduce new ideas)',
   'No topic sentence. Random linking words. New ideas in the conclusion.',
   'Topic: Education. Para 1: Why education matters. Para 2: Problems in education. Para 3: Solutions. Conclusion: Restate.',
   'B2', 'high', 87)
;
