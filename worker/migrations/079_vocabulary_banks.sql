-- 079: Vocabulary Banks for All 4 Tests
-- High-frequency vocabulary by topic for TOEFL iBT, TOEFL ITP, TOEIC, IELTS
-- Compiled from AWL (Coxhead), TOEIC 600-word lists, IELTS topic vocab, Barron's 800

CREATE TABLE IF NOT EXISTS vocabulary_banks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  ipa TEXT,
  pos TEXT,                              -- 'noun', 'verb', 'adjective', 'adverb', 'preposition'
  definition TEXT,
  indonesian TEXT,                       -- Indonesian translation
  example TEXT,                          -- example sentence
  topic TEXT NOT NULL,                   -- 'education', 'environment', 'technology', etc.
  cefr_level TEXT DEFAULT 'B1',
  tested_in TEXT,                        -- JSON array: ['TOEFL_IBT', 'TOEFL_ITP', 'TOEIC', 'IELTS']
  frequency TEXT DEFAULT 'medium',       -- 'high', 'medium', 'low'
  word_family TEXT,                      -- e.g. 'analyze/analysis/analyst/analytical'
  collocations TEXT,                     -- common collocations
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vb_topic ON vocabulary_banks(topic);
CREATE INDEX IF NOT EXISTS idx_vb_cefr ON vocabulary_banks(cefr_level);
CREATE INDEX IF NOT EXISTS idx_vb_word ON vocabulary_banks(word);

-- ===========================================================================
-- TOPIC 1: EDUCATION
-- ===========================================================================

INSERT INTO vocabulary_banks (word, ipa, pos, definition, indonesian, example, topic, cefr_level, tested_in, frequency, word_family, collocations) VALUES
  ('curriculum', '/kəˈrɪkjələm/', 'noun', 'The subjects studied in a course or school', 'kurikulum', 'The school updated its curriculum to include more science.', 'education', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'curricula/curriculums (plural)', 'core curriculum, national curriculum'),
  ('pedagogy', '/ˈpedəɡɑːdʒi/', 'noun', 'The method and practice of teaching', 'pedagogi', 'Modern pedagogy emphasizes student-centered learning.', 'education', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'pedagogical/pedagogue', 'evidence-based pedagogy, critical pedagogy'),
  ('literacy', '/ˈlɪtərəsi/', 'noun', 'Ability to read and write', 'literasi', 'Literacy rates have improved worldwide.', 'education', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'literate (adj)', 'digital literacy, financial literacy, media literacy'),
  ('enrollment', '/ɪnˈroʊlmənt/', 'noun', 'The act of registering for a course', 'pendaftaran', 'University enrollment has increased this year.', 'education', 'B2', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'medium', 'enroll (verb)', 'course enrollment, student enrollment'),
  ('tuition', '/tuˈɪʃən/', 'noun', 'Fee paid for instruction', 'biaya sekolah', 'Tuition fees have risen significantly.', 'education', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'tuition-free (adj)', 'tuition fees, pay tuition'),
  ('discipline', '/ˈdɪsɪplɪn/', 'noun', 'A branch of knowledge; or, controlled behavior', 'disiplin', 'She studied several academic disciplines.', 'education', 'B1', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'disciplinary (adj)', 'academic discipline, classroom discipline'),
  ('scholarship', '/ˈskɑːlərʃɪp/', 'noun', 'Financial aid for students; deep knowledge', 'beasiswa', 'She received a full scholarship to study abroad.', 'education', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'scholar (noun)', 'full scholarship, merit-based scholarship'),
  ('syllabus', '/ˈsɪləbəs/', 'noun', 'Outline of course content', 'silabus', 'The course syllabus lists all required readings.', 'education', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'syllabi (plural)', 'course syllabus'),
  ('assessment', '/əˈsesmənt/', 'noun', 'Evaluation of student learning', 'penilaian', 'Continuous assessment includes quizzes and projects.', 'education', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'assess (verb)', 'formative assessment, summative assessment'),
  ('thesis', '/ˈθiːsɪs/', 'noun', 'A long essay for a degree', 'skripsi/tesis', 'She is writing her master''s thesis on climate change.', 'education', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'theses (plural)', 'master''s thesis, doctoral thesis'),
  ('dissertation', '/ˌdɪsərˈteɪʃən/', 'noun', 'A long academic work, usually for a PhD', 'disertasi', 'His dissertation focused on machine learning.', 'education', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'dissertation defense', 'doctoral dissertation'),
  ('undergraduate', '/ˌʌndərˈɡrædʒuət/', 'noun/adj', 'A university student not yet graduated; or relating to such study', 'mahasiswa', 'Most undergraduates take 4 years to complete their degree.', 'education', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'undergraduate degree', 'undergraduate program'),
  ('graduate', '/ˈɡrædʒuət/', 'noun/adj', 'A person who has completed a degree; or relating to post-undergraduate study', 'lulusan', 'She is a graduate of Harvard University.', 'education', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'postgraduate (adj), graduation (noun)', 'graduate school, graduate program'),
  ('professor', '/prəˈfesər/', 'noun', 'Senior university teacher', 'profesor', 'The professor published three books last year.', 'education', 'A2', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'professorship (noun)', 'professor of history, assistant professor'),
  ('lecture', '/ˈlektʃər/', 'noun', 'An educational talk to an audience', 'kuliah/ceramah', 'The lecture covered Renaissance art.', 'education', 'A2', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'lecturer (noun)', 'attend a lecture, give a lecture'),
  ('seminar', '/ˈsemɪnɑːr/', 'noun', 'A small class for discussion', 'seminar', 'The seminar focuses on public speaking.', 'education', 'B1', '["TOEFL_IBT","IELTS"]', 'medium', 'seminarian (noun)', 'attend a seminar'),
  ('tutorial', '/tuːˈtɔːriəl/', 'noun', 'A period of teaching for one student or small group', 'tutorial', 'Tutorials are held every Tuesday.', 'education', 'B1', '["TOEFL_IBT","IELTS"]', 'medium', 'tutor (noun)', 'one-on-one tutorial'),
  ('examination', '/ɪɡˌzæmɪˈneɪʃən/', 'noun', 'A formal test of knowledge', 'ujian', 'Final examinations will be held in May.', 'education', 'B1', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'examine (verb), exam (short)', 'sit an examination, take an examination'),
  ('assignment', '/əˈsaɪnmənt/', 'noun', 'A task given as part of coursework', 'tugas', 'Submit your assignment by Friday.', 'education', 'A2', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'assign (verb)', 'complete an assignment, hand in an assignment'),
  ('prerequisite', '/ˌpriːˈrekwəzɪt/', 'noun', 'Something required before something else', 'prasyarat', 'Calculus is a prerequisite for this course.', 'education', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'prerequisite course', 'prerequisite for'),
  ('qualification', '/ˌkwɑːlɪfɪˈkeɪʃən/', 'noun', 'An official achievement; a skill', 'kualifikasi', 'This job requires specific qualifications.', 'education', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'qualify (verb), qualified (adj)', 'academic qualifications, professional qualifications'),

-- ===========================================================================
-- TOPIC 2: ENVIRONMENT
-- ===========================================================================

  ('sustainability', '/səˌsteɪnəˈbɪləti/', 'noun', 'Ability to maintain over time', 'keberlanjutan', 'Sustainability is key to long-term business success.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'sustainable (adj), sustain (verb)', 'environmental sustainability, sustainable development'),
  ('biodiversity', '/ˌbaɪoʊdaɪˈvɜːrsəti/', 'noun', 'Variety of plant and animal life', 'keanekaragaman hayati', 'Deforestation threatens global biodiversity.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'biodiverse (adj)', 'biodiversity loss, protect biodiversity'),
  ('conservation', '/ˌkɑːnsərˈveɪʃən/', 'noun', 'Protection of nature and resources', 'konservasi', 'Wildlife conservation is essential.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'conserve (verb), conservative (adj)', 'wildlife conservation, energy conservation'),
  ('deforestation', '/diːˌfɔːrɪˈsteɪʃən/', 'noun', 'Clearing of forests', 'penebangan hutan', 'Deforestation contributes to climate change.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'deforest (verb), forested (adj)', 'tropical deforestation'),
  ('emission', '/iˈmɪʃən/', 'noun', 'Gas released into the atmosphere', 'emisi', 'Carbon emissions need to be reduced.', 'environment', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'emit (verb)', 'carbon emissions, greenhouse gas emissions'),
  ('ecosystem', '/ˈiːkoʊsɪstəm/', 'noun', 'Community of living things and their environment', 'ekosistem', 'Coral reefs are complex ecosystems.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'eco- (prefix)', 'marine ecosystem, forest ecosystem'),
  ('pollution', '/pəˈluːʃən/', 'noun', 'Contamination of environment', 'polusi', 'Air pollution is a major health concern.', 'environment', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'pollute (verb), polluted (adj)', 'air pollution, water pollution'),
  ('renewable', '/rɪˈnuːəbl/', 'adj', 'Energy source that doesn''t run out', 'terbarukan', 'Solar power is a renewable energy source.', 'environment', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'renew (verb), renewal (noun)', 'renewable energy, renewable resources'),
  ('extinction', '/ɪkˈstɪŋkʃən/', 'noun', 'Disappearance of a species', 'kepunahan', 'Many species face extinction.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'extinct (adj), extinguish (verb)', 'mass extinction, near extinction'),
  ('greenhouse', '/ˈɡriːnhaʊs/', 'noun', 'Glass building for plants; also, greenhouse effect', 'rumah kaca', 'The greenhouse effect causes global warming.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'greenhouse gas', 'greenhouse effect, greenhouse gases'),
  ('climate', '/ˈklaɪmət/', 'noun', 'Long-term weather patterns', 'iklim', 'Climate change is a global concern.', 'environment', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'climatic (adj)', 'climate change, climate crisis'),
  ('fossil', '/ˈfɑːsl/', 'noun', 'Preserved remains; or, fossil fuel', 'fosil', 'Burning fossil fuels releases CO2.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'fossilize (verb)', 'fossil fuels, fossil fuel emissions'),
  ('recycle', '/ˌriːˈsaɪkl/', 'verb', 'Process waste for reuse', 'mendaur ulang', 'We should recycle paper and plastic.', 'environment', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'recyclable (adj), recycling (noun)', 'recycle bin, recycling plant'),
  ('habitat', '/ˈhæbɪtæt/', 'noun', 'Natural environment of an animal', 'habitat', 'The rainforest is home to many habitats.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'habitation (noun)', 'natural habitat, habitat loss'),
  ('ozone', '/ˈoʊzoʊn/', 'noun', 'Gas that protects Earth from UV', 'ozon', 'The ozone layer is thinning.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'ozone depletion', 'ozone layer'),
  ('drought', '/draʊt/', 'noun', 'Long period without rain', 'kekeringan', 'The drought destroyed crops.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'drought-resistant (adj)', 'severe drought'),
  ('flood', '/flʌd/', 'noun', 'Overflow of water', 'banjir', 'The flood displaced thousands of people.', 'environment', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'flooding (noun), floodplain (noun)', 'flash flood'),
  ('contaminate', '/kənˈtæmɪneɪt/', 'verb', 'Make impure by contact', 'mencemari', 'Industrial waste contaminated the river.', 'environment', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'contaminant (noun), contamination (noun)', 'contaminated water'),

-- ===========================================================================
-- TOPIC 3: TECHNOLOGY
-- ===========================================================================

  ('innovation', '/ˌɪnəˈveɪʃən/', 'noun', 'New idea or method', 'inovasi', 'Innovation drives economic growth.', 'technology', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'innovate (verb), innovative (adj)', 'technological innovation, drive innovation'),
  ('automation', '/ɔːˈtɑːməʃən/', 'noun', 'Use of machines to do work', 'otomatisasi', 'Automation has replaced many manual jobs.', 'technology', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'automate (verb), automatic (adj)', 'industrial automation'),
  ('artificial', '/ˌɑːrtɪˈfɪʃəl/', 'adj', 'Made by humans, not natural', 'buatan/buatan', 'Artificial intelligence is transforming industries.', 'technology', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'artificially (adv)', 'artificial intelligence, artificial selection'),
  ('algorithm', '/ˈælɡərɪðəm/', 'noun', 'A set of rules for solving problems', 'algoritma', 'Algorithms power search engines.', 'technology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'algorithmic (adj)', 'machine learning algorithm'),
  ('cybersecurity', '/ˌsaɪbərsɪˈkjʊrəti/', 'noun', 'Protection of computer systems', 'keamanan siber', 'Cybersecurity is a growing concern.', 'technology', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'cyber (prefix)', 'cybersecurity threats'),
  ('digital', '/ˈdɪdʒɪtəl/', 'adj', 'Relating to digital technology', 'digital', 'Digital media has changed advertising.', 'technology', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'digitize (verb)', 'digital age, digital revolution'),
  ('software', '/ˈsɔːftwer/', 'noun', 'Computer programs', 'perangkat lunak', 'The software needs updating.', 'technology', 'A2', '["TOEFL_IBT","TOEFL_ITP","IELTS","TOEIC"]', 'high', 'soft (adj)', 'software development'),
  ('hardware', '/ˈhɑːrdwer/', 'noun', 'Physical computer components', 'perangkat keras', 'The hardware is more expensive than software.', 'technology', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'hard (adj)', 'computer hardware'),
  ('database', '/ˈdeɪtəbeɪs/', 'noun', 'Organized collection of data', 'basis data', 'The database stores customer information.', 'technology', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'data (noun)', 'database management'),
  ('bandwidth', '/ˈbændwɪdθ/', 'noun', 'Capacity for data transmission', 'bandwidth', 'Higher bandwidth allows faster downloads.', 'technology', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'medium', 'wide-band (adj)', 'limited bandwidth'),
  ('encryption', '/ɪnˈkrɪpʃən/', 'noun', 'Process of encoding information', 'enkripsi', 'Encryption protects online transactions.', 'technology', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'encrypt (verb)', 'data encryption'),
  ('cloud', '/klaʊd/', 'noun', 'Internet-based computing service', 'awan/komputasi awan', 'We store files in the cloud.', 'technology', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'cloud-based (adj)', 'cloud computing, cloud storage'),
  ('interface', '/ˈɪntərfeɪs/', 'noun', 'A point of interaction between systems', 'antarmuka', 'The user interface is intuitive.', 'technology', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'interfacial (adj)', 'user interface, interface design'),
  ('maintenance', '/ˈmeɪntənəns/', 'noun', 'Process of maintaining something', 'pemeliharaan', 'Regular maintenance prevents breakdowns.', 'technology', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'maintain (verb)', 'system maintenance, maintenance costs'),

-- ===========================================================================
-- TOPIC 4: HEALTH
-- ===========================================================================

  ('nutrition', '/nuˈtrɪʃən/', 'noun', 'Process of consuming food for health', 'nutrisi', 'Good nutrition is essential for health.', 'health', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'nutritious (adj), nutrient (noun)', 'balanced nutrition'),
  ('obesity', '/oʊˈbiːsəti/', 'noun', 'Condition of being severely overweight', 'obesitas', 'Obesity rates are rising globally.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'obese (adj)', 'childhood obesity'),
  ('sedentary', '/ˈsedənteri/', 'adj', 'Involving little physical activity', 'tidak banyak bergerak', 'A sedentary lifestyle increases health risks.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'sedentary behavior', 'sedentary lifestyle, sedentary job'),
  ('pandemic', '/pænˈdemɪk/', 'noun', 'Disease spread over a whole country or world', 'pandemi', 'The COVID-19 pandemic changed daily life.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'pandemic-related (adj)', 'global pandemic'),
  ('epidemic', '/ˌepɪˈdemɪk/', 'noun', 'Disease affecting many people in a community', 'wabah', 'The flu epidemic caused school closures.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'epidemiology (noun)', 'epidemic outbreak'),
  ('vaccine', '/vækˈsiːn/', 'noun', 'Substance to protect against disease', 'vaksin', 'The new vaccine is highly effective.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'vaccinate (verb), vaccination (noun)', 'develop a vaccine'),
  ('antibiotic', '/ˌæntibaɪˈɑːtɪk/', 'noun', 'Medicine that kills bacteria', 'antibiotik', 'Antibiotics don''t work against viruses.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'anti- (prefix), biotic (adj)', 'antibiotic resistance'),
  ('diagnosis', '/ˌdaɪəɡˈnoʊsɪs/', 'noun', 'Identification of an illness', 'diagnosis', 'Early diagnosis improves outcomes.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'diagnose (verb), diagnostic (adj)', 'medical diagnosis'),
  ('symptom', '/ˈsɪmptəm/', 'noun', 'A sign of a disease', 'gejala', 'Fever is a common symptom of the flu.', 'health', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'symptomatic (adj)', 'common symptoms, severe symptoms'),
  ('treatment', '/ˈtriːtmənt/', 'noun', 'Medical care for a condition', 'perawatan', 'The treatment requires daily medication.', 'health', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'treat (verb)', 'medical treatment'),
  ('prevention', '/prɪˈvenʃən/', 'noun', 'Action to stop something from happening', 'pencegahan', 'Prevention is better than cure.', 'health', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'prevent (verb), preventive (adj)', 'disease prevention'),
  ('rehabilitation', '/ˌriːəˌbɪlɪˈteɪʃən/', 'noun', 'Process of restoring health', 'rehabilitasi', 'The athlete is in rehabilitation after surgery.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'rehabilitate (verb)', 'rehabilitation program'),
  ('immune', '/ɪˈmjuːn/', 'adj', 'Protected against a disease', 'kebal', 'A healthy diet boosts the immune system.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'immunity (noun), immunization (noun)', 'immune system, immune response'),
  ('chronic', '/ˈkrɑːnɪk/', 'adj', 'Persisting for a long time', 'kronis', 'Diabetes is a chronic disease.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'chronically (adv)', 'chronic illness, chronic pain'),
  ('acute', '/əˈkjuːt/', 'adj', 'Sharp or severe; short-term', 'akut', 'He had an acute asthma attack.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'acutely (adv), acuity (noun)', 'acute pain, acute disease'),
  ('genetic', '/dʒəˈnetɪk/', 'adj', 'Relating to genes', 'genetik', 'Some diseases have genetic causes.', 'health', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'gene (noun), genetics (noun)', 'genetic disorder, genetic engineering'),
  ('mental', '/ˈmentl/', 'adj', 'Relating to the mind', 'mental', 'Mental health is just as important as physical health.', 'health', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'mentally (adv)', 'mental health, mental illness'),

-- ===========================================================================
-- TOPIC 5: BUSINESS & WORK (HIGH PRIORITY FOR TOEIC)
-- ===========================================================================

  ('revenue', '/ˈrevənuː/', 'noun', 'Income, especially of a business', 'pendapatan', 'The company''s revenue grew 20% last year.', 'business', 'B1', '["TOEFL_IBT","TOEIC","IELTS"]', 'high', 'revenues (plural)', 'annual revenue, total revenue'),
  ('profit', '/ˈprɑːfɪt/', 'noun', 'Money gained from a business', 'keuntungan', 'The company posted record profits.', 'business', 'A2', '["TOEFL_IBT","TOEIC","IELTS"]', 'high', 'profitable (adj), profitability (noun)', 'gross profit, net profit'),
  ('investment', '/ɪnˈvestmənt/', 'noun', 'Money put into something for profit', 'investasi', 'The investment yielded high returns.', 'business', 'B1', '["TOEFL_IBT","TOEIC","IELTS"]', 'high', 'invest (verb), investor (noun)', 'foreign investment, capital investment'),
  ('budget', '/ˈbʌdʒɪt/', 'noun', 'Plan of income and expenses', 'anggaran', 'The marketing budget was cut.', 'business', 'A2', '["TOEFL_IBT","TOEIC","IELTS"]', 'high', 'budgetary (adj)', 'annual budget, tight budget'),
  ('invoice', '/ˈɪnvɔɪs/', 'noun', 'A bill for goods or services', 'faktur', 'Please send the invoice by email.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'invoice (verb)', 'pay an invoice, send an invoice'),
  ('salary', '/ˈsæləri/', 'noun', 'Fixed regular payment for work', 'gaji', 'Her salary is quite competitive.', 'business', 'A2', '["TOEFL_IBT","TOEFL_ITP","TOEIC"]', 'high', 'salaries (plural)', 'annual salary, base salary'),
  ('wage', '/weɪdʒ/', 'noun', 'Payment for work, usually hourly/daily', 'upah', 'The minimum wage has been raised.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'wages (plural)', 'hourly wage, minimum wage'),
  ('promotion', '/prəˈmoʊʃən/', 'noun', 'Advancement in rank; marketing activity', 'promosi/kenaikan pangkat', 'She received a promotion to manager.', 'business', 'A2', '["TOEFL_IBT","TOEIC","IELTS"]', 'high', 'promote (verb), promotional (adj)', 'job promotion, sales promotion'),
  ('client', '/ˈklaɪənt/', 'noun', 'A customer using professional services', 'klien', 'We value our long-term clients.', 'business', 'A2', '["TOEFL_IBT","TOEIC"]', 'high', 'clientele (noun)', 'client base, potential client'),
  ('customer', '/ˈkʌstəmər/', 'noun', 'A person who buys goods/services', 'pelanggan', 'Customer satisfaction is our priority.', 'business', 'A2', '["TOEFL_IBT","TOEIC"]', 'high', 'custom (noun)', 'customer service, customer satisfaction'),
  ('supplier', '/səˈplaɪər/', 'noun', 'A person or company that supplies', 'pemasok', 'We are looking for new suppliers.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'supply (verb), supplies (noun)', 'main supplier, supplier contract'),
  ('deadline', '/ˈdedlaɪn/', 'noun', 'A time by which something must be done', 'tenggat waktu', 'The deadline for applications is Friday.', 'business', 'A2', '["TOEFL_IBT","TOEFL_ITP","TOEIC"]', 'high', 'deadline-driven (adj)', 'meet a deadline, miss a deadline'),
  ('meeting', '/ˈmiːtɪŋ/', 'noun', 'A gathering for discussion', 'rapat', 'The meeting was scheduled for 3 PM.', 'business', 'A2', '["TOEFL_IBT","TOEFL_ITP","TOEIC"]', 'high', 'meet (verb)', 'attend a meeting, schedule a meeting'),
  ('agenda', '/əˈdʒendə/', 'noun', 'A list of items to be addressed', 'agenda', 'The first item on the agenda is the budget.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'agenda item', 'set the agenda, hidden agenda'),
  ('quarterly', '/ˈkwɔːrtərli/', 'adj', 'Occurring every quarter (3 months)', 'triwulan', 'The quarterly report is due next week.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'quarter (noun)', 'quarterly earnings'),
  ('department', '/dɪˈpɑːrtmənt/', 'noun', 'A division of an organization', 'departemen', 'She works in the marketing department.', 'business', 'A2', '["TOEFL_IBT","TOEFL_ITP","TOEIC"]', 'high', 'departmental (adj)', 'human resources department, sales department'),
  ('colleague', '/ˈkɑːliːɡ/', 'noun', 'A person one works with', 'rekan kerja', 'My colleagues are very supportive.', 'business', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'collegial (adj)', 'work colleague, close colleague'),
  ('deadline', '/ˈdedlaɪn/', 'noun', 'A time by which something must be done', 'tenggat', 'Submit before the deadline.', 'business', 'A2', '["TOEFL_IBT","TOEIC"]', 'high', NULL, 'miss a deadline'),
  ('headquarters', '/ˈhedˌkwɔːrtərz/', 'noun', 'The main office of an organization', 'kantor pusat', 'The company''s headquarters is in Jakarta.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'headquarter (verb)', 'corporate headquarters'),
  ('merger', '/ˈmɜːrdʒər/', 'noun', 'Combining of two companies', 'penggabungan', 'The merger created a larger company.', 'business', 'B2', '["TOEFL_IBT","TOEIC"]', 'high', 'merge (verb)', 'company merger'),
  ('shareholder', '/ˈʃerhoʊldər/', 'noun', 'A person who owns shares in a company', 'pemegang saham', 'Shareholders will vote on the proposal.', 'business', 'B2', '["TOEFL_IBT","TOEIC"]', 'high', 'share (noun)', 'major shareholder'),
  ('marketing', '/ˈmɑːrkətɪŋ/', 'noun', 'The action of promoting products', 'pemasaran', 'Digital marketing has grown rapidly.', 'business', 'A2', '["TOEFL_IBT","TOEIC","IELTS"]', 'high', 'market (verb/noun), marketable (adj)', 'marketing strategy'),
  ('advertising', '/ˈædvərtaɪzɪŋ/', 'noun', 'The activity of promoting products to the public', 'periklanan', 'The company spent a lot on advertising.', 'business', 'A2', '["TOEFL_IBT","TOEIC","IELTS"]', 'high', 'advertise (verb), advertisement (noun)', 'advertising campaign'),
  ('retail', '/ˈriːteɪl/', 'noun', 'Sale of goods to the public', 'eceran', 'The retail sector grew 5% last year.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'retailer (noun)', 'retail price, retail store'),
  ('wholesale', '/ˈhoʊlseɪl/', 'noun', 'Sale of goods in large quantities', 'grosir', 'Wholesale prices are lower than retail.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'wholesaler (noun)', 'wholesale market'),
  ('inventory', '/ˈɪnvəntɔːri/', 'noun', 'Stock of goods held by a business', 'inventaris', 'We need to reduce the inventory.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'inventorize (verb)', 'inventory management'),
  ('shipment', '/ˈʃɪpmənt/', 'noun', 'Goods transported together', 'pengiriman', 'The shipment arrived on time.', 'business', 'B1', '["TOEFL_IBT","TOEIC"]', 'high', 'ship (verb)', 'shipment tracking'),
  ('logistics', '/ləˈdʒɪstɪks/', 'noun', 'Coordination of complex operations', 'logistik', 'Logistics is a key part of e-commerce.', 'business', 'B2', '["TOEFL_IBT","TOEIC"]', 'high', 'logistical (adj)', 'logistics management'),
  ('negotiation', '/nɪˌɡoʊʃiˈeɪʃən/', 'noun', 'Discussion to reach an agreement', 'negosiasi', 'The negotiation took three hours.', 'business', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'negotiate (verb)', 'salary negotiation'),
  ('contract', '/ˈkɑːntrækt/', 'noun', 'A binding agreement', 'kontrak', 'Please sign the contract.', 'business', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'contractual (adj), contract (verb)', 'sign a contract, employment contract'),

-- ===========================================================================
-- TOPIC 6: SOCIETY & GOVERNMENT
-- ===========================================================================

  ('democracy', '/dɪˈmɑːkrəsi/', 'noun', 'A system of government by the people', 'demokrasi', 'Democracy requires active citizens.', 'society', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'democratic (adj), democratize (verb)', 'democratic government'),
  ('policy', '/ˈpɑːləsi/', 'noun', 'A course of action adopted by a government/organization', 'kebijakan', 'The new policy affects all employees.', 'society', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'policy-maker (noun)', 'government policy, foreign policy'),
  ('legislation', '/ˌledʒɪsˈleɪʃən/', 'noun', 'Laws collectively', 'legislasi', 'The legislation was passed unanimously.', 'society', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'legislate (verb), legislative (adj)', 'environmental legislation'),
  ('constitution', '/ˌkɑːnstəˈtuːʃən/', 'noun', 'The fundamental laws of a country', 'konstitusi', 'The constitution guarantees free speech.', 'society', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'constitutional (adj)', 'amend the constitution'),
  ('institution', '/ˌɪnstɪˈtuːʃən/', 'noun', 'An established organization or practice', 'lembaga', 'Universities are important institutions.', 'society', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'institutional (adj), institutionalize (verb)', 'financial institution'),
  ('community', '/kəˈmjuːnəti/', 'noun', 'A group of people with shared interests', 'masyarakat', 'The local community supports the new park.', 'society', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'community-based (adj)', 'local community, online community'),
  ('population', '/ˌpɑːpjəˈleɪʃən/', 'noun', 'All the inhabitants of an area', 'populasi', 'The population has doubled in 50 years.', 'society', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'populate (verb), populous (adj)', 'global population, aging population'),
  ('immigration', '/ˌɪmɪˈɡreɪʃən/', 'noun', 'The action of coming to live in another country', 'imigrasi', 'Immigration has shaped the country''s culture.', 'society', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'immigrate (verb), immigrant (noun)', 'immigration policy'),
  ('discrimination', '/dɪˌskrɪmɪˈneɪʃən/', 'noun', 'Unjust treatment of different categories', 'diskriminasi', 'Discrimination based on race is illegal.', 'society', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'discriminate (verb), discriminatory (adj)', 'racial discrimination'),
  ('inequality', '/ˌɪnɪˈkwɑːləti/', 'noun', 'Lack of equality', 'ketidaksetaraan', 'Income inequality is a major issue.', 'society', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'equal (adj), equalize (verb)', 'social inequality, economic inequality'),
  ('poverty', '/ˈpɑːvərti/', 'noun', 'The state of being extremely poor', 'kemiskinan', 'Poverty affects millions worldwide.', 'society', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'poor (adj), impoverish (verb)', 'extreme poverty, poverty line'),
  ('wealth', '/welθ/', 'noun', 'An abundance of valuable possessions', 'kekayaan', 'Wealth distribution is uneven.', 'society', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'wealthy (adj)', 'wealth gap, national wealth'),
  ('globalization', '/ˌɡloʊbələˈzeɪʃən/', 'noun', 'The process of global integration', 'globalisasi', 'Globalization affects local economies.', 'society', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'global (adj), globalize (verb)', 'economic globalization'),
  ('urbanization', '/ˌɜːrbənəˈzeɪʃən/', 'noun', 'The process of becoming more urban', 'urbanisasi', 'Urbanization has accelerated in Asia.', 'society', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'urban (adj), urbanize (verb)', 'rapid urbanization'),
  ('culture', '/ˈkʌltʃər/', 'noun', 'The ideas and customs of a society', 'budaya', 'Cultural diversity enriches society.', 'society', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'cultural (adj), culturally (adv)', 'cultural exchange, cultural identity'),
  ('tradition', '/trəˈdɪʃən/', 'noun', 'A long-established custom', 'tradisi', 'The festival is a centuries-old tradition.', 'society', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'traditional (adj), traditionally (adv)', 'cultural tradition, family tradition'),
  ('crime', '/kraɪm/', 'noun', 'An illegal act', 'kejahatan', 'Crime rates have decreased.', 'society', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'criminal (adj/noun)', 'crime rate, violent crime'),
  ('citizen', '/ˈsɪtɪzən/', 'noun', 'A member of a country', 'warga negara', 'Every citizen has rights and duties.', 'society', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'citizenship (noun)', 'senior citizen, citizen participation'),

-- ===========================================================================
-- TOPIC 7: COMMUNICATION & MEDIA
-- ===========================================================================

  ('communication', '/kəˌmjuːnɪˈkeɪʃən/', 'noun', 'The act of conveying information', 'komunikasi', 'Effective communication is key.', 'media', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'communicate (verb), communicative (adj)', 'communication skills, communication technology'),
  ('media', '/ˈmiːdiə/', 'noun', 'Means of communication', 'media', 'Social media has changed how we communicate.', 'media', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'multimedia (noun)', 'social media, news media'),
  ('journalist', '/ˈdʒɜːrnəlɪst/', 'noun', 'A person who writes for newspapers/magazines', 'wartawan', 'The journalist reported from the conflict zone.', 'media', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'journalism (noun)', 'investigative journalist'),
  ('audience', '/ˈɔːdiəns/', 'noun', 'The viewers or listeners of a program', 'penonton/pembaca', 'The audience clapped loudly.', 'media', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', NULL, 'target audience, live audience'),
  ('broadcast', '/ˈbrɔːdkæst/', 'verb/noun', 'To transmit a program; the program itself', 'menyiarkan; siaran', 'The match was broadcast live.', 'media', 'B1', '["TOEFL_IBT","IELTS"]', 'medium', 'broadcaster (noun)', 'live broadcast'),
  ('publicity', '/pʌbˈlɪsəti/', 'noun', 'Public attention given to a person/event', 'publisitas', 'The event received widespread publicity.', 'media', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'medium', 'publicize (verb), public (adj)', 'publicity campaign'),
  ('perception', '/pərˈsepʃən/', 'noun', 'The way something is understood', 'persepsi', 'Public perception has changed.', 'media', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'perceive (verb), perceptive (adj)', 'public perception'),
  ('misinformation', '/ˌmɪsɪnfərˈmeɪʃən/', 'noun', 'False information spread unintentionally', 'informasi salah', 'Misinformation spreads quickly on social media.', 'media', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'inform (verb), information (noun)', 'fight misinformation'),
  ('propaganda', '/ˌprɑːpəˈɡændə/', 'noun', 'Information used to promote a political cause', 'propaganda', 'The film exposed wartime propaganda.', 'media', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'propagandize (verb)', 'political propaganda'),

-- ===========================================================================
-- TOPIC 8: PSYCHOLOGY & PERSONAL DEVELOPMENT
-- ===========================================================================

  ('motivation', '/ˌmoʊtɪˈveɪʃən/', 'noun', 'The reason for acting', 'motivasi', 'Motivation is key to success.', 'psychology', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'motivate (verb), motivated (adj)', 'lack of motivation, intrinsic motivation'),
  ('resilience', '/rɪˈzɪliəns/', 'noun', 'Ability to recover from setbacks', 'ketahanan', 'Resilience is a key life skill.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'resilient (adj)', 'build resilience'),
  ('perception', '/pərˈsepʃən/', 'noun', 'The way something is understood', 'persepsi', 'Self-perception affects confidence.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'perceive (verb)', 'self-perception'),
  ('consciousness', '/ˈkɑːnʃəsnəs/', 'noun', 'State of being awake and aware', 'kesadaran', 'She lost consciousness briefly.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'conscious (adj)', 'raise consciousness'),
  ('cognition', '/kɑːɡˈnɪʃən/', 'noun', 'Mental process of knowing', 'kognisi', 'Cognition declines with age.', 'psychology', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'cognitive (adj)', 'cognitive psychology'),
  ('behavior', '/bɪˈheɪvjər/', 'noun', 'The way one acts', 'perilaku', 'Positive behavior should be rewarded.', 'psychology', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'behave (verb), behavioral (adj)', 'human behavior, social behavior'),
  ('emotion', '/iˈmoʊʃən/', 'noun', 'A strong feeling', 'emosi', 'She showed no emotion.', 'psychology', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'emotional (adj), emotionally (adv)', 'emotional intelligence, control emotions'),
  ('personality', '/ˌpɜːrsəˈnæləti/', 'noun', 'The combination of characteristics of a person', 'kepribadian', 'Her personality is warm and outgoing.', 'psychology', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'personal (adj), personalize (verb)', 'personality traits'),
  ('confidence', '/ˈkɑːnfɪdəns/', 'noun', 'A feeling of self-assurance', 'kepercayaan diri', 'Public speaking builds confidence.', 'psychology', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'confident (adj)', 'self-confidence'),
  ('stress', '/stres/', 'noun', 'A state of mental tension', 'stres', 'Work-related stress is common.', 'psychology', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'stressful (adj), stressed (adj)', 'stress management'),
  ('anxiety', '/æŋˈzaɪəti/', 'noun', 'A feeling of worry or fear', 'kecemasan', 'Many students experience test anxiety.', 'psychology', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'anxious (adj)', 'anxiety disorder'),
  ('depression', '/dɪˈpreʃən/', 'noun', 'A mood disorder with persistent sadness', 'depresi', 'Depression affects millions worldwide.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'depressed (adj)', 'clinical depression'),
  ('mindfulness', '/ˈmaɪndfəlnəs/', 'noun', 'Awareness of the present moment', 'kesadaran penuh', 'Mindfulness reduces stress.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'mindful (adj)', 'practice mindfulness'),
  ('self-esteem', '/ˌselfɪˈstiːm/', 'noun', 'Confidence in one''s own worth', 'harga diri', 'Positive feedback builds self-esteem.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', NULL, 'low self-esteem'),
  ('empathy', '/ˈempəθi/', 'noun', 'The ability to understand others'' feelings', 'empati', 'Empathy is important in healthcare.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'empathetic (adj)', 'show empathy'),

-- ===========================================================================
-- TOPIC 9: SCIENCE & RESEARCH (ACADEMIC)
-- ===========================================================================

  ('hypothesis', '/haɪˈpɑːθəsɪs/', 'noun', 'A proposed explanation for a phenomenon', 'hipotesis', 'The hypothesis was confirmed.', 'science', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'hypotheses (plural), hypothesize (verb)', 'null hypothesis, test a hypothesis'),
  ('experiment', '/ɪkˈsperɪmənt/', 'noun', 'A test conducted to discover something', 'eksperimen', 'The experiment proved the theory.', 'science', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'experimental (adj), experimentation (noun)', 'conduct an experiment'),
  ('observation', '/ˌɑːbzərˈveɪʃən/', 'noun', 'The act of watching carefully', 'observasi', 'Careful observation is essential.', 'science', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'observe (verb), observatory (noun)', 'firsthand observation'),
  ('analysis', '/əˈnæləsɪs/', 'noun', 'Detailed examination of something', 'analisis', 'The analysis revealed interesting patterns.', 'science', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'analyses (plural), analyze (verb)', 'data analysis, statistical analysis'),
  ('conclusion', '/kənˈkluːʒən/', 'noun', 'A judgment reached by reasoning', 'kesimpulan', 'The conclusion was supported by data.', 'science', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'conclude (verb), conclusive (adj)', 'draw a conclusion, jump to conclusions'),
  ('evidence', '/ˈevɪdəns/', 'noun', 'Facts that support a conclusion', 'bukti', 'There is strong evidence for the theory.', 'science', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'evident (adj), evidentially (adv)', 'conclusive evidence, evidence-based'),
  ('methodology', '/ˌmeθəˈdɑːlədʒi/', 'noun', 'A system of methods used in a field', 'metodologi', 'The research methodology was rigorous.', 'science', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'method (noun), methodical (adj)', 'research methodology'),
  ('phenomenon', '/fəˈnɑːmɪnən/', 'noun', 'A fact or event observed', 'fenomena', 'The phenomenon puzzled scientists.', 'science', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'phenomena (plural), phenomenal (adj)', 'natural phenomenon'),
  ('research', '/rɪˈsɜːrtʃ/', 'noun', 'Systematic investigation', 'penelitian', 'The research is ongoing.', 'science', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'researcher (noun), research (verb)', 'conduct research, research findings'),
  ('statistics', '/stəˈtɪstɪks/', 'noun', 'Numerical data; the discipline of analyzing data', 'statistik', 'The statistics show a clear trend.', 'science', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'statistic (noun), statistical (adj), statistician (noun)', 'vital statistics, statistics course'),
  ('theory', '/ˈθɪri/', 'noun', 'A system of ideas to explain something', 'teori', 'Einstein''s theory changed physics.', 'science', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'theoretical (adj), theorize (verb)', 'in theory, scientific theory'),
  ('variable', '/ˈveriəbl/', 'noun', 'A factor that can change', 'variabel', 'Temperature is a key variable.', 'science', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'vary (verb), variation (noun)', 'dependent variable, independent variable'),
  ('species', '/ˈspiːʃiːz/', 'noun', 'A group of similar organisms', 'spesies', 'Many species are endangered.', 'science', 'B1', '["TOEFL_IBT","IELTS"]', 'high', NULL, 'endangered species, species diversity'),
  ('organism', '/ˈɔːrɡənɪzəm/', 'noun', 'An individual life form', 'organisme', 'Bacteria are single-celled organisms.', 'science', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'organize (verb), organization (noun)', 'genetically modified organism'),
  ('evolution', '/ˌevəˈluːʃən/', 'noun', 'The process of developing over time', 'evolusi', 'Darwin''s theory of evolution.', 'science', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'evolve (verb), evolutionary (adj)', 'biological evolution'),

-- ===========================================================================
-- TOPIC 10: TIME, NUMBER, QUANTITY (HIGH FREQUENCY ACROSS ALL TESTS)
-- ===========================================================================

  ('frequency', '/ˈfriːkwənsi/', 'noun', 'How often something happens', 'frekuensi', 'The frequency of the bus is every 15 minutes.', 'time', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'frequent (adj), frequently (adv)', 'high frequency, low frequency'),
  ('duration', '/dʊˈreɪʃən/', 'noun', 'The length of time something lasts', 'durasi', 'The duration of the flight is 14 hours.', 'time', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'during (prep), durable (adj)', 'duration of'),
  ('subsequent', '/ˈsʌbsɪkwənt/', 'adj', 'Coming after in time', 'selanjutnya', 'Subsequent events proved him right.', 'time', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'subsequently (adv), subsequence (noun)', 'subsequent to'),
  ('previous', '/ˈpriːviəs/', 'adj', 'Existing before in time', 'sebelumnya', 'The previous owner lived here for 20 years.', 'time', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'previously (adv)', 'previous experience, previous year'),
  ('simultaneous', '/ˌsɪmlˈteɪniəs/', 'adj', 'Happening at the same time', 'simultan', 'The broadcast was simultaneous worldwide.', 'time', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'simultaneously (adv)', 'simultaneous translation'),
  ('eventually', '/ɪˈventʃuəli/', 'adv', 'In the end, after some time', 'pada akhirnya', 'He eventually found a solution.', 'time', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'eventual (adj)', 'eventually succeed'),
  ('approximately', '/əˈprɑːksɪmətli/', 'adv', 'Close to a number but not exact', 'sekitar', 'It costs approximately $50.', 'time', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'approximate (adj), approximation (noun)', 'approximately 30 minutes'),

-- ===========================================================================
-- TOPIC 11: DESCRIPTIVE ADJECTIVES (ACADEMIC)
-- ===========================================================================

  ('significant', '/sɪɡˈnɪfɪkənt/', 'adj', 'Important or large enough to be noticed', 'signifikan/penting', 'There has been a significant change.', 'descriptive', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'signify (verb), significance (noun), significantly (adv)', 'significant impact, significant difference'),
  ('substantial', '/səbˈstænʃəl/', 'adj', 'Of considerable size or amount', 'besar/signifikan', 'She received a substantial inheritance.', 'descriptive', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'substantially (adv), substance (noun)', 'substantial amount'),
  ('considerable', '/kənˈsɪdərəbl/', 'adj', 'Large in size, amount, or extent', 'banyak/luas', 'He has considerable experience.', 'descriptive', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'considerably (adv), consider (verb)', 'considerable amount'),
  ('crucial', '/ˈkruːʃəl/', 'adj', 'Of great importance', 'penting/krusial', 'Education is crucial for success.', 'descriptive', 'B1', '["TOEFL_IBT","IELTS"]', 'high', NULL, 'crucial role, crucial moment'),
  ('essential', '/ɪˈsenʃəl/', 'adj', 'Absolutely necessary', 'penting/esensial', 'Water is essential for life.', 'descriptive', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'essence (noun), essentially (adv)', 'essential to'),
  ('adequate', '/ˈædɪkwət/', 'adj', 'Sufficient or satisfactory', 'cukup', 'The salary is not adequate.', 'descriptive', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'adequately (adv), adequacy (noun)', 'adequate resources'),
  ('comprehensive', '/ˌkɑːmprɪˈhensɪv/', 'adj', 'Including all or nearly all elements', 'menyeluruh', 'The book is a comprehensive guide.', 'descriptive', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'comprehend (verb), comprehension (noun), comprehensively (adv)', 'comprehensive study'),
  ('fundamental', '/ˌfʌndəˈmentl/', 'adj', 'Forming a foundation; essential', 'mendasar', 'Reading is a fundamental skill.', 'descriptive', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'fundamentally (adv), fundamentals (noun)', 'fundamental right, fundamental change'),
  ('primary', '/ˈpraɪmeri/', 'adj', 'Of the first importance; main', 'utama', 'The primary cause was unclear.', 'descriptive', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'primarily (adv), prime (adj)', 'primary school, primary source'),
  ('major', '/ˈmeɪdʒər/', 'adj', 'Important, serious, or significant', 'utama/besar', 'There is a major problem.', 'descriptive', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'majority (noun)', 'major change, major role'),
  ('minor', '/ˈmaɪnər/', 'adj', 'Small in importance or amount', 'kecil', 'There was a minor accident.', 'descriptive', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'minority (noun)', 'minor change, minor detail'),
  ('obvious', '/ˈɑːbviəs/', 'adj', 'Easily perceived or understood', 'jelas/terang', 'The answer was obvious.', 'descriptive', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'obviously (adv)', 'obvious reason'),
  ('apparent', '/əˈperənt/', 'adj', 'Clearly visible or understood', 'nyata', 'It became apparent that he was wrong.', 'descriptive', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'apparently (adv), appear (verb)', 'apparent contradiction'),
  ('distinct', '/dɪˈstɪŋkt/', 'adj', 'Clearly different; recognizable', 'jelas/terpisah', 'There are three distinct groups.', 'descriptive', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'distinctly (adv), distinction (noun), distinctive (adj)', 'distinct from'),
  ('eventual', '/ɪˈventʃuəl/', 'adj', 'Occurring at the end of a process', 'akhir', 'The eventual outcome was positive.', 'descriptive', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'eventually (adv), eventuality (noun)', 'eventual success'),

-- ===========================================================================
-- TOPIC 12: VERBS (HIGH FREQUENCY ACADEMIC)
-- ===========================================================================

  ('indicate', '/ˈɪndɪkeɪt/', 'verb', 'To show or point out', 'menunjukkan', 'Studies indicate a strong correlation.', 'verb', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'indication (noun), indicative (adj)', 'indicate that'),
  ('demonstrate', '/ˈdemənstreɪt/', 'verb', 'To clearly show', 'mendemonstrasikan', 'The data demonstrates the trend.', 'verb', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'demonstration (noun), demonstrative (adj)', 'demonstrate that'),
  ('establish', '/ɪˈstæblɪʃ/', 'verb', 'To set up on a firm basis', 'mendirikan/menetapkan', 'The company was established in 1990.', 'verb', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'establishment (noun)', 'establish a relationship'),
  ('contribute', '/kənˈtrɪbjuːt/', 'verb', 'To give or add to', 'berkontribusi', 'Many factors contribute to success.', 'verb', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'contribution (noun), contributor (noun)', 'contribute to'),
  ('influence', '/ˈɪnfluəns/', 'verb/noun', 'To affect or change; the effect itself', 'mempengaruhi', 'Climate influences agriculture.', 'verb', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'influential (adj)', 'have influence on'),
  ('require', '/rɪˈkwaɪər/', 'verb', 'To need or demand', 'membutuhkan', 'The job requires patience.', 'verb', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'requirement (noun), required (adj)', 'require that'),
  ('interpret', '/ɪnˈtɜːrprɪt/', 'verb', 'To explain the meaning of', 'menafsirkan', 'How do you interpret the data?', 'verb', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'interpretation (noun), interpreter (noun)', 'interpret results'),
  ('assume', '/əˈsuːm/', 'verb', 'To suppose; to take on', 'mengasumsikan', 'I assume you are tired.', 'verb', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'assumption (noun), assumed (adj)', 'assume that'),
  ('constitute', '/ˈkɑːnstɪtuːt/', 'verb', 'To make up or form', 'menjadi', 'Women constitute 50% of the workforce.', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'constitution (noun), constituent (noun)', 'constitute a majority'),
  ('proceed', '/prəˈsiːd/', 'verb', 'To continue or go forward', 'melanjutkan', 'Please proceed to the next step.', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'proceeds (noun, financial), procedure (noun)', 'proceed with'),
  ('derive', '/dɪˈraɪv/', 'verb', 'To obtain from a source', 'berasal', 'The word derives from Latin.', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'derivation (noun), derivative (adj)', 'derive from'),
  ('diminish', '/dɪˈmɪnɪʃ/', 'verb', 'To make smaller or less', 'berkurang', 'Her enthusiasm did not diminish.', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'diminished (adj)', 'diminish over time'),
  ('eliminate', '/ɪˈlɪmɪneɪt/', 'verb', 'To completely remove', 'menghilangkan', 'We need to eliminate waste.', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'elimination (noun)', 'eliminate the risk'),
  ('facilitate', '/fəˈsɪlɪteɪt/', 'verb', 'To make easier', 'memudahkan', 'Technology facilitates communication.', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'facility (noun), facilitation (noun)', 'facilitate learning'),
  ('generate', '/ˈdʒenəreɪt/', 'verb', 'To produce or create', 'menghasilkan', 'Solar panels generate electricity.', 'verb', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'generation (noun), generator (noun)', 'generate income'),
  ('implement', '/ˈɪmplɪment/', 'verb', 'To put into effect', 'menerapkan', 'We will implement the new policy.', 'verb', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'implementation (noun)', 'implement a plan'),
  ('maintain', '/meɪnˈteɪn/', 'verb', 'To keep in good condition', 'mempertahankan', 'Maintain a healthy lifestyle.', 'verb', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'maintenance (noun)', 'maintain relationships'),
  ('obtain', '/əbˈteɪn/', 'verb', 'To get or acquire', 'memperoleh', 'She obtained her degree in 2020.', 'verb', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'obtainable (adj)', 'obtain information'),
  ('participate', '/pɑːrˈtɪsɪpeɪt/', 'verb', 'To take part in', 'berpartisipasi', 'Everyone is encouraged to participate.', 'verb', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'participant (noun), participation (noun)', 'participate in'),
  ('perceive', '/pərˈsiːv/', 'verb', 'To become aware of', 'mempersepsikan', 'How do you perceive the situation?', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'perception (noun), perceptive (adj)', 'perceive as'),
  ('prohibit', '/prəˈhɪbɪt/', 'verb', 'To forbid officially', 'melarang', 'Smoking is prohibited here.', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'prohibition (noun)', 'prohibit from'),
  ('promote', '/prəˈmoʊt/', 'verb', 'To further the progress of', 'mempromosikan', 'The campaign promotes healthy eating.', 'verb', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'promotion (noun), promoter (noun)', 'promote growth'),
  ('regulate', '/ˈreɡjəleɪt/', 'verb', 'To control by rules', 'mengatur', 'The agency regulates the industry.', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'regulation (noun), regulator (noun)', 'regulate prices'),
  ('respond', '/rɪˈspɑːnd/', 'verb', 'To answer or react', 'merespons', 'She responded to the email quickly.', 'verb', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'response (noun), respondent (noun)', 'respond to'),
  ('reveal', '/rɪˈviːl/', 'verb', 'To make known', 'mengungkap', 'The study reveals new insights.', 'verb', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'revelation (noun)', 'reveal that'),
  ('transform', '/trænsˈfɔːrm/', 'verb', 'To change completely', 'mengubah', 'Technology has transformed education.', 'verb', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'transformation (noun)', 'transform into'),
  ('utilize', '/ˈjuːtəlaɪz/', 'verb', 'To make use of', 'memanfaatkan', 'We utilize solar energy.', 'verb', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'utility (noun), utilization (noun)', 'utilize resources');
