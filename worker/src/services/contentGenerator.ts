import type { Env } from '../types';

interface VocabularyItem {
  word: string;
  partOfSpeech: string;
  indonesian: string;
  example: string;
  exampleTranslation: string;
  toeflContext: string;
  articleSlug: string;
}

interface QuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  section: string;
  testType: string;
  articleSlug: string;
}

interface GrammarTip {
  title: string;
  rule: string;
  examples: { en: string; id: string }[];
  toeflNote: string;
  articleSlug: string;
  testTypes: string[];
}

interface IdiomItem {
  idiom: string;
  meaning: string;
  example: string;
  exampleTranslation: string;
  articleSlug: string;
}

const OSEE_BOT = 'https://t.me/osee_IBT_IELTS_tutor_bot?start=';
const OSEE_BLOG = 'https://osee.co.id/blog/';

function formatTestEmoji(testType: string): string {
  switch (testType) {
    case 'IELTS': return '🎓';
    case 'TOEFL_ITP': return '📋';
    case 'TOEIC': return '💼';
    default: return '📝';
  }
}

function formatTestName(testType: string): string {
  switch (testType) {
    case 'IELTS': return 'IELTS Academic';
    case 'TOEFL_ITP': return 'TOEFL ITP';
    case 'TOEIC': return 'TOEIC';
    default: return 'TOEFL iBT';
  }
}

export async function generateVocabularyOfTheDay(env: Env): Promise<{ text: string; imagePrompt?: string }> {
  const vocabs: VocabularyItem[] = [
    {
      word: 'Mitigate',
      partOfSpeech: 'verb',
      indonesian: 'meringankan / mengurangi dampak',
      example: 'Governments must act now to mitigate the effects of climate change.',
      exampleTranslation: 'Pemerintah harus bertindak sekarang untuk mengurangi dampak perubahan iklim.',
      toeflContext: 'TOEFL Writing: sering muncul di task 2 arguments tentang environment & policy',
      articleSlug: 'mitigate-vocabulary-toefl-ielts'
    },
    {
      word: 'Substantiate',
      partOfSpeech: 'verb',
      indonesian: 'membuktikan / memberikan bukti',
      example: 'You need concrete data to substantiate your research claims.',
      exampleTranslation: 'Lo butuh data konkret buat membuktikan klaim penelitian lo.',
      toeflContext: 'TOEFL & IELTS Writing: essential buat bikin arguments credible',
      articleSlug: 'substantiate-vocab-academic-writing'
    },
    {
      word: 'Prevalent',
      partOfSpeech: 'adj',
      indonesian: 'umum / merajalela / banyak ditemukan',
      example: 'This health issue is prevalent among teenagers in urban areas.',
      exampleTranslation: 'Masalah kesehatan ini umum banget di kalangan remaja di perkotaan.',
      toeflContext: 'IELTS Reading: sering muncul di passages tentang public health & social issues',
      articleSlug: 'prevalent-vocab-ielts-reading'
    },
    {
      word: 'Ambiguous',
      partOfSpeech: 'adj',
      indonesian: 'ambigu / taksa / bisa ditafsirkan lebih dari satu',
      example: 'The contract language was deliberately ambiguous to avoid legal responsibility.',
      exampleTranslation: 'Bahasa kontraknya emang sengaja bikin ambigu biar gak tanggung jawab.',
      toeflContext: 'TOEFL Reading & Listening: listen for speaker tone yang menunjukkan ambiguity',
      articleSlug: 'ambiguous-vocab-toefl-strategy'
    },
    {
      word: 'Ephemeral',
      partOfSpeech: 'adj',
      indonesian: 'sementara / fana / tidak lasting lama',
      example: 'Social media fame is often ephemeral — here today, forgotten tomorrow.',
      exampleTranslation: 'Ketenaran di sosmed tuh cuma sebentar — hari ini viral, besok udah lupa.',
      toeflContext: 'IELTS Writing: bisa dipake di essay tentang technology & social media',
      articleSlug: 'ephemeral-vocab-ielts-essay'
    },
    {
      word: 'Pragmatic',
      partOfSpeech: 'adj',
      indonesian: 'realistis / praktis / berdasarkan kenyataan',
      example: 'We need a pragmatic approach, not idealistic theories.',
      exampleTranslation: 'Kita butuh pendekatan yang realistis, bukan teori muluk-muluk.',
      toeflContext: 'TOEFL & IELTS Speaking:好用 di part 4 Independent tasks tentang problem-solving',
      articleSlug: 'pragmatic-vocab-speaking-tips'
    },
    {
      word: 'Exacerbate',
      partOfSpeech: 'verb',
      indonesian: 'memperburuk / memperparah',
      example: 'Unemployment can exacerbate social inequality and crime rates.',
      exampleTranslation: 'Pengangguran bisa memperparah ketimpangan sosial dan tingkat kejahatan.',
      toeflContext: 'TOEFL Reading: vocabulary questions sering测试这个词 di passages tentang sociology',
      articleSlug: 'exacerbate-vocab-toefl-reading'
    },
    {
      word: 'Pristine',
      partOfSpeech: 'adj',
      indonesian: 'masih asli / belum tersentuh / sangat bersih',
      example: 'Tourists are drawn to the pristine beaches of Raja Ampat.',
      exampleTranslation: 'Turis tertarik ke pantai-pantai Raja Ampat yang masih sangat asli.',
      toeflContext: 'IELTS Reading: descriptive passages tentang environment & geography',
      articleSlug: 'pristine-vocab-ielts-environment'
    },
    {
      word: 'Paradigm',
      partOfSpeech: 'noun',
      indonesian: 'cara pandang / pola / kerangka berpikir',
      example: 'This discovery represents a new paradigm in physics research.',
      exampleTranslation: 'Penemuan ini merepresentasikan cara pandang baru dalam riset fisika.',
      toeflContext: 'TOEFL iBT Reading: academic passages suka pakai kata ini',
      articleSlug: 'paradigm-vocab-academic-english'
    },
    {
      word: 'Catalyst',
      partOfSpeech: 'noun',
      indonesian: 'pemicu / katalisator / sesuatu yang mempercepat perubahan',
      example: 'The protest served as a catalyst for political reform.',
      exampleTranslation: 'Protes itu jadi pemicu reformasi politik.',
      toeflContext: 'IELTS & TOEFL Writing: useful di essay yang membahas cause & effect',
      articleSlug: 'catalyst-vocab-cause-effect-essay'
    },
  ];

  const shuffled = vocabs.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  const testTypes = ['TOEFL iBT', 'IELTS', 'TOEFL ITP', 'TOEIC'];
  const randomTest = testTypes[Math.floor(Math.random() * testTypes.length)];
  const testEmoji = formatTestEmoji(randomTest);

  let text = `${testEmoji} VOCAB HARIAN | ${randomTest}\n\n`;
  text += `🎯 3 kata yang HARUS lo tau hari ini:\n\n`;

  selected.forEach((v, i) => {
    text += `${i + 1}️⃣ *${v.word}* (${v.partOfSpeech})\n`;
    text += `   🇮🇩 ${v.indonesian}\n`;
    text += `   📝 "${v.example}"\n`;
    text += `      → ${v.exampleTranslation}\n`;
    text += `   💡 ${v.toeflContext}\n\n`;
  });

  text += `━━━━━━━━━━━━━━━\n`;
  text += `📖 Baca penjelasan lengkap + contoh kalimat + latihan:\n`;
  text += `👉 ${OSEE_BLOG}${selected[0].articleSlug}\n\n`;
  text += `💬 Coba bikin 2 kalimat pake salah satu kata hari ini!\n`;
  text += `Komen di bawah ↓\n\n`;
  text += `#vocab_harian #belajaringgris #${randomTest.toLowerCase().replace(' ','')} #toefl #ielts #englishvocabulary`;

  const imagePrompt = `Clean educational infographic, minimalist design with purple and blue gradient, showing 3 academic English vocabulary words: ${selected.map(v => v.word).join(', ')}. Clean white background, professional typography, suitable for Telegram channel post`;

  return { text, imagePrompt };
}

export async function generateDailyQuiz(env: Env): Promise<QuizItem> {
  const quizzes: QuizItem[] = [
    {
      question: '"Despite ___ busy schedule, she still found time to study every day."',
      options: ['A) her', 'B) hers', 'C) herself', 'D) she\'s'],
      correctIndex: 0,
      explanation: '"Despite" itu preposition, jadi harus diikuti noun atau pronoun. "Her busy schedule" = noun phrase yang bener. "Despite her busy schedule" = meskipun jadwalnya padat. Bandingkan: "Although she was busy..." (kalimat lengkap dengan subject + verb).',
      section: 'Grammar — Contrast Connectors',
      testType: 'TOEFL_IBT',
      articleSlug: 'despite-although-grammar-toefl'
    },
    {
      question: '"The professor who teaches chemistry ___ from Harvard University."',
      options: ['A) graduated', 'B) graduates', 'C) has graduated', 'D) did graduate'],
      correctIndex: 0,
      explanation: 'Relative clause "who teaches chemistry" cuma memberikan tambahan info tentang professor. Main clause tetap "The professor graduated from Harvard." Karena konteksnya masa lalu yang selesai, simple past "graduated" yang tepat.',
      section: 'Grammar — Relative Clauses',
      testType: 'IELTS',
      articleSlug: 'relative-clauses-ielts-grammar'
    },
    {
      question: '"Neither the students nor the teacher ___ present during the announcement."',
      options: ['A) was', 'B) were', 'C) are', 'D) have been'],
      correctIndex: 0,
      explanation: 'Rule: "neither...nor" itu proximity rule — verb agrees dengan noun/pronoun yang PALING DEKAT. "the teacher" (singular) ada di depan "nor", jadi verb singular. "was" = bener.',
      section: 'Grammar — Subject-Verb Agreement',
      testType: 'TOEFL_ITP',
      articleSlug: 'neither-nor-proximity-rule'
    },
    {
      question: 'Complete the sentence: "Using English for professional communication requires ___ communication skills."',
      options: ['A) effective', 'B) effect', 'C) effectively', 'D) effectiveness'],
      correctIndex: 0,
      explanation: 'Di sini butuh adjective ("effective") buat modified noun "skills". "Communicate" → effective communication = komunikasi yang efektif. "Effectively" itu adverb, modified verb, bukan noun.',
      section: 'Vocabulary — Word Form',
      testType: 'TOEIC',
      articleSlug: 'word-form-toeic-vocab'
    },
    {
      question: '"If I ___ more money, I would invest in real estate."',
      options: ['A) had', 'B) have', 'C) would have', 'D) had had'],
      correctIndex: 0,
      explanation: 'Ini Second Conditional — tentang hypothetical situation di masa sekarang/kedepan. Structure: If + Past Simple + would/could/might + base verb. "If I had more money" = kalau saja aku punya lebih banyak uang (tapi реально nggak).',
      section: 'Grammar — Conditionals',
      testType: 'IELTS',
      articleSlug: 'second-conditional-ielts-speaking'
    },
    {
      question: '"The researcher\'s FINDINGS were groundbreaking and changed the field ___."',
      options: ['A) significantly', 'B) significance', 'C) significant', 'D) signify'],
      correctIndex: 0,
      explanation: '"Changed" itu verb — butuh adverb "significantly" buat modified verb tersebut. "Significantly changed" = berubah secara signifikan. "Significant" = adjective buat modified noun.',
      section: 'Vocabulary — Word Form',
      testType: 'TOEFL_IBT',
      articleSlug: 'word-form-adverb-adjective-toefl'
    },
    {
      question: '"___ the heavy rain, the flight still departed on time."',
      options: ['A) Despite', 'B) Although', 'C) Because', 'D) Since'],
      correctIndex: 0,
      explanation: '"Despite" + noun/gerund = meskipun. "Despite the heavy rain" = meskipun hujan lebat. "Although" + subject + verb = meskipun + kalimat lengkap. "Because" dan "Since" = karena (cause, bukan contrast).',
      section: 'Grammar — Contrast Markers',
      testType: 'TOEFL_ITP',
      articleSlug: 'despite-although-grammar-toefl-itp'
    },
    {
      question: '"Her presentation skills have improved ___ over the past year."',
      options: ['A) significantly', 'B) significance', 'C) significant', 'D) signify'],
      correctIndex: 0,
      explanation: '"Improved" = verb. Kapan pakai adverb? Untuk modified verb. "Improved significantly" = meningkat secara signifikan. Bandingkan: "Significant improvement" = improvement = noun, pakai adjective.',
      section: 'Vocabulary — Word Form',
      testType: 'IELTS',
      articleSlug: 'word-form-ielts-writing'
    },
  ];

  const shuffled = quizzes.sort(() => Math.random() - 0.5);
  return shuffled[0];
}

export function formatQuizPost(quiz: QuizItem, replyLink: string): string {
  const testEmoji = formatTestEmoji(quiz.testType);
  const testName = formatTestName(quiz.testType);

  let text = `${testEmoji} QUIZ HARIAN | ${testName}\n\n`;
  text += `Jangan scroll dulu — jawab dulu!\n\n`;
  text += `📚 Topik: ${quiz.section}\n\n`;
  text += `"${quiz.question}"\n\n`;
  quiz.options.forEach(opt => {
    text += `${opt}\n`;
  });
  text += `\n━━━━━━━━━━━━━━━\n`;
  text += `💬 Jawab di kolom komentar!\n`;
  text += `Beri alasan lo kenapa pilih jawaban itu ↓\n\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  text += `🤫 Udah jawab? Cek jawaban + penjelasan lengkap:\n`;
  text += `👉 ${OSEE_BLOG}${quiz.articleSlug}\n\n`;
  text += `📚 Lebih banyak latihan soal di ↓\n`;
  text += `👉 ${replyLink}\n\n`;
  text += `#quiz_harian #belajaringgris #${testName.toLowerCase().replace(' ','')} #toefl #ielts #englishpractice`;

  return text;
}

export async function generateGrammarTip(env: Env): Promise<string> {
  const tips: GrammarTip[] = [
    {
      title: '⚡ "Which" vs "That" — TOEFL/IELTS必考!',
      rule: 'That = restrictive clause (identifying — gak bisa diapus). Which = non-restrictive ( дополнительная информация — bisa diapus tanpa mengubah arti).',
      examples: [
        { en: 'The book that changed my life is on the table.', id: 'Buku yang mengubah hidupku ada di meja. → kalau diapus "The book is on the table" = masih ada arti.' },
        { en: 'My phone, which is brand new, is already broken.', id: 'HP-ku, yang baru banget, udah rusak. → kalau diapus "My phone is already broken" = kehilangan info tambahan.' },
      ],
      toeflNote: '🎯 TOEFL/ IELTS Reading & Writing: kalau removal mengubah arti kalimat = THAT. Kalau removal nggak mengubah = WHICH. Sakti di soal vocabulary-in-context juga!',
      articleSlug: 'which-vs-that-definitive-guide',
      testTypes: ['TOEFL_IBT', 'IELTS']
    },
    {
      title: '⚡ Neither...Nor — Proximity Rule yang Sering出错',
      rule: 'Verb agree dengan noun/pronoun PALING DEKAT dengan verb (proximity rule). Bukan yang lebih banyak!',
      examples: [
        { en: 'Neither the students nor the teacher is attending.', id: 'Yang paling deket verb "is" = "teacher" (singular) → verb singular "is".' },
        { en: 'Neither the teacher nor the students are attending.', id: 'Yang paling deket verb "are" = "students" (plural) → verb plural "are".' },
      ],
      toeflNote: '❌ Common mistake: pakai verb sesuai subject pertama (students = plural → were). ✅ Benar: deket mana? Yang deket determine verbnya.',
      articleSlug: 'neither-nor-proximity-rule-master',
      testTypes: ['TOEFL_IBT', 'TOEFL_ITP']
    },
    {
      title: '⚡ Passive Voice — Cara Cepat Detect di Reading',
      rule: 'Pattern: Subject + Be (is/are/was/were/been/being) + Past Participle (V3). Telegram Reading: identify subject + understand apa yang dilakukan SUBJECT.',
      examples: [
        { en: 'The research was conducted over a two-year period by a team of scientists.', id: 'Research = subject, "was conducted" = passive, scientists = agent (who did it).' },
        { en: 'The findings have been published in leading journals worldwide.', id: 'Findings = subject, "have been published" = passive perfect, journals = location.' },
      ],
      toeflNote: '📖 TOEFL Reading: passive suka diuji di soal factual information — cek who did what to whom.',
      articleSlug: 'passive-voice-toefl-reading-strategy',
      testTypes: ['TOEFL_IBT', 'IELTS']
    },
    {
      title: '⚡ Although vs Despite — Strukturnya Beda!',
      rule: 'Despite/In spite of + noun/gerund (V-ing). Although/Even though + subject + verb (kalimat lengkap).',
      examples: [
        { en: 'Despite the heavy traffic, we arrived on time.', id: 'Despite + noun phrase "the heavy traffic". ✅' },
        { en: 'Although it was raining heavily, we went out.', id: 'Although + subject + verb "it was raining". ✅' },
        { en: 'Despite it was raining... (❌)', id: 'Despite nggak bisa diikuti kalimat lengkap!' },
      ],
      toeflNote: '📝 IELTS Writing Task 2 & TOEFL Writing: choose the RIGHT connector based on sentence structure, bukan karena keduanya berarti "meskipun".',
      articleSlug: 'although-despite-ielts-writing',
      testTypes: ['IELTS', 'TOEFL_IBT']
    },
    {
      title: '⚡ Relative Clauses: Who / Whom / Whose — Test ini Rare tapi Nyerempet!',
      rule: 'Who = subject (replaces he/she/they). Whom = object (replaces him/her/them). Whose = possessive (replaces his/her/their).',
      examples: [
        { en: 'The student who scored highest will be honored.', id: 'Who = subject of "scored" → replace "who" with "she/he" → "The student she scored highest" ✅' },
        { en: 'The student whom we selected passed with honors.', id: 'Whom = object of "selected" → replace "whom" with "her/him" → "The student we selected her passed" ✅' },
      ],
      toeflNote: '💡 Trick: replace whom dengan him/her/they. Kalau kalimat masih masuk akal = whom bener. TOEFL ITP Structure suka测试.',
      articleSlug: 'relative-clauses-who-whom-whose',
      testTypes: ['TOEFL_ITP', 'IELTS']
    },
  ];

  const shuffled = tips.sort(() => Math.random() - 0.5);
  const tip = shuffled[0];
  const testTypes = tip.testTypes.map(t => formatTestEmoji(t) + ' ' + formatTestName(t)).join(' · ');

  let text = `📚 GRAMMAR SNAP | ${testTypes}\n\n`;
  text += `${tip.title}\n\n`;
  text += `📖 Aturan:\n${tip.rule}\n\n`;
  text += `💡 Contoh:\n`;
  tip.examples.forEach(ex => {
    text += `• EN: "${ex.en}"\n`;
    text += `  ID: ${ex.id}\n\n`;
  });
  text += `${tip.toeflNote}\n\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  text += `📖 Baca penjelasan lengkap + latihan-soal:\n`;
  text += `👉 ${OSEE_BLOG}${tip.articleSlug}\n\n`;
  text += `#grammar #belajaringgris #${tip.testTypes[0].toLowerCase().replace('_','')} #toefl #ielts`;

  return text;
}

export async function generateIdiom(env: Env): Promise<string> {
  const idioms: IdiomItem[] = [
    {
      idiom: 'Hit the nail on the head',
      meaning: 'Tepat sekali, tepat sasaran, bener banget',
      example: 'You really hit the nail on the head with that analysis of the problem.',
      exampleTranslation: 'Analisis lo tentang masalah itu bener banget, tepat sasaran.',
      articleSlug: 'idiom-hit-the-nail-on-the-head'
    },
    {
      idiom: 'A blessing in disguise',
      meaning: 'Hal buruk yang ternyata baik / erscheinungen磨',
      example: 'Losing that job was a blessing in disguise — I found a much better opportunity.',
      exampleTranslation: 'Kehilangan pekerjaan itu ternyata baik — aku nemu kesempatan yang lebih bagus.',
      articleSlug: 'idiom-blessing-in-disguise'
    },
    {
      idiom: 'Cost an arm and a leg',
      meaning: 'Mahal banget / harganya selangit',
      example: 'Living in central Jakarta costs an arm and a leg these days.',
      exampleTranslation: 'Tinggal di Jakarta Pusat tuh mahal banget akhir-akhir ini.',
      articleSlug: 'idiom-cost-arm-and-leg'
    },
    {
      idiom: 'Kill two birds with one stone',
      meaning: 'Satu langkah untuk dua tujuan / efisiensi tinggi',
      example: 'Using public transport kills two birds with one stone — save money and reduce pollution.',
      exampleTranslation: 'Pakai transportasi umum itu satu langkah buat dua tujuan — ngirit uang dan kurangi polusi.',
      articleSlug: 'idiom-kill-two-birds-one-stone'
    },
    {
      idiom: 'Under the weather',
      meaning: 'Sedang tidak enak badan / sedikit sakit',
      example: 'I\'ve been feeling under the weather since yesterday, so I\'ll skip the meeting.',
      exampleTranslation: 'Aku lagi gak enak badan sejak kemarin, jadi aku skip meeting ya.',
      articleSlug: 'idiom-under-the-weather'
    },
    {
      idiom: 'Piece of cake',
      meaning: 'Super easy / gampang banget / anak TK juga bisa',
      example: 'The exam was a piece of cake if you studied the vocabulary list.',
      exampleTranslation: 'Examnya gampang banget kalau lo udah belajar vocabulary list.',
      articleSlug: 'idiom-piece-of-cake'
    },
    {
      idiom: 'Break the ice',
      meaning: 'Memecah keheningan / membuat suasana jadi nyaman',
      example: 'His joke about the traffic helped break the ice at the interview.',
      exampleTranslation: 'Jokesnya soal macet itu bantu bikin suasana interview jadi nyaman.',
      articleSlug: 'idiom-break-the-ice'
    },
    {
      idiom: 'Spill the beans',
      meaning: 'Bocorin rahasia / spill the tea',
      example: 'Don\'t spill the beans about the surprise party for Sarah!',
      exampleTranslation: 'Jangan bocorin party kejutan untuk Sarah!',
      articleSlug: 'idiom-spill-the-beans'
    },
    {
      idiom: 'Hit the books',
      meaning: ' Belajar keras / fokus belajar / nyamber buku',
      example: 'I need to hit the books hard if I want to pass the TOEFL this month.',
      exampleTranslation: 'Aku harus belajar keras kalau mau lulus TOEFL bulan ini.',
      articleSlug: 'idiom-hit-the-books'
    },
    {
      idiom: 'A drop in the ocean',
      meaning: 'Sedikit sekali / tidak signifikan / seperti setetes air di laut',
      example: 'The donation was just a drop in the ocean compared to what was needed.',
      exampleTranslation: 'Donasinya cuma sedikit banget dibandingkan yang dibutuhkan.',
      articleSlug: 'idiom-drop-in-the-ocean'
    },
  ];

  const shuffled = idioms.sort(() => Math.random() - 0.5);
  const idiom = shuffled[0];

  let text = `💬 IDIOM HARIAN | Bahasa Inggris yang natural\n\n`;
  text += `*${idiom.idiom}*\n\n`;
  text += `🇮🇩 Arti: ${idiom.meaning}\n\n`;
  text += `📖 Contoh:\n"${idiom.example}"\n`;
  text += `→ ${idiom.exampleTranslation}\n\n`;
  text += `💡 Kenapa ini penting?\n`;
  text += `Idiom bikin lo sound like native speaker. TOEFL/ IELTS Speaking & Writing: pakai idiom yang tepat bikin respons lo lebih natural dan mendapat skor lebih tinggi!\n\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  text += `📖 Baca + latihan 10 idiom populer:\n`;
  text += `👉 ${OSEE_BLOG}${idiom.articleSlug}\n\n`;
  text += `💬 Coba bikin kalimat pake idiom ini!\n`;
  text += `Share di komentar ↓\n\n`;
  text += `#idiom_harian #belajaringgris #toeflidiom #ieltsidiom #englishidioms`;

  return text;
}

export async function generateStudentSpotlight(env: Env): Promise<string | null> {
  const recentResults = await env.DB.prepare(`
    SELECT u.name, tr.total_score, tr.band_score, tr.created_at, ta.test_type
     FROM test_results tr
     JOIN test_attempts ta ON tr.attempt_id = ta.id
     JOIN users u ON ta.user_id = u.id
     WHERE tr.band_score IS NOT NULL
     ORDER BY tr.created_at DESC
     LIMIT 20
  `).all() as any;

  if (!recentResults.results || recentResults.results.length === 0) {
    return null;
  }

  const eligible = recentResults.results.filter((r: any) => (r.band_score || 0) >= 4.0);
  if (eligible.length === 0) return null;

  const student = eligible[Math.floor(Math.random() * eligible.length)];
  const testEmoji = formatTestEmoji(student.test_type);
  const testName = formatTestName(student.test_type);

  let text = `🏆 STUDENT SPOTLIGHT\n\n`;
  text += `🎉 ${student.name} baru aja mencapai skor bagus:\n\n`;
  text += `${testEmoji} Test: ${testName}\n`;
  text += `📊 Band Score: ${student.band_score}\n`;
  text += `📝 Total Score: ${student.total_score}\n\n`;
  text += `💪 Lo juga bisa! Mulai dari diagnostic test gratis.\n\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  text += `📖 Baca strategi belajar mereka di:\n`;
  text += `👉 ${OSEE_BLOG}student-success-stories\n\n`;
  text += `🎯 Mulai belajar sekarang:\n`;
  text += `👉 ${OSEE_BOT}spotlight\n\n`;
  text += `#studentspotlight #belajaringgris #toefl #ielts #successstory`;

  return text;
}

export function generatePromoCTA(): string {
  const testTypes = [
    { name: 'TOEFL iBT', emoji: '📝' },
    { name: 'IELTS Academic', emoji: '🎓' },
    { name: 'TOEFL ITP', emoji: '📋' },
    { name: 'TOEIC', emoji: '💼' },
  ];
  const random = testTypes[Math.floor(Math.random() * testTypes.length)];

  const ctas = [
    `🎯 Lo tau nggak? Platform belajar TOEFL/IELTS yang bikin aku bisa скiaz skor 6.0 dalam 2 bulan!\n\nBeda dari yang lain:✅ AI feedback per kata — lo tau exatamente bagian mana yang salah\n✅ Explanations lengkap — bukan cuma jawaban, tapi JADI-LO KENAPA\n✅ Practice kapan aja, di mana aja — fleksibel banget\n\nCoba gratis dulu — 10 soal per hari tanpa batas waktu 👇\n👉 ${OSEE_BOT}promo\n\n#belajaringgris #toefl #ielts #premium`,
    `📚 Mau скiaz skor TOEFL/IELTS tapi bingung mulai dari mana?\n\nAku pernah di posisi lo — пробовала YouTube, buku, semua apps. Tapi baru ngerasa cocok di EduBot.\n\nKenapa?\n• Adaptive learning — soal yang keluar sesuai level lo\n• Spaced repetition — lo review soal yang pernah salah\n• AI Tutor 24/7 — tanya kapan aja, dapat jawaban конкретный\n\nDaftar gratis sekarang 👇\n👉 ${OSEE_BOT}promo\n\n#toeflprep #ieltsprep #belajaringgris`,
    `💡 Indonesian student证: Belajar TOEFL/IELTS itu nggak harus mahal!\n\nEduBot kasih akses ke:\n• 3,000+ soal dengan explanations\n• Speaking practice dengan AI evaluation\n• Diagnostic test — tau level lo sekarang\n• Personalized study plan\n\nSemua mulai dari Rp 99rb/bulan. Lebih murah dari 1x les private.\n\nCoba 1 hari premium gratis 👇\n👉 ${OSEE_BOT}promo`,
    `🎓 TOEFL deadline approaching?\n\nУ тебя есть ${random.emoji} waktu buat persiapan — nggak harus nge-heavy course.\n\nDengan 30 menit sehari di EduBot, banyak student udah повысить skor mereka 0.5-1.0 band dalam 30 hari.\n\nKuncinya: consistently + the right practice.\n\nMulai sekarang 👇\n👉 ${OSEE_BOT}promo\n\n#${random.name.toLowerCase().replace(' ','')} #belajaringgris #studytips`,
  ];

  return ctas[Math.floor(Math.random() * ctas.length)];
}

export function generateSpeakingCTA(): string {
  const ctas = [
    `🗣️ Tahu nggak? Bagian Speaking TOEFL/IELTS yang bikin orang gugup.\n\nBukan karena topsiks-nya, tapi karena lo nggak punya guru yang bisa koreksi pronunciation lo secara spesifik.\n\nDi EduBot:\n•🎙️ Lo rekam jawaban lo\n•🤖 AI evaluez точность pronunciation lo per kata\n•📝 Lo dapat feedback конкретный: "Kata 'research' lo salah pronunciation di bagian kedua"\n\nIni yang bikin beda. Bukan cuma skor — tapi lo tau persis apa yang harus diperbaiki.\n\nCoba speaking practice gratis 👇\n👉 ${OSEE_BOT}speaking\n\n#speakingpractice #toefl #ielts #pronunciation`,
    `🎙️朗读 atau Interview — lo pilih jenis speaking yang mau lo-latihan.\n\nKedua-duanya ada AI evaluation yang kasih:\n•🎯 Pronunciation score per kata\n•📊 Fluency assessment\n•💡 Specific feedback: "Vowel sound di 'comPREHENSION' perlu diperbaiki"\n\nDi tempat lain? Lo cuma dapat skor tanpa объяснение.\n\nMulai gratis 👇\n👉 ${OSEE_BOT}speaking\n\n#toeflspeaking #ieltsspeaking #speakingpractice`,
    `💬 Di EduBot, Speaking practice itu bukan cuma "catat band score."\n\nSetiap jawaban lo dinilai oleh AI untuk:\n•🗣️ Pronunciation — lo ngomong pronouncing yang bener apa nggak\n•📖 Fluency — lo lancar atau TerPUTUS-PUTUS\n•🎯 Comprehension — lo ngerti pertanyaan dan bisa jawab dengan tepat\n\nBaru nemu platform yang nerjemahin "lo salah pronunciation di kata ini" dengan spesifik.\n\nCoba sekarang 👇\n👉 ${OSEE_BOT}speaking\n\n#speakingtips #toefl #ielts #englishspeaking`,
    `🗣️ Indonesian accent + TOEFL Speaking = tantangan terbesar.\n\nKenapa?\n•🇮🇩 Bahasa Indonesia punya vowel sounds yang beda dari English\n•🇬🇧 Banyak kata yang pronunciationnya beda dari penulisannya\n\nTapi kalau tau exactly apa yang salah — gampang diperbaiki.\n\nEduBot AI kasih feedback per fonem: bukan cuma "pronunciation perlu diperbaiki" tapi "bagian ini salah, coba pronounce ulang dengan cara ini."\n\nCoba sekarang 👇\n👉 ${OSEE_BOT}speaking\n\n#pronunciation #toeflielts #speakingpractice`,
  ];

  return ctas[Math.floor(Math.random() * ctas.length)];
}

export async function postToChannel(env: Env, text: string, contentType = 'cta'): Promise<boolean> {
  const channelId = env.TELEGRAM_BOT_TOKEN.includes('test')
    ? '@TOEFL_IELTS_Indonesia_Test'
    : '-1003884450070';

  let messageId: string | null = null;
  let status = 'failed';
  let errorMsg: string | null = null;

  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const result = await response.json() as any;
    if (result.ok) {
      messageId = String(result.result?.message_id || null);
      status = 'sent';
    } else {
      errorMsg = result.description || 'Unknown error';
      console.error('Channel post failed:', result);
    }
  } catch (e: any) {
    errorMsg = e?.message || String(e);
    console.error('Failed to post to channel:', e);
  }

  // Log to channel_posts for analytics
  try {
    await env.DB.prepare(`
      INSERT INTO channel_posts (post_type, post_content, content_preview, message_id, sent_to_channel, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(contentType, text, text.substring(0, 100), messageId, channelId, status, errorMsg).run();
  } catch (e) {
    console.error('Failed to log channel post:', e);
  }

  return status === 'sent';
}
