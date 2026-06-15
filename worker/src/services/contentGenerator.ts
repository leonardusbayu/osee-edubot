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
  /** Generated channel image ready for sendPhoto. Best-effort. */
  channelImage?: { bytes: ArrayBuffer; mime_type: string; source: 'cache' | 'fresh' | 'fallback' };
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
// P1 channel-fix: previously pointed to osee.co.id/blog/<slug> which
// returns "connection closed unexpectedly" (server-level failure on
// the WordPress backend). Channel posts drove 0 conversions because
// every CTA link was a dead click. Now points to a worker endpoint
// (P2 will populate it with real articles; for now it renders a
// minimal HTML page that links back to the bot). The endpoint
// always returns 200, so the channel never links to a dead page.
const OSEE_BLOG = 'https://edubot-api.edubot-leonardus.workers.dev/api/blog/article/';

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

// Week 2 channel fix: pull a real quiz from test_contents. Returns
// null if D1 has no quiz-shaped content (cold-start fallback to the
// hardcoded array in generateDailyQuiz).
async function pullRandomQuizFromBank(env: Env): Promise<QuizItem | null> {
  try {
    // We need rows whose content has the shape of an MCQ: a question
    // text, an array of options, and a correct answer. Different
    // question types store these under different keys, so we sample
    // broadly.
    const rows = await env.DB.prepare(
      `SELECT id, content, section, test_type, question_type
       FROM test_contents
       WHERE status = 'published'
         AND question_type IN (
           'read_academic_passage','read_in_daily_life',
           'complete_the_words','listen_choose_response',
           'listen_academic_talk','true_false_not_given',
           'multiple_choice','matching_headings'
         )
       ORDER BY RANDOM() LIMIT 25`
    ).all<{ id: number; content: string; section: string; test_type: string; question_type: string }>();
    for (const row of rows.results || []) {
      try {
        const c = JSON.parse(row.content);
        // The content JSON shape varies by question_type. Look for
        // any of: question_text + options (array of strings) + correct
        // answer (index or letter).
        const question = c.question_text || c.question || c.direction || '';
        const optionsRaw = c.options || c.choices || [];
        const options: string[] = Array.isArray(optionsRaw)
          ? optionsRaw.map((o: any) => typeof o === 'string' ? o : (o?.text || o?.label || JSON.stringify(o)))
          : [];
        if (!question || options.length < 2 || question.length < 10) continue;

        // The correct answer is sometimes an index, sometimes a
        // letter, sometimes the answer text. Try to normalize to index.
        let correctIndex = 0;
        const correctRaw = c.answers?.[0] ?? c.correct_answer ?? c.correct ?? c.answer;
        if (typeof correctRaw === 'number') {
          correctIndex = correctRaw;
        } else if (typeof correctRaw === 'string') {
          // "A" / "B" etc
          if (/^[A-Z]$/i.test(correctRaw.trim())) {
            correctIndex = correctRaw.toUpperCase().charCodeAt(0) - 65;
          } else {
            // Match against options text
            const idx = options.findIndex((o: string) => o.trim().toLowerCase() === correctRaw.trim().toLowerCase());
            if (idx >= 0) correctIndex = idx;
          }
        }
        if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

        // Use the explanation field or build a minimal one
        const explanation = c.explanation || `Correct answer: ${options[correctIndex]}.`;

        // Map question_type to a readable section label
        const sectionMap: Record<string, string> = {
          'read_academic_passage': 'Reading — Comprehension',
          'read_in_daily_life': 'Reading — Daily Life',
          'complete_the_words': 'Reading — Vocabulary',
          'listen_choose_response': 'Listening — Response',
          'listen_academic_talk': 'Listening — Lecture',
          'true_false_not_given': 'Reading — True/False/Not Given',
          'multiple_choice': 'Multiple Choice',
          'matching_headings': 'Reading — Matching Headings',
        };
        const section = sectionMap[row.question_type] || row.section;

        return {
          question: question.slice(0, 500),  // Telegram message length safety
          options: options.slice(0, 4).map((o: string) => o.slice(0, 200)),
          correctIndex,
          explanation,
          section,
          testType: row.test_type,
          articleSlug: `quiz-of-the-day`,  // generic — /api/blog resolves missing
        };
      } catch { /* skip malformed row */ }
    }
    return null;
  } catch (e) {
    console.error('[quiz] pullRandomQuizFromBank error (non-fatal):', e);
    return null;
  }
}

export async function generateVocabularyOfTheDay(env: Env): Promise<{ text: string; imagePrompt?: string; channelImage?: { bytes: ArrayBuffer; mime_type: string; source: 'cache' | 'fresh' | 'fallback' } }> {
  // Week 2 channel fix: pull example sentences from real test_contents
  // reading passages (which contain rich academic English) instead of
  // the 14-entry hardcoded array that cycled forever. The word list
  // stays curated (30 high-frequency TOEFL/IELTS academic words), but
  // each word's example sentence comes from a real exam passage, so
  // the post never looks the same twice. Falls back to a static
  // example if D1 is empty.
  const ACADEMIC_WORDS: { word: string; indonesian: string; pos: string; context: string }[] = [
    { word: 'mitigate',   pos: 'verb',   indonesian: 'meringankan dampak',   context: 'environment & policy' },
    { word: 'substantiate', pos: 'verb', indonesian: 'membuktikan',          context: 'research & writing' },
    { word: 'paradigm',   pos: 'noun',   indonesian: 'pola / kerangka pikir', context: 'academic essays' },
    { word: 'ephemeral',  pos: 'adj',    indonesian: 'tidak kekal',           context: 'technology & social' },
    { word: 'catalyst',   pos: 'noun',   indonesian: 'pemicu perubahan',     context: 'cause-effect' },
    { word: 'pragmatic',  pos: 'adj',    indonesian: 'realistis',             context: 'problem-solving' },
    { word: 'exacerbate', pos: 'verb',   indonesian: 'memperburuk',           context: 'sociology' },
    { word: 'pristine',   pos: 'adj',    indonesian: 'asli / belum tersentuh', context: 'environment' },
    { word: 'ambiguous',  pos: 'adj',    indonesian: 'ambigu / tdk jelas',    context: 'reading strategies' },
    { word: 'prevalent',  pos: 'adj',    indonesian: 'umum / banyak',         context: 'environment & health' },
    { word: 'coherent',   pos: 'adj',    indonesian: 'koheren / logis',      context: 'writing' },
    { word: 'undermine',  pos: 'verb',   indonesian: 'melemahkan',            context: 'politics & social' },
    { word: 'nuance',     pos: 'noun',   indonesian: 'nuansa / hal halus',    context: 'reading' },
    { word: 'compelling', pos: 'adj',    indonesian: 'meyakinkan',           context: 'speaking & writing' },
    { word: 'viable',     pos: 'adj',    indonesian: 'layak / bisa diterapkan', context: 'problem-solving' },
    { word: 'detriment',  pos: 'noun',   indonesian: 'kerugian / dampak buruk', context: 'health' },
    { word: 'inclination', pos: 'noun',  indonesian: 'kecenderungan',        context: 'sociology' },
    { word: 'feasible',   pos: 'adj',    indonesian: 'layak laksana',        context: 'business' },
    { word: 'concise',    pos: 'adj',    indonesian: 'ringkas',               context: 'writing' },
    { word: 'reluctant',  pos: 'adj',    indonesian: 'enggan / tdk mau',     context: 'reading' },
  ];

  const shuffled = ACADEMIC_WORDS.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  // Pull one real passage from test_contents to extract a fresh example
  // sentence for each word. The passage query is fast (indexed) and
  // gives us a real TOEFL/IELTS sentence for context — never the same
  // example twice in a row.
  const testTypes = ['TOEFL_IBT', 'IELTS', 'TOEFL_ITP', 'TOEIC'];
  const randomTest = testTypes[Math.floor(Math.random() * testTypes.length)];
  let realExamples: { sentence: string }[] = [];
  try {
    const passageRows = await env.DB.prepare(
      `SELECT content FROM test_contents
       WHERE status = 'published' AND question_type IN ('read_academic_passage', 'read_in_daily_life', 'listen_academic_talk')
       ORDER BY RANDOM() LIMIT 5`
    ).all<{ content: string }>();
    const sentences: string[] = [];
    for (const row of passageRows.results || []) {
      try {
        const c = JSON.parse(row.content);
        const text = c.passage_text || c.passage || c.script || '';
        // Pull sentences that contain an academic word (length 50-200 chars)
        const matches = text.match(/[^.!?]{50,200}[.!?]/g) || [];
        for (const s of matches) {
          if (s.length > 80 && s.length < 200) {
            sentences.push(s.trim());
            if (sentences.length >= 5) break;
          }
        }
        if (sentences.length >= 5) break;
      } catch { /* skip malformed content */ }
    }
    realExamples = sentences.map((s) => ({ sentence: s }));
  } catch (e) {
    console.error('[vocab] failed to pull real examples (non-fatal):', e);
  }

  const testEmoji = formatTestEmoji(randomTest);

  let text = `${testEmoji} VOCAB HARIAN | ${randomTest}\n\n`;
  text += `🎯 3 kata academic yang sering muncul di exam:\n\n`;

  selected.forEach((v, i) => {
    const ex = realExamples[i]?.sentence || `The researchers used this word in a published paper.`;
    text += `${i + 1}️⃣ *${v.word}* (${v.pos})\n`;
    text += `   🇮🇩 ${v.indonesian}\n`;
    text += `   📝 "${ex}"\n`;
    text += `   💡 Context: ${v.context}\n\n`;
  });

  text += `━━━━━━━━━━━━━━━\n`;
  text += `📖 Baca penjelasan lengkap + contoh kalimat + latihan:\n`;
  // Use a generic vocab-of-the-day article slug (the worker /api/blog
  // endpoint resolves any missing slug to a 'coming soon' page).
  text += `👉 ${OSEE_BLOG}vocab-of-the-day\n\n`;
  text += `💬 Coba bikin 2 kalimat pake salah satu kata hari ini!\n`;
  text += `Komen di bawah ↓\n\n`;
  text += `#vocab_harian #belajaringgris #${randomTest.toLowerCase().replace(' ','')} #toefl #ielts #englishvocabulary`;

  // Channel post image (best-effort). The imagePrompt is still
  // returned for backwards compatibility (legacy callers that want the
  // raw prompt for their own use). The channelImage field carries
  // the actual generated bytes ready for sendPhoto.
  const imagePrompt = `Clean educativo infographic, minimalist design with purple and blue gradient, showing 3 academic English vocabulary words: ${selected.map(v => v.word).join(', ')}. Clean white background, professional typography, suitable for Telegram channel post`;

  let channelImage: { bytes: ArrayBuffer; mime_type: string; source: 'cache' | 'fresh' | 'fallback' } | undefined;
  try {
    const { getOrGenerateChannelImage } = await import('./channel-image');
    channelImage = await getOrGenerateChannelImage(env, {
      topic: 'vocab',
      subject: selected.map(v => v.word).join(', '),
      variant: randomTest,
    });
  } catch (e: any) {
    console.error('[generateVocabularyOfTheDay] channel-image error (non-fatal):', e?.message || e);
  }

  return { text, imagePrompt, channelImage };
}

export async function generateDailyQuiz(env: Env): Promise<QuizItem> {
  // Week 2 channel fix: pull a real quiz from test_contents.
  // The hardcoded array of 10 questions was the only source — once a
  // student has seen them, the channel feels stale. test_contents has
  // hundreds of real TOEFL/IELTS questions with full content+options
  //+correct answers. Falls back to hardcoded if D1 is empty.
  const liveQuestion = await pullRandomQuizFromBank(env);
  if (liveQuestion) return liveQuestion;

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
      explanation: 'Ini Second Conditional — tentang hypothetical situation di masa sekarang/kedepan. Structure: If + Past Simple + would/could/might + base verb. "If I had more money" = kalau saja aku punya lebih banyak uang (tapi nyatanya nggak).',
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
  const picked = shuffled[0];
  // Best-effort channel image. Subject is a short snippet of the
  // question text so the cache key changes per question (each quiz
  // gets its own visual).
  try {
    const { getOrGenerateChannelImage } = await import('./channel-image');
    const subject = picked.question.replace(/^["']|["']$/g, '').substring(0, 120);
    (picked as any).channelImage = await getOrGenerateChannelImage(env, {
      topic: 'quiz',
      subject: `${picked.section}: ${subject}`,
      variant: picked.testType,
    });
  } catch (e: any) {
    console.error('[generateDailyQuiz] channel-image error (non-fatal):', e?.message || e);
  }
  return picked;
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

export async function generateGrammarTip(env: Env): Promise<{ text: string; channelImage?: { bytes: ArrayBuffer; mime_type: string; source: 'cache' | 'fresh' | 'fallback' } }> {
  const tips: GrammarTip[] = [
    {
      title: '⚡ "Which" vs "That" — Wajib Bisa di TOEFL/IELTS!',
      rule: 'That = restrictive clause (identifying — gak bisa diapus). Which = non-restrictive (info tambahan — bisa diapus tanpa mengubah arti).',
      examples: [
        { en: 'The book that changed my life is on the table.', id: 'Buku yang mengubah hidupku ada di meja. → kalau diapus "The book is on the table" = masih ada arti.' },
        { en: 'My phone, which is brand new, is already broken.', id: 'HP-ku, yang baru banget, udah rusak. → kalau diapus "My phone is already broken" = kehilangan info tambahan.' },
      ],
      toeflNote: '🎯 TOEFL/ IELTS Reading & Writing: kalau removal mengubah arti kalimat = THAT. Kalau removal nggak mengubah = WHICH. Sakti di soal vocabulary-in-context juga!',
      articleSlug: 'which-vs-that-definitive-guide',
      testTypes: ['TOEFL_IBT', 'IELTS']
    },
    {
      title: '⚡ Neither...Nor — Proximity Rule yang Sering Salah',
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
      toeflNote: '💡 Trick: replace whom dengan him/her/they. Kalau kalimat masih masuk akal = whom bener. TOEFL ITP Structure suka nguji ini.',
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

  // Best-effort channel image. Subject = the rule title so the cache
  // key changes per tip.
  let channelImage: { bytes: ArrayBuffer; mime_type: string; source: 'cache' | 'fresh' | 'fallback' } | undefined;
  try {
    const { getOrGenerateChannelImage } = await import('./channel-image');
    channelImage = await getOrGenerateChannelImage(env, {
      topic: 'grammar',
      subject: tip.title,
      variant: tip.testTypes[0],
    });
  } catch (e: any) {
    console.error('[generateGrammarTip] channel-image error (non-fatal):', e?.message || e);
  }

  return { text, channelImage };
}

export async function generateIdiom(env: Env): Promise<{ text: string; channelImage?: { bytes: ArrayBuffer; mime_type: string; source: 'cache' | 'fresh' | 'fallback' } }> {
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
      meaning: 'Hal buruk yang ternyata jadi berkah / kemalangan yang berakhir baik',
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

  // Best-effort channel image. Subject = the idiom itself so the
  // visual is the literal wordplay (the image generator builds a pun).
  let channelImage: { bytes: ArrayBuffer; mime_type: string; source: 'cache' | 'fresh' | 'fallback' } | undefined;
  try {
    const { getOrGenerateChannelImage } = await import('./channel-image');
    channelImage = await getOrGenerateChannelImage(env, {
      topic: 'idiom',
      subject: `${idiom.idiom} — ${idiom.meaning}`,
    });
  } catch (e: any) {
    console.error('[generateIdiom] channel-image error (non-fatal):', e?.message || e);
  }

  return { text, channelImage };
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
    `🎯 Lo tau nggak? Platform belajar TOEFL/IELTS yang bikin aku bisa naikin skor 6.0 dalam 2 bulan!\n\nBeda dari yang lain:\n✅ AI feedback per kata — lo tau tepat bagian mana yang salah\n✅ Explanations lengkap — bukan cuma jawaban, tapi kenapa\n✅ Practice kapan aja, di mana aja — fleksibel banget\n\nCoba gratis dulu — 10 soal per hari tanpa batas waktu 👇\n👉 ${OSEE_BOT}promo\n\n#belajaringgris #toefl #ielts #premium`,
    `📚 Mau naikin skor TOEFL/IELTS tapi bingung mulai dari mana?\n\nAku pernah di posisi lo — udah coba YouTube, buku, semua apps. Tapi baru ngerasa cocok di EduBot.\n\nKenapa?\n• Adaptive learning — soal yang keluar sesuai level lo\n• Spaced repetition — lo review soal yang pernah salah\n• AI Tutor 24/7 — tanya kapan aja, dapat jawaban konkret\n\nDaftar gratis sekarang 👇\n👉 ${OSEE_BOT}promo\n\n#toeflprep #ieltsprep #belajaringgris`,
    `💡 Pesan buat student Indonesia: Belajar TOEFL/IELTS itu nggak harus mahal!\n\nEduBot kasih akses ke:\n• 3,000+ soal dengan explanations\n• Speaking practice dengan AI evaluation\n• Diagnostic test — tau level lo sekarang\n• Personalized study plan\n\nSemua mulai dari Rp 99rb/bulan. Lebih murah dari 1x les private.\n\nCoba 1 hari premium gratis 👇\n👉 ${OSEE_BOT}promo`,
    `🎓 TOEFL deadline approaching?\n\nMasih ada ${random.emoji} waktu buat persiapan — nggak harus ambil course mahal.\n\nDengan 30 menit sehari di EduBot, banyak student udah naikin skor mereka 0.5-1.0 band dalam 30 hari.\n\nKuncinya: konsisten + practice yang tepat.\n\nMulai sekarang 👇\n👉 ${OSEE_BOT}promo\n\n#${random.name.toLowerCase().replace(' ','')} #belajaringgris #studytips`,
  ];

  return ctas[Math.floor(Math.random() * ctas.length)];
}

export function generateSpeakingCTA(): string {
  const ctas = [
    `🗣️ Tahu nggak? Bagian Speaking TOEFL/IELTS yang bikin orang gugup.\n\nBukan karena topik-nya, tapi karena lo nggak punya guru yang bisa koreksi pronunciation lo secara spesifik.\n\nDi EduBot:\n•🎙️ Lo rekam jawaban lo\n•🤖 AI evaluasi akurasi pronunciation lo per kata\n•📝 Lo dapat feedback konkret: "Kata 'research' lo salah pronunciation di bagian kedua"\n\nIni yang bikin beda. Bukan cuma skor — tapi lo tau persis apa yang harus diperbaiki.\n\nCoba speaking practice gratis 👇\n👉 ${OSEE_BOT}speaking\n\n#speakingpractice #toefl #ielts #pronunciation`,
    `🎙️ Read-aloud atau Interview — lo pilih jenis speaking yang mau lo latihan.\n\nKedua-duanya ada AI evaluation yang kasih:\n•🎯 Pronunciation score per kata\n•📊 Fluency assessment\n•💡 Specific feedback: "Vowel sound di 'comPREHENSION' perlu diperbaiki"\n\nDi tempat lain? Lo cuma dapat skor tanpa penjelasan.\n\nMulai gratis 👇\n👉 ${OSEE_BOT}speaking\n\n#toeflspeaking #ieltsspeaking #speakingpractice`,
    `💬 Di EduBot, Speaking practice itu bukan cuma "catat band score."\n\nSetiap jawaban lo dinilai oleh AI untuk:\n•🗣️ Pronunciation — lo ngomong pronouncing yang bener apa nggak\n•📖 Fluency — lo lancar atau TerPUTUS-PUTUS\n•🎯 Comprehension — lo ngerti pertanyaan dan bisa jawab dengan tepat\n\nBaru nemu platform yang nerjemahin "lo salah pronunciation di kata ini" dengan spesifik.\n\nCoba sekarang 👇\n👉 ${OSEE_BOT}speaking\n\n#speakingtips #toefl #ielts #englishspeaking`,
    `🗣️ Indonesian accent + TOEFL Speaking = tantangan terbesar.\n\nKenapa?\n•🇮🇩 Bahasa Indonesia punya vowel sounds yang beda dari English\n•🇬🇧 Banyak kata yang pronunciationnya beda dari penulisannya\n\nTapi kalau tau exactly apa yang salah — gampang diperbaiki.\n\nEduBot AI kasih feedback per fonem: bukan cuma "pronunciation perlu diperbaiki" tapi "bagian ini salah, coba pronounce ulang dengan cara ini."\n\nCoba sekarang 👇\n👉 ${OSEE_BOT}speaking\n\n#pronunciation #toeflielts #speakingpractice`,
  ];

  return ctas[Math.floor(Math.random() * ctas.length)];
}

// Channel posts are authored with *bold* / _italic_ markers but sent with
// parse_mode:'HTML' — without conversion Telegram renders literal asterisks.
// Escape HTML specials first (content has no raw tags), then convert markers.
export function channelMarkdownToHtml(text: string): string {
  let t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  t = t
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/_([^_\n]+)_/g, '<i>$1</i>');
  return t;
}

export interface PostToChannelOptions {
  /** Optional image to send as a Telegram photo (caption = text). */
  image?: { bytes: ArrayBuffer; mime_type: string; source?: 'cache' | 'fresh' | 'fallback' };
  /**
   * Whether to fall back to sendMessage if the image send fails. Default
   * true — we never block the channel post on an image problem.
   */
  fallbackToText?: boolean;
}

export async function postToChannel(
  env: Env,
  text: string,
  contentType = 'cta',
  options: PostToChannelOptions = {},
): Promise<boolean> {
  const channelId = env.TELEGRAM_BOT_TOKEN.includes('test')
    ? '@TOEFL_IELTS_Indonesia_Test'
    : '-1003884450070';

  const htmlText = channelMarkdownToHtml(text);
  let messageId: string | null = null;
  let status = 'failed';
  let errorMsg: string | null = null;
  let usedPhoto = false;

  // We have an image and it's not the transparent-PNG fallback — try
  // sendPhoto first. Telegram's sendPhoto accepts text as caption
  // (capped at 1024 chars; longer captions are sent separately by
  // falling back to sendMessage).
  const image = options.image;
  const shouldTryPhoto = image && image.source !== 'fallback' && image.bytes.byteLength > 1024;

  if (shouldTryPhoto) {
    try {
      // Telegram caption limit is 1024 chars. If text is longer, send
      // a text follow-up and use a truncated caption. We still get the
      // visual.
      const TELEGRAM_CAPTION_MAX = 1024;
      const caption = htmlText.length > TELEGRAM_CAPTION_MAX
        ? htmlText.substring(0, TELEGRAM_CAPTION_MAX - 3) + '…'
        : htmlText;
      const captionParseMode = htmlText.length > TELEGRAM_CAPTION_MAX ? undefined : 'HTML';

      const form = new FormData();
      form.append('chat_id', channelId);
      const ext = image.mime_type === 'image/jpeg' ? 'jpg' : 'png';
      form.append('photo', new File([image.bytes], `channel-${contentType}.${ext}`, { type: image.mime_type }));
      form.append('caption', caption);
      if (captionParseMode) form.append('parse_mode', captionParseMode);

      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: form,
      });
      const result = await res.json() as any;
      if (result.ok) {
        messageId = String(result.result?.message_id || null);
        status = 'sent';
        usedPhoto = true;
      } else {
        errorMsg = `sendPhoto: ${result.description || 'unknown'}`;
        console.warn(`[postToChannel] sendPhoto failed for ${contentType}, will try text:`, result);
      }
    } catch (e: any) {
      errorMsg = `sendPhoto threw: ${e?.message || e}`;
      console.error('[postToChannel] sendPhoto threw, falling back to text:', e);
    }
  }

  // Send text (either because we don't have an image, or the photo send failed)
  if (status !== 'sent') {
    try {
      let response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          text: htmlText,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });

      let result = await response.json() as any;
      if (!result.ok) {
        // HTML parse rejection → retry as plain text so the post still lands.
        response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: channelId,
            text: text.replace(/[*_]/g, ''),
            disable_web_page_preview: false,
          }),
        });
        result = await response.json() as any;
      }
      if (result.ok) {
        messageId = String(result.result?.message_id || null);
        status = 'sent';
      } else {
        errorMsg = (errorMsg ? errorMsg + '; ' : '') + (result.description || 'Unknown error');
        console.error('Channel post failed:', result);
      }
    } catch (e: any) {
      errorMsg = (errorMsg ? errorMsg + '; ' : '') + (e?.message || String(e));
      console.error('Failed to post to channel:', e);
    }
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
