-- ═══════════════════════════════════════════════════════
-- PRONUNCIATION BANK SEED DATA
-- Comprehensive word/phrase bank for TOEFL, IELTS, TOEIC
-- Organized by sound category + difficulty
-- ═══════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────
-- CATEGORY 1: TH SOUNDS (θ and ð)
-- #1 difficulty for Indonesian speakers (no /θ/ or /ð/ in Bahasa)
-- ───────────────────────────────────────────────────────

-- Voiceless TH /θ/ — beginner
INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('think', '/θɪŋk/', 'th_sounds', 'voiceless_th', 'beginner', 'ALL', 'verb', 'I think this is the right answer.', 'Diucapkan "tink" — lidah tidak keluar', 'Letakkan ujung lidah di antara gigi, hembuskan udara.'),
('three', '/θriː/', 'th_sounds', 'voiceless_th', 'beginner', 'ALL', 'number', 'There are three main sections.', 'Diucapkan "tree" — tanpa TH', 'Bedakan: THREE (θ) vs TREE (t). Lidah harus keluar di antara gigi.'),
('thought', '/θɔːt/', 'th_sounds', 'voiceless_th', 'beginner', 'ALL', 'noun', 'That was a thought-provoking lecture.', 'Diucapkan "tot" atau "taught" tanpa TH', 'Mulai dengan lidah di antara gigi, lalu tarik ke belakang untuk "ot".'),
('through', '/θruː/', 'th_sounds', 'voiceless_th', 'beginner', 'ALL', 'preposition', 'We went through the entire chapter.', 'Diucapkan "tru" — tanpa bunyi TH', 'Hati-hati: through, thorough, though, thought — semua beda!'),
('theory', '/ˈθɪəri/', 'th_sounds', 'voiceless_th', 'intermediate', 'TOEFL_IBT', 'noun', 'The theory was supported by evidence.', 'Diucapkan "teori" seperti Bahasa Indonesia', 'Penekanan di suku pertama: THEE-uh-ree, bukan te-O-ri.'),
('thesis', '/ˈθiːsɪs/', 'th_sounds', 'voiceless_th', 'intermediate', 'IELTS', 'noun', 'She defended her thesis successfully.', 'Diucapkan "tesis" tanpa TH', 'THEE-sis, dengan TH yang jelas di awal.'),
('thorough', '/ˈθʌrə/', 'th_sounds', 'voiceless_th', 'intermediate', 'ALL', 'adjective', 'The research was very thorough.', 'Diucapkan "toro" — salah total', 'THUH-ruh. Jangan sama dengan "through" (thru).'),
('therapeutic', '/ˌθerəˈpjuːtɪk/', 'th_sounds', 'voiceless_th', 'advanced', 'IELTS', 'adjective', 'Music can be therapeutic for patients.', 'Diucapkan "terapiutik"', 'ther-uh-PYOO-tik. TH + penekanan di suku ketiga.'),
('thermodynamics', '/ˌθɜːrməʊdaɪˈnæmɪks/', 'th_sounds', 'voiceless_th', 'advanced', 'TOEFL_IBT', 'noun', 'The lecture covered thermodynamics.', 'Diucapkan "termodinamik"', 'thur-moh-dy-NAM-iks. TH harus jelas.'),
('methodology', '/ˌmeθəˈdɒlədʒi/', 'th_sounds', 'voiceless_th', 'advanced', 'IELTS', 'noun', 'The methodology section describes the approach.', 'TH di tengah kata sering hilang', 'meth-uh-DOL-uh-jee. TH di tengah juga harus jelas.');

-- Voiced TH /ð/ — beginner
INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('the', '/ðə/', 'th_sounds', 'voiced_th', 'beginner', 'ALL', 'article', 'The answer is B.', 'Diucapkan "de" — tanpa getaran', 'Lidah di antara gigi + getarkan pita suara. Beda dengan "voiceless th".'),
('this', '/ðɪs/', 'th_sounds', 'voiced_th', 'beginner', 'ALL', 'pronoun', 'This question is about main idea.', 'Diucapkan "dis"', 'Getarkan pita suara saat lidah di antara gigi.'),
('that', '/ðæt/', 'th_sounds', 'voiced_th', 'beginner', 'ALL', 'pronoun', 'That is the correct answer.', 'Diucapkan "dat"', 'Rasakan getaran di tenggorokan saat mengucapkan TH.'),
('these', '/ðiːz/', 'th_sounds', 'voiced_th', 'beginner', 'ALL', 'pronoun', 'These examples illustrate the point.', 'Diucapkan "dis" — salah vokal juga', 'THEEZ — panjangkan vokal "ee" dan akhiri dengan "z".'),
('those', '/ðəʊz/', 'th_sounds', 'voiced_th', 'beginner', 'ALL', 'pronoun', 'Those factors contribute to the result.', 'Diucapkan "dos"', 'THOHZ — voiced TH + bunyi "oh" + Z di akhir.'),
('together', '/təˈɡeðər/', 'th_sounds', 'voiced_th', 'intermediate', 'ALL', 'adverb', 'The students worked together on the project.', 'TH di tengah kata sering jadi "d"', 'tuh-GEDH-er. TH di tengah harus tetap voiced.'),
('although', '/ɔːlˈðəʊ/', 'th_sounds', 'voiced_th', 'intermediate', 'TOEFL_IBT', 'conjunction', 'Although the data is limited, the trend is clear.', 'Diucapkan "altho" tanpa TH', 'ol-THOH. Sering muncul di TOEFL reading & writing.'),
('therefore', '/ˈðeəfɔːr/', 'th_sounds', 'voiced_th', 'intermediate', 'ALL', 'adverb', 'Therefore, the hypothesis was rejected.', 'Diucapkan "derfore"', 'THAIR-for. Kata penghubung penting di akademik writing.'),
('furthermore', '/ˈfɜːðəmɔːr/', 'th_sounds', 'voiced_th', 'advanced', 'IELTS', 'adverb', 'Furthermore, the results indicate a trend.', 'TH di tengah hilang', 'FUR-thuh-mor. Penting untuk IELTS Writing Task 2.'),
('nevertheless', '/ˌnevəðəˈles/', 'th_sounds', 'voiced_th', 'advanced', 'TOEFL_IBT', 'adverb', 'Nevertheless, the study has some limitations.', 'TH di tengah jadi "d"', 'nev-er-thuh-LESS. Connector akademik level tinggi.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 2: VOWEL PAIRS (minimal pairs)
-- Long vs short vowels — big source of confusion
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('ship', '/ʃɪp/', 'vowel_pairs', 'short_i', 'beginner', 'ALL', 'noun', 'The ship sailed across the ocean.', 'Disamakan dengan "sheep"', 'Bunyi /ɪ/ pendek — seperti "i" di kata "ini". Bibir rileks.'),
('sheep', '/ʃiːp/', 'vowel_pairs', 'long_ee', 'beginner', 'ALL', 'noun', 'The sheep grazed in the field.', 'Disamakan dengan "ship"', 'Bunyi /iː/ panjang — tarik bibir ke samping, tahan lama.'),
('sit', '/sɪt/', 'vowel_pairs', 'short_i', 'beginner', 'ALL', 'verb', 'Please sit down and listen.', 'Vokal terlalu panjang → jadi "seat"', 'Pendek dan tajam: SIT. Jangan jadi SEAT.'),
('seat', '/siːt/', 'vowel_pairs', 'long_ee', 'beginner', 'ALL', 'noun', 'Please take your seat.', 'Vokal terlalu pendek → jadi "sit"', 'Panjangkan: SEEEAT. Rasakan bibir tertarik.'),
('live', '/lɪv/', 'vowel_pairs', 'short_i', 'beginner', 'ALL', 'verb', 'I live in Jakarta.', 'Disamakan dengan "leave"', 'LIV (pendek). Beda arti dari LEAVE!'),
('leave', '/liːv/', 'vowel_pairs', 'long_ee', 'beginner', 'ALL', 'verb', 'Please leave your bags outside.', 'Disamakan dengan "live"', 'LEEV (panjang). "Live in" vs "Leave from" — beda makna.'),
('full', '/fʊl/', 'vowel_pairs', 'short_u', 'beginner', 'ALL', 'adjective', 'The auditorium was full.', 'Disamakan dengan "fool"', '/ʊ/ pendek — bibir agak bulat tapi rileks.'),
('fool', '/fuːl/', 'vowel_pairs', 'long_oo', 'beginner', 'ALL', 'noun', 'Only a fool would ignore the data.', 'Disamakan dengan "full"', '/uː/ panjang — bibir sangat bulat, tahan.'),
('bed', '/bed/', 'vowel_pairs', 'short_e', 'beginner', 'ALL', 'noun', 'The hospital bed was occupied.', 'Disamakan dengan "bad"', '/e/ — mulut agak terbuka, lidah di tengah.'),
('bad', '/bæd/', 'vowel_pairs', 'short_a', 'beginner', 'ALL', 'adjective', 'The bad weather affected the experiment.', 'Disamakan dengan "bed"', '/æ/ — mulut lebih terbuka lebar, lidah turun.'),
('cat', '/kæt/', 'vowel_pairs', 'short_a', 'beginner', 'ALL', 'noun', 'The cat sat on the mat.', 'Vokal /æ/ jadi /e/', '/æ/ buka mulut lebar — seperti antara "a" dan "e".'),
('cut', '/kʌt/', 'vowel_pairs', 'short_u_schwa', 'beginner', 'ALL', 'verb', 'The budget was cut significantly.', 'Disamakan dengan "cat"', '/ʌ/ — mulut setengah terbuka, bunyi netral seperti "a" pendek.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 3: WORD STRESS (penekanan kata)
-- Indonesian is syllable-timed; English is stress-timed
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('photograph', '/ˈfəʊtəɡrɑːf/', 'word_stress', 'first_syllable', 'intermediate', 'ALL', 'noun', 'The photograph shows the experiment setup.', 'Penekanan di suku kedua: fo-TO-graf', 'FOH-tuh-graf. Penekanan di suku PERTAMA.'),
('photographer', '/fəˈtɒɡrəfər/', 'word_stress', 'second_syllable', 'intermediate', 'ALL', 'noun', 'The photographer captured the moment.', 'Penekanan sama seperti "photograph"', 'fuh-TOG-ruh-fur. Penekanan PINDAH ke suku kedua!'),
('photographic', '/ˌfəʊtəˈɡræfɪk/', 'word_stress', 'third_syllable', 'intermediate', 'ALL', 'adjective', 'The photographic evidence was compelling.', 'Penekanan di suku pertama', 'foh-tuh-GRAF-ik. Penekanan di suku KETIGA!'),
('present', '/ˈpreznt/', 'word_stress', 'noun_verb_shift', 'intermediate', 'TOEIC', 'noun', 'I have a present for you.', 'Tidak membedakan noun vs verb stress', 'PREZ-ent (noun: hadiah). pre-ZENT (verb: mempresentasikan).'),
('record', '/ˈrekɔːd/', 'word_stress', 'noun_verb_shift', 'intermediate', 'TOEIC', 'noun', 'The record shows an improvement.', 'Stress sama untuk noun dan verb', 'REK-ord (noun: catatan). ri-KORD (verb: merekam).'),
('conduct', '/ˈkɒndʌkt/', 'word_stress', 'noun_verb_shift', 'intermediate', 'ALL', 'noun', 'His conduct was unprofessional.', 'Tidak shift stress', 'KON-duct (noun: perilaku). kun-DUCT (verb: melakukan).'),
('analysis', '/əˈnæləsɪs/', 'word_stress', 'academic', 'intermediate', 'TOEFL_IBT', 'noun', 'The analysis revealed significant patterns.', 'Diucapkan "analisis" seperti BI', 'uh-NAL-uh-sis. Penekanan di suku KEDUA.'),
('development', '/dɪˈveləpmənt/', 'word_stress', 'academic', 'intermediate', 'IELTS', 'noun', 'The development of the theory took decades.', 'Penekanan di suku pertama', 'di-VEL-up-ment. Penekanan di suku KEDUA.'),
('environment', '/ɪnˈvaɪrənmənt/', 'word_stress', 'academic', 'intermediate', 'IELTS', 'noun', 'The environment is a key IELTS topic.', 'Diucapkan "en-vi-ron-men" rata', 'in-VY-run-ment. Penekanan di suku KEDUA.'),
('significant', '/sɪɡˈnɪfɪkənt/', 'word_stress', 'academic', 'intermediate', 'TOEFL_IBT', 'adjective', 'The results were statistically significant.', 'Penekanan salah: SIG-ni-fi-cant', 'sig-NIF-i-kunt. Penekanan di suku KEDUA.'),
('communicate', '/kəˈmjuːnɪkeɪt/', 'word_stress', 'academic', 'intermediate', 'TOEIC', 'verb', 'We need to communicate more effectively.', 'Diucapkan "komunikasi" style', 'kuh-MYOO-ni-kayt. Penekanan di suku KEDUA.'),
('opportunity', '/ˌɒpəˈtjuːnɪti/', 'word_stress', 'academic', 'advanced', 'IELTS', 'noun', 'This is a great opportunity for growth.', 'Penekanan di suku pertama', 'op-uh-TYOO-ni-tee. Penekanan di suku KETIGA.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 4: FINAL CONSONANTS
-- Indonesian rarely ends words with consonants
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('walked', '/wɔːkt/', 'final_consonants', 'ed_endings', 'beginner', 'ALL', 'verb', 'She walked to the library.', 'Diucapkan "walk-ED" (2 suku kata)', 'WALKT — satu suku kata! Setelah /k/, -ed dibaca /t/.'),
('played', '/pleɪd/', 'final_consonants', 'ed_endings', 'beginner', 'ALL', 'verb', 'The children played outside.', 'Diucapkan "play-ED"', 'PLAYD — satu suku kata! Setelah voiced sound, -ed dibaca /d/.'),
('needed', '/ˈniːdɪd/', 'final_consonants', 'ed_endings', 'beginner', 'ALL', 'verb', 'More research is needed.', 'Diucapkan "need" tanpa -ed', 'NEE-did — DUA suku kata! Setelah /t/ atau /d/, -ed dibaca /ɪd/.'),
('asked', '/ɑːskt/', 'final_consonants', 'ed_endings', 'intermediate', 'ALL', 'verb', 'The professor asked a question.', 'Diucapkan "ask-ED"', 'ASKT — konsonan cluster /skt/ di akhir. Latih pelan-pelan.'),
('helped', '/helpt/', 'final_consonants', 'ed_endings', 'beginner', 'ALL', 'verb', 'The tutor helped the student.', 'Diucapkan "help-ED"', 'HELPT — -ed setelah /p/ dibaca /t/.'),
('books', '/bʊks/', 'final_consonants', 's_endings', 'beginner', 'ALL', 'noun', 'The books are on the shelf.', 'Bunyi /s/ di akhir hilang', 'BUKS — /s/ setelah consonant tak bersuara tetap /s/.'),
('dogs', '/dɒɡz/', 'final_consonants', 's_endings', 'beginner', 'ALL', 'noun', 'The dogs were barking.', 'Bunyi /z/ jadi /s/', 'DOGZ — setelah voiced sound, -s dibaca /z/!'),
('watches', '/ˈwɒtʃɪz/', 'final_consonants', 's_endings', 'beginner', 'ALL', 'noun', 'He watches the news every day.', 'Diucapkan "watch-S"', 'WOT-chiz — setelah /tʃ/, /ʃ/, /s/, /z/, tambah suku kata /ɪz/.'),
('months', '/mʌnθs/', 'final_consonants', 'clusters', 'intermediate', 'ALL', 'noun', 'The study lasted six months.', 'Diucapkan "mons" — TH hilang', 'MUNTHS — cluster /nθs/ sulit tapi penting. Latih pelan.'),
('strengths', '/streŋθs/', 'final_consonants', 'clusters', 'advanced', 'IELTS', 'noun', 'Identify your strengths and weaknesses.', 'Diucapkan "strens"', 'STRENGTHS — cluster /ŋθs/ tersulit di English. Sering muncul di IELTS Speaking.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 5: R AND L SOUNDS
-- Tricky for many Asian language speakers
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('right', '/raɪt/', 'r_and_l', 'initial_r', 'beginner', 'ALL', 'adjective', 'That is the right answer.', 'R terlalu lemah', 'Lidah melengkung ke belakang, TIDAK menyentuh langit-langit.'),
('light', '/laɪt/', 'r_and_l', 'initial_l', 'beginner', 'ALL', 'noun', 'The light was too bright to read.', 'Disamakan dengan "right"', 'Ujung lidah menyentuh gusi belakang gigi atas.'),
('read', '/riːd/', 'r_and_l', 'initial_r', 'beginner', 'ALL', 'verb', 'Please read the passage carefully.', 'R Indonesia (getar) bukan R English', 'R English: lidah melengkung ke belakang, TIDAK bergetar.'),
('lead', '/liːd/', 'r_and_l', 'initial_l', 'beginner', 'ALL', 'verb', 'This could lead to new discoveries.', 'Disamakan dengan "read"', 'L: ujung lidah sentuh gusi. R: lidah melengkung, tidak sentuh.'),
('really', '/ˈrɪəli/', 'r_and_l', 'r_and_l_combo', 'intermediate', 'ALL', 'adverb', 'The results were really surprising.', 'R dan L keduanya lemah', 'REE-uh-lee. R melengkung → vokal → L sentuh gusi.'),
('literally', '/ˈlɪtərəli/', 'r_and_l', 'r_and_l_combo', 'advanced', 'ALL', 'adverb', 'The lake literally dried up.', 'R dan L tercampur', 'LIT-er-uh-lee. L di awal, R di tengah — bedakan!'),
('rural', '/ˈrʊrəl/', 'r_and_l', 'r_and_l_combo', 'advanced', 'IELTS', 'adjective', 'Rural areas face different challenges.', 'Sangat sulit — R dan L berurutan', 'ROOR-ul. Dua R + satu L. Latih pelan: roo...rul.'),
('world', '/wɜːrld/', 'r_and_l', 'r_and_l_combo', 'intermediate', 'ALL', 'noun', 'The world population is growing.', 'R hilang — jadi "wold"', 'WURLD. R dan L berurutan — lidah dari melengkung ke menyentuh gusi.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 6: SILENT LETTERS
-- Words where spelling ≠ pronunciation
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('knowledge', '/ˈnɒlɪdʒ/', 'silent_letters', 'silent_k', 'intermediate', 'ALL', 'noun', 'Knowledge of grammar is essential.', 'K dibunyikan: "k-nowledge"', 'NOL-ij. K diam di awal. Juga: knife, knee, knock.'),
('psychology', '/saɪˈkɒlədʒi/', 'silent_letters', 'silent_p', 'intermediate', 'TOEFL_IBT', 'noun', 'She studied psychology at university.', 'P dibunyikan: "p-sychology"', 'sy-KOL-uh-jee. P diam. Juga: pneumonia, pseudo.'),
('receipt', '/rɪˈsiːt/', 'silent_letters', 'silent_p', 'intermediate', 'TOEIC', 'noun', 'Please keep your receipt.', 'P dibunyikan: "re-ceipt"', 'ri-SEET. P diam di tengah kata.'),
('debt', '/det/', 'silent_letters', 'silent_b', 'intermediate', 'IELTS', 'noun', 'The national debt has increased.', 'B dibunyikan: "debt" dengan B', 'DET. B diam. Juga: doubt, subtle, climb.'),
('island', '/ˈaɪlənd/', 'silent_letters', 'silent_s', 'beginner', 'ALL', 'noun', 'The island was uninhabited.', 'S dibunyikan: "is-land"', 'EYE-lund. S diam!'),
('Wednesday', '/ˈwenzdeɪ/', 'silent_letters', 'silent_d', 'beginner', 'ALL', 'noun', 'The meeting is on Wednesday.', 'Diucapkan "Wed-nes-day" 3 suku kata', 'WENZ-day. Hanya 2 suku kata! D pertama diam.'),
('colonel', '/ˈkɜːrnl/', 'silent_letters', 'irregular', 'advanced', 'ALL', 'noun', 'The colonel addressed the troops.', 'Diucapkan seperti ditulis', 'KUR-nul. Salah satu kata paling irregularbdi English!'),
('queue', '/kjuː/', 'silent_letters', 'silent_ueue', 'intermediate', 'IELTS', 'noun', 'There was a long queue at the office.', 'Diucapkan "kyu-yu" atau "kwee"', 'KYOO. Empat huruf diam setelah Q!');

-- ───────────────────────────────────────────────────────
-- CATEGORY 7: ACADEMIC VOCABULARY (TOEFL/IELTS specific)
-- Frequently tested words with tricky pronunciation
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('analyze', '/ˈænəlaɪz/', 'academic_vocab', 'toefl_core', 'intermediate', 'TOEFL_IBT', 'verb', 'Analyze the data in the chart.', 'Diucapkan "analisa"', 'AN-uh-lyze. Penekanan di suku pertama.'),
('hypothesis', '/haɪˈpɒθəsɪs/', 'academic_vocab', 'toefl_core', 'advanced', 'TOEFL_IBT', 'noun', 'The hypothesis was later confirmed.', 'Diucapkan "hipotesis"', 'hy-POTH-uh-sis. TH di tengah + stress di suku kedua.'),
('phenomenon', '/fɪˈnɒmɪnən/', 'academic_vocab', 'toefl_core', 'advanced', 'TOEFL_IBT', 'noun', 'This phenomenon occurs naturally.', 'Diucapkan "fenomena"', 'fi-NOM-i-nun. Plural: phenomena (fi-NOM-i-nuh).'),
('paradigm', '/ˈpærədaɪm/', 'academic_vocab', 'toefl_core', 'advanced', 'TOEFL_IBT', 'noun', 'A new paradigm emerged in the field.', 'G dibunyikan', 'PAR-uh-dime. G diam!'),
('hierarchy', '/ˈhaɪərɑːrki/', 'academic_vocab', 'ielts_core', 'advanced', 'IELTS', 'noun', 'The social hierarchy was rigid.', 'Diucapkan "hi-e-rar-ki"', 'HY-uh-rar-kee. Penekanan di suku pertama.'),
('entrepreneur', '/ˌɒntrəprəˈnɜːr/', 'academic_vocab', 'ielts_core', 'advanced', 'IELTS', 'noun', 'She became a successful entrepreneur.', 'Diucapkan "enterpre-nur"', 'on-truh-pruh-NUR. Kata Prancis — penekanan di akhir.'),
('infrastructure', '/ˈɪnfrəstrʌktʃər/', 'academic_vocab', 'ielts_core', 'intermediate', 'IELTS', 'noun', 'The infrastructure needs improvement.', 'Diucapkan terlalu banyak suku kata', 'IN-fruh-struk-chur. 4 suku kata, stress di pertama.'),
('negotiate', '/nɪˈɡəʊʃieɪt/', 'academic_vocab', 'toeic_core', 'intermediate', 'TOEIC', 'verb', 'We need to negotiate the contract terms.', 'Diucapkan "negosiasi"', 'ni-GOH-shee-ayt. Penekanan di suku kedua.'),
('schedule', '/ˈʃedjuːl/', 'academic_vocab', 'toeic_core', 'intermediate', 'TOEIC', 'noun', 'The schedule has been updated.', 'Diucapkan "skedyul" (American) vs "shedyul" (British)', 'SKED-yool (US) atau SHED-yool (UK). Keduanya benar.'),
('colleague', '/ˈkɒliːɡ/', 'academic_vocab', 'toeic_core', 'intermediate', 'TOEIC', 'noun', 'My colleague will handle the report.', 'Diucapkan "ko-le-ag"', 'KOL-eeg. Dua suku kata saja!'),
('guarantee', '/ˌɡærənˈtiː/', 'academic_vocab', 'toeic_core', 'intermediate', 'TOEIC', 'noun', 'We guarantee delivery within 5 days.', 'Penekanan di suku pertama', 'gar-un-TEE. Penekanan di suku TERAKHIR.'),
('itinerary', '/aɪˈtɪnərəri/', 'academic_vocab', 'toeic_core', 'advanced', 'TOEIC', 'noun', 'Please review the travel itinerary.', 'Diucapkan "itinerari"', 'eye-TIN-uh-ruh-ree. 5 suku kata, stress di kedua.');

-- ───────────────────────────────────────────────────────
-- CATEGORY 8: CONNECTED SPEECH
-- How words sound different in sentences
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('want to', '/ˈwɒnə/', 'connected_speech', 'reductions', 'intermediate', 'ALL', 'phrase', 'I want to improve my score.', 'Diucapkan kata per kata: "want too"', 'Dalam percakapan natural: "wanna". Penting untuk listening!'),
('going to', '/ˈɡʌnə/', 'connected_speech', 'reductions', 'intermediate', 'ALL', 'phrase', 'I am going to study tonight.', 'Diucapkan "go-ing tu"', 'Dalam percakapan: "gonna". Sering muncul di TOEFL listening.'),
('have to', '/ˈhæftə/', 'connected_speech', 'reductions', 'intermediate', 'ALL', 'phrase', 'You have to submit by Friday.', 'Diucapkan "hev tu"', 'Dalam percakapan: "hafta". V berubah jadi F sebelum T.'),
('could have', '/ˈkʊdəv/', 'connected_speech', 'reductions', 'intermediate', 'TOEFL_IBT', 'phrase', 'She could have passed the test.', 'Diucapkan "could hev"', '"Could-uv" atau "coulda". BUKAN "could of" (salah grammar).'),
('would have', '/ˈwʊdəv/', 'connected_speech', 'reductions', 'intermediate', 'IELTS', 'phrase', 'I would have chosen option B.', 'Diucapkan "would hev"', '"Would-uv" atau "woulda". Penting untuk conditional sentences.'),
('did you', '/ˈdɪdʒuː/', 'connected_speech', 'linking', 'intermediate', 'ALL', 'phrase', 'Did you finish the assignment?', 'Diucapkan "did yu" terpisah', '"Didja" — D + Y jadi /dʒ/ (seperti J). Sering di listening!'),
('what are you', '/ˈwɒtʃə/', 'connected_speech', 'linking', 'advanced', 'ALL', 'phrase', 'What are you working on?', 'Diucapkan kata per kata', '"Whatcha" — sangat contracted dalam native speech.'),
('a lot of', '/əˈlɒtəv/', 'connected_speech', 'linking', 'beginner', 'ALL', 'phrase', 'There is a lot of evidence to support this.', 'Diucapkan "a lot of" terpisah', '"Alotta" — semua menyatu. OF terdengar seperti "uh".');

-- ───────────────────────────────────────────────────────
-- CATEGORY 9: COMMONLY MISPRONOUNCED WORDS
-- Words Indonesian students consistently get wrong
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('comfortable', '/ˈkʌmftəbl/', 'commonly_mispronounced', 'syllable_reduction', 'intermediate', 'ALL', 'adjective', 'The test environment should be comfortable.', 'Diucapkan 4 suku kata: "com-for-ta-ble"', 'KUMF-tuh-bul. Hanya 3 suku kata! FOR hilang.'),
('vegetable', '/ˈvedʒtəbl/', 'commonly_mispronounced', 'syllable_reduction', 'intermediate', 'ALL', 'noun', 'Eat more vegetables for better health.', 'Diucapkan 4 suku kata: "ve-ge-ta-ble"', 'VEJ-tuh-bul. Hanya 3 suku kata!'),
('temperature', '/ˈtemprətʃər/', 'commonly_mispronounced', 'syllable_reduction', 'intermediate', 'IELTS', 'noun', 'The temperature is rising globally.', 'Diucapkan "tem-pe-ra-tur" (4 suku kata)', 'TEM-pruh-chur. 3 suku kata saja.'),
('interesting', '/ˈɪntrəstɪŋ/', 'commonly_mispronounced', 'syllable_reduction', 'beginner', 'ALL', 'adjective', 'The lecture was very interesting.', 'Diucapkan 4 suku kata: "in-te-res-ting"', 'IN-trus-ting atau IN-tres-ting. Hanya 3 suku kata.'),
('chocolate', '/ˈtʃɒklət/', 'commonly_mispronounced', 'syllable_reduction', 'beginner', 'ALL', 'noun', 'Would you like some chocolate?', 'Diucapkan "cho-co-late" (3 suku kata)', 'CHOK-let. Hanya 2 suku kata!'),
('laboratory', '/ləˈbɒrətri/', 'commonly_mispronounced', 'stress_shift', 'advanced', 'TOEFL_IBT', 'noun', 'The experiment was conducted in the laboratory.', 'Penekanan di suku pertama (British OK)', 'luh-BOR-uh-tree (US) atau LAB-ruh-tree (UK).'),
('determine', '/dɪˈtɜːrmɪn/', 'commonly_mispronounced', 'stress_shift', 'intermediate', 'TOEFL_IBT', 'verb', 'We need to determine the cause.', 'Diucapkan "determin" dengan E terbuka', 'di-TUR-min. Penekanan di suku kedua.'),
('specific', '/spəˈsɪfɪk/', 'commonly_mispronounced', 'stress_shift', 'intermediate', 'ALL', 'adjective', 'Be more specific in your answer.', 'Penekanan di suku pertama: "SPE-si-fik"', 'spuh-SIF-ik. Penekanan di suku KEDUA.'),
('appropriate', '/əˈprəʊpriət/', 'commonly_mispronounced', 'stress_shift', 'intermediate', 'ALL', 'adjective', 'Choose the most appropriate answer.', 'Diucapkan "a-pro-pri-at" rata', 'uh-PROH-pree-ut. Penekanan di suku KEDUA.'),
('pronunciation', '/prəˌnʌnsiˈeɪʃn/', 'commonly_mispronounced', 'ironic', 'intermediate', 'ALL', 'noun', 'Your pronunciation has improved.', 'Diucapkan "pronounciation" (ada O tambahan)', 'pruh-nun-see-AY-shun. BUKAN "pro-NOUN-ciation"!'),
('chaos', '/ˈkeɪɒs/', 'commonly_mispronounced', 'unexpected', 'intermediate', 'ALL', 'noun', 'The experiment ended in chaos.', 'Diucapkan "cha-os" dengan CH', 'KAY-os. CH dibaca K!'),
('choir', '/kwaɪər/', 'commonly_mispronounced', 'unexpected', 'intermediate', 'ALL', 'noun', 'The university choir performed beautifully.', 'Diucapkan "choy-er"', 'KWIRE. Sama sekali tidak seperti spelling-nya!');

-- ───────────────────────────────────────────────────────
-- CATEGORY 10: SENTENCE INTONATION
-- Full sentences for practicing natural flow
-- ───────────────────────────────────────────────────────

INSERT INTO pronunciation_bank (word, ipa, category, subcategory, difficulty, test_type, part_of_speech, example_sentence, common_mistake, tip) VALUES
('The results of the study were inconclusive.', NULL, 'sentence_practice', 'academic_statement', 'intermediate', 'TOEFL_IBT', 'sentence', 'The results of the study were inconclusive.', 'Intonasi datar tanpa penekanan', 'Tekankan: "reSULTS", "STUdy", "INCONclusive". Turun di akhir.'),
('Could you please explain that again?', NULL, 'sentence_practice', 'polite_request', 'beginner', 'IELTS', 'sentence', 'Could you please explain that again?', 'Intonasi datar seperti pernyataan', 'Naik di "again?" — ini pertanyaan sopan. Penting untuk IELTS Speaking.'),
('I would like to schedule a meeting for next Tuesday.', NULL, 'sentence_practice', 'business', 'intermediate', 'TOEIC', 'sentence', 'I would like to schedule a meeting for next Tuesday.', 'Terlalu kaku kata per kata', '"I''d like to SCHED-ule a MEETing for next TUESday." Reduce "would" → "''d".'),
('Although there are several limitations, the findings are significant.', NULL, 'sentence_practice', 'academic_complex', 'advanced', 'TOEFL_IBT', 'sentence', 'Although there are several limitations, the findings are significant.', 'Tidak ada jeda setelah koma', 'Jeda setelah "limitations," — lalu lanjut. Penting untuk Speaking Task 3-4.'),
('In my opinion, the advantages outweigh the disadvantages.', NULL, 'sentence_practice', 'ielts_essay', 'intermediate', 'IELTS', 'sentence', 'In my opinion, the advantages outweigh the disadvantages.', 'Penekanan salah pada "outweigh"', 'Jeda setelah "opinion," — tekankan "outWEIGH" dan "disadVANtages".'),
('The quarterly report shows a fifteen percent increase in revenue.', NULL, 'sentence_practice', 'business_report', 'intermediate', 'TOEIC', 'sentence', 'The quarterly report shows a fifteen percent increase in revenue.', '"Fifteen" dan "percent" salah stress', '"QUARterly rePORT shows a fifTEEN perCENT inCREASE in REVenue."'),
('To what extent do you agree or disagree with the following statement?', NULL, 'sentence_practice', 'ielts_prompt', 'advanced', 'IELTS', 'sentence', 'To what extent do you agree or disagree with the following statement?', 'Terlalu cepat tanpa penekanan', 'Pelan dan jelas: "to what exTENT... do you aGREE or disaGREE..."'),
('Based on the information in paragraph three, the author implies that...', NULL, 'sentence_practice', 'toefl_prompt', 'advanced', 'TOEFL_IBT', 'sentence', 'Based on the information in paragraph three, the author implies that...', 'Diucapkan terlalu cepat', '"Based on the inforMAtion... the AUthor imPLIES..." Jeda di koma.');
