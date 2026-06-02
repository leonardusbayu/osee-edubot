-- 078: Master Grammar Topics
-- Comprehensive grammar syllabus for TOEFL iBT, TOEFL ITP, TOEIC, IELTS
-- Compiled from: Official Guide to TOEFL Test 6th ed, Longman TOEFL ITP, ETS TOEIC,
--                Cambridge IELTS 18, Cambridge Grammar of English, Practical English Usage

CREATE TABLE IF NOT EXISTS grammar_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_key TEXT UNIQUE NOT NULL,         -- e.g. 'present_simple', 'articles_definite'
  category TEXT NOT NULL,                 -- 'tense', 'noun', 'verb_form', 'clause', 'modality', 'voice', 'word_class', 'syntax', 'punctuation'
  subcategory TEXT,                       -- e.g. 'simple', 'progressive', 'perfect'
  name TEXT NOT NULL,                     -- human-readable name
  description TEXT,                       -- what this topic is
  cefr_level TEXT DEFAULT 'B1',           -- A1, A2, B1, B2, C1, C2
  rule TEXT,                              -- the rule/pattern
  examples TEXT,                          -- 3-5 example sentences (newline-separated)
  common_mistakes TEXT,                   -- typical Indonesian-speaker mistakes
  tested_in TEXT,                         -- JSON array: ['TOEFL_IBT', 'TOEFL_ITP', 'TOEIC', 'IELTS']
  frequency TEXT DEFAULT 'medium',        -- 'high', 'medium', 'low' (frequency in tests)
  order_index INTEGER DEFAULT 0,          -- display order
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_grammar_cat ON grammar_topics(category, order_index);
CREATE INDEX IF NOT EXISTS idx_grammar_cefr ON grammar_topics(cefr_level);

-- ===========================================================================
-- SECTION 1: VERB TENSES (12 tenses)
-- ===========================================================================

INSERT INTO grammar_topics (topic_key, category, subcategory, name, description, cefr_level, rule, examples, common_mistakes, tested_in, frequency, order_index) VALUES
  ('present_simple', 'tense', 'simple', 'Present Simple',
   'Habits, routines, general truths, permanent states',
   'A1', 'Subject + base verb (+s for he/she/it). Use adverbs of frequency (always, usually, often, sometimes, never).',
   'I work at a tech company.\nShe studies English every day.\nThe sun rises in the east.\nWater boils at 100 degrees Celsius.',
   'Indonesian: "I work" — using base form. For he/she/it, MUST add -s/-es.\nWRONG: "She work" → CORRECT: "She works".\nForgetting third-person -s is the #1 mistake.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 10),

  ('present_progressive', 'tense', 'progressive', 'Present Progressive/Continuous',
   'Actions happening now, temporary situations, current trends',
   'A1', 'Subject + am/is/are + verb-ing.',
   'I am studying for the TOEFL right now.\nShe is working from home this week.\nThe population is growing rapidly.',
   'Indonesian: "Saya belajar sekarang" is the same form as habitual. Use progressive ONLY for actions happening at speech time.\nWRONG: "I am work at a company" (mixing forms)',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 20),

  ('present_perfect', 'tense', 'perfect', 'Present Perfect',
   'Past actions with present relevance, experiences, recent events, unfinished time',
   'A2', 'Subject + have/has + past participle (V3). NEVER use with specific past time (yesterday, in 2010, last week).',
   'I have lived in Jakarta for five years.\nShe has finished her homework.\nHave you ever been to London?\nI have just eaten lunch.',
   'Indonesian: "Saya sudah pergi ke London kemarin" — wrong because "kemarin" is specific past.\nCORRECT: "I went to London yesterday" or "I have been to London" (no time).',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 30),

  ('present_perfect_progressive', 'tense', 'perfect_progressive', 'Present Perfect Progressive',
   'Ongoing actions from past to present, emphasizing duration',
   'B1', 'Subject + have/has been + verb-ing.',
   'I have been waiting for two hours.\nIt has been raining all day.\nShe has been working here since 2020.',
   'Often confused with present perfect simple. Use progressive for ongoing action, simple for completed/result.\n"He has been reading" (still reading) vs "He has read the book" (finished).',
   '["TOEFL_IBT","IELTS"]', 'medium', 40),

  ('past_simple', 'tense', 'simple', 'Past Simple',
   'Completed actions at specific past times',
   'A1', 'Subject + V2 (regular -ed, irregular forms). Time markers: yesterday, last week, in 2010, ago, when.',
   'I visited Bali last summer.\nShe wrote three essays yesterday.\nDid you see the movie?',
   'Indonesian: "I go to Bali yesterday" — WRONG (using present).\nAlways use past form with past time markers.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 50),

  ('past_progressive', 'tense', 'progressive', 'Past Progressive/Continuous',
   'Ongoing past actions, often interrupted by another action',
   'A2', 'Subject + was/were + verb-ing. Often used with past simple (interruption).',
   'I was studying when she called.\nThey were playing football at 5 PM.\nWhile I was cooking, the phone rang.',
   'Use "while" for the longer action (progressive), "when" for the interruption (simple past).',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 60),

  ('past_perfect', 'tense', 'perfect', 'Past Perfect',
   'Action completed before another past action ("the past of the past")',
   'B1', 'Subject + had + past participle (V3). Used when two past events; the earlier one uses past perfect.',
   'I had already eaten when she arrived.\nBy the time the train came, we had waited for 30 minutes.\nHe said he had finished the report.',
   'Indonesian speakers often skip this tense, using past simple for both events.\nWRONG: "When she arrived, I already ate" → CORRECT: "When she arrived, I had already eaten".',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 70),

  ('past_perfect_progressive', 'tense', 'perfect_progressive', 'Past Perfect Progressive',
   'Ongoing action before a past point',
   'B2', 'Subject + had been + verb-ing.',
   'I had been studying for two hours before the power went out.\nShe had been waiting since 3 PM when the bus finally came.',
   'Rarely tested directly but appears in advanced reading passages.',
   '["TOEFL_IBT","IELTS"]', 'medium', 80),

  ('future_simple', 'tense', 'simple', 'Future Simple (will)',
   'Predictions, spontaneous decisions, promises, future facts',
   'A1', 'Subject + will + base verb. Use for: predictions (I think it will rain), spontaneous decisions (I''ll help you), facts (She will be 30 next year).',
   'I will call you tomorrow.\nIt will probably rain tonight.\nWhen you arrive, I will meet you at the airport.',
   'WRONG: "I will go to the cinema yesterday" — mixing future with past time.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 90),

  ('future_progressive', 'tense', 'progressive', 'Future Progressive',
   'Ongoing action at a future time',
   'B1', 'Subject + will be + verb-ing.',
   'This time tomorrow, I will be flying to Tokyo.\nAt 8 PM tonight, she will be giving her presentation.',
   'Less common; appears mostly in academic reading passages.',
   '["TOEFL_IBT","IELTS"]', 'low', 100),

  ('future_perfect', 'tense', 'perfect', 'Future Perfect',
   'Action completed before a future point',
   'B2', 'Subject + will have + past participle. Time markers: by, by the time, before.',
   'By next year, I will have graduated.\nBy the time you read this, I will have left.',
   'Indonesian: "Saya akan sudah lulus tahun depan" (will already have graduated) — direct translation.',
   '["TOEFL_IBT","IELTS"]', 'medium', 110),

  ('going_to', 'tense', 'simple', '"Going to" Future',
   'Planned intentions, predictions based on present evidence',
   'A2', 'Subject + am/is/are + going to + base verb. Use for: plans (decided before), predictions from evidence (clouds → rain).',
   'I am going to study medicine.\nLook at those clouds — it is going to rain.\nShe is going to have a baby.',
   'Use "going to" for PLANS, "will" for SPONTANEOUS decisions at speech time.\nWRONG: "Look, a phone call! I am going to answer it" → CORRECT: "I will answer it".',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 120),

  ('present_used_to', 'tense', 'simple', 'Used to / Would (past habits)',
   'Past habits that no longer happen',
   'A2', 'Used to + base verb (for past states AND actions). Would + base verb (for past actions only, NOT states).',
   'I used to live in Surabaya. (state — "used to" only)\nI used to play tennis when I was young.\nWhen I was a child, I would visit my grandmother every weekend.',
   'WRONG: "I would live in Surabaya" (would + state — incorrect).\nUse "used to" for both states and actions; "would" only for repeated past actions.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 130),

-- ===========================================================================
-- SECTION 2: VERB FORMS (Participles, Infinitives, Gerunds)
-- ===========================================================================

  ('infinitive_purpose', 'verb_form', 'infinitive', 'Infinitive of Purpose',
   'To + verb to express purpose',
   'A2', 'Use "to + base verb" to say WHY. Alternative: "in order to + verb" (more formal).',
   'I came here to learn English.\nShe studies hard in order to get a scholarship.\nHe went to the store to buy milk.',
   'WRONG: "I came here for learn" (mixing "for" + infinitive).\nUse "to" or "for + noun" (I came here for learning / I came here to learn).',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 200),

  ('gerund_as_subject', 'verb_form', 'gerund', 'Gerund as Subject',
   'Verb+ing as the subject of a sentence',
   'B1', 'Use V-ing (not infinitive) after: enjoy, avoid, finish, mind, suggest, consider, deny, imagine, involve, keep, miss, practice, quit, recommend, risk.',
   'Swimming is good exercise.\nI enjoy reading before bed.\nShe suggested going to the movies.\nAvoid eating too much sugar.',
   'WRONG: "I enjoy to read" — must be "I enjoy reading".\nCommon verbs that take gerund: enjoy, finish, mind, suggest, recommend, avoid, consider, imagine, involve, miss, practice, risk, keep.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 210),

  ('gerund_after_prep', 'verb_form', 'gerund', 'Gerund After Prepositions',
   'V-ing after prepositions (in, on, at, about, of, for, by, with, without)',
   'A2', 'After any preposition, use V-ing. NEVER "to + verb".',
   'I am good at cooking.\nShe is interested in learning Japanese.\nHe left without saying goodbye.\nYou can improve by practicing daily.',
   'WRONG: "I am good at to cook" → CORRECT: "I am good at cooking".\nThis is heavily tested in TOEFL ITP and TOEIC.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 220),

  ('infinitive_vs_gerund', 'verb_form', 'infinitive', 'Infinitive vs Gerund (Different Meanings)',
   'Some verbs change meaning based on infinitive vs gerund',
   'B2', 'stop doing (quit) vs stop to do (pause to do); remember doing (memory) vs remember to do (not forget); regret doing (sad about past) vs regret to do (formal sad); try doing (experiment) vs try to do (attempt); go on doing (continue same) vs go on to do (next step).',
   'I stopped smoking. (quit)\nI stopped to smoke. (paused what I was doing to smoke)\nI remember locking the door. (I have the memory)\nRemember to lock the door. (don''t forget)',
   'Critical distinction. Indonesian speakers often miss this. Test with: stop, remember, forget, regret, try, go on, mean.',
   '["TOEFL_IBT","IELTS"]', 'high', 230),

  ('passive_voice', 'voice', 'passive', 'Passive Voice',
   'When the action is more important than the agent, or agent is unknown',
   'B1', 'Subject + be + past participle (+ by + agent if known). All tenses possible.',
   'English is spoken worldwide.\nThe book was written in 1850.\nThe new bridge will be opened next month.\nThe cake was eaten by the children.',
   'WRONG: "English is speak" (using base form).\nBe + V3 is the formula. Common error: missing "be".',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 300),

  ('causative_have_get', 'voice', 'causative', 'Causative "have" and "get"',
   'Have someone else do something for you',
   'B2', 'Have + object + base verb (arrange). Get + object + to + verb (more effort). Have + object + V3 (something done to you, often unwanted).',
   'I had the mechanic check my car. (I arranged it)\nI got the mechanic to check my car. (persuaded)\nI had my car stolen. (something happened to me)',
   'WRONG: "I had the mechanic to check" — must use base verb (no "to") with "have".',
   '["TOEFL_IBT","IELTS"]', 'medium', 310),

-- ===========================================================================
-- SECTION 3: MODALS
-- ===========================================================================

  ('modal_ability', 'modality', 'ability', 'Modals of Ability (can, could, be able to)',
   'Expressing general ability, specific ability, permission',
   'A1', 'Can (present ability), could (past general ability / polite request), be able to (specific ability: was/will be able to).',
   'I can speak three languages. (general)\nI could swim when I was 5. (past general)\nI was able to finish the marathon. (past specific achievement)\nWill you be able to come? (future specific)',
   'Use "was/were able to" for SPECIFIC past achievements. "Could" alone is for general ability.\nWRONG: "Yesterday I could solve the problem" (specific event) → CORRECT: "Yesterday I was able to solve the problem".',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 400),

  ('modal_obligation', 'modality', 'obligation', 'Modals of Obligation (must, have to, should, ought to)',
   'Expressing necessity, duty, advice',
   'A1', 'Must (strong, speaker''s authority), have to (external necessity), should (advice), ought to (formal advice).',
   'You must wear a seatbelt. (law)\nI have to work tomorrow. (external)\nYou should see a doctor. (advice)\nYou ought to apologize. (formal advice)',
   'WRONG: "You must to go" (must + to is wrong — modal + base verb).\nNever use "to" after modals.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 410),

  ('modal_permission', 'modality', 'permission', 'Modals of Permission (can, could, may, might)',
   'Asking for and giving permission',
   'A1', 'Can (informal permission), could (polite), may (formal).',
   'Can I borrow your pen? (informal)\nCould I use your phone? (polite)\nMay I leave early today? (formal)',
   'WRONG: "Can I to borrow" (no "to" after modal).',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'medium', 420),

  ('modal_deduction', 'modality', 'deduction', 'Modals of Deduction (must, might, could, can''t)',
   'Expressing logical conclusions about present and past',
   'B2', 'Must (almost certain), may/might/could (possible), can''t (almost certain negative).',
   'She must be tired — she''s been working all day.\nIt might rain later.\nHe can''t be at home — his lights are off.',
   'Must is only for positive deduction; can''t is for negative.\nWRONG: "It must not rain" (meaning: it probably won''t rain) — WRONG. Use "probably won''t".',
   '["TOEFL_IBT","IELTS"]', 'high', 430),

  ('modal_past', 'modality', 'past', 'Modal Perfects (could have, should have, must have)',
   'Speculation and regrets about the past',
   'B2', 'Could have + V3 (was possible but didn''t), should have + V3 (regret, was better but didn''t), must have + V3 (almost certain past).',
   'You could have told me! (you had the chance but didn''t)\nI should have studied harder. (regret)\nShe must have left already. (deduction)',
   'WRONG: "You should have study" — must use V3.\nIndonesian: "Saya harusnya belajar lebih giat" = I should have studied harder.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 440),

-- ===========================================================================
-- SECTION 4: CONDITIONALS
-- ===========================================================================

  ('conditional_zero', 'clause', 'conditional', 'Zero Conditional',
   'General truths, scientific facts, habits',
   'A2', 'If + present simple, present simple. (Both clauses in present simple.)',
   'If you heat water to 100°C, it boils.\nIf I have free time, I read a book.',
   'Both halves use present tense — this is the key.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'medium', 500),

  ('conditional_first', 'clause', 'conditional', 'First Conditional',
   'Real/likely future situations',
   'A2', 'If + present simple, will + base verb.',
   'If it rains tomorrow, I will stay home.\nIf you study hard, you will pass the exam.',
   'Indonesian: "Kalau hujan, saya akan di rumah" — same structure.\nWRONG: "If it will rain" → "If it rains" (present simple after if).',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 510),

  ('conditional_second', 'clause', 'conditional', 'Second Conditional',
   'Unreal/hypothetical present or future',
   'B1', 'If + past simple, would + base verb.',
   'If I won the lottery, I would travel the world.\nIf I were you, I would apologize.',
   'Use "were" for all subjects in formal English (If I were / If he were).\nWRONG: "If I would win" → "If I won".\nIndonesian: "Kalau saya jadi Anda, saya akan minta maaf" — use "were" in formal.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 520),

  ('conditional_third', 'clause', 'conditional', 'Third Conditional',
   'Unreal past situations and their imagined results',
   'B2', 'If + had + past participle, would have + past participle.',
   'If I had studied harder, I would have passed the exam.\nIf she had left earlier, she would have caught the train.',
   'Indonesian: "Kalau saya belajar lebih giat, saya akan lulus" — but for past unreal, both halves need perfect form.\nWRONG: "If I studied harder, I would pass" (present) vs "If I had studied harder, I would have passed" (past).',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 530),

  ('conditional_mixed', 'clause', 'conditional', 'Mixed Conditionals',
   'Past condition with present result, or present condition with past result',
   'C1', 'If + had + V3 (past), would + base verb (present result). OR If + past simple, would have + V3 (present condition, past result).',
   'If I had taken that job, I would be in New York now.\nIf I were braver, I would have spoken up yesterday.',
   'Advanced; tested in TOEFL iBT reading passages.',
   '["TOEFL_IBT","IELTS"]', 'low', 540),

  ('wish_if_only', 'clause', 'wish', 'Wish / If only (Regrets and Hypotheticals)',
   'Expressing wishes about present/past',
   'B1', 'Wish + past simple (present wish), wish + had + V3 (past regret), wish + would (annoyance).',
   'I wish I were taller. (present)\nI wish I had studied medicine. (past regret)\nI wish you would stop interrupting me.',
   'Use "were" (not "was") after wish in formal English.\nWRONG: "I wish I was" → "I wish I were".',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 550),

-- ===========================================================================
-- SECTION 5: NOUNS, ARTICLES, DETERMINERS
-- ===========================================================================

  ('articles_definite', 'noun', 'article', 'Definite Article (the)',
   'Use "the" for specific nouns, known to both speaker and listener',
   'A1', 'Use "the" for: unique things (the sun), previously mentioned (I have a cat. The cat is black.), superlatives (the best), ordinals (the first), with of-phrases (the end of the road), musical instruments (play the piano), geographical features (the Amazon).',
   'The sun is bright today.\nI bought a book yesterday. The book is interesting.\nShe is the smartest student in class.\nThe Eiffel Tower is in Paris.',
   'Indonesian: "the" is more limited. Common errors:\n1. Missing "the" for unique things: "Sun is bright" → "The sun is bright".\n2. Using "the" for general plurals: "The cats are friendly" (general — no "the").',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 600),

  ('articles_indefinite', 'noun', 'article', 'Indefinite Article (a/an)',
   'Use "a/an" for first mention, singular countable nouns, professions',
   'A1', 'A (before consonant sound: a book, a university /juː/), An (before vowel sound: an apple, an hour /aʊər/).',
   'I saw a movie last night.\nShe is a teacher.\nAn umbrella is useful in Jakarta.',
   'Sound matters, not spelling!\nWRONG: "a apple" (vowel sound), "an university" (consonant sound /j/).\nIndonesian: tidak ada a/an — kesalahan umum.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 610),

  ('articles_zero', 'noun', 'article', 'Zero Article (no article)',
   'No article for plurals (general), uncountables, proper nouns, meals, sports, languages',
   'A2', 'No article: plural general (Cats are mammals), uncountable general (Water is essential), proper nouns (Jakarta, Indonesia), meals (have breakfast), sports (play tennis), languages (speak English), with "at/in" for places (at home, in bed).',
   'Cats are independent animals.\nI love coffee.\nShe plays tennis every weekend.\nHe is at work.',
   'WRONG: "I love the coffee" (general — no "the").\nWRONG: "Play the tennis" (sport — no "the").\nWRONG: "I am at the home" (home — no "the").',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 620),

  ('countable_uncountable', 'noun', 'countability', 'Countable vs Uncountable Nouns',
   'Nouns that can/cannot be counted',
   'A2', 'Countable: can be singular/plural (book/books). Uncountable: cannot be counted (water, information, advice, furniture, luggage, news, research, knowledge).',
   'I have two books. (countable)\nI need some information. (uncountable — no plural)\nA piece of advice / an item of furniture / a piece of news.',
   'Indonesian: most nouns can be pluralized. Common errors:\nWRONG: "informations, furnitures, advices" (these are uncountable).\nUse: "a piece of X", "an item of X", "some X".',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 630),

  ('quantifiers', 'noun', 'quantifier', 'Quantifiers (much, many, few, little, some, any, a lot of)',
   'Words that show quantity',
   'A1', 'Much (uncountable, negative/question), many (countable, negative/question), some (positive statements, offers), any (negative, question), a lot of/lots of (all), few (countable, negative sense), little (uncountable, negative sense), a few (countable, positive sense), a little (uncountable, positive sense).',
   'I don''t have much money. (uncountable)\nHow many books do you have? (countable)\nThere are a few students in the class. (positive — some)\nThere is little hope. (negative — almost none)',
   'WRONG: "How much books" (countable).\nWRONG: "I have a little friends" (countable — use "a few").\nIndonesian: "beberapa" — translate based on countable/uncountable.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 640),

  ('possessives', 'noun', 'possessive', 'Possessives (''s, of, possessive pronouns)',
   'Showing ownership',
   'A1', '''s for people/animals (Tom''s car). Of for things (the roof of the house). Possessive pronouns: my, your, his, her, its, our, their. Possessive adjectives vs pronouns: my book / mine.',
   'Tom''s sister is a doctor.\nThe color of the sky is blue.\nThis is my book. That book is mine.',
   'WRONG: "Tom sister" (missing ''s).\nWRONG: "The book is my" (should be "mine" — pronoun without noun).',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'medium', 650),

-- ===========================================================================
-- SECTION 6: PRONOUNS
-- ===========================================================================

  ('pronouns_subject_object', 'pronoun', 'case', 'Subject vs Object Pronouns',
   'Pronouns in subject vs object position',
   'A1', 'Subject: I, you, he, she, it, we, they. Object: me, you, him, her, it, us, them.',
   'She invited me to the party. (object)\nI called him yesterday. (object)\nHe and I are friends. (subject — both subject form)\nBetween you and me, this is hard. (object — both object form)',
   'WRONG: "Me and him went to the store" → "He and I went to the store".\nWRONG: "Between you and I" → "Between you and me".\nIndonesian: "Saya dan dia" — but English uses subject form in compound subjects.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 700),

  ('pronoun_reference', 'pronoun', 'reference', 'Pronoun Reference (it, this, that, they)',
   'Pronouns must clearly refer to a specific noun',
   'B1', 'Pronoun must agree with its antecedent in number and gender. Ambiguous references are tested.',
   'Tom brought his laptop, but he forgot the charger. (he = Tom)\nThe students finished their exam. (their = students)\nThe committee announced its decision. (singular — committee is singular)',
   'Indonesian: "mereka" can be plural for any group. English distinguishes he/she/it/they.\nAmbiguous reference: "Tom met John on his birthday" — whose birthday?',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 710),

  ('relative_pronouns', 'pronoun', 'relative', 'Relative Pronouns (who, whom, whose, which, that)',
   'Connecting clauses with pronouns',
   'B1', 'Who (people, subject), whom (people, object — formal), whose (possession), which (things), that (defining only, both people and things).',
   'The man who lives next door is friendly. (subject — no comma)\nThe book which I bought is interesting. (object)\nThe person whose car was stolen called the police.\nThe movie that we watched was great. (defining)',
   'Indonesian: "yang" works for all. English distinguishes.\nWRONG: "The man which lives next door" → "who".\nWRONG: "The book who I bought" → "which/that".',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 720),

  ('relative_advanced', 'pronoun', 'relative', 'Reduced Relative Clauses (participle clauses)',
   'Shortening relative clauses',
   'B2', 'Active: who/which + verb → V-ing (the man who is sitting → the man sitting). Passive: which/that + be + V3 → V3 (the book that was written → the book written).',
   'The man sitting on the bench is my uncle. (who is sitting)\nThe book written by her is a bestseller. (which was written)\nThe students taking the exam must remain quiet.',
   'WRONG: "The man to sit on the bench" → "The man sitting".',
   '["TOEFL_IBT","IELTS"]', 'medium', 730),

  ('reflexive_pronouns', 'pronoun', 'reflexive', 'Reflexive Pronouns (myself, yourself, etc.)',
   'When subject and object are the same',
   'A2', 'myself, yourself, himself, herself, itself, ourselves, yourselves, themselves. Use when subject = object, after prepositions (look at myself), for emphasis (I myself did it).',
   'I hurt myself while cooking.\nShe taught herself to code.\nThey blamed themselves for the mistake.\nThe CEO himself answered my email.',
   'WRONG: "I hurt me" → "I hurt myself".\nIndonesian: "-sendiri" or "-diri" — overuse common. Only use reflexive when subject = object.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'medium', 740),

  ('one_ones', 'pronoun', 'substitute', '"One" and "Ones" as Pronoun Substitutes',
   'Avoiding repetition with pronoun substitutes',
   'B2', 'One/ones replaces a countable noun already mentioned. "The one" specifies a particular one.',
   'I prefer the red one. (the red car)\nThese cookies are better than the ones from yesterday.\nI have a red one and a blue one.',
   'Common in academic writing to avoid repetition.',
   '["TOEFL_IBT","IELTS"]', 'low', 750),

-- ===========================================================================
-- SECTION 7: ADJECTIVES AND ADVERBS
-- ===========================================================================

  ('comparative_superlative', 'adjective', 'comparison', 'Comparative and Superlative',
   'Comparing two or more things',
   'A1', 'One syllable: -er/-est (tall/taller/tallest). One syllable ending consonant-vowel-consonant: double last (big/bigger/biggest). Two syllables: -er/-est OR more/most (more beautiful). Three+ syllables: more/most (more intelligent). Irregular: good/better/best, bad/worse/worst, far/further/farthest, little/less/least, much/many/more/most.',
   'Tom is taller than Jerry.\nThis is the most interesting book I have read.\nShe is more intelligent than her brother.\nToday is worse than yesterday.',
   'WRONG: "more tall" (one syllable).\nWRONG: "intelligenter" (long adjective).\nIndonesian: "lebih" = more, "paling" = most. Don''t double up: WRONG "more taller" → "taller".',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 800),

  ('adjective_order', 'adjective', 'order', 'Adjective Order',
   'Royal order of adjectives',
   'B2', 'Order: opinion-size-age-shape-color-origin-material-purpose-noun. (OSASCOMP)\nI have a beautiful small old round red Italian leather bag.',
   'A beautiful big old house. (opinion-size-age)\nA new red sports car. (age-color-purpose)\nA nice Italian leather bag. (opinion-origin-material)',
   'Indonesian: urutan bebas. English punya aturan ketat.\nTest tip: when in doubt, "opinion + size + age + color" works for most cases.',
   '["TOEFL_IBT","IELTS"]', 'medium', 810),

  ('adverbs_position', 'adverb', 'position', 'Adverb Position',
   'Where to place adverbs of frequency, manner, time',
   'A1', 'Frequency: usually before main verb (I always eat breakfast), after "to be" (I am always late). Manner: after object (She sings beautifully). Time: end of sentence (I will go tomorrow).',
   'I always drink coffee in the morning.\nShe is never late.\nHe speaks English fluently.\nWe will meet tomorrow.',
   'WRONG: "I drink always coffee" (frequency before main verb).\nWRONG: "She is late never" (frequency after "to be" but misplaced).',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'medium', 820),

  ('comparative_constructions', 'adjective', 'comparison', 'Comparative Constructions (as...as, the more...the more)',
   'Special comparative structures',
   'B1', 'As + adjective + as (equality). Not as/so + adjective + as (inequality). The + comparative, the + comparative (proportional).',
   'She is as tall as her mother.\nThis book is not as interesting as that one.\nThe harder you study, the better your score will be.\nThe more you practice, the more you improve.',
   'Indonesian: "se-...se-" = "as...as".\nWRONG: "as more tall" → "as tall".',
   '["TOEFL_IBT","IELTS"]', 'medium', 830),

-- ===========================================================================
-- SECTION 8: CLAUSES AND SENTENCE TYPES
-- ===========================================================================

  ('noun_clauses', 'clause', 'noun', 'Noun Clauses (that, whether, wh-words)',
   'Clauses that function as nouns',
   'B1', 'That/wh-/whether + subject + verb. Acts as subject, object, or complement.',
   'That he succeeded surprised everyone. (subject)\nI believe that she is honest. (object)\nThe question is whether we can afford it. (complement)\nWhat he said was unclear.',
   'Tested in complex reading passages.',
   '["TOEFL_IBT","IELTS"]', 'medium', 900),

  ('reported_speech', 'clause', 'reported', 'Reported Speech (Indirect Speech)',
   'Reporting what someone said without quoting',
   'B1', 'Backshift tenses: present→past, past→past perfect, will→would, can→could. Time/place changes: now→then, today→that day, here→there, tomorrow→the next day.',
   '"I am tired" → He said (that) he was tired.\n"I will call you" → She said she would call me.\n"I have finished" → He said he had finished.\n"I saw her yesterday" → He said he had seen her the day before.',
   'WRONG: "He said me he was tired" → "He told me he was tired" (use tell + person).\nIndonesian: "dia bilang" (say) vs "dia cerita ke saya" (tell me).',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 910),

  ('passive_reporting', 'clause', 'reported', 'Passive Reporting Verbs',
   'Using passive to report actions',
   'B2', 'Subject + is/are + said/believed/reported/known + to + verb. Use to avoid mentioning the source.',
   'He is said to be very rich. (People say he is rich.)\nThe company is believed to have moved abroad.\nShe is known to have graduated from Harvard.',
   'Common in academic writing.',
   '["TOEFL_IBT","IELTS"]', 'medium', 920),

  ('subjunctive', 'clause', 'subjunctive', 'Subjunctive Mood',
   'Verb form for hypotheticals, suggestions, demands',
   'C1', 'Use base form (no -s) after: suggest/recommend/insist/demand/require that + subject + base verb. Also: If I were (formal), It is essential that he be (formal).',
   'I suggest that he study harder. (not "studies")\nThe doctor recommended that she take the medicine.\nIt is vital that every student be prepared. (formal subjunctive)\nIf I were you, I would go. (formal)',
   'Rarely tested directly but appears in advanced writing.',
   '["TOEFL_IBT","IELTS"]', 'low', 930),

  ('parallel_structure', 'syntax', 'parallel', 'Parallel Structure',
   'Using same grammatical form in lists and comparisons',
   'B1', 'Use same form: noun-noun-noun, verb-verb-verb, to + verb - to + verb - to + verb.',
   'I like reading, writing, and painting. (gerund)\nShe wants to study, to work, and to travel. (to + verb)\nThe job requires patience, skill, and experience. (noun)',
   'WRONG: "I like reading, writing, and to paint" → all gerunds.\nHeavily tested in TOEFL ITP and TOEIC.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 1000),

  ('inversion', 'syntax', 'inversion', 'Inversion (Question, Negative Adverbials)',
   'Inverting subject and auxiliary for emphasis or after negative adverbs',
   'C1', 'After negative/restricted adverbs (never, rarely, seldom, hardly, not only, no sooner), invert: Never have I seen such beauty.',
   'Never have I seen such a beautiful sunset.\nNot only is she smart, but she is also kind.\nHardly had I arrived when the phone rang.\nUnder no circumstances should you open this door.',
   'Advanced. Tested in TOEFL iBT reading passages.',
   '["TOEFL_IBT","IELTS"]', 'low', 1010),

  ('cleft_sentences', 'syntax', 'cleft', 'Cleft Sentences (It is...that / What...is)',
   'For emphasis on specific parts of a sentence',
   'C1', 'It + be + emphasized + who/that/which + clause. OR What + clause + be + emphasized.',
   'It was John who broke the window. (emphasizes John)\nWhat I need is a vacation. (emphasizes the subject)\nIt is in Jakarta that she grew up. (emphasizes place)',
   'Advanced emphasis structure. Common in academic writing.',
   '["TOEFL_IBT","IELTS"]', 'low', 1020),

  ('reduced_clauses', 'syntax', 'reduction', 'Reduced Adverbial Clauses',
   'Shortening adverb clauses when subject is shared',
   'B2', 'When/while/if/because/although + subject + verb → when/while/if/because/although + V-ing (or having + V3 for perfect). If the subject is the same as the main clause.',
   'While walking to school, I saw a dog. (While I was walking)\nHaving finished the exam, she left. (After she had finished)\nIf given the chance, I would travel the world. (If I were given)\nAlthough tired, he kept working. (Although he was tired)',
   'Very common in academic writing. Tested in TOEFL writing rubrics.',
   '["TOEFL_IBT","IELTS"]', 'high', 1030),

  ('participial_phrases', 'syntax', 'reduction', 'Participial Phrases (V-ing at sentence start)',
   'V-ing and V3 phrases as sentence openers',
   'B2', 'V-ing (active) or having + V3 (active perfect) or V3 (passive) at the start of a sentence, modifying the subject.',
   'Walking to school, I met my friend. (V-ing)\nHaving eaten lunch, we went for a walk. (having V3)\nBuilt in 1900, the house is very old. (V3 passive)\nTaken regularly, the medicine is effective.',
   'Subject of main clause must be the doer/receiver of the participle.\nWRONG: "Walking to school, the rain started" (rain doesn''t walk).',
   '["TOEFL_IBT","IELTS"]', 'high', 1040),

-- ===========================================================================
-- SECTION 9: PREPOSITIONS AND CONJUNCTIONS
-- ===========================================================================

  ('prepositions_time', 'preposition', 'time', 'Prepositions of Time (in, on, at, by, for, since, during, from...to)',
   'Time prepositions',
   'A1', 'In (months, years, centuries, morning/afternoon/evening). On (days, dates). At (times, night, weekend). By (before a deadline). For (duration). Since (starting point). From...to/until (range). During (within a period).',
   'In July, in 2025, in the morning.\nOn Monday, on July 4th.\nAt 3 PM, at night.\nI have lived here for 5 years. (duration)\nI have lived here since 2020. (starting point)\nDuring the meeting, the phone rang.',
   'Indonesian: "di" — but English distinguishes "in" (inside time) and "on" (surface day).\nWRONG: "I will come in Monday" → "on Monday".',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 1100),

  ('prepositions_place', 'preposition', 'place', 'Prepositions of Place (in, on, at, by, between, among, under, over)',
   'Place prepositions',
   'A1', 'In (inside), on (surface), at (point/location), by (next to), between (two), among (more than two), under (below), over (above), above (higher, not touching), below (lower, not touching).',
   'The book is on the table.\nShe lives in Jakarta.\nMeet me at the station.\nThe bank is by the post office.\nThe cat is under the chair.',
   'WRONG: "She lives at Jakarta" → "in Jakarta" (city = in).\nWRONG: "The book is in the table" → "on the table" (surface).',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 1110),

  ('prepositions_movement', 'preposition', 'movement', 'Prepositions of Movement (to, from, into, out of, across, through, along, around)',
   'Direction and movement prepositions',
   'A2', 'To (destination), from (origin), into (inside motion), out of (exit), across (surface crossing), through (inside crossing), along (following a line), around (circular), up/down (vertical), past (next to and beyond).',
   'She walked to the door.\nHe jumped into the pool.\nWe drove through the tunnel.\nThe bird flew across the sky.\nThey walked along the beach.',
   'Indonesian: "ke" (to) "dari" (from) — but English has more options.\nWRONG: "I go to Jakarta in Tuesday" → "I go to Jakarta on Tuesday".',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 1120),

  ('linking_words', 'conjunction', 'addition', 'Linking Words: Addition (and, also, moreover, furthermore, in addition, besides, as well as)',
   'Words and phrases that add information',
   'B1', 'And (basic), also (mid-sentence), as well as (after noun), in addition (formal), moreover (formal), furthermore (formal), besides (informal).',
   'I like tea. Also, I love coffee.\nShe speaks French. In addition, she is learning German.\nThe hotel is expensive. Moreover, it is far from the center.\nHe is smart. Besides, he works hard.',
   'Indonesian: "dan", "juga", "selain itu" — same idea but English word order matters.\n"Besides" usually goes at sentence start, not mid-sentence.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 1200),

  ('linking_contrast', 'conjunction', 'contrast', 'Linking Words: Contrast (but, however, although, though, even though, whereas, while, on the other hand, nevertheless, nonetheless)',
   'Words and phrases showing contrast',
   'B1', 'But (informal), however (formal mid-sentence, comma before), although/though/even though (subordinating), whereas/while (compare two things), on the other hand (compare), nevertheless/nonetheless (despite).',
   'I studied hard. However, I failed.\nAlthough it rained, we went out.\nShe is outgoing, whereas her brother is shy.\nThe test was hard. Nevertheless, she passed.',
   'Indonesian: "tapi", "namun", "walaupun" — be careful with word position.\nWRONG: "However I studied hard, I failed" → "Although I studied hard, I failed".',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 1210),

  ('linking_cause_effect', 'conjunction', 'cause', 'Linking Words: Cause & Effect (because, since, as, due to, because of, therefore, consequently, as a result, so, hence)',
   'Words and phrases showing cause/effect',
   'A2', 'Because/since/as (cause clauses, mid-sentence), because of/due to (prepositions, before noun phrase), therefore/consequently/hence (effect, start of sentence), as a result (start of sentence), so (informal mid-sentence).',
   'I was late because the bus was delayed.\nDue to the rain, the match was canceled.\nHe studied hard. Therefore, he passed.\nShe is rich. As a result, she travels often.',
   'WRONG: "Because the rain, we stayed home" → "Because of the rain" or "Because it rained".\n"Therefore" starts a sentence; "because" is a connector.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 1220),

  ('linking_purpose', 'conjunction', 'purpose', 'Linking Words: Purpose (to, in order to, so as to, for, so that, in case)',
   'Words and phrases showing purpose',
   'B1', 'To/in order to/so as to (before verb, same subject), for + noun, so that (different subjects possible), in case (preparation for possibility).',
   'I went to the bank to withdraw money. (same subject)\nShe studies hard so that she can pass. (different subjects possible)\nBring an umbrella in case it rains.',
   'WRONG: "for to go" → "to go" or "in order to go".\nIndonesian: "untuk" — use "to" + verb, "for" + noun.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 1230),

  ('subordinators', 'conjunction', 'subordinator', 'Subordinators (because, although, when, while, if, since, as, after, before, until, as soon as)',
   'Words that introduce dependent clauses',
   'A2', 'Subordinators connect dependent + main clause. Often: because (cause), although (contrast), when/while (time), if (condition), since (time/cause), after/before (time), until (time), as (reason/manner), as soon as (immediate time).',
   'I was reading when the phone rang.\nStay here until I come back.\nAs soon as he arrived, we left.\nShe cried because she was sad.',
   'Indonesian: complex subordinates exist but word order differs. Use comma if subordinate comes first.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 1240),

-- ===========================================================================
-- SECTION 10: WORD FORMATION AND VOCABULARY
-- ===========================================================================

  ('word_formation', 'word_formation', 'general', 'Word Formation (prefixes, suffixes, compounds)',
   'Building words from base forms',
   'B1', 'Common prefixes: un-, in-/im-/il-/ir-, re-, pre-, post-, anti-, non-, dis-, mis-, over-, under-. Common suffixes: -tion/-sion (noun), -ment (noun), -ness (noun), -ity (noun), -able/-ible (adj), -al (adj), -ful (adj), -less (adj), -ly (adv), -ize/-ise (verb), -en (verb), -ify (verb).',
   'happy → unhappy (prefix)\ndecide → decision (suffix)\nuse → useless, useful, user, usage, reuse\nchild → childish, childhood, childlike\nbeauty → beautiful, beautify, beautician',
   'Indonesian: many words borrowed from English with different forms. Be careful with spelling.\nWRONG: "decission" (correct: "decision").',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 1300),

  ('prefixes_negation', 'word_formation', 'prefix', 'Negation Prefixes (un-, in-, dis-, non-, mis-, anti-)',
   'Prefixes that negate or oppose',
   'A2', 'Un- (most adjectives: unhappy, unfair). In-/im-/il-/ir- (Latin: incorrect, impossible, illegal, irregular). Dis- (verbs/dislike, disagree). Non- (nouns/adjectives: nonverbal, nonfiction). Mis- (verbs: misunderstand, misspell). Anti- (against: antisocial, antibiotic).',
   'Happy → unhappy\nPossible → impossible\nLegal → illegal\nRegular → irregular\nAgree → disagree\nVerbal → nonverbal',
   'Indonesian: "tidak", "bukan" — but English uses prefixes.\nWRONG: "inlegal" → "illegal".\nWRONG: "unpossible" → "impossible".',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 1310),

  ('phrasal_verbs', 'vocabulary', 'phrasal', 'Phrasal Verbs (high-frequency)',
   'Verb + particle combinations with idiomatic meaning',
   'B2', 'Phrasal verbs are verb + preposition/adverb. Often have idiomatic meaning. Top 50 most tested in TOEIC/IELTS.',
   'Put off (postpone), look forward to (anticipate), get along (have good relationship), take over (assume control), figure out (understand), break down (stop functioning), come up with (propose), give up (quit), run out of (exhaust), look into (investigate), put up with (tolerate), set up (establish), turn down (reject), bring up (mention/raise), call off (cancel), check in (register at hotel/airport), check out (leave hotel), count on (rely on), deal with (handle), depend on (rely on), find out (discover), get over (recover from), go over (review), hand in (submit), keep up with (maintain pace), look after (take care of), make up (invent/reconcile), pick up (collect/learn casually), pull off (succeed at something difficult), show up (appear), stand for (represent), take after (resemble parent), try out (test), work out (exercise/figure out).',
   'Phrasal verbs are critical for TOEIC (high frequency in Part 3-7), IELTS, and TOEFL.\nIndonesian: often translated literally. Must memorize meaning.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 1400),

  ('collocations', 'vocabulary', 'collocation', 'Collocations (natural word combinations)',
   'Words that naturally go together',
   'B2', 'Common collocations: make a decision (NOT do a decision), take a photo (NOT make a photo), heavy rain (NOT strong rain), fast food (NOT quick food), strong coffee (NOT powerful coffee), do homework (NOT make homework), make a mistake (NOT do a mistake), pay attention (NOT give attention), take a break (NOT have a break).',
   'Make: a decision, a mistake, a difference, progress, an effort, money, sense\nTake: a break, a photo, a look, a shower, a nap, notes, responsibility, action\nDo: homework, business, research, a job, a favor, exercise, housework, damage\nHave: a meeting, a conversation, breakfast/lunch/dinner, a shower, a look, fun, a good time',
   'Indonesian: belajar collocations dari konteks, bukan translate.\nTested heavily in TOEIC Part 5-7 and IELTS writing.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 1410),

  ('academic_word_list', 'vocabulary', 'academic', 'Academic Word List (AWL)',
   '570 most frequent words in academic texts',
   'B2', 'AWL by Averil Coxhead: 570 word families covering 10% of academic words. Critical for TOEFL iBT and IELTS Academic.',
   'analyze, approach, area, assess, assume, available, benefit, concept, consist, constitute, context, contract, create, data, define, derive, distribute, economy, environment, establish, estimate, evaluate, factor, feature, final, formula, function, identify, indicate, individual, interpret, involve, issue, labor, legal, legislation, major, method, occur, percent, period, policy, principle, proceed, process, range, region, regulate, relevant, require, research, resource, response, role, section, sector, significant, similar, source, specific, structure, theory, vary,',
   'AWL is the highest-impact vocabulary list for academic English. Master 100+ for TOEFL 80+, 200+ for IELTS 7+.',
   '["TOEFL_IBT","IELTS"]', 'high', 1420),

-- ===========================================================================
-- SECTION 11: PUNCTUATION
-- ===========================================================================

  ('comma_usage', 'punctuation', 'comma', 'Comma Usage',
   'When to use commas',
   'A2', 'Use commas for: 1) lists (A, B, and C), 2) coordinating conjunctions joining independent clauses (I went home, and I ate.), 3) introductory phrases (After class, I went home.), 4) non-defining relative clauses (Tom, who is 30, lives here.), 5) addresses, 6) direct address.',
   'I bought apples, oranges, and bananas.\nI studied hard, but I still failed.\nAfter the meeting, we had lunch.\nMy friend, who lives in London, called me.',
   'Indonesian: penggunaan koma lebih longgar. English punya aturan jelas.\nWRONG: "I bought apples, oranges and bananas" (Oxford comma is required in formal English: A, B, and C).',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'medium', 1500),

  ('semicolon_colon', 'punctuation', 'semicolon', 'Semicolons and Colons',
   'Connecting related independent clauses or introducing lists',
   'B1', 'Semicolon: join 2 related independent clauses without a conjunction. Colon: introduce a list, explanation, or quote after a complete sentence.',
   'I love reading; my sister prefers sports. (semicolon)\nWe need three things: time, money, and effort. (colon)\nThe answer is clear: yes. (colon after complete sentence)',
   'WRONG: "I love reading, my sister prefers sports" (comma splice — use semicolon or conjunction).',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'medium', 1510),

  ('apostrophe', 'punctuation', 'apostrophe', 'Apostrophes (possession and contractions)',
   'Showing possession or contractions',
   'A1', 'Possession: ''s for singular (Tom''s car), s'' for plural ending in s (the students'' books), of-phrase for things (the roof of the house). Contractions: I am → I''m, do not → don''t.',
   'Tom''s laptop. (singular)\nThe students'' books. (plural)\nIt''s raining. (It is)\nDon''t worry. (Do not)',
   'WRONG: "Tom''s laptop" for plural — should be "The students'' laptops".\nWRONG: "Its raining" (its = possessive; it''s = it is).',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'medium', 1520),

-- ===========================================================================
-- SECTION 12: SUBJECT-VERB AGREEMENT & ADVANCED SYNTAX
-- ===========================================================================

  ('sv_agreement', 'syntax', 'agreement', 'Subject-Verb Agreement',
   'Verb must agree with subject in number',
   'A1', 'Singular subject → singular verb. Plural subject → plural verb. Be careful with: subjects separated by "or" (Tom or his friends ARE), indefinite pronouns (everyone, somebody = singular), collective nouns, subject after verb, relative clauses.',
   'He works hard. (singular)\nThey work hard. (plural)\nEveryone is here. (singular)\nThe book that I bought is interesting. (book = singular)\nNeither Tom nor his friends are coming.',
   'Indonesian: kata kerja tidak berubah bentuk. English: -s for singular.\nWRONG: "He work" → "He works".\nIndonesian: "Buku yang saya beli menarik" — book is singular in English.',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 1600),

  ('indefinite_pronouns', 'pronoun', 'indefinite', 'Indefinite Pronouns (everyone, somebody, nothing, etc.)',
   'Pronouns that refer to non-specific things — all singular',
   'A2', 'Singular: everyone, everybody, everything, someone, somebody, something, anyone, anybody, anything, no one, nobody, nothing, each, either, neither, one. Plural: both, few, many, several, others.',
   'Everyone is welcome. (singular verb)\nNobody knows the answer. (singular verb)\nIs there anything I can do? (singular)\nFew students passed. (plural verb)',
   'WRONG: "Everyone are here" → "Everyone is here".\nIndonesian: "semua orang" (plural in Indonesian) but singular in English.',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 1610),

  ('there_is_are', 'syntax', 'existential', '"There is / There are" (Existential)',
   'Introducing existence or presence',
   'A1', 'There is + singular/uncountable. There are + plural. Use of/with to show possession/contents.',
   'There is a book on the table.\nThere are many students in class.\nThere is no time to waste.\nThere is a man with a red hat.',
   'WRONG: "There are a book" → "There is a book".\nWRONG: "There is many students" → "There are many students".',
   '["TOEFL_IBT","TOEFL_ITP","TOEIC","IELTS"]', 'high', 1620),

  ('it_expletive', 'syntax', 'expletive', '"It" as a Dummy Subject (Weather, Time, Distance)',
   'Using "it" when no real subject',
   'A2', 'It is + adjective + to + verb (It is important to study). It is raining. It is 3 o''clock. It is 10 km to the station.',
   'It is important to learn English.\nIt is raining heavily.\nIt is 3 o''clock in the afternoon.\nIt is 100 km from here to Bandung.',
   'Indonesian: tidak ada "it" ekspletif. Translasi langsung: "Penting untuk belajar" — but English needs "It is important to..."',
   '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'medium', 1630)
