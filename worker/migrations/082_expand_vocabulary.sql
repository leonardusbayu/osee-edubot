-- 082: Expand Vocabulary Banks — Additional Words for All 4 Tests
-- Adds ~350 more high-frequency words across 12 new + existing topics
-- Targets: IELTS 500+ words, AWL (Coxhead), TOEIC 600-word list, TOEFL academic word list
-- Compiled from: Cambridge IELTS 18 word list, AWL sublists 1-10, TOEIC 600 words,
--                Barron's 800 Essential Words, Oxford 3000

-- Note: vocabulary_banks table is created in 079. This migration adds more rows
-- and creates additional indexes.

CREATE INDEX IF NOT EXISTS idx_vb_freq ON vocabulary_banks(frequency);
CREATE INDEX IF NOT EXISTS idx_vb_test ON vocabulary_banks(tested_in);

-- ===========================================================================
-- EXPANSION TOPIC 1: GOVERNMENT & POLITICS (40 words)
-- ===========================================================================

INSERT INTO vocabulary_banks (word, ipa, pos, definition, indonesian, example, topic, cefr_level, tested_in, frequency, word_family, collocations) VALUES
  ('democracy', '/dɪˈmɑːkrəsi/', 'noun', 'A system of government where people vote', 'demokrasi', 'Indonesia is the third-largest democracy in the world.', 'government', 'B1', '["TOEFL_IBT","IELTS","TOEFL_ITP"]', 'high', 'democratic/democrat', 'representative democracy, direct democracy'),
  ('dictatorship', '/dɪkˈteɪtərʃɪp/', 'noun', 'A system of government by one person with absolute power', 'kediktatoran', 'The country suffered under a military dictatorship for 20 years.', 'government', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'dictator/dictatorial', 'military dictatorship, totalitarian dictatorship'),
  ('legislation', '/ˌledʒɪsˈleɪʃən/', 'noun', 'A law or set of laws passed by parliament', 'legislasi', 'The new legislation requires all companies to reduce emissions.', 'government', 'B2', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'legislate/legislative/legislator', 'pass legislation, draft legislation'),
  ('constitution', '/ˌkɑːnstəˈtuːʃən/', 'noun', 'The fundamental laws of a country', 'konstitusi', 'The constitution guarantees freedom of speech.', 'government', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'constitutional/constitute', 'amend the constitution, constitutional right'),
  ('parliament', '/ˈpɑːrləmənt/', 'noun', 'The legislative body of a country', 'parlemen', 'Parliament passed the new law last week.', 'government', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'parliamentary', 'member of parliament, parliamentary debate'),
  ('election', '/ɪˈlɛkʃən/', 'noun', 'A process of choosing a leader by voting', 'pemilihan', 'The general election will be held in 2029.', 'government', 'B1', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'elect/elective/electoral', 'general election, presidential election, fair election'),
  ('campaign', '/kæmˈpeɪn/', 'noun', 'An organized effort to achieve a goal (election, change)', 'kampanye', 'Her election campaign focused on healthcare reform.', 'government', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'campaigner', 'run a campaign, election campaign, advertising campaign'),
  ('policy', '/ˈpɑːləsi/', 'noun', 'A plan of action adopted by a government or organization', 'kebijakan', 'The new foreign policy emphasizes trade over military aid.', 'government', 'B1', '["TOEFL_IBT","TOEFL_ITP","IELTS","TOEIC"]', 'high', 'policies/political/politician', 'foreign policy, economic policy, implement a policy'),
  ('reform', '/rɪˈfɔːrm/', 'noun', 'A change made to improve a system', 'reformasi', 'The government promised education reform within five years.', 'government', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'reform/reformer/reformation', 'education reform, political reform, social reform'),
  ('administration', '/ədˌmɪnɪˈstreɪʃən/', 'noun', 'The government in power, or the act of managing', 'pemerintahan', 'The new administration took office in January.', 'government', 'B2', '["TOEFL_IBT","TOEFL_ITP","IELTS","TOEIC"]', 'high', 'administer/administrator/administrative', 'federal administration, school administration'),
  ('diplomacy', '/dɪˈploʊməsi/', 'noun', 'The management of international relations', 'diplomasi', 'Diplomacy is the best way to resolve conflicts.', 'government', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'diplomat/diplomatic', 'international diplomacy, shuttle diplomacy'),
  ('treaty', '/ˈtriːti/', 'noun', 'A formal agreement between countries', 'perjanjian', 'The two countries signed a peace treaty in 1945.', 'government', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'treaties', 'peace treaty, trade treaty, sign a treaty'),
  ('sovereignty', '/ˈsɑːvrənti/', 'noun', 'The authority of a state to govern itself', 'kedaulatan', 'The nation fought for its sovereignty for centuries.', 'government', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'sovereign', 'national sovereignty, popular sovereignty'),
  ('bureaucracy', '/bjʊˈrɑːkrəsi/', 'noun', 'A system of government with many rules and officials', 'birokrasi', 'Bureaucracy often slows down decision-making.', 'government', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'bureaucrat/bureaucratic', 'cut through bureaucracy, government bureaucracy'),
  ('ballot', '/ˈbælət/', 'noun', 'A vote, especially a secret one', 'surat suara', 'The ballot is secret to protect voters'' privacy.', 'government', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'ballot', 'cast a ballot, secret ballot, ballot box'),
  ('coalition', '/ˌkoʊəˈlɪʃən/', 'noun', 'A temporary alliance of political parties', 'koalisi', 'A coalition government was formed after the election.', 'government', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'coalition', 'form a coalition, coalition government'),
  ('referendum', '/ˌrɛfəˈrɛndəm/', 'noun', 'A public vote on a single issue', 'referendum', 'The country held a referendum on EU membership.', 'government', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'referenda (plural)', 'hold a referendum, national referendum'),
  ('amendment', '/əˈmɛndmənt/', 'noun', 'A change or addition to a document (esp. constitution)', 'amandemen', 'The 19th Amendment gave women the right to vote.', 'government', 'C1', '["TOEFL_IBT","IELTS","TOEFL_ITP"]', 'low', 'amend', 'propose an amendment, pass an amendment'),
  ('impeach', '/ɪmˈpiːtʃ/', 'verb', 'To formally accuse a public official of misconduct', 'mendakwa', 'The president was impeached for corruption.', 'government', 'C2', '["TOEFL_IBT","IELTS"]', 'low', 'impeachment', 'impeach a president, face impeachment'),
  ('veto', '/ˈviːtoʊ/', 'noun/verb', 'The right to reject a decision', 'veto', 'The president used his veto to block the bill.', 'government', 'B2', '["TOEFL_IBT","IELTS"]', 'low', 'veto', 'veto power, presidential veto, override a veto'),

-- ===========================================================================
-- EXPANSION TOPIC 2: LAW & JUSTICE (30 words)
-- ===========================================================================

  ('legislation_law', '/ˌlɛdʒɪsˈleɪʃən/', 'noun', 'Laws considered collectively', 'perundang-undangan', 'New legislation on data privacy was passed this year.', 'law', 'B2', '["TOEFL_IBT","IELTS","TOEFL_ITP"]', 'high', 'legislate/legislative', 'environmental legislation, labor legislation'),
  ('jurisdiction', '/ˌdʒʊrɪsˈdɪkʃən/', 'noun', 'The official power to make legal decisions', 'yurisdiksi', 'The case falls under federal jurisdiction.', 'law', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'jurisdictional', 'outside the jurisdiction, federal jurisdiction'),
  ('plaintiff', '/ˈpleɪntɪf/', 'noun', 'A person who brings a case to court', 'penggugat', 'The plaintiff claimed the company had breached the contract.', 'law', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'plaintiff', 'plaintiff and defendant'),
  ('defendant', '/dɪˈfɛndənt/', 'noun', 'A person accused in a court of law', 'tergugat', 'The defendant was found not guilty.', 'law', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'defend/defense', 'defendant''s testimony, defense attorney'),
  ('verdict', '/ˈvɜːrdɪkt/', 'noun', 'A decision in a court case', 'vonis', 'The jury reached a verdict of not guilty.', 'law', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'verdict', 'reach a verdict, guilty verdict, majority verdict'),
  ('testimony', '/ˈtɛstɪmoʊni/', 'noun', 'A statement given as evidence', 'kesaksian', 'Her testimony was crucial to the case.', 'law', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'testify/testimonial', 'give testimony, witness testimony, expert testimony'),
  ('witness', '/ˈwɪtnəs/', 'noun', 'A person who sees an event happen', 'saksi', 'She was the only witness to the accident.', 'law', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'witness', 'eye witness, witness statement, call a witness'),
  ('attorney', '/əˈtɜːrni/', 'noun', 'A lawyer', 'pengacara', 'She hired an attorney to handle the case.', 'law', 'B1', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'attorneys', 'defense attorney, district attorney, power of attorney'),
  ('judiciary', '/dʒuːˈdɪʃieri/', 'noun', 'The branch of government that deals with the law', 'pengadilan', 'The judiciary is independent of the other branches.', 'law', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'judicial', 'independent judiciary, judicial system'),
  ('appeal', '/əˈpiːl/', 'verb/noun', 'To ask a higher court to review a decision', 'banding', 'The defense will appeal the verdict.', 'law', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'appeal', 'file an appeal, court of appeal, right to appeal'),
  ('sentence', '/ˈsɛntəns/', 'noun', 'The punishment given to someone convicted', 'hukuman', 'He received a 10-year prison sentence.', 'law', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'sentence', 'prison sentence, death sentence, serve a sentence'),
  ('convict', '/kənˈvɪkt/', 'verb', 'To declare someone guilty', 'menyalahkan', 'He was convicted of fraud.', 'law', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'conviction/convict', 'convicted of murder, previous conviction'),
  ('acquit', '/əˈkwɪt/', 'verb', 'To declare someone not guilty', 'membebaskan', 'The jury acquitted him of all charges.', 'law', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'acquittal', 'acquitted of all charges, full acquittal'),
  ('sue', '/suː/', 'verb', 'To take legal action against someone', 'menggugat', 'She sued the company for damages.', 'law', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'sue/lawsuit', 'sue for damages, file a lawsuit'),
  ('liability', '/ˌlaɪəˈbɪləti/', 'noun', 'Legal responsibility for something', 'tanggung jawab hukum', 'The company denies liability for the damage.', 'law', 'C1', '["TOEFL_IBT","IELTS","TOEIC"]', 'medium', 'liable', 'limited liability, full liability, hold liable'),
  ('copyright', '/ˈkɑːpiˌraɪt/', 'noun', 'The legal right to publish a work', 'hak cipta', 'The book is protected by copyright.', 'law', 'B1', '["TOEFL_IBT","IELTS"]', 'medium', 'copyright', 'copyright law, infringe copyright, copyright holder'),
  ('patent', '/ˈpætənt/', 'noun', 'An official right to be the only maker of something', 'paten', 'The company holds a patent on the technology.', 'law', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'medium', 'patent', 'patent application, file a patent, patent holder'),
  ('trademark', '/ˈtreɪdˌmɑːrk/', 'noun', 'A symbol that identifies a company', 'merek dagang', 'The logo is a registered trademark.', 'law', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'medium', 'trademark', 'trademark registration, trademark infringement'),
  ('ethics', '/ˈɛθɪks/', 'noun', 'Moral principles that govern behavior', 'etika', 'Medical ethics require doctors to keep patient information private.', 'law', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'ethical/ethic', 'code of ethics, ethics committee, professional ethics'),
  ('compliance', '/kəmˈplaɪəns/', 'noun', 'Acting in accordance with rules', 'kepatuhan', 'The company is in full compliance with the law.', 'law', 'C1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'comply/compliant', 'regulatory compliance, compliance officer, in compliance'),

-- ===========================================================================
-- EXPANSION TOPIC 3: HISTORY (30 words)
-- ===========================================================================

  ('era', '/ˈɪərə/', 'noun', 'A period of time in history', 'era', 'The Victorian era lasted from 1837 to 1901.', 'history', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'era', 'a new era, digital era, modern era'),
  ('century', '/ˈsɛntʃəri/', 'noun', 'A period of 100 years', 'abad', 'The 21st century began in 2001.', 'history', 'A1', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'centuries', '21st century, last century, centuries old'),
  ('decade', '/ˈdɛkeɪd/', 'noun', 'A period of 10 years', 'dekade', 'The first decade of the 21st century saw rapid change.', 'history', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'decade', 'past decade, over a decade, last decade'),
  ('dynasty', '/ˈdaɪnəsti/', 'noun', 'A series of rulers from the same family', 'dinasti', 'The Ming Dynasty ruled China for almost 300 years.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'dynasty', 'royal dynasty, ruling dynasty'),
  ('empire', '/ˈɛmpaɪər/', 'noun', 'A group of countries ruled by one monarch', 'kekaisaran', 'The Roman Empire covered much of Europe.', 'history', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'imperial/emperor', 'Roman Empire, fall of an empire, empire-building'),
  ('revolution', '/ˌrɛvəˈluːʃən/', 'noun', 'A major change or overthrow of a government', 'revolusi', 'The Industrial Revolution changed society forever.', 'history', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'revolutionary/revolt', 'industrial revolution, social revolution, peaceful revolution'),
  ('colonial', '/kəˈloʊniəl/', 'adj', 'Relating to a colony or colonization', 'kolonial', 'Indonesia fought colonial rule for many years.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'colony/colonize/colonization', 'colonial period, colonial rule, post-colonial'),
  ('medieval', '/ˌmiːdiˈiːvəl/', 'adj', 'Relating to the Middle Ages (5th-15th century)', 'abad pertengahan', 'Medieval castles still stand across Europe.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'medieval', 'medieval period, medieval history'),
  ('renaissance', '/ˈrɛnəsɑːns/', 'noun', 'A period of cultural rebirth (14th-17th century)', 'renaissance', 'The Renaissance produced many great artists.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'Renaissance', 'Italian Renaissance, renaissance of'),
  ('civilization', '/ˌsɪvələˈzeɪʃən/', 'noun', 'A complex human society', 'peradaban', 'Ancient Egyptian civilization built the pyramids.', 'history', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'civilize/civilized', 'ancient civilization, Western civilization, lost civilization'),
  ('mythology', '/mɪˈθɑːlədʒi/', 'noun', 'A collection of myths', 'mitologi', 'Greek mythology includes stories of gods and heroes.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'myth/mythological', 'Greek mythology, Norse mythology'),
  ('artifact', '/ˈɑːrtɪˌfækt/', 'noun', 'An object made by humans, often historical', 'artefak', 'The museum displays artifacts from ancient Egypt.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'artifact', 'ancient artifact, historical artifact'),
  ('archaeology', '/ˌɑːrkiˈɑːlədʒi/', 'noun', 'The study of ancient peoples through artifacts', 'arkeologi', 'Archaeology has revealed much about early humans.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'archaeologist/archaeological', 'do archaeology, archaeological dig, classical archaeology'),
  ('excavate', '/ˈɛkskəˌveɪt/', 'verb', 'To dig up artifacts from the ground', 'menggali', 'They excavated the ancient city in 1922.', 'history', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'excavation', 'excavate a site, archaeological excavation'),
  ('manuscript', '/ˈmænjəˌskrɪpt/', 'noun', 'A handwritten book or document', 'naskah', 'The library has medieval manuscripts.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'low', 'manuscript', 'ancient manuscript, original manuscript'),
  ('chronology', '/krəˈnɑːlədʒi/', 'noun', 'The order of events in time', 'kronologi', 'The chronology of the war is well documented.', 'history', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'chronological', 'establish a chronology, chronological order'),
  ('legacy', '/ˈlɛɡəsi/', 'noun', 'Something inherited from the past', 'warisan', 'His legacy lives on through his music.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'legacy', 'leave a legacy, lasting legacy'),
  ('historian', '/hɪˈstɔːriən/', 'noun', 'A person who studies history', 'sejarawan', 'Historians debate the causes of World War I.', 'history', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'historic/historical/history', 'modern historian, social historian'),
  ('warfare', '/ˈwɔːrfɛr/', 'noun', 'A way of fighting war', 'peperangan', 'Modern warfare uses advanced technology.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'war/warrior', 'guerrilla warfare, trench warfare, modern warfare'),
  ('exile', '/ˈɛksaɪl/', 'noun/verb', 'Being away from one''s home, often by force', 'pengasingan', 'He lived in exile for 20 years.', 'history', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'exile', 'live in exile, political exile, exiled from'),

-- ===========================================================================
-- EXPANSION TOPIC 4: GEOGRAPHY (25 words)
-- ===========================================================================

  ('continent', '/ˈkɑːntənənt/', 'noun', 'One of the seven large land masses', 'benua', 'Africa is the second-largest continent.', 'geography', 'A2', '["TOEFL_IBT","TOEFL_ITP","IELTS"]', 'high', 'continental', 'African continent, continent of Asia'),
  ('equator', '/ɪˈkweɪtər/', 'noun', 'The imaginary line around the middle of Earth', 'katulistiwa', 'Countries near the equator are usually hot.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'equatorial', 'above the equator, equatorial climate'),
  ('hemisphere', '/ˈhɛmɪˌsfɪr/', 'noun', 'Half of the Earth', 'belahan bumi', 'The Northern Hemisphere has most of the world''s land.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'hemisphere', 'Northern Hemisphere, Southern Hemisphere, Eastern Hemisphere'),
  ('tropic', '/ˈtrɑːpɪk/', 'noun', 'The line of latitude at 23.5° North or South', 'tropik', 'The Tropic of Cancer is in the Northern Hemisphere.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'low', 'tropical', 'Tropic of Cancer, tropical climate'),
  ('arctic', '/ˈɑːrktɪk/', 'adj', 'Relating to the North Pole region', 'arktik', 'The Arctic ice is melting rapidly.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'Arctic', 'Arctic Circle, Arctic Ocean, Arctic climate'),
  ('desert', '/ˈdɛzərt/', 'noun', 'A dry region with little rain', 'padang pasir', 'The Sahara is the largest hot desert.', 'geography', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'desert', 'Sahara Desert, desert climate, desert region'),
  ('rainforest', '/ˈreɪnˌfɔːrɪst/', 'noun', 'A dense forest with heavy rainfall', 'hutan hujan', 'The Amazon rainforest is home to many species.', 'geography', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'forest', 'tropical rainforest, Amazon rainforest, deforestation'),
  ('plateau', '/plæˈtoʊ/', 'noun', 'A flat area of high land', 'dataran tinggi', 'The Tibetan Plateau is the highest in the world.', 'geography', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'plateau', 'high plateau, Tibetan Plateau'),
  ('peninsula', '/pəˈnɪnsələ/', 'noun', 'A piece of land surrounded by water on three sides', 'semenanjung', 'Italy is a peninsula in southern Europe.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'peninsular', 'Korean Peninsula, Iberian Peninsula'),
  ('estuary', '/ˈɛstʃuˌɛri/', 'noun', 'Where a river meets the sea', 'muara sungai', 'The estuary is a rich habitat for wildlife.', 'geography', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'estuarine', 'river estuary, estuarine ecosystem'),
  ('delta', '/ˈdɛltə/', 'noun', 'A triangular area at a river''s mouth', 'delta', 'The Nile Delta is in northern Egypt.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'delta', 'river delta, Nile Delta, Mekong Delta'),
  ('strait', '/streɪt/', 'noun', 'A narrow passage of water connecting two seas', 'selat', 'The Strait of Malacca is a major shipping route.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'low', 'strait', 'Strait of Malacca, Strait of Gibraltar'),
  ('reef', '/riːf/', 'noun', 'A ridge of rock or coral in the sea', 'terumbu karang', 'The Great Barrier Reef is the world''s largest coral reef.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'reef', 'coral reef, Great Barrier Reef'),
  ('glacier', '/ˈɡleɪʃər/', 'noun', 'A large mass of ice that moves slowly', 'gletser', 'Glaciers are melting due to climate change.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'glacial', 'glacier melting, glacial retreat'),
  ('atmosphere', '/ˈætməsˌfɪr/', 'noun', 'The gases surrounding Earth; the mood of a place', 'atmosfer', 'The Earth''s atmosphere is mostly nitrogen.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'atmospheric', 'Earth''s atmosphere, atmosphere of, atmospheric pressure'),
  ('ozone', '/ˈoʊzoʊn/', 'noun', 'A gas in the atmosphere that absorbs UV radiation', 'ozon', 'The ozone layer protects us from UV radiation.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'ozone', 'ozone layer, ozone depletion'),
  ('terrain', '/təˈreɪn/', 'noun', 'The physical features of a tract of land', 'medan', 'The terrain in the north is mountainous.', 'geography', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'terrain', 'rugged terrain, mountainous terrain'),
  ('latitude', '/ˈlætɪˌtuːd/', 'noun', 'Distance north or south of the equator', 'lintang', 'Jakarta is at 6 degrees south latitude.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'latitudes', 'high latitude, low latitude'),
  ('longitude', '/ˈlɑːndʒɪˌtuːd/', 'noun', 'Distance east or west of the prime meridian', 'bujur', 'Longitude lines run from pole to pole.', 'geography', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'longitudes', 'lines of longitude'),
  ('topography', '/təˈpɑːɡrəfi/', 'noun', 'The arrangement of physical features of an area', 'topografi', 'The topography of the region includes mountains and valleys.', 'geography', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'topographic', 'topographic map'),

-- ===========================================================================
-- EXPANSION TOPIC 5: FOOD & COOKING (25 words)
-- ===========================================================================

  ('cuisine', '/kwɪˈziːn/', 'noun', 'A style of cooking', 'masakan', 'Italian cuisine is popular worldwide.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'cuisine', 'Italian cuisine, French cuisine, local cuisine'),
  ('ingredient', '/ɪnˈɡriːdiənt/', 'noun', 'A food used in a recipe', 'bahan', 'The main ingredients are flour, sugar, and eggs.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'ingredient', 'key ingredient, main ingredient, list of ingredients'),
  ('recipe', '/ˈrɛsəpi/', 'noun', 'Instructions for preparing a dish', 'resep', 'She shared her recipe for chocolate cake.', 'food', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'recipe', 'recipe book, secret recipe, follow a recipe'),
  ('appetite', '/ˈæpɪˌtaɪt/', 'noun', 'A desire for food', 'nafsu makan', 'Exercise gives me a big appetite.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'medium', 'appetite', 'lose your appetite, healthy appetite, spoil your appetite'),
  ('beverage', '/ˈbɛvərɪdʒ/', 'noun', 'A drink (formal)', 'minuman', 'The restaurant serves hot and cold beverages.', 'food', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'medium', 'beverages', 'hot beverage, cold beverage, alcoholic beverage'),
  ('nutrition', '/nuˈtrɪʃən/', 'noun', 'The process of getting food for health', 'nutrisi', 'Good nutrition is essential for health.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'nutritious/nutrient', 'balanced nutrition, proper nutrition, nutrition label'),
  ('digest', '/daɪˈdʒɛst/', 'verb', 'To break down food in the body', 'mencerna', 'Some foods are hard to digest.', 'food', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'digestion/digestive', 'digest food, hard to digest, digestive system'),
  ('protein', '/ˈproʊtiːn/', 'noun', 'A nutrient found in meat, eggs, beans', 'protein', 'Chicken is a good source of protein.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'protein', 'lean protein, protein source, high protein'),
  ('vitamin', '/ˈvaɪtəmɪn/', 'noun', 'A substance needed for health', 'vitamin', 'Oranges are rich in vitamin C.', 'food', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'vitamin', 'vitamin C, vitamin D, vitamin supplement'),
  ('calorie', '/ˈkæləri/', 'noun', 'A unit of energy in food', 'kalori', 'A balanced diet has the right number of calories.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'calorie', 'low-calorie, calorie intake, count calories'),
  ('organic', '/ɔːrˈɡænɪk/', 'adj', 'Produced without artificial chemicals', 'organik', 'Organic food is grown without pesticides.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'organic/organically', 'organic food, organic farming, certified organic'),
  ('vegan', '/ˈviːɡən/', 'noun/adj', 'A person who eats no animal products', 'vegan', 'Vegan diets exclude meat, dairy, and eggs.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'vegan', 'vegan diet, vegan lifestyle, strict vegan'),
  ('vegetarian', '/ˌvɛdʒəˈtɛriən/', 'noun/adj', 'A person who eats no meat', 'vegetarian', 'Vegetarians don''t eat meat but may eat dairy.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'vegetarian', 'vegetarian diet, vegetarian food, become vegetarian'),
  ('harvest', '/ˈhɑːrvɪst/', 'noun/verb', 'The act of gathering crops', 'panen', 'The rice harvest happens twice a year.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'harvest', 'harvest season, harvest time, harvest crops'),
  ('cultivate', '/ˈkʌltəˌveɪt/', 'verb', 'To grow crops or plants', 'menanam', 'Farmers cultivate rice in the fields.', 'food', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'cultivation', 'cultivate land, rice cultivation, cultivate relationships'),
  ('irrigation', '/ˌɪrɪˈɡeɪʃən/', 'noun', 'Supplying water to crops', 'irigasi', 'Modern irrigation has increased crop yields.', 'food', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'irrigate', 'irrigation system, drip irrigation, irrigate fields'),
  ('fertilizer', '/ˈfɜːrtəˌlaɪzər/', 'noun', 'Substance added to soil to help plants grow', 'pupuk', 'Organic fertilizer is better for the soil.', 'food', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'fertilize', 'chemical fertilizer, organic fertilizer, apply fertilizer'),
  ('pesticide', '/ˈpɛstɪˌsaɪd/', 'noun', 'Substance used to kill pests', 'pestisida', 'Many farmers are reducing their use of pesticides.', 'food', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'pesticide', 'pesticide use, pesticide residue, ban pesticides'),
  ('livestock', '/ˈlaɪvˌstɑːk/', 'noun', 'Farm animals', 'ternak', 'Livestock farming produces meat and dairy.', 'food', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'livestock', 'livestock farming, raise livestock'),
  ('aquaculture', '/ˈɑːkwəˌkʌltʃər/', 'noun', 'Farming fish and other aquatic animals', 'akuakultur', 'Aquaculture is growing rapidly to meet demand.', 'food', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'aquaculture', 'marine aquaculture, sustainable aquaculture'),

-- ===========================================================================
-- EXPANSION TOPIC 6: SPORTS & FITNESS (25 words)
-- ===========================================================================

  ('athlete', '/ˈæθliːt/', 'noun', 'A person who is good at sports', 'atlet', 'She is a professional athlete.', 'sports', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'athletic/athletics', 'top athlete, Olympic athlete, athlete''s foot'),
  ('competition', '/ˌkɑːmpəˈtɪʃən/', 'noun', 'A contest or event', 'kompetisi', 'He won the international competition.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'compete/competitive', 'enter a competition, fair competition, stiff competition'),
  ('tournament', '/ˈtʊrnəmənt/', 'noun', 'A series of games to find a winner', 'turnamen', 'The tennis tournament starts next week.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'tournament', 'golf tournament, knockout tournament'),
  ('championship', '/ˈtʃæmpiənˌʃɪp/', 'noun', 'A competition to find the best', 'kejuaraan', 'They won the world championship in 2018.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'champion', 'world championship, defend the championship'),
  ('stadium', '/ˈsteɪdiəm/', 'noun', 'A large sports arena', 'stadion', 'The stadium holds 80,000 people.', 'sports', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'stadium', 'football stadium, Olympic stadium'),
  ('referee', '/ˌrɛfəˈriː/', 'noun', 'An official who enforces rules in a game', 'wasit', 'The referee gave a red card.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'referee', 'head referee, referee the game'),
  ('opponent', '/əˈpoʊnənt/', 'noun', 'A person you compete against', 'lawan', 'She defeated her opponent in the final.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'oppose/opposition', 'tough opponent, political opponent'),
  ('victory', '/ˈvɪktəri/', 'noun', 'The act of winning', 'kemenangan', 'The team celebrated their victory.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'victor/victorious', 'narrow victory, decisive victory, victory speech'),
  ('defeat', '/dɪˈfiːt/', 'verb/noun', 'To lose or cause to lose', 'kekalahan', 'They suffered a crushing defeat.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'defeat', 'suffer a defeat, admit defeat'),
  ('trophy', '/ˈtroʊfi/', 'noun', 'An award for winning', 'piala', 'She held the trophy above her head.', 'sports', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'trophy', 'win a trophy, trophy cabinet'),
  ('medal', '/ˈmɛdəl/', 'noun', 'A metal disc given as an award', 'medali', 'He won a gold medal in swimming.', 'sports', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'medalist', 'gold medal, silver medal, bronze medal'),
  ('fitness', '/ˈfɪtnəs/', 'noun', 'The state of being physically healthy', 'kebugaran', 'Regular exercise improves fitness.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'fit', 'physical fitness, fitness center, fitness level'),
  ('endurance', '/ɪnˈdʊrəns/', 'noun', 'The ability to sustain effort', 'daya tahan', 'Marathon runners need great endurance.', 'sports', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'endure', 'physical endurance, test of endurance'),
  ('agility', '/əˈdʒɪləti/', 'noun', 'The ability to move quickly and easily', 'kelincahan', 'Gymnastics requires strength and agility.', 'sports', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'agile', 'mental agility, physical agility'),
  ('rehabilitation', '/ˌriːəˌbɪlɪˈteɪʃən/', 'noun', 'The process of restoring health', 'rehabilitasi', 'He is undergoing rehabilitation after the injury.', 'sports', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'rehabilitate', 'rehabilitation program, physical rehabilitation'),
  ('training', '/ˈtreɪnɪŋ/', 'noun', 'The process of preparing for a sport', 'pelatihan', 'Daily training is essential for athletes.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'train/trainer', 'training program, on the job training, hard training'),
  ('workout', '/ˈwɜːrkˌaʊt/', 'noun', 'A session of physical exercise', 'latihan', 'She does a 30-minute workout every morning.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'workout', 'daily workout, workout routine, intense workout'),
  ('coach', '/koʊtʃ/', 'noun', 'A person who trains a team', 'pelatih', 'The coach was very strict with the players.', 'sports', 'A1', '["TOEFL_IBT","IELTS"]', 'high', 'coach', 'head coach, life coach, coach someone'),
  ('sponsorship', '/ˈspɑːnsərˌʃɪp/', 'noun', 'Financial support from a sponsor', 'sponsorship', 'The team''s jerseys carry a sponsorship logo.', 'sports', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'sponsor', 'corporate sponsorship, sponsorship deal'),
  ('spectator', '/ˈspɛkteɪtər/', 'noun', 'A person who watches an event', 'penonton', 'Thousands of spectators cheered the runners.', 'sports', 'B1', '["TOEFL_IBT","IELTS"]', 'medium', 'spectate', 'spectator sport, casual spectator'),

-- ===========================================================================
-- EXPANSION TOPIC 7: ART & CULTURE (25 words)
-- ===========================================================================

  ('artwork', '/ˈɑːrtˌwɜːrk/', 'noun', 'A piece of art', 'karya seni', 'The museum displays modern artwork.', 'art_culture', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'art', 'original artwork, famous artwork'),
  ('sculpture', '/ˈskʌlptʃər/', 'noun', 'A 3D work of art', 'patung', 'The sculpture was made of marble.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'sculptor', 'bronze sculpture, stone sculpture, abstract sculpture'),
  ('exhibition', '/ˌɛksəˈbɪʃən/', 'noun', 'A public display of art or items', 'pameran', 'The exhibition opens next week.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'exhibit', 'art exhibition, hold an exhibition'),
  ('gallery', '/ˈɡæləri/', 'noun', 'A place where art is displayed', 'galeri', 'The gallery features works by local artists.', 'art_culture', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'gallery', 'art gallery, gallery owner, online gallery'),
  ('portrait', '/ˈpɔːrtrət/', 'noun', 'A painting of a person', 'potret', 'She painted a portrait of her mother.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'portrait', 'self-portrait, family portrait'),
  ('landscape', '/ˈlændskeɪp/', 'noun', 'A painting of natural scenery', 'lanskap', 'The landscape showed snow-capped mountains.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'landscape', 'landscape painting, urban landscape, beautiful landscape'),
  ('masterpiece', '/ˈmæstərˌpiːs/', 'noun', 'A great work of art', 'mahakarya', 'The Mona Lisa is Leonardo''s masterpiece.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'master', 'literary masterpiece, musical masterpiece'),
  ('abstract', '/ˈæbstrækt/', 'adj', 'Art that doesn''t represent realistic images', 'abstrak', 'Abstract art can be hard to interpret.', 'art_culture', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'abstract', 'abstract art, abstract idea, abstract noun'),
  ('realism', '/ˈriːəˌlɪzəm/', 'noun', 'Art that represents subjects truthfully', 'realisme', 'Realism emerged in the 19th century.', 'art_culture', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'realistic/realist', 'magical realism, social realism'),
  ('impressionism', '/ɪmˈprɛʃəˌnɪzəm/', 'noun', 'A 19th-century art movement', 'impresionisme', 'Monet was a key figure in Impressionism.', 'art_culture', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'impressionist', 'French Impressionism, impressionist painting'),
  ('modernism', '/ˈmɑːdərˌnɪzəm/', 'noun', 'A movement rejecting traditional styles', 'modernisme', 'Modernism changed literature and art in the 20th century.', 'art_culture', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'modernist', 'literary modernism, modernist literature'),
  ('postmodernism', '/poʊstˈmɑːdərˌnɪzəm/', 'noun', 'A late 20th-century movement', 'pascamodernisme', 'Postmodernism questions truth and authority.', 'art_culture', 'C2', '["TOEFL_IBT","IELTS"]', 'low', 'postmodern', 'postmodern art, postmodern literature'),
  ('festival', '/ˈfɛstəvəl/', 'noun', 'A special event or celebration', 'festival', 'The music festival attracts thousands.', 'art_culture', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'festive', 'music festival, film festival, harvest festival'),
  ('tradition', '/trəˈdɪʃən/', 'noun', 'A long-established custom or belief', 'tradisi', 'The tradition has been passed down for generations.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'traditional', 'cultural tradition, family tradition, ancient tradition'),
  ('heritage', '/ˈhɛrɪtɪdʒ/', 'noun', 'Traditions, monuments, and buildings of a country', 'warisan', 'The city is a UNESCO World Heritage site.', 'art_culture', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'heritage', 'cultural heritage, world heritage, family heritage'),
  ('ceremony', '/ˈsɛrəˌmoʊni/', 'noun', 'A formal religious or public event', 'upacara', 'The wedding ceremony was beautiful.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'ceremonial', 'opening ceremony, graduation ceremony'),
  ('ritual', '/ˈrɪtʃuəl/', 'noun', 'A series of actions performed as a custom', 'ritual', 'The ritual has been performed for centuries.', 'art_culture', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'ritual', 'religious ritual, daily ritual, ritual sacrifice'),
  ('fashion', '/ˈfæʃən/', 'noun', 'A popular style of clothes', 'mode', 'Fashion trends change every season.', 'art_culture', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'fashionable', 'fashion industry, fashion show, fashion design'),
  ('literature', '/ˈlɪtərətʃər/', 'noun', 'Written works of artistic value', 'sastra', 'She studies English literature.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'literary/literate', 'world literature, English literature, modern literature'),
  ('novel', '/ˈnɑːvəl/', 'noun', 'A long fictional book', 'novel', 'The novel won the Booker Prize.', 'art_culture', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'novel/novelist', 'historical novel, graphic novel, novel idea'),
  ('poetry', '/ˈpoʊətri/', 'noun', 'A type of writing in verse', 'puisi', 'She writes poetry about nature.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'poet/poetic', 'modern poetry, classical poetry, write poetry'),
  ('drama', '/ˈdrɑːmə/', 'noun', 'A play for the theater, TV, or radio', 'drama', 'The drama was a huge success.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'dramatic/dramatize', 'drama series, historical drama'),
  ('theater', '/ˈθiːətər/', 'noun', 'A place where plays are performed', 'teater', 'We went to the theater last night.', 'art_culture', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'theatrical', 'movie theater, theater performance'),
  ('cinema', '/ˈsɪnəmə/', 'noun', 'Movies as an art form', 'sinema', 'She studied cinema in Paris.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'cinematic', 'cinema industry, art-house cinema'),
  ('orchestra', '/ˈɔːrkɪstrə/', 'noun', 'A large group of musicians', 'orkestra', 'The orchestra played beautifully.', 'art_culture', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'orchestral', 'symphony orchestra, chamber orchestra'),

-- ===========================================================================
-- EXPANSION TOPIC 8: MUSIC (20 words)
-- ===========================================================================

  ('melody', '/ˈmɛlədi/', 'noun', 'A tune', 'melodi', 'The melody is haunting and beautiful.', 'music', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'melodic', 'catchy melody, beautiful melody'),
  ('harmony', '/ˈhɑːrməni/', 'noun', 'A combination of musical notes', 'harmoni', 'The harmony adds depth to the music.', 'music', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'harmonious', 'in harmony, vocal harmony'),
  ('rhythm', '/ˈrɪðəm/', 'noun', 'A pattern of beats in music', 'ritme', 'The rhythm is fast and energetic.', 'music', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'rhythmic', 'steady rhythm, dance rhythm'),
  ('composition', '/ˌkɑːmpəˈzɪʃən/', 'noun', 'A piece of music or writing', 'komposisi', 'This symphony is one of his finest compositions.', 'music', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'compose/composer', 'musical composition, original composition'),
  ('composer', '/kəmˈpoʊzər/', 'noun', 'A person who writes music', 'komposer', 'Beethoven was a famous composer.', 'music', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'compose', 'great composer, classical composer'),
  ('symphony', '/ˈsɪmfəni/', 'noun', 'A long orchestral piece', 'simfoni', 'The symphony has four movements.', 'music', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'symphonic', 'symphony orchestra, Beethoven''s symphonies'),
  ('genre', '/ˈʒɑːnrə/', 'noun', 'A category of music, art, or literature', 'genre', 'Jazz is a popular music genre.', 'music', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'genre', 'music genre, film genre, literary genre'),
  ('lyrics', '/ˈlɪrɪks/', 'noun', 'The words of a song', 'lirik', 'The lyrics are very moving.', 'music', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'lyric', 'song lyrics, write lyrics'),
  ('album', '/ˈælbəm/', 'noun', 'A collection of songs or recordings', 'album', 'Her new album came out last month.', 'music', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'album', 'debut album, latest album'),
  ('concert', '/ˈkɑːnsərt/', 'noun', 'A live music performance', 'konser', 'The concert was sold out.', 'music', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'concert', 'live concert, concert hall, pop concert'),
  ('vocal', '/ˈvoʊkəl/', 'adj/noun', 'Relating to the voice; a singing part', 'vokal', 'The song has strong vocals.', 'music', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'vocal', 'vocal performance, vocal range'),
  ('instrumental', '/ˌɪnstrəˈmɛntəl/', 'adj', 'Music played by instruments, no singing', 'instrumen', 'The track is purely instrumental.', 'music', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'instrumental', 'instrumental music, instrumental version'),
  ('rehearsal', '/rɪˈhɜːrsəl/', 'noun', 'A practice session before a performance', 'latihan', 'The band had a final rehearsal before the tour.', 'music', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'rehearse', 'dress rehearsal, rehearse a play'),
  ('acoustics', '/əˈkuːstɪks/', 'noun', 'The qualities of a room that affect sound', 'akustik', 'The concert hall has excellent acoustics.', 'music', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'acoustic', 'acoustic guitar, room acoustics'),
  ('solo', '/ˈsoʊloʊ/', 'noun/adj', 'A performance by one person', 'solo', 'She sang a beautiful solo.', 'music', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'solo', 'solo performance, solo career'),
  ('duet', '/duˈɛt/', 'noun', 'A song sung by two people', 'duet', 'They performed a duet together.', 'music', 'B2', '["TOEFL_IBT","IELTS"]', 'low', 'duet', 'sing a duet'),
  ('improvise', '/ˈɪmprəˌvaɪz/', 'verb', 'To create music on the spot', 'berimprovisasi', 'Jazz musicians often improvise.', 'music', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'improvisation', 'improvise on stage, musical improvisation'),

-- ===========================================================================
-- EXPANSION TOPIC 9: TRAVEL & TRANSPORTATION (25 words)
-- ===========================================================================

  ('itinerary', '/aɪˈtɪnəˌrɛri/', 'noun', 'A planned route or journey', 'rute perjalanan', 'Our itinerary includes three days in Tokyo.', 'travel', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'itinerary', 'travel itinerary, full itinerary'),
  ('destination', '/ˌdɛstɪˈneɪʃən/', 'noun', 'A place you are traveling to', 'tujuan', 'Bali is a popular tourist destination.', 'travel', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'destined', 'final destination, holiday destination'),
  ('departure', '/dɪˈpɑːrtʃər/', 'noun', 'The act of leaving', 'keberangkatan', 'Our departure is at 8 AM.', 'travel', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'depart', 'departure gate, departure time, departure lounge'),
  ('arrival', '/əˈraɪvəl/', 'noun', 'The act of reaching a place', 'kedatangan', 'Please check the arrival board.', 'travel', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'arrive', 'arrival time, arrival hall'),
  ('accommodation', '/əˌkɑːməˈdeɪʃən/', 'noun', 'A place to stay (hotel, etc.)', 'akomodasi', 'We need to book accommodation for the trip.', 'travel', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'accommodate', 'find accommodation, book accommodation'),
  ('reservation', '/ˌrɛzərˈveɪʃən/', 'noun', 'A booking in advance', 'reservasi', 'I made a reservation at the restaurant.', 'travel', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'reserve', 'hotel reservation, make a reservation'),
  ('luggage', '/ˈlʌɡɪdʒ/', 'noun', 'Bags and suitcases', 'bagasi', 'My luggage was lost at the airport.', 'travel', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'luggage', 'check luggage, hand luggage'),
  ('suitcase', '/ˈsuːtˌkeɪs/', 'noun', 'A rectangular bag for clothes', 'koper', 'She packed her suitcase the night before.', 'travel', 'A1', '["TOEFL_IBT","IELTS"]', 'high', 'suitcase', 'pack a suitcase, suitcase full of'),
  ('passport', '/ˈpæsˌpɔːrt/', 'noun', 'An official document for travel', 'paspor', 'You need a passport to travel abroad.', 'travel', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'passport', 'passport control, passport number'),
  ('customs', '/ˈkʌstəmz/', 'noun', 'The official department that checks goods', 'bea cukai', 'We had to go through customs at the airport.', 'travel', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'custom', 'customs officer, customs duty, go through customs'),
  ('visa', '/ˈviːzə/', 'noun', 'An official document allowing entry to a country', 'visa', 'You need a visa to enter the United States.', 'travel', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'visa', 'apply for a visa, tourist visa, work visa'),
  ('embassy', '/ˈɛmbəsi/', 'noun', 'A building where diplomats work', 'kedutaan', 'I went to the embassy to renew my passport.', 'travel', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'ambassador', 'US Embassy, embassy staff'),
  ('tourist', '/ˈtʊrɪst/', 'noun', 'A person traveling for pleasure', 'turis', 'The city is full of tourists in summer.', 'travel', 'A1', '["TOEFL_IBT","IELTS"]', 'high', 'tourism', 'attract tourists, tourist attraction'),
  ('sightseeing', '/ˈsaɪtˌsiːɪŋ/', 'noun', 'Visiting places of interest', 'berwisata', 'We did a lot of sightseeing in Rome.', 'travel', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'sightsee', 'go sightseeing, sightseeing tour'),
  ('landmark', '/ˈlændˌmɑːrk/', 'noun', 'A famous building or place', 'landmark', 'The Eiffel Tower is a famous landmark.', 'travel', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'landmark', 'historic landmark, cultural landmark'),
  ('souvenir', '/ˌsuːvəˈnɪr/', 'noun', 'An object kept as a reminder of a place', 'oleh-oleh', 'I bought a souvenir from Bali.', 'travel', 'B1', '["TOEFL_IBT","IELTS"]', 'medium', 'souvenir', 'buy a souvenir, souvenir shop'),
  ('boarding_pass', '/ˈbɔːrdɪŋ ˌpæs/', 'noun', 'A document to board a plane/ship', 'kartu naik', 'Please have your boarding pass ready.', 'travel', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'boarding', 'boarding gate, boarding pass'),
  ('layover', '/ˈleɪˌoʊvər/', 'noun', 'A stop between flights', 'transit', 'We had a 3-hour layover in Singapore.', 'travel', 'B1', '["TOEFL_IBT","IELTS"]', 'medium', 'layover', 'long layover, layover in'),
  ('commute', '/kəˈmjuːt/', 'verb', 'To travel regularly to work', 'berangkat kerja', 'She commutes 30 minutes to the office.', 'travel', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'commute', 'daily commute, commute to work'),
  ('traffic', '/ˈtræfɪk/', 'noun', 'Vehicles moving on a road', 'lalu lintas', 'Jakarta is famous for its heavy traffic.', 'travel', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'traffic', 'traffic jam, rush hour traffic, traffic light'),

-- ===========================================================================
-- EXPANSION TOPIC 10: WEATHER & CLIMATE (20 words)
-- ===========================================================================

  ('humidity', '/hjuːˈmɪdəti/', 'noun', 'Moisture in the air', 'kelembapan', 'The humidity in Jakarta is very high.', 'weather', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'humid', 'high humidity, relative humidity'),
  ('precipitation', '/prɪˌsɪpɪˈteɪʃən/', 'noun', 'Rain, snow, sleet, or hail that falls', 'presipitasi', 'Annual precipitation varies by region.', 'weather', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'precipitate', 'heavy precipitation, annual precipitation'),
  ('drought', '/draʊt/', 'noun', 'A long period without rain', 'kekeringan', 'The drought ruined the crops.', 'weather', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'drought', 'severe drought, drought-resistant'),
  ('flood', '/flʌd/', 'noun/verb', 'An overflow of water', 'banjir', 'The flood displaced thousands of people.', 'weather', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'flood', 'flash flood, flood damage, flooded area'),
  ('storm', '/stɔːrm/', 'noun', 'A violent weather event with wind and rain', 'badai', 'The storm caused widespread damage.', 'weather', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'stormy', 'tropical storm, severe storm'),
  ('hurricane', '/ˈhʌrɪˌkeɪn/', 'noun', 'A severe tropical storm', 'badai tropis', 'The hurricane made landfall in Florida.', 'weather', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'hurricane', 'hurricane season, hurricane warning'),
  ('typhoon', '/taɪˈfuːn/', 'noun', 'A tropical storm in the western Pacific', 'taifun', 'Typhoons often hit the Philippines.', 'weather', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'typhoon', 'typhoon warning, super typhoon'),
  ('tornado', '/tɔːrˈneɪdoʊ/', 'noun', 'A violent windstorm with a funnel shape', 'tornado', 'Tornadoes can destroy everything in their path.', 'weather', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'tornado', 'tornado warning, hit by a tornado'),
  ('avalanche', '/ˈævəˌlæntʃ/', 'noun', 'A mass of snow sliding down a mountain', 'longsor salju', 'Skiers caused a small avalanche.', 'weather', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'avalanche', 'avalanche risk, snow avalanche'),
  ('wildfire', '/ˈwaɪldˌfaɪər/', 'noun', 'A large, destructive fire in nature', 'kebakaran hutan', 'Wildfires have increased due to climate change.', 'weather', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'fire', 'wildfire season, control a wildfire'),
  ('monsoon', '/mɑːnˈsuːn/', 'noun', 'A seasonal wind bringing heavy rain', 'muson', 'The monsoon brings heavy rains to Southeast Asia.', 'weather', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'monsoon', 'monsoon season, monsoon rains'),
  ('forecast', '/ˈfɔːrˌkæst/', 'noun/verb', 'A prediction of future weather', 'ramalan', 'The forecast says it will rain tomorrow.', 'weather', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'forecast', 'weather forecast, forecast the weather'),
  ('temperature', '/ˈtɛmpərətʃər/', 'noun', 'How hot or cold something is', 'suhu', 'The temperature dropped below zero.', 'weather', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'temperate', 'high temperature, average temperature'),
  ('climate', '/ˈklaɪmət/', 'noun', 'The typical weather of a place', 'iklim', 'The climate is changing rapidly.', 'weather', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'climatic', 'climate change, tropical climate'),
  ('greenhouse_effect', '/ˈɡriːnˌhaʊs ɪˈfɛkt/', 'noun', 'Warming caused by gases in the atmosphere', 'efek rumah kaca', 'The greenhouse effect raises global temperatures.', 'weather', 'C1', '["TOEFL_IBT","IELTS"]', 'high', 'greenhouse', 'greenhouse gases, greenhouse effect'),

-- ===========================================================================
-- EXPANSION TOPIC 11: FAMILY & RELATIONSHIPS (20 words)
-- ===========================================================================

  ('sibling', '/ˈsɪblɪŋ/', 'noun', 'A brother or sister', 'saudara', 'She has two siblings.', 'family', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'sibling', 'older sibling, sibling rivalry'),
  ('offspring', '/ˈɔːfˌsprɪŋ/', 'noun', 'A person''s child or children', 'keturunan', 'The parents wanted to protect their offspring.', 'family', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'offspring', 'rear offspring, healthy offspring'),
  ('ancestor', '/ˈænˌsɛstər/', 'noun', 'A person from whom one is descended', 'nenek moyang', 'My ancestors came from Java.', 'family', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'ancestry/ancestral', 'common ancestor, ancestral home'),
  ('descendant', '/dɪˈsɛndənt/', 'noun', 'A person descended from a particular ancestor', 'keturunan', 'They are descendants of the founding family.', 'family', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'descend', 'direct descendant, descendants of'),
  ('relative', '/ˈrɛlətɪv/', 'noun', 'A family member', 'kerabat', 'We visited our relatives in Bandung.', 'family', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'relate', 'close relative, distant relative'),
  ('engagement', '/ɪnˈɡeɪdʒmənt/', 'noun', 'A promise to marry; a job/appointment', 'pertunangan', 'They announced their engagement last week.', 'family', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'engage', 'engagement ring, professional engagement'),
  ('wedding', '/ˈwɛdɪŋ/', 'noun', 'A marriage ceremony', 'pernikahan', 'The wedding will be held in June.', 'family', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'wed', 'wedding ceremony, wedding dress, white wedding'),
  ('divorce', '/dɪˈvɔːrs/', 'noun/verb', 'The legal ending of a marriage', 'perceraian', 'The divorce was finalized last year.', 'family', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'divorce', 'divorce rate, file for divorce, divorce papers'),
  ('custody', '/ˈkʌstədi/', 'noun', 'The right to care for a child', 'perwalian', 'She was granted custody of the children.', 'family', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'custodial', 'child custody, sole custody, joint custody'),
  ('inheritance', '/ɪnˈhɛrɪtəns/', 'noun', 'Property received from a dead person', 'warisan', 'She received a large inheritance from her grandmother.', 'family', 'B2', '["TOEFL_IBT","IELTS"]', 'medium', 'inherit', 'inheritance tax, family inheritance'),
  ('genealogy', '/ˌdʒiːniˈælədʒi/', 'noun', 'A study of family history', 'silsilah', 'Genealogy research can reveal surprising connections.', 'family', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'genealogical', 'genealogy research, family genealogy'),

-- ===========================================================================
-- EXPANSION TOPIC 12: TECHNOLOGY & INTERNET (25 words)
-- ===========================================================================

  ('algorithm', '/ˈælɡəˌrɪðəm/', 'noun', 'A set of rules for solving a problem (computers)', 'algoritma', 'Social media algorithms decide what you see.', 'technology', 'C1', '["TOEFL_IBT","IELTS"]', 'high', 'algorithmic', 'search algorithm, machine learning algorithm'),
  ('database', '/ˈdeɪtəˌbeɪs/', 'noun', 'A structured set of data stored electronically', 'basis data', 'The database contains millions of records.', 'technology', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'database', 'database management, access a database'),
  ('bandwidth', '/ˈbændˌwɪdθ/', 'noun', 'The capacity of a network to carry data', 'bandwidth', 'High bandwidth allows fast downloads.', 'technology', 'C1', '["TOEFL_IBT","IELTS","TOEIC"]', 'medium', 'bandwidth', 'high bandwidth, bandwidth limit'),
  ('encryption', '/ɪnˈkrɪpʃən/', 'noun', 'The process of encoding data for security', 'enkripsi', 'Encryption protects your data from hackers.', 'technology', 'C1', '["TOEFL_IBT","IELTS"]', 'high', 'encrypt', 'data encryption, end-to-end encryption'),
  ('cybersecurity', '/ˌsaɪbərsɪˈkjʊrəti/', 'noun', 'The protection of computer systems', 'keamanan siber', 'Cybersecurity is a growing concern.', 'technology', 'C1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'cybersecurity', 'cybersecurity threat, cybersecurity expert'),
  ('malware', '/ˈmælˌwɛr/', 'noun', 'Software designed to harm computers', 'malware', 'The malware infected thousands of computers.', 'technology', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'malware', 'malware attack, detect malware'),
  ('phishing', '/ˈfɪʃɪŋ/', 'noun', 'Fraudulent attempts to obtain sensitive data', 'phishing', 'Beware of phishing emails asking for passwords.', 'technology', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'phish', 'phishing email, phishing scam'),
  ('cloud_computing', '/klaʊd kəmˈpjuːtɪŋ/', 'noun', 'Computing services delivered over the internet', 'komputasi awan', 'Cloud computing has transformed how we work.', 'technology', 'C1', '["TOEFL_IBT","IELTS"]', 'high', 'cloud', 'cloud computing services, cloud storage'),
  ('virtual', '/ˈvɜːrtʃuəl/', 'adj', 'Simulated by a computer; nearly (with noun)', 'virtual', 'We had a virtual meeting on Zoom.', 'technology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'virtually', 'virtual reality, virtual assistant'),
  ('augmented', '/ɔːɡˈmɛntɪd/', 'adj', 'Enhanced with technology', 'ditingkatkan', 'Augmented reality overlays digital info on the real world.', 'technology', 'C1', '["TOEFL_IBT","IELTS"]', 'high', 'augment', 'augmented reality, augmented intelligence'),
  ('blockchain', '/ˈblɑːkˌtʃeɪn/', 'noun', 'A decentralized digital ledger', 'blockchain', 'Blockchain is the technology behind Bitcoin.', 'technology', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'blockchain', 'blockchain technology, blockchain network'),
  ('automation', '/ɔːˈtɑːməˌʃən/', 'noun', 'The use of machines to do tasks automatically', 'otomasi', 'Automation is replacing many manual jobs.', 'technology', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'automate', 'automation industry, process automation'),
  ('interface', '/ˈɪntərˌfeɪs/', 'noun', 'A point where two systems meet', 'antarmuka', 'The user interface is easy to navigate.', 'technology', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'interface', 'user interface, interface design'),
  ('platform', '/ˈplætˌfɔːrm/', 'noun', 'A system on which software runs', 'platform', 'The app is available on multiple platforms.', 'technology', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'platform', 'online platform, social media platform'),
  ('streaming', '/ˈstriːmɪŋ/', 'noun', 'Watching or listening to media in real time', 'streaming', 'Streaming services have changed how we watch TV.', 'technology', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'stream', 'live streaming, streaming service'),
  ('wireless', '/ˈwaɪərˌləs/', 'adj', 'Without wires', 'nirkabel', 'Wireless networks are everywhere.', 'technology', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'wireless', 'wireless network, wireless charging'),
  ('download', '/daʊnˈloʊd/', 'verb', 'To transfer data from the internet', 'mengunduh', 'You can download the app for free.', 'technology', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'download', 'download speed, download music'),
  ('upload', '/ʌpˈloʊd/', 'verb', 'To transfer data to the internet', 'mengunggah', 'She uploaded the video to YouTube.', 'technology', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'upload', 'upload speed, upload photos'),
  ('browse', '/braʊz/', 'verb', 'To look through information on the internet', 'menjelajah', 'I browsed the website for an hour.', 'technology', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'browser', 'browse the web, browse online'),
  ('search_engine', '/ˈsɜːrtʃ ˌɛndʒən/', 'noun', 'A system for finding information online', 'mesin pencari', 'Google is the most popular search engine.', 'technology', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'search', 'search engine results, search engine optimization'),

-- ===========================================================================
-- EXPANSION TOPIC 13: BUSINESS & FINANCE (20 words)
-- ===========================================================================

  ('revenue', '/ˈrɛvəˌnuː/', 'noun', 'Income, especially for a business', 'pendapatan', 'Annual revenue increased by 15%.', 'business', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'revenue', 'annual revenue, generate revenue, total revenue'),
  ('profit', '/ˈprɑːfɪt/', 'noun', 'Money gained from a business', 'laba', 'The company reported record profits.', 'business', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'profitable', 'net profit, gross profit, profit margin'),
  ('loss', '/lɔːs/', 'noun', 'The state of losing money', 'kerugian', 'The company suffered heavy losses.', 'business', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'lose', 'net loss, financial loss, suffer a loss'),
  ('investment', '/ɪnˈvɛstmənt/', 'noun', 'Money put into something to make a profit', 'investasi', 'Real estate is a good investment.', 'business', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'invest', 'make an investment, foreign investment'),
  ('budget', '/ˈbʌdʒɪt/', 'noun', 'A plan for how to spend money', 'anggaran', 'The budget was approved by the board.', 'business', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'budget', 'annual budget, tight budget, on a budget'),
  ('salary', '/ˈsæləri/', 'noun', 'Fixed regular payment for work', 'gaji', 'Her salary was increased last year.', 'business', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'salary', 'annual salary, high salary, salary increase'),
  ('wage', '/weɪdʒ/', 'noun', 'Money paid for hourly work', 'upah', 'The minimum wage was raised.', 'business', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'wage', 'hourly wage, minimum wage, fair wage'),
  ('bonus', '/ˈboʊnəs/', 'noun', 'Extra money given as a reward', 'bonus', 'Employees received a year-end bonus.', 'business', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'bonus', 'annual bonus, performance bonus'),
  ('promotion', '/prəˈmoʊʃən/', 'noun', 'A move to a higher position', 'promosi', 'She got a promotion to manager.', 'business', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'promote', 'get a promotion, promotion opportunity'),
  ('deadline', '/ˈdɛdˌlaɪn/', 'noun', 'A time by which something must be done', 'tenggat', 'The deadline is tomorrow at 5 PM.', 'business', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'deadline', 'meet a deadline, deadline approaching, tight deadline'),
  ('client', '/ˈklaɪənt/', 'noun', 'A person who uses a service', 'klien', 'We always put the client first.', 'business', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'client', 'client meeting, long-term client'),
  ('customer', '/ˈkʌstəmər/', 'noun', 'A person who buys goods', 'pelanggan', 'Customer satisfaction is our top priority.', 'business', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'customer', 'customer service, attract customers'),
  ('invoice', '/ˈɪnˌvɔɪs/', 'noun', 'A bill for goods or services', 'faktur', 'Please send the invoice by email.', 'business', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'invoice', 'pay an invoice, invoice number'),
  ('merger', '/ˈmɜːrdʒər/', 'noun', 'The combining of two companies', 'penggabungan', 'The merger created the world''s largest airline.', 'business', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'merge', 'company merger, complete a merger'),
  ('franchise', '/ˈfrænˌtʃaɪz/', 'noun', 'A business with the right to sell a brand', 'waralaba', 'She owns a franchise of a fast-food chain.', 'business', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'franchise', 'open a franchise, franchise owner'),
  ('monopoly', '/məˈnɑːpəli/', 'noun', 'Exclusive control of a market', 'monopoli', 'The company has a monopoly on the market.', 'business', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'monopolize', 'government monopoly, break a monopoly'),
  ('wholesale', '/ˈhoʊlˌseɪl/', 'noun/adj', 'Selling in large quantities', 'grosir', 'Wholesale prices are much lower.', 'business', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'wholesale', 'wholesale market, at wholesale prices'),
  ('retail', '/ˈriːˌteɪl/', 'noun/adj', 'Selling to the public', 'eceran', 'Retail sales increased last month.', 'business', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'retailer', 'retail price, retail store, retail industry'),
  ('logistics', '/ləˈdʒɪstɪks/', 'noun', 'Coordination of complex operations', 'logistik', 'Logistics is a key part of e-commerce.', 'business', 'C1', '["TOEFL_IBT","IELTS","TOEIC"]', 'medium', 'logistic', 'logistics company, supply chain logistics'),
  ('inventory', '/ˈɪnvənˌtɔːri/', 'noun', 'A list of goods a company has', 'persediaan', 'We need to update our inventory.', 'business', 'B2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'inventory', 'inventory management, in stock inventory'),

-- ===========================================================================
-- EXPANSION TOPIC 14: PSYCHOLOGY & BEHAVIOR (20 words)
-- ===========================================================================

  ('perception', '/pərˈsɛpʃən/', 'noun', 'The way you notice things with your senses', 'persepsi', 'Our perception of reality is shaped by experience.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'perceive', 'visual perception, public perception'),
  ('cognition', '/kɑːɡˈnɪʃən/', 'noun', 'The mental process of knowing', 'kognisi', 'Cognition includes memory, thinking, and judgment.', 'psychology', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'cognitive', 'cognitive psychology, cognitive function'),
  ('motivation', '/ˌmoʊtɪˈveɪʃən/', 'noun', 'The reason for doing something', 'motivasi', 'Intrinsic motivation comes from within.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'motivate', 'lack of motivation, high motivation'),
  ('emotion', '/ɪˈmoʊʃən/', 'noun', 'A strong feeling', 'emosi', 'He struggled to control his emotions.', 'psychology', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'emotional', 'express emotions, mixed emotions'),
  ('behavior', '/bɪˈheɪvjər/', 'noun', 'The way a person acts', 'perilaku', 'Children learn behavior from their parents.', 'psychology', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'behave', 'bad behavior, good behavior, social behavior'),
  ('personality', '/ˌpɜːrsəˈnæləti/', 'noun', 'The qualities that make a person unique', 'kepribadian', 'Her personality is warm and friendly.', 'psychology', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'personal', 'strong personality, personality type'),
  ('consciousness', '/ˈkɑːnʃəsnəs/', 'noun', 'The state of being awake and aware', 'kesadaran', 'The patient lost consciousness after the fall.', 'psychology', 'C1', '["TOEFL_IBT","IELTS"]', 'medium', 'conscious', 'level of consciousness, social consciousness'),
  ('subconscious', '/ˌsʌbˈkɑːnʃəs/', 'noun/adj', 'Below the level of conscious thought', 'bawah sadar', 'Dreams come from the subconscious.', 'psychology', 'C1', '["TOEFL_IBT","IELTS"]', 'low', 'subconscious', 'subconscious mind, subconscious desire'),
  ('instinct', '/ˈɪnˌstɪŋkt/', 'noun', 'A natural tendency to behave in a certain way', 'naluri', 'Mothers have an instinct to protect their children.', 'psychology', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'instinctive', 'natural instinct, survival instinct'),
  ('trauma', '/ˈtraʊmə/', 'noun', 'A deeply distressing experience', 'trauma', 'The accident caused long-term trauma.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'traumatic', 'childhood trauma, trauma survivor'),
  ('therapy', '/ˈθɛrəpi/', 'noun', 'Treatment for a medical or mental condition', 'terapi', 'She''s been in therapy for six months.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'therapist/therapeutic', 'speech therapy, physical therapy, therapy session'),
  ('addiction', '/əˈdɪkʃən/', 'noun', 'A strong, harmful dependence on something', 'kecanduan', 'Drug addiction is a serious problem.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'addicted/addictive', 'alcohol addiction, overcome addiction'),
  ('anxiety', '/æŋˈzaɪəti/', 'noun', 'A feeling of worry or nervousness', 'kecemasan', 'She suffers from anxiety before exams.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'anxious', 'severe anxiety, social anxiety, anxiety disorder'),
  ('depression', '/dɪˈprɛʃən/', 'noun', 'A mental condition of persistent sadness', 'depresi', 'Depression affects millions of people.', 'psychology', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'depressed/depressing', 'clinical depression, suffer from depression'),
  ('stress', '/strɛs/', 'noun', 'Mental or emotional tension', 'stres', 'Work-related stress is on the rise.', 'psychology', 'A2', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'stressful', 'stress level, reduce stress, under stress'),

-- ===========================================================================
-- EXPANSION TOPIC 15: TRANSPORTATION & VEHICLES (15 words)
-- ===========================================================================

  ('vehicle', '/ˈviːəkəl/', 'noun', 'A thing used for transporting people or goods', 'kendaraan', 'Electric vehicles are growing in popularity.', 'transportation', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'vehicular', 'motor vehicle, commercial vehicle'),
  ('subway', '/ˈsʌbˌweɪ/', 'noun', 'An underground railway system', 'kereta bawah tanah', 'The subway is the fastest way across the city.', 'transportation', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'subway', 'subway station, ride the subway'),
  ('ferry', '/ˈfɛri/', 'noun', 'A boat that carries people across water', 'kapal feri', 'We took a ferry to the island.', 'transportation', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'ferry', 'car ferry, ride a ferry'),
  ('freight', '/freɪt/', 'noun', 'Goods transported in bulk', 'kargo', 'Freight trains carry goods across the country.', 'transportation', 'B2', '["TOEFL_IBT","IELTS"]', 'high', 'freight', 'freight train, air freight, freight company'),
  ('cargo', '/ˈkɑːrɡoʊ/', 'noun', 'Goods carried by ship, plane, or vehicle', 'kargo', 'The ship was carrying cargo to Jakarta.', 'transportation', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'cargo', 'cargo ship, cargo plane, cargo hold'),
  ('pedestrian', '/pəˈdɛstriən/', 'noun', 'A person walking rather than driving', 'pejalan kaki', 'Pedestrians have the right of way at the crossing.', 'transportation', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'pedestrian', 'pedestrian crossing, pedestrian area'),
  ('intersection', '/ˌɪntərˈsɛkʃən/', 'noun', 'A point where roads cross', 'persimpangan', 'Turn left at the next intersection.', 'transportation', 'B1', '["TOEFL_IBT","IELTS"]', 'high', 'intersect', 'busy intersection, traffic intersection'),
  ('highway', '/ˈhaɪˌweɪ/', 'noun', 'A main road for fast travel', 'jalan tol', 'The highway connects Jakarta and Surabaya.', 'transportation', 'A2', '["TOEFL_IBT","IELTS"]', 'high', 'highway', 'interstate highway, highway system'),
  ('toll', '/toʊl/', 'noun', 'A fee for using a road or bridge', 'tol', 'You have to pay a toll to use this highway.', 'transportation', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'toll', 'toll road, toll booth, pay a toll'),
  ('terminal', '/ˈtɜːrmənəl/', 'noun', 'A place where transport vehicles load/unload', 'terminal', 'Please go to Terminal 3 for your flight.', 'transportation', 'B1', '["TOEFL_IBT","IELTS","TOEIC"]', 'high', 'terminal', 'airport terminal, bus terminal')
;
