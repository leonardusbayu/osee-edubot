-- ═══════════════════════════════════════════════════════
-- PRONUNCIATION BANK SEED DATA — EXPANSION PACK
-- Additional 200+ entries for comprehensive coverage
-- ═══════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────
-- CATEGORY 1 EXPANSION: MORE TH SOUNDS
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('math', '/mæθ/', 'th_sounds', 'voiceless_th', 'beginner', 'ALL', 'noun', 'Math skills are essential for data analysis.', 'TH di akhir jadi "s" atau "t"', 'Akhiri dengan lidah di antara gigi: MATH bukan "mas" atau "mat".'),
('bath', '/bɑːθ/', 'th_sounds', 'voiceless_th', 'beginner', 'ALL', 'noun', 'The bath water was too hot.', 'Diucapkan "bat" atau "bas"', 'TH di akhir — lidah harus tetap di antara gigi.'),
('both', '/bəʊθ/', 'th_sounds', 'voiceless_th', 'beginner', 'ALL', 'pronoun', 'Both answers are correct.', 'Diucapkan "bot"', 'BOHTH — TH harus terdengar jelas di akhir.'),
('healthy', '/ˈhelθi/', 'th_sounds', 'voiceless_th', 'intermediate', 'ALL', 'adjective', 'A healthy diet is important.', 'TH jadi "t": "helti"', 'HEL-thee. TH di tengah tetap harus jelas.'),
('wealthy', '/ˈwelθi/', 'th_sounds', 'voiceless_th', 'intermediate', 'IELTS', 'adjective', 'Wealthy nations have more resources.', 'TH jadi "t"', 'WEL-thee. Sama polanya dengan healthy.'),
('anything', '/ˈeniθɪŋ/', 'th_sounds', 'voiceless_th', 'beginner', 'ALL', 'pronoun', 'Is there anything else you need?', 'TH di tengah hilang', 'EN-ee-thing. TH harus jelas.'),
('whether', '/ˈweðər/', 'th_sounds', 'voiced_th', 'intermediate', 'ALL', 'conjunction', 'Whether or not you agree, the data is clear.', 'Disamakan dengan "weather"', 'WEDH-er. Voiced TH. Bunyi sama dengan "weather"!'),
('breathe', '/briːð/', 'th_sounds', 'voiced_th', 'intermediate', 'ALL', 'verb', 'Take a moment to breathe deeply.', 'Disamakan dengan "breath" (noun)', 'BREEDH (verb, voiced TH) vs BRETH (noun, voiceless TH).'),
('smooth', '/smuːð/', 'th_sounds', 'voiced_th', 'intermediate', 'ALL', 'adjective', 'The transition was smooth.', 'TH di akhir jadi "t"', 'SMOODH — voiced TH di akhir, pita suara bergetar.'),
('within', '/wɪˈðɪn/', 'th_sounds', 'voiced_th', 'intermediate', 'ALL', 'preposition', 'Within the next five minutes.', 'TH jadi "d": "widin"', 'wi-THIN. Voiced TH di tengah.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 2 EXPANSION: MORE VOWEL PAIRS + DIPHTHONGS
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('bit', '/bɪt/', 'vowel_pairs', 'short_i', 'beginner', 'ALL', 'noun', 'A bit of patience is needed.', 'Vokal terlalu panjang → "beat"', 'Pendek: BIT. Mulut rileks.'),
('beat', '/biːt/', 'vowel_pairs', 'long_ee', 'beginner', 'ALL', 'verb', 'She beat the record by two points.', 'Vokal terlalu pendek → "bit"', 'Panjang: BEET. Bibir ditarik ke samping.'),
('pull', '/pʊl/', 'vowel_pairs', 'short_u', 'beginner', 'ALL', 'verb', 'Pull the door handle.', 'Disamakan dengan "pool"', '/ʊ/ pendek — bibir agak bulat tapi rileks.'),
('pool', '/puːl/', 'vowel_pairs', 'long_oo', 'beginner', 'ALL', 'noun', 'The swimming pool was closed.', 'Disamakan dengan "pull"', '/uː/ panjang — bibir sangat bulat dan maju.'),
('hat', '/hæt/', 'vowel_pairs', 'short_a', 'beginner', 'ALL', 'noun', 'She wore a hat to the exam.', 'Vokal jadi /ʌ/ → "hut"', '/æ/ — mulut terbuka lebar. Beda dari "hut" (/hʌt/).'),
('hut', '/hʌt/', 'vowel_pairs', 'short_u_schwa', 'beginner', 'ALL', 'noun', 'They built a hut near the river.', 'Vokal jadi /æ/ → "hat"', '/ʌ/ — mulut setengah terbuka, bunyi netral.'),
('mate', '/meɪt/', 'vowel_pairs', 'diphthong_ei', 'beginner', 'ALL', 'noun', 'My classmate helped me study.', 'Vokal jadi /e/ → "met"', '/eɪ/ — diphthong, mulai dari /e/ bergerak ke /ɪ/.'),
('met', '/met/', 'vowel_pairs', 'short_e', 'beginner', 'ALL', 'verb', 'I met her at the conference.', 'Vokal jadi /eɪ/ → "mate"', '/e/ — pendek, mulut agak terbuka. Beda dari "mate".'),
('note', '/nəʊt/', 'vowel_pairs', 'diphthong_ou', 'beginner', 'ALL', 'noun', 'Take note of the key points.', 'Vokal jadi /ɒ/ → "not"', '/əʊ/ — diphthong, dari /ə/ bergerak ke /ʊ/.'),
('not', '/nɒt/', 'vowel_pairs', 'short_o', 'beginner', 'ALL', 'adverb', 'This is not the correct answer.', 'Vokal jadi /əʊ/ → "note"', '/ɒ/ — pendek, mulut bulat. Sangat beda dari "note"!'),
('coat', '/kəʊt/', 'vowel_pairs', 'diphthong_ou', 'beginner', 'ALL', 'noun', 'Wear a coat when it is cold.', 'Vokal jadi /ɒ/ → "cot"', '/əʊ/ — KOHT. Diphthong panjang.'),
('cot', '/kɒt/', 'vowel_pairs', 'short_o', 'beginner', 'ALL', 'noun', 'The baby slept in a cot.', 'Disamakan dengan "coat"', '/ɒ/ — KOT. Pendek dan bulat.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 3 EXPANSION: WORD STRESS — MORE PAIRS + ACADEMIC
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('increase', '/ˈɪnkriːs/', 'word_stress', 'noun_verb_shift', 'intermediate', 'TOEIC', 'noun', 'There was an increase in sales.', 'Stress sama untuk noun dan verb', 'IN-crease (noun). in-CREASE (verb). Pattern: noun=depan, verb=belakang.'),
('contract', '/ˈkɒntrækt/', 'word_stress', 'noun_verb_shift', 'intermediate', 'TOEIC', 'noun', 'Sign the contract before the deadline.', 'Tidak shift stress', 'KON-tract (noun). kun-TRACT (verb).'),
('permit', '/ˈpɜːrmɪt/', 'word_stress', 'noun_verb_shift', 'intermediate', 'TOEIC', 'noun', 'You need a work permit.', 'Tidak shift stress', 'PUR-mit (noun: izin). pur-MIT (verb: mengizinkan).'),
('object', '/ˈɒbdʒekt/', 'word_stress', 'noun_verb_shift', 'intermediate', 'TOEFL_IBT', 'noun', 'The object was found in the ruins.', 'Stress sama', 'OB-ject (noun: benda). ob-JECT (verb: keberatan).'),
('produce', '/ˈprɒdjuːs/', 'word_stress', 'noun_verb_shift', 'intermediate', 'ALL', 'noun', 'Fresh produce is available at the market.', 'Tidak shift stress', 'PROD-yoos (noun: hasil). pruh-DYOOS (verb: menghasilkan).'),
('university', '/ˌjuːnɪˈvɜːrsɪti/', 'word_stress', 'academic', 'intermediate', 'IELTS', 'noun', 'She graduated from a prestigious university.', 'Penekanan di suku pertama: "U-ni-ver-si-ty"', 'yoo-ni-VUR-si-tee. Penekanan di suku KETIGA.'),
('examination', '/ɪɡˌzæmɪˈneɪʃn/', 'word_stress', 'academic', 'intermediate', 'TOEFL_IBT', 'noun', 'The examination took three hours.', 'Penekanan di "exam"', 'ig-zam-i-NAY-shun. Penekanan di suku KEEMPAT.'),
('responsibility', '/rɪˌspɒnsəˈbɪləti/', 'word_stress', 'academic', 'advanced', 'IELTS', 'noun', 'It is our responsibility to protect the environment.', 'Penekanan salah', 'ri-spon-suh-BIL-i-tee. Penekanan di suku KEEMPAT.'),
('characterize', '/ˈkærəktəraɪz/', 'word_stress', 'academic', 'advanced', 'TOEFL_IBT', 'verb', 'How would you characterize the results?', 'Diucapkan "karakterisasi"', 'KAR-uk-tuh-ryze. Penekanan di suku PERTAMA.'),
('differentiate', '/ˌdɪfəˈrenʃieɪt/', 'word_stress', 'academic', 'advanced', 'TOEFL_IBT', 'verb', 'It is important to differentiate between the two.', 'Penekanan salah', 'dif-uh-REN-shee-ayt. Penekanan di suku KETIGA.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 4 EXPANSION: MORE FINAL CONSONANTS + CLUSTERS
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('stopped', '/stɒpt/', 'final_consonants', 'ed_endings', 'beginner', 'ALL', 'verb', 'The experiment was stopped early.', 'Diucapkan "stop-ped" 2 suku', 'STOPT — satu suku kata. Setelah /p/, -ed = /t/.'),
('changed', '/tʃeɪndʒd/', 'final_consonants', 'ed_endings', 'beginner', 'ALL', 'verb', 'The policy has changed significantly.', 'Diucapkan "change-ed"', 'CHAINJD — satu suku kata. Setelah voiced, -ed = /d/.'),
('created', '/kriˈeɪtɪd/', 'final_consonants', 'ed_endings', 'beginner', 'ALL', 'verb', 'The team created a new solution.', 'Diucapkan "create" tanpa -ed', 'kree-AY-tid — 3 suku kata. Setelah /t/, -ed = /ɪd/.'),
('discussed', '/dɪˈskʌst/', 'final_consonants', 'ed_endings', 'intermediate', 'ALL', 'verb', 'The topic was discussed in class.', 'Diucapkan "discuss-ed"', 'di-SKUST — -ed setelah /s/ = /t/. Cluster /st/ di akhir.'),
('established', '/ɪˈstæblɪʃt/', 'final_consonants', 'ed_endings', 'advanced', 'IELTS', 'verb', 'The organization was established in 1995.', 'Diucapkan "establish-ed"', 'i-STAB-lisht. Cluster /ʃt/ di akhir.'),
('desks', '/desks/', 'final_consonants', 'clusters', 'intermediate', 'ALL', 'noun', 'The desks were arranged in rows.', 'K atau S hilang', 'DESKS — cluster /sks/ harus lengkap.'),
('tasks', '/tɑːsks/', 'final_consonants', 'clusters', 'intermediate', 'TOEIC', 'noun', 'Complete all tasks by end of day.', 'S akhir hilang', 'TASKS — cluster /sks/. Penting di TOEIC context.'),
('texts', '/teksts/', 'final_consonants', 'clusters', 'advanced', 'ALL', 'noun', 'Academic texts require careful reading.', 'Cluster terlalu sulit, huruf hilang', 'TEKSTS — cluster /ksts/ sangat sulit. Latih pelan.'),
('sixths', '/sɪksθs/', 'final_consonants', 'clusters', 'advanced', 'ALL', 'noun', 'Five sixths of the participants agreed.', 'Hampir tidak mungkin buat non-native', 'SIKSTHS — cluster /ksθs/. Salah satu tersulit di English.'),
('clothes', '/kləʊðz/', 'final_consonants', 'voiced_final', 'intermediate', 'ALL', 'noun', 'Change your clothes before the interview.', 'Diucapkan "clot-hes" (2 suku kata)', 'KLOHDHZ — satu suku kata! TH voiced + Z.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 5 EXPANSION: MORE R/L + W/V SOUNDS
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('correct', '/kəˈrekt/', 'r_and_l', 'medial_r', 'intermediate', 'ALL', 'adjective', 'Your answer is correct.', 'R di tengah terlalu lemah', 'kuh-REKT. R jelas di tengah kata.'),
('collect', '/kəˈlekt/', 'r_and_l', 'medial_l', 'intermediate', 'ALL', 'verb', 'We need to collect more data.', 'L dan R tercampur', 'kuh-LEKT. L sentuh gusi, beda dari R di "correct".'),
('role', '/rəʊl/', 'r_and_l', 'minimal_pair_rl', 'intermediate', 'ALL', 'noun', 'What role does technology play?', 'Disamakan dengan "roll"', 'ROHL. Bunyi sama dengan "roll" tapi beda makna.'),
('election', '/ɪˈlekʃn/', 'r_and_l', 'medial_l', 'intermediate', 'IELTS', 'noun', 'The election results were announced.', 'L terlalu lemah', 'i-LEK-shun. L jelas di suku kedua.'),
('religion', '/rɪˈlɪdʒən/', 'r_and_l', 'r_and_l_combo', 'intermediate', 'IELTS', 'noun', 'Religion is a sensitive topic.', 'R dan L keduanya lemah', 'ri-LIJ-un. R awal + L di suku kedua.'),
('relative', '/ˈrelətɪv/', 'r_and_l', 'r_and_l_combo', 'intermediate', 'ALL', 'noun', 'This is a relative improvement.', 'R dan L tercampur', 'REL-uh-tiv. R lalu langsung L.'),
('very', '/ˈveri/', 'w_and_v', 'v_sound', 'beginner', 'ALL', 'adverb', 'The results were very clear.', 'V jadi W: "wery"', 'VERI — gigi atas sentuh bibir bawah untuk /v/.'),
('west', '/west/', 'w_and_v', 'w_sound', 'beginner', 'ALL', 'noun', 'The wind blew from the west.', 'W jadi V: "vest"', 'WEST — bibir bulat, tidak ada kontak gigi. Beda dari "vest"!'),
('vine', '/vaɪn/', 'w_and_v', 'v_sound', 'beginner', 'ALL', 'noun', 'The vine grew over the wall.', 'V jadi W: "wine"', 'VINE — gigi atas + bibir bawah. Beda dari "wine" (bibir bulat).'),
('wine', '/waɪn/', 'w_and_v', 'w_sound', 'beginner', 'ALL', 'noun', 'They served wine at the reception.', 'W jadi V', 'WINE — bibir bulat, tanpa gigi. Beda dari "vine"!');

-- ───────────────────────────────────────────────────────
-- NEW CATEGORY 11: SCHWA SOUND /ə/
-- The most common English vowel — often missed by learners
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('about', '/əˈbaʊt/', 'schwa_sound', 'initial_schwa', 'beginner', 'ALL', 'preposition', 'Tell me about your research.', 'Suku pertama terlalu jelas: "A-bout"', 'uh-BAUT. Suku pertama cuma "uh" lemah.'),
('today', '/təˈdeɪ/', 'schwa_sound', 'initial_schwa', 'beginner', 'ALL', 'adverb', 'The exam is today.', 'Diucapkan "TO-day" dengan O jelas', 'tuh-DAY. Suku pertama schwa lemah.'),
('banana', '/bəˈnɑːnə/', 'schwa_sound', 'multiple_schwa', 'beginner', 'ALL', 'noun', 'Eat a banana for energy.', 'Semua A dibaca sama', 'buh-NAH-nuh. Ada DUA schwa: suku 1 dan 3.'),
('support', '/səˈpɔːrt/', 'schwa_sound', 'initial_schwa', 'intermediate', 'ALL', 'verb', 'The data supports the hypothesis.', 'Diucapkan "su-PORT" dengan U jelas', 'suh-PORT. Suku pertama schwa.'),
('problem', '/ˈprɒbləm/', 'schwa_sound', 'final_schwa', 'beginner', 'ALL', 'noun', 'What is the problem?', 'E diucapkan jelas: "prob-LEM"', 'PROB-lum. Suku kedua schwa — hampir tidak terdengar.'),
('happen', '/ˈhæpən/', 'schwa_sound', 'final_schwa', 'beginner', 'ALL', 'verb', 'What did happen during the experiment?', 'E diucapkan jelas: "hap-PEN"', 'HAP-un. Suku kedua schwa.'),
('government', '/ˈɡʌvərnmənt/', 'schwa_sound', 'multiple_schwa', 'intermediate', 'IELTS', 'noun', 'The government announced new policies.', 'Semua vokal dibaca penuh', 'GUV-urn-munt. Schwa di suku 2 dan 3.'),
('economy', '/ɪˈkɒnəmi/', 'schwa_sound', 'medial_schwa', 'intermediate', 'IELTS', 'noun', 'The economy is recovering slowly.', 'O kedua diucapkan penuh', 'i-KON-uh-mee. Schwa di suku ketiga.'),
('necessary', '/ˈnesəsəri/', 'schwa_sound', 'multiple_schwa', 'intermediate', 'ALL', 'adjective', 'It is necessary to follow the procedure.', 'Semua vokal dibaca penuh', 'NES-uh-suh-ree. DUA schwa di tengah.'),
('consider', '/kənˈsɪdər/', 'schwa_sound', 'initial_schwa', 'intermediate', 'TOEFL_IBT', 'verb', 'Consider the following factors.', 'Diucapkan "con-SI-der" dengan O jelas', 'kun-SID-er. Suku pertama schwa + suku terakhir schwa.'),
('particular', '/pəˈtɪkjʊlər/', 'schwa_sound', 'multiple_schwa', 'intermediate', 'TOEFL_IBT', 'adjective', 'This particular finding is important.', 'Diucapkan "par-TI-ku-lar"', 'puh-TIK-yoo-lur. Schwa di suku 1 dan 4.'),
('administration', '/ədˌmɪnɪˈstreɪʃn/', 'schwa_sound', 'initial_schwa', 'advanced', 'TOEIC', 'noun', 'The administration approved the proposal.', 'A awal diucapkan penuh', 'ud-min-i-STRAY-shun. Schwa di suku pertama.');

-- ───────────────────────────────────────────────────────
-- NEW CATEGORY 12: CONFUSING HOMOPHONES
-- Same sound, different spelling/meaning
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('affect', '/əˈfekt/', 'homophones', 'affect_effect', 'intermediate', 'ALL', 'verb', 'Climate change will affect crop yields.', 'Disamakan dengan "effect"', 'uh-FEKT (verb). Beda: "effect" = i-FEKT (noun). A=aksi (verb), E=end result (noun).'),
('effect', '/ɪˈfekt/', 'homophones', 'affect_effect', 'intermediate', 'ALL', 'noun', 'The effect was statistically significant.', 'Disamakan dengan "affect"', 'i-FEKT (noun). Bunyi mirip tapi vokal awal BEDA dari "affect".'),
('accept', '/əkˈsept/', 'homophones', 'accept_except', 'intermediate', 'ALL', 'verb', 'I accept the invitation.', 'Disamakan dengan "except"', 'uk-SEPT. Bunyi mirip "except" tapi arti sangat beda!'),
('except', '/ɪkˈsept/', 'homophones', 'accept_except', 'intermediate', 'ALL', 'preposition', 'Everyone passed except one student.', 'Disamakan dengan "accept"', 'ik-SEPT. Vokal awal /ɪ/ bukan /ə/.'),
('principal', '/ˈprɪnsəpl/', 'homophones', 'principal_principle', 'intermediate', 'ALL', 'noun', 'The principal addressed the students.', 'Disamakan dengan "principle"', 'PRIN-suh-pul. Bunyi SAMA dengan "principle" tapi arti beda!'),
('there', '/ðeər/', 'homophones', 'there_their_theyre', 'beginner', 'ALL', 'adverb', 'There are three main factors.', 'Tidak bisa membedakan', 'THAIR — bunyi sama: there/their/they''re. Bedakan dari konteks.'),
('piece', '/piːs/', 'homophones', 'piece_peace', 'beginner', 'ALL', 'noun', 'Read this piece of text carefully.', 'Disamakan dengan "peace"', 'PEES — sama bunyinya dengan "peace". Bedakan dari konteks.'),
('stationary', '/ˈsteɪʃənəri/', 'homophones', 'stationary_stationery', 'intermediate', 'ALL', 'adjective', 'The object remained stationary.', 'Disamakan dengan "stationery"', 'STAY-shun-uh-ree. Bunyi sama, tapi -ary=diam, -ery=alat tulis.'),
('site', '/saɪt/', 'homophones', 'site_sight_cite', 'intermediate', 'TOEFL_IBT', 'noun', 'The research site was carefully selected.', 'Tidak tahu ini homophone', 'SYTE — 3 homophone: site (lokasi), sight (penglihatan), cite (mengutip).'),
('waste', '/weɪst/', 'homophones', 'waste_waist', 'beginner', 'ALL', 'noun', 'Do not waste your study time.', 'Tidak tahu ini homophone', 'WAYST — sama bunyinya dengan "waist" (pinggang).');

-- ───────────────────────────────────────────────────────
-- NEW CATEGORY 13: NUMBERS & DATES
-- Critical for TOEIC and IELTS Listening
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('thirteen', '/θɜːˈtiːn/', 'numbers_dates', 'teen_vs_ty', 'beginner', 'ALL', 'number', 'There are thirteen questions in this section.', 'Disamakan dengan "thirty"', 'thur-TEEN — stress di belakang. THIRTY = THUR-tee — stress di depan!'),
('thirty', '/ˈθɜːrti/', 'numbers_dates', 'teen_vs_ty', 'beginner', 'ALL', 'number', 'The exam lasts thirty minutes.', 'Disamakan dengan "thirteen"', 'THUR-tee — stress di DEPAN. Beda: thirteen = thur-TEEN (belakang).'),
('fourteen', '/fɔːˈtiːn/', 'numbers_dates', 'teen_vs_ty', 'beginner', 'ALL', 'number', 'Question fourteen is about main idea.', 'Disamakan dengan "forty"', 'for-TEEN — stress belakang. FORTY = FOR-tee — stress depan.'),
('forty', '/ˈfɔːrti/', 'numbers_dates', 'teen_vs_ty', 'beginner', 'ALL', 'number', 'The test has forty questions.', 'Disamakan dengan "fourteen"', 'FOR-tee — stress DEPAN. BUKAN "fourty" (salah spelling juga).'),
('fifteen', '/fɪfˈtiːn/', 'numbers_dates', 'teen_vs_ty', 'beginner', 'ALL', 'number', 'You have fifteen minutes left.', 'Disamakan dengan "fifty"', 'fif-TEEN — stress belakang. FIFTY = FIF-tee — stress depan.'),
('fifty', '/ˈfɪfti/', 'numbers_dates', 'teen_vs_ty', 'beginner', 'ALL', 'number', 'The score was fifty out of a hundred.', 'Disamakan dengan "fifteen"', 'FIF-tee — stress DEPAN. Kunci: -TEEN (belakang) vs -TY (depan).'),
('January', '/ˈdʒænjuəri/', 'numbers_dates', 'months', 'beginner', 'ALL', 'noun', 'The semester starts in January.', 'Diucapkan "Januari" seperti BI', 'JAN-yoo-uh-ree. Bukan "Ja-nu-a-ri".'),
('February', '/ˈfebruəri/', 'numbers_dates', 'months', 'beginner', 'ALL', 'noun', 'The deadline is February fifteenth.', 'R pertama hilang: "Febuary"', 'FEB-roo-uh-ree. R harus jelas setelah B!'),
('Wednesday', '/ˈwenzdeɪ/', 'numbers_dates', 'days', 'beginner', 'ALL', 'noun', 'The class meets every Wednesday.', 'Diucapkan 3 suku kata', 'WENZ-day. D pertama diam — 2 suku kata saja!'),
('eighth', '/eɪtθ/', 'numbers_dates', 'ordinals', 'intermediate', 'ALL', 'adjective', 'The eighth chapter covers methodology.', 'TH hilang: "eight"', 'AYTTH — T + TH di akhir. Cluster sulit!');

-- ───────────────────────────────────────────────────────
-- NEW CATEGORY 14: BUSINESS ENGLISH (TOEIC Focus)
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('receipt', '/rɪˈsiːt/', 'business_english', 'office', 'intermediate', 'TOEIC', 'noun', 'Please keep the receipt for reimbursement.', 'P dibunyikan', 'ri-SEET. P diam! Jangan "re-CEIPT".'),
('invoice', '/ˈɪnvɔɪs/', 'business_english', 'office', 'intermediate', 'TOEIC', 'noun', 'Send the invoice by end of day.', 'Diucapkan "in-voice" rata', 'IN-voys. Stress di suku pertama.'),
('budget', '/ˈbʌdʒɪt/', 'business_english', 'finance', 'intermediate', 'TOEIC', 'noun', 'The department exceeded its budget.', 'U jadi /u/: "boo-jet"', 'BUJ-it. /ʌ/ pendek, bukan /u/.'),
('revenue', '/ˈrevənjuː/', 'business_english', 'finance', 'intermediate', 'TOEIC', 'noun', 'Revenue increased by fifteen percent.', 'Diucapkan "re-ve-nu" rata', 'REV-uh-nyoo. Stress di suku PERTAMA.'),
('quarterly', '/ˈkwɔːrtərli/', 'business_english', 'finance', 'intermediate', 'TOEIC', 'adjective', 'The quarterly report is due next week.', 'Diucapkan "kwar-ter-li"', 'KWOR-tur-lee. QU = /kw/.'),
('merchandise', '/ˈmɜːrtʃəndaɪz/', 'business_english', 'retail', 'intermediate', 'TOEIC', 'noun', 'The merchandise was displayed attractively.', 'Diucapkan "mer-chan-dis"', 'MUR-chun-dyze. -dise = /daɪz/ bukan /dɪs/.'),
('warranty', '/ˈwɒrənti/', 'business_english', 'retail', 'intermediate', 'TOEIC', 'noun', 'The warranty covers parts and labor.', 'Diucapkan "war-ran-ty"', 'WOR-un-tee. Schwa di suku kedua.'),
('personnel', '/ˌpɜːrsəˈnel/', 'business_english', 'hr', 'intermediate', 'TOEIC', 'noun', 'All personnel must attend the training.', 'Disamakan dengan "personal"', 'pur-suh-NEL. Stress di suku TERAKHIR. Beda dari "personal" (PUR-suh-nul).'),
('colleague', '/ˈkɒliːɡ/', 'business_english', 'hr', 'intermediate', 'TOEIC', 'noun', 'Discuss with your colleague.', 'Diucapkan "ko-le-ag" 3 suku kata', 'KOL-eeg. DUA suku kata saja!'),
('itinerary', '/aɪˈtɪnərəri/', 'business_english', 'travel', 'advanced', 'TOEIC', 'noun', 'Please check the travel itinerary.', 'Diucapkan "i-ti-ne-ra-ri"', 'eye-TIN-uh-ruh-ree. 5 suku kata, stress di kedua.');

-- ───────────────────────────────────────────────────────
-- NEW CATEGORY 15: ACADEMIC PHRASES & COLLOCATIONS
-- Multi-word expressions tested in TOEFL/IELTS
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('in addition to', NULL, 'academic_phrases', 'addition', 'intermediate', 'TOEFL_IBT', 'phrase', 'In addition to the main study, a pilot was conducted.', 'Terlalu kaku kata per kata', '"in-uh-DISH-un-tuh" — menyatu, stress di "DISH".'),
('on the other hand', NULL, 'academic_phrases', 'contrast', 'intermediate', 'IELTS', 'phrase', 'On the other hand, the evidence suggests otherwise.', 'Diucapkan rata tanpa ritme', '"on-thee-OTHER-hand" — stress di "OTHER".'),
('as a result', NULL, 'academic_phrases', 'cause_effect', 'intermediate', 'ALL', 'phrase', 'As a result, the experiment was repeated.', 'Kata per kata tanpa linking', '"azuh-ri-ZULT" — linking: as_a → /azuh/.'),
('with regard to', NULL, 'academic_phrases', 'reference', 'intermediate', 'IELTS', 'phrase', 'With regard to the first point, I agree.', 'Diucapkan "with re-gard to" rata', '"with-ri-GARD-tuh" — stress di "GARD".'),
('for instance', NULL, 'academic_phrases', 'example', 'intermediate', 'ALL', 'phrase', 'For instance, many students struggle with pronunciation.', 'Diucapkan "for in-stan-ce" 4 suku kata', '"frin-stuns" — sangat contracted: for_instance → /frɪnstəns/.'),
('it is worth noting that', NULL, 'academic_phrases', 'emphasis', 'advanced', 'TOEFL_IBT', 'phrase', 'It is worth noting that the sample size was small.', 'Terlalu lambat dan kaku', '"it-swurth-NOHT-ing-that" — linking is_worth → /swɜːθ/.'),
('to a certain extent', NULL, 'academic_phrases', 'hedging', 'advanced', 'IELTS', 'phrase', 'To a certain extent, the theory holds true.', 'Diucapkan kata per kata', '"tuh-uh-SUR-tun-ik-STENT" — stress di "SUR" dan "STENT".'),
('according to', NULL, 'academic_phrases', 'reference', 'intermediate', 'ALL', 'phrase', 'According to the research, this approach is effective.', 'Diucapkan "a-KOR-ding to" rata', '"uh-KOR-ding-tuh" — schwa awal, linking.'),
('in terms of', NULL, 'academic_phrases', 'reference', 'intermediate', 'ALL', 'phrase', 'In terms of accuracy, Method A is superior.', 'Diucapkan kata per kata', '"in-TURMZ-uv" — menyatu, stress di "TURMZ".'),
('on behalf of', NULL, 'academic_phrases', 'formal', 'advanced', 'TOEIC', 'phrase', 'On behalf of the team, I would like to thank you.', 'Diucapkan "on be-half of"', '"on-bi-HAF-uv" — stress di "HAF". H sering diam: /bɪˈæf/.');

-- ───────────────────────────────────────────────────────
-- NEW CATEGORY 16: TONGUE TWISTERS (Drill Exercises)
-- Fun practice sentences that target specific sounds
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('She sells seashells by the seashore.', NULL, 'tongue_twisters', 'sh_vs_s', 'intermediate', 'ALL', 'sentence', 'She sells seashells by the seashore.', 'SH dan S tercampur', 'Bedakan: SH (bibir maju) vs S (bibir rileks). Mulai pelan!'),
('The thirty-three thieves thought they thrilled the throne.', NULL, 'tongue_twisters', 'th_practice', 'advanced', 'ALL', 'sentence', 'The thirty-three thieves thought they thrilled the throne.', 'TH jadi T di seluruh kalimat', 'Semua kata TH! Latih TH berulang. Lidah di antara gigi terus.'),
('Red lorry, yellow lorry.', NULL, 'tongue_twisters', 'r_and_l', 'intermediate', 'ALL', 'sentence', 'Red lorry, yellow lorry.', 'R dan L tercampur', 'R (lidah melengkung) lalu L (lidah sentuh gusi). Bergantian!'),
('I saw Susie sitting in a shoe shine shop.', NULL, 'tongue_twisters', 'sh_vs_s', 'intermediate', 'ALL', 'sentence', 'I saw Susie sitting in a shoe shine shop.', 'S dan SH tercampur', 'S (saw, Susie, sitting) vs SH (shoe, shine, shop). Bedakan!'),
('Unique New York, unique New York, you know you need unique New York.', NULL, 'tongue_twisters', 'vowels', 'advanced', 'ALL', 'sentence', 'Unique New York, unique New York.', 'Vokal tercampur', 'yoo-NEEK NYOO YORK. Fokus pada transisi vokal.');

-- ───────────────────────────────────────────────────────
-- NEW CATEGORY 17: IELTS SPEAKING TOPICS
-- High-frequency vocabulary for IELTS Part 2 & 3
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('sustainable', '/səˈsteɪnəbl/', 'ielts_topics', 'environment', 'intermediate', 'IELTS', 'adjective', 'We need more sustainable energy sources.', 'Diucapkan "sus-tain-a-ble" rata', 'suh-STAY-nuh-bul. Stress di suku kedua.'),
('biodiversity', '/ˌbaɪəʊdaɪˈvɜːrsɪti/', 'ielts_topics', 'environment', 'advanced', 'IELTS', 'noun', 'Protecting biodiversity is crucial.', 'Penekanan salah', 'by-oh-dy-VUR-si-tee. Stress di suku keempat.'),
('urbanization', '/ˌɜːrbənaɪˈzeɪʃn/', 'ielts_topics', 'society', 'advanced', 'IELTS', 'noun', 'Urbanization has increased rapidly.', 'Diucapkan "urbanisasi"', 'ur-bun-eye-ZAY-shun. Stress di suku keempat.'),
('globalization', '/ˌɡləʊbəlaɪˈzeɪʃn/', 'ielts_topics', 'society', 'advanced', 'IELTS', 'noun', 'Globalization affects every country.', 'Diucapkan "globalisasi"', 'gloh-bul-eye-ZAY-shun. Pola -ization: stress selalu di -ZAY.'),
('infrastructure', '/ˈɪnfrəstrʌktʃər/', 'ielts_topics', 'development', 'intermediate', 'IELTS', 'noun', 'The city needs better infrastructure.', 'Terlalu banyak suku kata', 'IN-fruh-struk-chur. 4 suku kata.'),
('phenomenon', '/fɪˈnɒmɪnən/', 'ielts_topics', 'academic', 'advanced', 'IELTS', 'noun', 'This is a global phenomenon.', 'Diucapkan "fenomena"', 'fi-NOM-i-nun. Plural: phenomena /fi-NOM-i-nuh/.'),
('deteriorate', '/dɪˈtɪəriəreɪt/', 'ielts_topics', 'change', 'advanced', 'IELTS', 'verb', 'Air quality continues to deteriorate.', 'Terlalu sedikit suku kata', 'di-TEER-ee-uh-rayt. 5 suku kata!'),
('predominantly', '/prɪˈdɒmɪnəntli/', 'ielts_topics', 'academic', 'advanced', 'IELTS', 'adverb', 'The area is predominantly rural.', 'Penekanan salah', 'pri-DOM-i-nunt-lee. Stress di suku kedua.');

-- ───────────────────────────────────────────────────────
-- NEW CATEGORY 18: TOEFL LISTENING VOCABULARY
-- Words commonly heard in TOEFL lectures/conversations
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('archaeological', '/ˌɑːrkiəˈlɒdʒɪkl/', 'toefl_listening', 'social_science', 'advanced', 'TOEFL_IBT', 'adjective', 'The archaeological evidence supports the theory.', 'CH dibunyikan sebagai /tʃ/', 'ar-kee-uh-LOJ-i-kul. CH = /k/, bukan /tʃ/!'),
('photosynthesis', '/ˌfəʊtəʊˈsɪnθəsɪs/', 'toefl_listening', 'natural_science', 'advanced', 'TOEFL_IBT', 'noun', 'Photosynthesis converts light to energy.', 'Diucapkan "fotosintesis"', 'foh-toh-SIN-thuh-sis. TH di tengah!'),
('metamorphosis', '/ˌmetəˈmɔːrfəsɪs/', 'toefl_listening', 'natural_science', 'advanced', 'TOEFL_IBT', 'noun', 'The butterfly undergoes metamorphosis.', 'Diucapkan "metamorfosis"', 'met-uh-MOR-fuh-sis. Stress di suku ketiga.'),
('prerequisite', '/priːˈrekwəzɪt/', 'toefl_listening', 'campus', 'intermediate', 'TOEFL_IBT', 'noun', 'Math 101 is a prerequisite for this course.', 'Diucapkan "pre-re-kwi-sit"', 'pree-REK-wuh-zit. Stress di suku kedua.'),
('symposium', '/sɪmˈpəʊziəm/', 'toefl_listening', 'campus', 'advanced', 'TOEFL_IBT', 'noun', 'The professor spoke at the symposium.', 'Diucapkan "simposium"', 'sim-POH-zee-um. Stress di suku kedua.'),
('bibliography', '/ˌbɪbliˈɒɡrəfi/', 'toefl_listening', 'campus', 'intermediate', 'TOEFL_IBT', 'noun', 'Include a bibliography at the end.', 'Diucapkan "bibliografi"', 'bib-lee-OG-ruh-fee. Stress di suku ketiga.'),
('paleontology', '/ˌpeɪliɒnˈtɒlədʒi/', 'toefl_listening', 'natural_science', 'advanced', 'TOEFL_IBT', 'noun', 'She is studying paleontology.', 'Diucapkan "paleontologi"', 'pay-lee-on-TOL-uh-jee. Stress di suku keempat.'),
('anthropology', '/ˌænθrəˈpɒlədʒi/', 'toefl_listening', 'social_science', 'advanced', 'TOEFL_IBT', 'noun', 'The anthropology lecture was fascinating.', 'TH hilang: "antropologi"', 'an-thruh-POL-uh-jee. TH harus jelas!');

-- ───────────────────────────────────────────────────────
-- CATEGORY 9 EXPANSION: MORE COMMONLY MISPRONOUNCED
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('library', '/ˈlaɪbrəri/', 'commonly_mispronounced', 'syllable_reduction', 'beginner', 'ALL', 'noun', 'The library has extensive resources.', 'Diucapkan "li-bra-ry" atau "li-be-ri"', 'LY-bruh-ree. BUKAN "li-berry"!'),
('probably', '/ˈprɒbəbli/', 'commonly_mispronounced', 'syllable_reduction', 'beginner', 'ALL', 'adverb', 'The answer is probably B.', 'Diucapkan "pro-bab-ly"', 'PROB-uh-blee. Sering disingkat "prob-lee" dalam speech.'),
('genre', '/ˈʒɒnrə/', 'commonly_mispronounced', 'french_origin', 'intermediate', 'ALL', 'noun', 'What genre of music do you prefer?', 'Diucapkan "jen-re"', 'ZHON-ruh. Kata Prancis — ZH bukan J.'),
('debris', '/ˈdebriː/', 'commonly_mispronounced', 'french_origin', 'intermediate', 'ALL', 'noun', 'The debris was cleared after the storm.', 'S dibunyikan', 'duh-BREE. S diam — kata Prancis!'),
('niche', '/niːʃ/', 'commonly_mispronounced', 'french_origin', 'intermediate', 'ALL', 'noun', 'Find your niche in the market.', 'Diucapkan "nich" dengan CH', 'NEESH (British) atau NITCH (American). Keduanya benar.'),
('recipe', '/ˈresəpi/', 'commonly_mispronounced', 'unexpected', 'beginner', 'ALL', 'noun', 'Follow the recipe carefully.', 'Diucapkan "re-sipe"', 'RES-uh-pee. 3 suku kata — E akhir tidak diam!'),
('stomach', '/ˈstʌmək/', 'commonly_mispronounced', 'unexpected', 'beginner', 'ALL', 'noun', 'An upset stomach can affect concentration.', 'CH dibunyikan sebagai /tʃ/', 'STUM-uk. CH = /k/ di akhir kata ini.'),
('suite', '/swiːt/', 'commonly_mispronounced', 'unexpected', 'intermediate', 'TOEIC', 'noun', 'Book the executive suite for the meeting.', 'Diucapkan "syoot" atau "suit"', 'SWEET — persis seperti "sweet"! Bukan "soot".'),
('coup', '/kuː/', 'commonly_mispronounced', 'french_origin', 'advanced', 'ALL', 'noun', 'It was a major coup for the research team.', 'Diucapkan "cowp" atau "kup"', 'KOO — P diam! Kata Prancis.'),
('bury', '/ˈberi/', 'commonly_mispronounced', 'unexpected', 'intermediate', 'ALL', 'verb', 'They decided to bury the evidence.', 'Diucapkan "byoo-ree"', 'BER-ee — dibaca seperti "berry", BUKAN seperti "fury".');

-- ───────────────────────────────────────────────────────
-- CATEGORY 8 EXPANSION: MORE CONNECTED SPEECH
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('should have', '/ˈʃʊdəv/', 'connected_speech', 'reductions', 'intermediate', 'ALL', 'phrase', 'You should have studied harder.', 'Diucapkan "should hev"', '"Shoulduv" atau "shoulda". BUKAN "should of".'),
('must have', '/ˈmʌstəv/', 'connected_speech', 'reductions', 'intermediate', 'TOEFL_IBT', 'phrase', 'She must have left early.', 'Diucapkan "must hev"', '"Mustuv" atau "musta". Penting untuk TOEFL listening!'),
('do you', '/dʒuː/', 'connected_speech', 'linking', 'intermediate', 'ALL', 'phrase', 'Do you understand the question?', 'Diucapkan "do yu" terpisah', '"Djoo" — D + Y → /dʒ/. "D''you understand?"'),
('don''t you', '/ˈdəʊntʃuː/', 'connected_speech', 'linking', 'intermediate', 'ALL', 'phrase', 'Don''t you think so?', 'Diucapkan kata per kata', '"Dontcha" — T + Y → /tʃ/. Sering di conversation.'),
('not at all', '/ˌnɒtəˈtɔːl/', 'connected_speech', 'linking', 'beginner', 'ALL', 'phrase', 'Not at all, please go ahead.', 'Diucapkan kata per kata', '"Notatall" — menyatu, T terhubung ke A. Bunyi seperti "nodadall".'),
('kind of', '/ˈkaɪndə/', 'connected_speech', 'reductions', 'intermediate', 'ALL', 'phrase', 'It is kind of difficult.', 'Diucapkan "kind of" terpisah', '"Kinda" — sangat common dalam speech. OF → /ə/.'),
('sort of', '/ˈsɔːrtə/', 'connected_speech', 'reductions', 'intermediate', 'ALL', 'phrase', 'It was sort of unexpected.', 'Diucapkan terpisah', '"Sorta" — seperti "kinda". OF → /ə/.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 10 EXPANSION: MORE SENTENCE PRACTICE
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('The professor emphasized the importance of critical thinking.', NULL, 'sentence_practice', 'academic_statement', 'intermediate', 'TOEFL_IBT', 'sentence', 'The professor emphasized the importance of critical thinking.', 'Penekanan merata', 'proFESsor EMphasized imPORtance CRItical THINKing — content words stressed.'),
('I am sorry, but I have to disagree with that point.', NULL, 'sentence_practice', 'polite_disagreement', 'intermediate', 'IELTS', 'sentence', 'I am sorry, but I have to disagree with that point.', 'Terlalu kaku', '"I''m sorry, but I hafta disaGREE with that point." Contractions natural!'),
('The conference will be held from March fifteenth to the eighteenth.', NULL, 'sentence_practice', 'business', 'intermediate', 'TOEIC', 'sentence', 'The conference will be held from March fifteenth to the eighteenth.', 'Numbers salah', '"fifTEENTH" dan "eighTEENTH" — stress dan TH di akhir.'),
('Despite the challenges, the team managed to complete the project on time.', NULL, 'sentence_practice', 'academic_complex', 'advanced', 'ALL', 'sentence', 'Despite the challenges, the team managed to complete the project on time.', 'Tidak ada jeda yang tepat', 'Jeda setelah "challenges," — tekankan "SPITE", "CHAL", "MAN", "COM", "TIME".'),
('Would you mind if I asked you a few questions about your experience?', NULL, 'sentence_practice', 'polite_request', 'intermediate', 'IELTS', 'sentence', 'Would you mind if I asked you a few questions about your experience?', 'Terlalu kaku dan formal', '"Would-juh mind if I askt-chuh few questions..." — natural linking.'),
('Revenue from the Asia-Pacific region exceeded expectations by twelve percent.', NULL, 'sentence_practice', 'business_report', 'advanced', 'TOEIC', 'sentence', 'Revenue from the Asia-Pacific region exceeded expectations by twelve percent.', 'Numbers dan nama salah', '"REVenue... Asia-puh-SIF-ik... exCEEDed... TWELVE perCENT."');
