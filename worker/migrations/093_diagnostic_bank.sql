-- 093: Diagnostic question bank — pindahkan soal diagnostic dari hardcoded
-- arrays di diagnostic.ts ke D1, supaya retake dapat variasi soal per topic
-- dan soal baru bisa ditambah tanpa deploy.
--
-- test_type: 'COMMON' (dipakai semua test) atau 'TOEFL_IBT' | 'IELTS' |
-- 'TOEFL_ITP' | 'TOEIC' untuk soal khusus per test.

CREATE TABLE IF NOT EXISTS diagnostic_question_bank (
  id INTEGER PRIMARY KEY,
  test_type TEXT NOT NULL,
  section TEXT,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL, -- JSON array
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  audio_text TEXT, -- teks TTS untuk soal listening/vocab beraudio
  difficulty INTEGER DEFAULT 2,
  is_active INTEGER DEFAULT 1,
  source TEXT DEFAULT 'seed',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diag_bank_type_active
  ON diagnostic_question_bank (test_type, is_active);
CREATE INDEX IF NOT EXISTS idx_diag_bank_topic
  ON diagnostic_question_bank (topic);

-- === SEED: salinan setia dari array hardcoded di diagnostic.ts ===

-- COMMON_GRAMMAR (id 1-8)
INSERT OR IGNORE INTO diagnostic_question_bank (id, test_type, section, topic, question, options, correct_answer, explanation) VALUES
(1, 'COMMON', 'grammar', 'articles', 'I want to buy ___ umbrella.

a) a
b) an
c) the
d) (nothing)', '["a","an","the","(nothing)"]', 'b', '"Umbrella" starts with a vowel SOUND, so we use "an".'),
(2, 'COMMON', 'grammar', 'articles', '___ sun rises in ___ east.

a) A, an
b) The, the
c) A, the
d) The, an', '["A, an","The, the","A, the","The, an"]', 'b', 'We use "the" for things that are unique (only one sun, one east).'),
(3, 'COMMON', 'grammar', 'tenses', 'Yesterday, she ___ to the market.

a) go
b) goes
c) went
d) going', '["go","goes","went","going"]', 'c', '"Yesterday" = past time, so we use past tense "went".'),
(4, 'COMMON', 'grammar', 'tenses', 'I have ___ here since 2020.

a) live
b) lived
c) living
d) lives', '["live","lived","living","lives"]', 'b', '"Since 2020" = Present Perfect. have + past participle (lived).'),
(5, 'COMMON', 'grammar', 'sv_agreement', 'Everyone ___ happy today.

a) are
b) is
c) were
d) been', '["are","is","were","been"]', 'b', '"Everyone" is singular (even though it means many people). Use "is".'),
(6, 'COMMON', 'grammar', 'sv_agreement', 'The news ___ shocking.

a) are
b) is
c) were
d) have been', '["are","is","were","have been"]', 'b', '"News" is uncountable and always singular. Use "is".'),
(7, 'COMMON', 'grammar', 'prepositions', 'The meeting is ___ Monday ___ 3 PM.

a) in, in
b) on, at
c) at, on
d) in, at', '["in, in","on, at","at, on","in, at"]', 'b', 'Days → "on" (on Monday). Clock time → "at" (at 3 PM).'),
(8, 'COMMON', 'grammar', 'passive_voice', 'This bridge ___ in 1995.

a) built
b) was built
c) is built
d) has built', '["built","was built","is built","has built"]', 'b', 'Past passive = was/were + past participle. "Was built" because 1995 is past.');

-- COMMON_VOCAB (id 9-12)
INSERT OR IGNORE INTO diagnostic_question_bank (id, test_type, section, topic, question, options, correct_answer, explanation, audio_text) VALUES
(9, 'COMMON', 'vocabulary', 'academic_words', 'Dengarkan audio, lalu jawab:

The scientist wants to ___ whether the drug is safe.

a) determine
b) create
c) ignore
d) celebrate', '["determine","create","ignore","celebrate"]', 'a', '"Determine" = find out / decide. Common academic word.', 'Before approving the medication, researchers must carefully evaluate the trial results to find out whether the drug is safe for human use.'),
(10, 'COMMON', 'vocabulary', 'academic_words', 'Dengarkan audio, lalu jawab:

The government ___ new regulations last year.

a) implemented
b) decorated
c) entertained
d) abandoned', '["implemented","decorated","entertained","abandoned"]', 'a', '"Implemented" = put into action.', 'Following months of public debate, officials put the new policy into action across every province at the start of the past year.'),
(11, 'COMMON', 'vocabulary', 'collocations', 'Dengarkan audio, lalu jawab:

Can you ___ a decision quickly?

a) do
b) make
c) take
d) have', '["do","make","take","have"]', 'b', '"Make a decision" is the correct collocation.', 'Manager: We have a tight deadline, so I need you to choose between the two options quickly. Can you give me your final answer today?'),
(12, 'COMMON', 'vocabulary', 'collocations', 'Dengarkan audio, lalu jawab:

There was ___ rain last night.

a) strong
b) big
c) heavy
d) hard', '["strong","big","heavy","hard"]', 'c', '"Heavy rain" is the natural English collocation.', 'Weather reporter: The storm brought strong downpours throughout the evening, and the streets were flooded by morning after hours of continuous rainfall.');

-- COMMON_READING (id 13-15)
INSERT OR IGNORE INTO diagnostic_question_bank (id, test_type, section, topic, question, options, correct_answer, explanation) VALUES
(13, 'COMMON', 'reading', 'main_idea', 'Read:
"Bees play a crucial role in pollinating crops. Without them, many fruits and vegetables would not grow. Scientists are concerned about declining bee populations worldwide."

What is the main idea?

a) Bees make honey
b) Bees are important for food production
c) Scientists study insects
d) Crops need water', '["Bees make honey","Bees are important for food production","Scientists study insects","Crops need water"]', 'b', 'The passage talks about bees pollinating crops and the concern about their decline.'),
(14, 'COMMON', 'reading', 'detail', 'From the same passage about bees: What are scientists concerned about?

a) Too many bees
b) Bees attacking people
c) Declining bee populations
d) New types of bees', '["Too many bees","Bees attacking people","Declining bee populations","New types of bees"]', 'c', 'Direct quote: "Scientists are concerned about declining bee populations."'),
(15, 'COMMON', 'reading', 'vocabulary_context', 'In the passage, "crucial" most likely means:

a) small
b) very important
c) dangerous
d) interesting', '["small","very important","dangerous","interesting"]', 'b', '"Crucial" = extremely important, essential.');

-- COMMON_LISTENING (id 16-18)
INSERT OR IGNORE INTO diagnostic_question_bank (id, test_type, section, topic, question, options, correct_answer, explanation, audio_text) VALUES
(16, 'COMMON', 'listening', 'conversation', 'Dengarkan audio di atas, lalu jawab:

What does the woman mean?

a) The exam is tomorrow
b) The exam was cancelled
c) The exam is today
d) The exam is next week', '["The exam is tomorrow","The exam was cancelled","The exam is today","The exam is next week"]', 'c', '"Moved up" = made earlier. The exam is now today, not tomorrow.', 'Man: I thought the exam was tomorrow. Woman: No, it was moved up to today.'),
(17, 'COMMON', 'listening', 'inference', 'Dengarkan audio di atas, lalu jawab:

What is the woman asking?

a) To turn off the light
b) To make the music quieter
c) To change the song
d) To stop studying', '["To turn off the light","To make the music quieter","To change the song","To stop studying"]', 'b', '"Turn down" = reduce the volume. She wants it quieter.', 'Woman: Could you turn down the music? I''m trying to study.'),
(18, 'COMMON', 'listening', 'purpose', 'Dengarkan audio di atas, lalu jawab:

What is the student trying to do?

a) Submit the paper early
b) Ask for more time
c) Cancel the assignment
d) Change the topic', '["Submit the paper early","Ask for more time","Cancel the assignment","Change the topic"]', 'b', '"Extension" = more time to complete something.', 'Student: Professor, I was wondering if I could get an extension on the paper?');

-- TOEFL_IBT_EXTRA (id 19-20)
INSERT OR IGNORE INTO diagnostic_question_bank (id, test_type, section, topic, question, options, correct_answer, explanation, audio_text) VALUES
(19, 'TOEFL_IBT', 'writing', 'email', 'Dengarkan instruksi di atas, lalu tulis email pendek (3-5 kalimat) ke profesor kamu.

Tulis dalam bahasa Inggris:', '[]', '_free_text_', '', 'Write a short email to your professor. Explain that you will miss class tomorrow because you have a doctor''s appointment. Ask if you can get the notes from a classmate.'),
(20, 'TOEFL_IBT', 'grammar', 'word_formation', 'She is very ___ (help). She always helps everyone.

a) helpless
b) helpful
c) helping
d) helped', '["helpless","helpful","helping","helped"]', 'b', '"-ful" suffix means "full of". Helpful = full of help.', NULL);

-- IELTS_EXTRA (id 21-22)
INSERT OR IGNORE INTO diagnostic_question_bank (id, test_type, section, topic, question, options, correct_answer, explanation, audio_text) VALUES
(21, 'IELTS', 'reading', 'true_false_not_given', 'Read:
"Coffee was first discovered in Ethiopia. A shepherd noticed his goats became energetic after eating certain berries. By the 15th century, coffee was being cultivated in Yemen."

Statement: Coffee was first grown in Ethiopia.

a) True
b) False
c) Not Given', '["True","False","Not Given"]', 'c', 'The passage says coffee was DISCOVERED in Ethiopia, but CULTIVATED in Yemen. Where it was first grown is not clearly stated.', NULL),
(22, 'IELTS', 'speaking', 'cue_card', 'Dengarkan instruksi di atas. Kamu punya 1 menit persiapan, lalu bicara selama 2 menit.

Jawab dalam bahasa Inggris (tulis jawabanmu):', '[]', '_free_text_', 'IELTS Speaking Part 2: Cue card task. You should speak for 1-2 minutes covering all the points.', 'Describe a book that you have read recently. You should say: what the book was about, why you chose to read it, what you learned from it, and explain whether you would recommend it to others.');

-- TOEFL_ITP_EXTRA (id 23-24)
INSERT OR IGNORE INTO diagnostic_question_bank (id, test_type, section, topic, question, options, correct_answer, explanation) VALUES
(23, 'TOEFL_ITP', 'grammar', 'error_identification', 'Find the error:

"The professor, along with his students, (A) are attending (B) the conference (C) which is held (D) annually."

a) A
b) B
c) C
d) D', '["A","B","C","D"]', 'a', '"Along with" does not change the subject. The subject is "professor" (singular), so it should be "is attending".'),
(24, 'TOEFL_ITP', 'grammar', 'sentence_completion', '___ the weather is bad, the outdoor event will be postponed.

a) Despite
b) Should
c) Unless
d) Although', '["Despite","Should","Unless","Although"]', 'b', '"Should the weather be bad" = "If the weather is bad" (formal inversion). Common in TOEFL ITP Structure.');

-- TOEIC_EXTRA (id 25-26)
INSERT OR IGNORE INTO diagnostic_question_bank (id, test_type, section, topic, question, options, correct_answer, explanation) VALUES
(25, 'TOEIC', 'vocabulary', 'business_vocabulary', 'The quarterly report shows a significant ___ in revenue.

a) increase
b) meeting
c) schedule
d) department', '["increase","meeting","schedule","department"]', 'a', '"Increase in revenue" is a common business collocation. TOEIC focuses on workplace vocabulary.'),
(26, 'TOEIC', 'reading', 'business_reading', 'Read:
"All employees must submit their time sheets by Friday at 5 PM. Late submissions will not be processed until the following pay period."

What happens if time sheets are submitted late?

a) Employees will be fired
b) Payment will be delayed
c) Time sheets will be rejected
d) A fine will be charged', '["Employees will be fired","Payment will be delayed","Time sheets will be rejected","A fine will be charged"]', 'b', '"Not processed until the following pay period" means payment will be delayed, not rejected.');
