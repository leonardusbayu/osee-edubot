// ═══════════════════════════════════════════════════════════════
// VOCAB PACKS — high-frequency vocabulary card packs (ROADMAP_M3 §3.4)
//
// Hardcoded, exam-accurate word banks per test type:
//   TOEFL_IBT — Academic Word List high-frequency
//   TOEFL_ITP — structure / written-expression academic words
//   IELTS     — topic vocab (environment, education, technology, health)
//   TOEIC     — business 600 core
//
// Daily drip: deterministic rotation by day-of-year so everyone gets a
// fresh 5-card set every day with zero state. /vocab in webhook.ts sends
// the cards; the 'vocab:add_today' callback enqueues them into FSRS.
// ═══════════════════════════════════════════════════════════════

export interface VocabCard {
  word: string;
  meaning_id: string; // Indonesian meaning
  example: string;    // exam-register example sentence
  collocations?: string;
}

export const CARDS_PER_DAY = 5;

export const VOCAB_PACKS: Record<string, VocabCard[]> = {
  TOEFL_IBT: [
    { word: 'analyze', meaning_id: 'menganalisis; mengurai sesuatu untuk memahaminya', example: 'Researchers analyzed the data to identify long-term climate patterns.', collocations: 'analyze data, analyze results' },
    { word: 'derive', meaning_id: 'berasal dari; memperoleh sesuatu dari sumber lain', example: 'Many English words derive from Latin and Greek roots.', collocations: 'derive from, derive benefit' },
    { word: 'hypothesis', meaning_id: 'hipotesis; dugaan ilmiah yang belum terbukti', example: 'The experiment was designed to test the hypothesis that light affects plant growth.', collocations: 'test a hypothesis, support a hypothesis' },
    { word: 'significant', meaning_id: 'signifikan; penting atau besar pengaruhnya', example: 'The study found a significant difference between the two groups.', collocations: 'statistically significant, significant impact' },
    { word: 'phenomenon', meaning_id: 'fenomena; kejadian yang dapat diamati', example: 'Migration is a natural phenomenon observed in many bird species.', collocations: 'natural phenomenon, rare phenomenon' },
    { word: 'consequence', meaning_id: 'konsekuensi; akibat dari suatu tindakan', example: 'Deforestation has serious consequences for biodiversity.', collocations: 'as a consequence, serious consequences' },
    { word: 'establish', meaning_id: 'mendirikan; menetapkan atau membuktikan', example: 'The university was established in the nineteenth century.', collocations: 'establish a link, firmly established' },
    { word: 'evidence', meaning_id: 'bukti; data yang mendukung suatu klaim', example: 'Fossil evidence suggests that the region was once covered by ocean.', collocations: 'strong evidence, evidence suggests' },
    { word: 'factor', meaning_id: 'faktor; unsur yang memengaruhi hasil', example: 'Climate is a key factor in determining which crops can be grown.', collocations: 'key factor, contributing factor' },
    { word: 'indicate', meaning_id: 'menunjukkan; memberi petunjuk', example: 'The results indicate a strong correlation between exercise and memory.', collocations: 'studies indicate, clearly indicate' },
    { word: 'interpret', meaning_id: 'menafsirkan; menjelaskan makna sesuatu', example: 'Historians interpret ancient texts to understand early civilizations.', collocations: 'interpret data, widely interpreted' },
    { word: 'methodology', meaning_id: 'metodologi; cara atau sistem dalam penelitian', example: 'The paper describes the methodology used to collect the survey data.', collocations: 'research methodology, rigorous methodology' },
    { word: 'occur', meaning_id: 'terjadi; berlangsung', example: 'Earthquakes occur most frequently along tectonic plate boundaries.', collocations: 'occur naturally, frequently occur' },
    { word: 'perceive', meaning_id: 'mempersepsikan; memandang atau menyadari', example: 'Humans perceive only a small portion of the light spectrum.', collocations: 'perceive as, widely perceived' },
    { word: 'predominant', meaning_id: 'dominan; paling utama atau umum', example: 'Agriculture remained the predominant economic activity in the region.', collocations: 'predominant theory, predominant role' },
    { word: 'subsequent', meaning_id: 'berikutnya; yang terjadi setelahnya', example: 'The initial discovery led to subsequent research on gene editing.', collocations: 'subsequent studies, subsequent years' },
    { word: 'sufficient', meaning_id: 'cukup; memadai', example: 'Plants need sufficient sunlight to carry out photosynthesis.', collocations: 'sufficient evidence, sufficient resources' },
    { word: 'underlying', meaning_id: 'mendasari; yang menjadi dasar', example: 'The lecture examined the underlying causes of the economic crisis.', collocations: 'underlying cause, underlying assumption' },
    { word: 'attribute', meaning_id: 'menghubungkan sesuatu dengan penyebabnya', example: 'Scientists attribute the temperature rise to greenhouse gas emissions.', collocations: 'attribute to, attributed largely to' },
    { word: 'comprise', meaning_id: 'terdiri dari; mencakup', example: 'The committee comprises experts from several academic disciplines.', collocations: 'comprise of (avoid), comprises several' },
    { word: 'constrain', meaning_id: 'membatasi; mengekang', example: 'Limited funding constrained the scope of the research project.', collocations: 'constrained by, severely constrain' },
    { word: 'differentiate', meaning_id: 'membedakan', example: 'Students must differentiate between facts and the author’s opinions.', collocations: 'differentiate between, clearly differentiate' },
    { word: 'diminish', meaning_id: 'berkurang; mengurangi', example: 'The drug’s effectiveness diminishes over time as bacteria adapt.', collocations: 'gradually diminish, diminishing returns' },
    { word: 'empirical', meaning_id: 'empiris; berdasarkan pengamatan atau eksperimen', example: 'The theory is supported by decades of empirical evidence.', collocations: 'empirical evidence, empirical study' },
    { word: 'fluctuate', meaning_id: 'berfluktuasi; naik turun tidak menentu', example: 'Ocean temperatures fluctuate seasonally, affecting marine life.', collocations: 'fluctuate widely, prices fluctuate' },
    { word: 'implication', meaning_id: 'implikasi; dampak atau makna tersirat', example: 'The findings have important implications for public health policy.', collocations: 'far-reaching implications, policy implications' },
    { word: 'inherent', meaning_id: 'melekat; bawaan dari sifatnya', example: 'There are inherent risks in any experimental medical procedure.', collocations: 'inherent risk, inherent in' },
    { word: 'integrate', meaning_id: 'mengintegrasikan; menggabungkan menjadi satu', example: 'The new curriculum integrates technology into traditional instruction.', collocations: 'integrate into, fully integrated' },
    { word: 'paradigm', meaning_id: 'paradigma; kerangka berpikir', example: 'Darwin’s work introduced a new paradigm in biological science.', collocations: 'paradigm shift, dominant paradigm' },
    { word: 'plausible', meaning_id: 'masuk akal; dapat dipercaya', example: 'The professor offered a plausible explanation for the fossil gap.', collocations: 'plausible explanation, seem plausible' },
    { word: 'preliminary', meaning_id: 'awal; pendahuluan', example: 'Preliminary results suggest the vaccine is highly effective.', collocations: 'preliminary findings, preliminary study' },
    { word: 'proportion', meaning_id: 'proporsi; perbandingan bagian', example: 'A large proportion of the population lives in coastal areas.', collocations: 'large proportion, in proportion to' },
    { word: 'speculate', meaning_id: 'berspekulasi; menduga tanpa bukti pasti', example: 'Astronomers speculate that the planet may contain liquid water.', collocations: 'speculate about, widely speculated' },
    { word: 'synthesis', meaning_id: 'sintesis; penggabungan beberapa unsur', example: 'The essay requires a synthesis of ideas from both reading passages.', collocations: 'synthesis of, protein synthesis' },
    { word: 'transition', meaning_id: 'transisi; peralihan', example: 'The transition from agriculture to industry transformed urban life.', collocations: 'transition to, smooth transition' },
    { word: 'undergo', meaning_id: 'mengalami; menjalani', example: 'Metamorphic rocks undergo changes due to heat and pressure.', collocations: 'undergo change, undergo treatment' },
    { word: 'validate', meaning_id: 'memvalidasi; membuktikan kebenaran', example: 'Independent experiments were conducted to validate the findings.', collocations: 'validate results, validate a theory' },
    { word: 'criterion', meaning_id: 'kriteria; standar penilaian (bentuk tunggal)', example: 'Cost was the main criterion used to evaluate the proposals.', collocations: 'main criterion, meet the criteria' },
    { word: 'notion', meaning_id: 'gagasan; konsep atau ide', example: 'The lecture challenged the notion that intelligence is fixed at birth.', collocations: 'challenge the notion, the notion that' },
    { word: 'pervasive', meaning_id: 'merata; tersebar luas', example: 'The influence of social media is pervasive among university students.', collocations: 'pervasive influence, increasingly pervasive' },
  ],
  TOEFL_ITP: [
    { word: 'despite', meaning_id: 'meskipun (diikuti kata benda)', example: 'Despite the heavy rain, the field study continued as scheduled.', collocations: 'despite the fact that' },
    { word: 'whereas', meaning_id: 'sedangkan; sementara itu (kontras)', example: 'Mammals are warm-blooded, whereas reptiles depend on external heat.', collocations: 'whereas + clause' },
    { word: 'furthermore', meaning_id: 'lebih lanjut; selain itu', example: 'The method is inexpensive; furthermore, it requires no special equipment.', collocations: 'furthermore, moreover' },
    { word: 'nevertheless', meaning_id: 'namun demikian', example: 'The sample size was small; nevertheless, the results were consistent.', collocations: 'nevertheless, the results' },
    { word: 'consist', meaning_id: 'terdiri (consist of)', example: 'The Earth’s atmosphere consists primarily of nitrogen and oxygen.', collocations: 'consist of' },
    { word: 'require', meaning_id: 'membutuhkan; mengharuskan', example: 'Graduate students are required to submit a thesis proposal.', collocations: 'require that + base verb' },
    { word: 'available', meaning_id: 'tersedia', example: 'Scholarship funds are available to students who maintain high grades.', collocations: 'readily available, available to' },
    { word: 'previous', meaning_id: 'sebelumnya', example: 'Previous studies failed to account for seasonal variation.', collocations: 'previous research, previous studies' },
    { word: 'rarely', meaning_id: 'jarang (memicu inversi di awal kalimat)', example: 'Rarely do desert plants bloom more than once a year.', collocations: 'rarely, seldom, hardly ever' },
    { word: 'scarcely', meaning_id: 'hampir tidak', example: 'Scarcely had the experiment begun when the power failed.', collocations: 'scarcely ... when' },
    { word: 'abundant', meaning_id: 'melimpah', example: 'Fossils are abundant in the sedimentary rocks of this region.', collocations: 'abundant in, abundant supply' },
    { word: 'essential', meaning_id: 'esensial; sangat penting', example: 'It is essential that every sample be labeled accurately.', collocations: 'essential that + base verb' },
    { word: 'considerable', meaning_id: 'besar; cukup banyak', example: 'The dam took a considerable amount of time and money to build.', collocations: 'considerable amount, considerable influence' },
    { word: 'distinguish', meaning_id: 'membedakan', example: 'Its long neck distinguishes the giraffe from all other mammals.', collocations: 'distinguish from, distinguish between' },
    { word: 'composed', meaning_id: 'tersusun (be composed of)', example: 'Granite is composed of quartz, feldspar, and mica.', collocations: 'be composed of' },
    { word: 'enable', meaning_id: 'memungkinkan', example: 'Gills enable fish to extract oxygen from water.', collocations: 'enable + object + to' },
    { word: 'emerge', meaning_id: 'muncul', example: 'Jazz emerged in the early twentieth century in New Orleans.', collocations: 'emerge from, emerge as' },
    { word: 'relatively', meaning_id: 'relatif; secara perbandingan', example: 'Aluminum is relatively light compared with other structural metals.', collocations: 'relatively small, relatively few' },
    { word: 'primarily', meaning_id: 'terutama', example: 'The museum’s collection consists primarily of pre-Columbian art.', collocations: 'consist primarily of' },
    { word: 'numerous', meaning_id: 'banyak; berjumlah besar', example: 'Numerous attempts were made to climb the peak before 1953.', collocations: 'numerous studies, numerous occasions' },
    { word: 'virtually', meaning_id: 'hampir; nyaris', example: 'Virtually all flowering plants depend on pollinators to reproduce.', collocations: 'virtually all, virtually impossible' },
    { word: 'alike', meaning_id: 'sama; serupa (posisi setelah kata benda)', example: 'The theory attracted scientists and philosophers alike.', collocations: 'A and B alike' },
    { word: 'whereby', meaning_id: 'yang dengannya; melalui mana', example: 'Photosynthesis is the process whereby plants convert light into energy.', collocations: 'process whereby' },
    { word: 'unlike', meaning_id: 'tidak seperti; berbeda dengan', example: 'Unlike most metals, mercury is liquid at room temperature.', collocations: 'unlike + noun' },
    { word: 'due to', meaning_id: 'karena; disebabkan oleh (diikuti kata benda)', example: 'The flight was delayed due to severe weather conditions.', collocations: 'due to the fact that' },
    { word: 'so that', meaning_id: 'supaya; agar', example: 'Bridges are built with expansion joints so that they can withstand heat.', collocations: 'so that + clause' },
    { word: 'hardly', meaning_id: 'hampir tidak', example: 'Hardly any rainfall reaches the interior of the Atacama Desert.', collocations: 'hardly any, hardly ever' },
    { word: 'neither', meaning_id: 'tidak juga; keduanya tidak', example: 'Neither the moon nor the planets produce their own light.', collocations: 'neither ... nor' },
    { word: 'among', meaning_id: 'di antara (tiga atau lebih)', example: 'Cooperation among team members is essential for success.', collocations: 'among others, among the first' },
    { word: 'beneath', meaning_id: 'di bawah', example: 'Vast reserves of oil lie beneath the ocean floor.', collocations: 'beneath the surface' },
    { word: 'capable', meaning_id: 'mampu (capable of)', example: 'Modern computers are capable of performing billions of calculations per second.', collocations: 'capable of + V-ing' },
    { word: 'familiar', meaning_id: 'akrab; dikenal (familiar with/to)', example: 'Most students are familiar with the basic laws of motion.', collocations: 'familiar with, familiar to' },
    { word: 'responsible', meaning_id: 'bertanggung jawab (responsible for)', example: 'Chlorophyll is responsible for the green color of leaves.', collocations: 'responsible for' },
    { word: 'similar', meaning_id: 'mirip (similar to)', example: 'The chemical structure of margarine is similar to that of butter.', collocations: 'similar to, similar in' },
    { word: 'prior', meaning_id: 'sebelum (prior to)', example: 'Prior to the invention of the printing press, books were copied by hand.', collocations: 'prior to' },
    { word: 'regardless', meaning_id: 'terlepas dari (regardless of)', example: 'All applicants are evaluated regardless of their background.', collocations: 'regardless of' },
    { word: 'seldom', meaning_id: 'jarang sekali', example: 'Seldom does a comet of this size pass so close to Earth.', collocations: 'seldom + inversion' },
    { word: 'thus', meaning_id: 'dengan demikian', example: 'The region receives little rain; thus, irrigation is necessary for farming.', collocations: 'thus far, and thus' },
    { word: 'moreover', meaning_id: 'terlebih lagi', example: 'Solar power is renewable; moreover, it produces no direct emissions.', collocations: 'moreover, in addition' },
    { word: 'likewise', meaning_id: 'demikian pula', example: 'Whales must surface to breathe; likewise, dolphins rely on air.', collocations: 'likewise, similarly' },
  ],
  IELTS: [
    { word: 'sustainable', meaning_id: 'berkelanjutan; ramah lingkungan jangka panjang', example: 'Governments should invest in sustainable energy sources such as wind and solar power.', collocations: 'sustainable development, environmentally sustainable' },
    { word: 'emission', meaning_id: 'emisi; gas buangan', example: 'Stricter regulations are needed to reduce carbon emissions from factories.', collocations: 'carbon emissions, reduce emissions' },
    { word: 'deforestation', meaning_id: 'penggundulan hutan', example: 'Deforestation in tropical regions threatens thousands of plant and animal species.', collocations: 'rampant deforestation, combat deforestation' },
    { word: 'renewable', meaning_id: 'terbarukan', example: 'Renewable energy now accounts for a growing share of electricity production.', collocations: 'renewable energy, renewable resources' },
    { word: 'biodiversity', meaning_id: 'keanekaragaman hayati', example: 'Coral reefs support remarkable biodiversity despite covering little of the ocean floor.', collocations: 'protect biodiversity, loss of biodiversity' },
    { word: 'contamination', meaning_id: 'kontaminasi; pencemaran', example: 'Industrial waste has caused widespread contamination of the river system.', collocations: 'water contamination, contamination levels' },
    { word: 'conservation', meaning_id: 'konservasi; pelestarian', example: 'Wildlife conservation programmes depend heavily on government funding.', collocations: 'conservation efforts, energy conservation' },
    { word: 'curriculum', meaning_id: 'kurikulum', example: 'Many argue that financial literacy should be part of the school curriculum.', collocations: 'national curriculum, curriculum design' },
    { word: 'literacy', meaning_id: 'kemampuan baca tulis; literasi', example: 'Improving adult literacy rates remains a priority in developing countries.', collocations: 'literacy rate, digital literacy' },
    { word: 'compulsory', meaning_id: 'wajib', example: 'In most countries, education is compulsory until the age of sixteen.', collocations: 'compulsory education, compulsory subject' },
    { word: 'vocational', meaning_id: 'kejuruan; berkaitan dengan keterampilan kerja', example: 'Vocational training offers a practical alternative to university education.', collocations: 'vocational training, vocational course' },
    { word: 'tuition', meaning_id: 'biaya kuliah; pengajaran', example: 'Rising tuition fees have made higher education less accessible.', collocations: 'tuition fees, private tuition' },
    { word: 'discipline', meaning_id: 'disiplin; bidang ilmu', example: 'Strict discipline in schools is a controversial topic among educators.', collocations: 'maintain discipline, academic discipline' },
    { word: 'innovation', meaning_id: 'inovasi', example: 'Technological innovation has transformed the way people communicate.', collocations: 'technological innovation, drive innovation' },
    { word: 'automation', meaning_id: 'otomatisasi', example: 'Automation may eliminate millions of manufacturing jobs in the coming decades.', collocations: 'increasing automation, automation of jobs' },
    { word: 'obsolete', meaning_id: 'usang; ketinggalan zaman', example: 'Some skills quickly become obsolete as technology advances.', collocations: 'become obsolete, render obsolete' },
    { word: 'surveillance', meaning_id: 'pengawasan; pemantauan', example: 'The growth of public surveillance raises serious privacy concerns.', collocations: 'mass surveillance, surveillance cameras' },
    { word: 'connectivity', meaning_id: 'konektivitas; keterhubungan', example: 'Improved internet connectivity has enabled remote work in rural areas.', collocations: 'internet connectivity, global connectivity' },
    { word: 'breakthrough', meaning_id: 'terobosan', example: 'A medical breakthrough in gene therapy could save thousands of lives.', collocations: 'scientific breakthrough, major breakthrough' },
    { word: 'accessible', meaning_id: 'mudah diakses', example: 'Healthcare should be accessible to all citizens regardless of income.', collocations: 'easily accessible, accessible to' },
    { word: 'sedentary', meaning_id: 'kurang gerak; banyak duduk', example: 'A sedentary lifestyle is a major contributor to obesity and heart disease.', collocations: 'sedentary lifestyle, sedentary work' },
    { word: 'obesity', meaning_id: 'obesitas; kegemukan', example: 'Childhood obesity has risen sharply due to poor diet and lack of exercise.', collocations: 'childhood obesity, tackle obesity' },
    { word: 'epidemic', meaning_id: 'epidemi; wabah', example: 'Health officials warned that the disease could become a national epidemic.', collocations: 'obesity epidemic, epidemic of' },
    { word: 'preventive', meaning_id: 'pencegahan', example: 'Preventive measures such as vaccination are more cost-effective than treatment.', collocations: 'preventive measures, preventive care' },
    { word: 'wellbeing', meaning_id: 'kesejahteraan', example: 'Regular exercise contributes significantly to both physical and mental wellbeing.', collocations: 'mental wellbeing, sense of wellbeing' },
    { word: 'nutrition', meaning_id: 'nutrisi; gizi', example: 'Good nutrition during childhood is essential for healthy development.', collocations: 'proper nutrition, poor nutrition' },
    { word: 'urbanization', meaning_id: 'urbanisasi', example: 'Rapid urbanization has placed enormous pressure on city infrastructure.', collocations: 'rapid urbanization, urbanization process' },
    { word: 'infrastructure', meaning_id: 'infrastruktur', example: 'Investment in public infrastructure boosts long-term economic growth.', collocations: 'public infrastructure, transport infrastructure' },
    { word: 'congestion', meaning_id: 'kemacetan', example: 'Traffic congestion in major cities costs the economy billions each year.', collocations: 'traffic congestion, ease congestion' },
    { word: 'inequality', meaning_id: 'ketimpangan; ketidaksetaraan', example: 'Income inequality has widened in many developed countries.', collocations: 'income inequality, social inequality' },
    { word: 'globalization', meaning_id: 'globalisasi', example: 'Globalization has increased trade but also intensified competition for jobs.', collocations: 'economic globalization, effects of globalization' },
    { word: 'consumption', meaning_id: 'konsumsi', example: 'Reducing energy consumption is one of the simplest ways to cut emissions.', collocations: 'energy consumption, excessive consumption' },
    { word: 'demographic', meaning_id: 'demografis; berkaitan dengan penduduk', example: 'An ageing population is the most pressing demographic challenge facing Japan.', collocations: 'demographic change, demographic trends' },
    { word: 'controversial', meaning_id: 'kontroversial', example: 'Animal testing remains a highly controversial issue in medical research.', collocations: 'highly controversial, controversial issue' },
    { word: 'detrimental', meaning_id: 'merugikan; berdampak buruk', example: 'Excessive screen time can be detrimental to children’s development.', collocations: 'detrimental to, detrimental effect' },
    { word: 'mitigate', meaning_id: 'mengurangi dampak buruk', example: 'Planting trees in cities can help mitigate the effects of air pollution.', collocations: 'mitigate the effects, mitigate risk' },
    { word: 'implement', meaning_id: 'melaksanakan; menerapkan', example: 'The government plans to implement a nationwide recycling scheme.', collocations: 'implement a policy, fully implement' },
    { word: 'allocate', meaning_id: 'mengalokasikan', example: 'More funds should be allocated to public health education.', collocations: 'allocate resources, allocate funds' },
    { word: 'incentive', meaning_id: 'insentif; dorongan', example: 'Tax incentives encourage companies to invest in green technology.', collocations: 'financial incentive, provide an incentive' },
    { word: 'prosperity', meaning_id: 'kemakmuran', example: 'Education is widely seen as the foundation of national prosperity.', collocations: 'economic prosperity, future prosperity' },
  ],
  TOEIC: [
    { word: 'invoice', meaning_id: 'faktur; tagihan', example: 'Please review the attached invoice and remit payment within thirty days.', collocations: 'issue an invoice, pay an invoice' },
    { word: 'itinerary', meaning_id: 'rencana perjalanan', example: 'The travel agency emailed a detailed itinerary for the business trip.', collocations: 'travel itinerary, confirm the itinerary' },
    { word: 'warranty', meaning_id: 'garansi', example: 'The laptop comes with a two-year warranty covering parts and labor.', collocations: 'under warranty, extended warranty' },
    { word: 'reimburse', meaning_id: 'mengganti biaya', example: 'Employees will be reimbursed for travel expenses upon submission of receipts.', collocations: 'reimburse expenses, fully reimbursed' },
    { word: 'comply', meaning_id: 'mematuhi (comply with)', example: 'All contractors must comply with the building safety regulations.', collocations: 'comply with regulations' },
    { word: 'quotation', meaning_id: 'penawaran harga', example: 'We requested a quotation from three suppliers before placing the order.', collocations: 'request a quotation, price quotation' },
    { word: 'shipment', meaning_id: 'pengiriman barang', example: 'The shipment was delayed at customs for two days.', collocations: 'track a shipment, shipment of goods' },
    { word: 'inventory', meaning_id: 'persediaan barang; stok', example: 'The warehouse conducts a full inventory check at the end of each quarter.', collocations: 'inventory check, manage inventory' },
    { word: 'merger', meaning_id: 'penggabungan perusahaan', example: 'The merger between the two banks was approved by shareholders.', collocations: 'merger and acquisition, announce a merger' },
    { word: 'recruit', meaning_id: 'merekrut', example: 'The company plans to recruit fifty engineers for its new branch.', collocations: 'recruit staff, actively recruit' },
    { word: 'applicant', meaning_id: 'pelamar', example: 'All applicants must submit a resume and two letters of reference.', collocations: 'job applicant, successful applicant' },
    { word: 'promotion', meaning_id: 'kenaikan jabatan; promosi penjualan', example: 'Ms. Tanaka received a promotion to regional sales manager.', collocations: 'receive a promotion, promotional campaign' },
    { word: 'deadline', meaning_id: 'tenggat waktu', example: 'The deadline for submitting the budget proposal is Friday at noon.', collocations: 'meet a deadline, tight deadline' },
    { word: 'agenda', meaning_id: 'agenda rapat', example: 'The quarterly review is the first item on today’s agenda.', collocations: 'meeting agenda, on the agenda' },
    { word: 'minutes', meaning_id: 'notulen rapat', example: 'The secretary will distribute the minutes of the meeting by tomorrow.', collocations: 'take the minutes, approve the minutes' },
    { word: 'venue', meaning_id: 'tempat acara', example: 'The conference venue can accommodate up to five hundred attendees.', collocations: 'conference venue, book a venue' },
    { word: 'attendee', meaning_id: 'peserta; hadirin', example: 'All attendees will receive a copy of the presentation slides.', collocations: 'conference attendees, registered attendees' },
    { word: 'refund', meaning_id: 'pengembalian uang', example: 'Customers may request a full refund within fourteen days of purchase.', collocations: 'full refund, issue a refund' },
    { word: 'receipt', meaning_id: 'kuitansi; tanda terima', example: 'Please keep your receipt as proof of purchase for warranty claims.', collocations: 'keep the receipt, upon receipt of' },
    { word: 'estimate', meaning_id: 'perkiraan biaya', example: 'The contractor provided a written estimate for the renovation work.', collocations: 'cost estimate, rough estimate' },
    { word: 'negotiate', meaning_id: 'bernegosiasi', example: 'The union will negotiate a new contract with management next month.', collocations: 'negotiate a deal, negotiate terms' },
    { word: 'procurement', meaning_id: 'pengadaan barang/jasa', example: 'The procurement department handles all purchasing for the company.', collocations: 'procurement process, procurement department' },
    { word: 'expenditure', meaning_id: 'pengeluaran', example: 'The finance team reviewed last quarter’s expenditure on marketing.', collocations: 'capital expenditure, reduce expenditure' },
    { word: 'revenue', meaning_id: 'pendapatan', example: 'Online sales now account for forty percent of the company’s revenue.', collocations: 'annual revenue, revenue growth' },
    { word: 'forecast', meaning_id: 'prakiraan; ramalan', example: 'Analysts forecast strong growth in the technology sector this year.', collocations: 'sales forecast, forecast growth' },
    { word: 'subsidiary', meaning_id: 'anak perusahaan', example: 'The corporation operates a subsidiary in Singapore.', collocations: 'wholly owned subsidiary, overseas subsidiary' },
    { word: 'headquarters', meaning_id: 'kantor pusat', example: 'The company is relocating its headquarters to a larger building downtown.', collocations: 'corporate headquarters, headquarters staff' },
    { word: 'supervisor', meaning_id: 'penyelia; atasan langsung', example: 'Report any equipment malfunction to your supervisor immediately.', collocations: 'immediate supervisor, shift supervisor' },
    { word: 'appliance', meaning_id: 'peralatan rumah tangga elektronik', example: 'The store offers free delivery on all kitchen appliances.', collocations: 'household appliance, electrical appliance' },
    { word: 'maintenance', meaning_id: 'pemeliharaan; perawatan', example: 'The elevator will be out of service for routine maintenance on Monday.', collocations: 'routine maintenance, maintenance work' },
    { word: 'defective', meaning_id: 'cacat; rusak', example: 'Defective items can be exchanged at any of our retail locations.', collocations: 'defective product, defective parts' },
    { word: 'voucher', meaning_id: 'voucer; kupon', example: 'Guests received a meal voucher as compensation for the flight delay.', collocations: 'gift voucher, redeem a voucher' },
    { word: 'overtime', meaning_id: 'lembur', example: 'Staff who work overtime on weekends receive double pay.', collocations: 'work overtime, overtime pay' },
    { word: 'payroll', meaning_id: 'penggajian; daftar gaji', example: 'The payroll department processes salaries on the last day of each month.', collocations: 'payroll department, on the payroll' },
    { word: 'tenant', meaning_id: 'penyewa', example: 'Tenants must give sixty days’ notice before vacating the office space.', collocations: 'commercial tenant, tenant agreement' },
    { word: 'lease', meaning_id: 'kontrak sewa', example: 'The company signed a five-year lease on the new warehouse.', collocations: 'sign a lease, lease agreement' },
    { word: 'audit', meaning_id: 'audit; pemeriksaan keuangan', example: 'An external firm conducts the annual financial audit.', collocations: 'financial audit, conduct an audit' },
    { word: 'compensation', meaning_id: 'kompensasi; imbalan', example: 'The compensation package includes health insurance and a retirement plan.', collocations: 'compensation package, fair compensation' },
    { word: 'courier', meaning_id: 'kurir; jasa pengiriman', example: 'The signed contract was sent by courier to arrive before the deadline.', collocations: 'courier service, by courier' },
    { word: 'punctual', meaning_id: 'tepat waktu', example: 'Employees are expected to be punctual for all client meetings.', collocations: 'punctual arrival, always punctual' },
  ],
};

/** Day of year (1-366) in WIB so the rotation flips at local midnight. */
function dayOfYearWIB(d: Date = new Date()): number {
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  const start = Date.UTC(wib.getUTCFullYear(), 0, 0);
  return Math.floor((wib.getTime() - start) / 86400000);
}

/** Today's deterministic 5-card set for a test type. No state needed. */
export function getTodaysCards(testType: string, date: Date = new Date()): VocabCard[] {
  const pack = VOCAB_PACKS[testType] || VOCAB_PACKS['TOEFL_IBT'];
  const offset = (dayOfYearWIB(date) * CARDS_PER_DAY) % pack.length;
  const cards: VocabCard[] = [];
  for (let i = 0; i < CARDS_PER_DAY; i++) {
    cards.push(pack[(offset + i) % pack.length]);
  }
  return cards;
}

/** Bot message for today's cards (visual rhythm: bold word, → example, blank line). */
export function formatVocabMessage(testType: string, cards: VocabCard[]): string {
  const lines: string[] = [];
  lines.push(`📚 *5 Kata Hari Ini — ${testType.replace(/_/g, ' ')}*\n`);
  for (const c of cards) {
    lines.push(`*${c.word}* — ${c.meaning_id}`);
    lines.push(`→ ${c.example}`);
    if (c.collocations) lines.push(`🔗 ${c.collocations}`);
    lines.push('');
  }
  lines.push('Mau kartu-kartu ini masuk review harian kamu? Ketuk tombol di bawah.');
  return lines.join('\n');
}

/**
 * Build an FSRS-ready MC question for a card: correct meaning + 3 distractor
 * meanings drawn from other cards in the same pack. Deterministic placement
 * of the correct option (hash of the word) so re-runs are stable.
 */
export function buildVocabQuestion(card: VocabCard, testType: string): {
  question_data: string;
  correct_answer: string;
} {
  const pack = VOCAB_PACKS[testType] || VOCAB_PACKS['TOEFL_IBT'];
  const others = pack.filter((c) => c.word !== card.word);
  // Deterministic distractor pick: simple hash of the word as start index.
  let h = 0;
  for (let i = 0; i < card.word.length; i++) h = (h * 31 + card.word.charCodeAt(i)) >>> 0;
  const distractors: string[] = [];
  for (let i = 0; distractors.length < 3 && i < others.length; i++) {
    const m = others[(h + i * 7) % others.length].meaning_id;
    if (m !== card.meaning_id && !distractors.includes(m)) distractors.push(m);
  }
  const correctIdx = h % 4;
  const options = [...distractors];
  options.splice(correctIdx, 0, card.meaning_id);
  const letters = ['A', 'B', 'C', 'D'];
  return {
    question_data: JSON.stringify({
      question_text: `Apa arti '${card.word}'?`,
      options,
    }),
    correct_answer: letters[correctIdx],
  };
}
