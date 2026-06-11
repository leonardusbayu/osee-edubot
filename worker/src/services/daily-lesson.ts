type TargetTest = 'TOEFL_IBT' | 'TOEFL_ITP' | 'IELTS' | 'TOEIC';

type DailyLesson = {
  target: TargetTest;
  label: string;
  hook: string;
  insight: string;
  microLesson: string;
  tryNow: string;
  reflection: string;
  cta: string;
  scene: string;
  sceneVocab: string[];
  focusCallback: string;
};

const TARGET_LABELS: Record<TargetTest, string> = {
  TOEFL_IBT: 'TOEFL iBT',
  TOEFL_ITP: 'TOEFL ITP',
  IELTS: 'IELTS',
  TOEIC: 'TOEIC',
};

const TARGET_EMOJI: Record<TargetTest, string> = {
  TOEFL_IBT: '🇺🇸',
  TOEFL_ITP: '📚',
  IELTS: '🇬🇧',
  TOEIC: '🏢',
};

const DAILY_LESSONS: Record<TargetTest, DailyLesson[]> = {
  TOEFL_ITP: [
    {
      target: 'TOEFL_ITP',
      label: TARGET_LABELS.TOEFL_ITP,
      hook: 'TOEFL ITP Structure sering bisa dijawab sebelum kamu tahu arti seluruh kalimat.',
      insight: 'Kuncinya: cari subject dan verb utama. Banyak distraktor cuma phrase panjang yang bikin kamu panik.',
      microLesson: 'Core sentence dulu: buang prepositional phrase, adjective clause, dan appositive. Tinggal siapa melakukan apa.',
      tryNow: 'Latihan 45 detik: “The results of the experiment in the coastal area ___ surprising.” Pilih: is/are/was/were. Core-nya apa?',
      reflection: 'Kamu tadi membaca semua detail, atau langsung mencari subject utama?',
      cta: 'Ketik /study → Reading → Structure & Written Expression.',
      scene: 'A student solving a TOEFL ITP structure question, crossing out long phrases and circling the subject and main verb',
      sceneVocab: ['subject', 'verb', 'structure', 'phrase', 'grammar'],
      focusCallback: 'cat_reading',
    },
    {
      target: 'TOEFL_ITP',
      label: TARGET_LABELS.TOEFL_ITP,
      hook: 'Listening ITP terasa cepat karena kamu menunggu kata yang sama. Padahal jawaban sering berupa paraphrase.',
      insight: 'Kalau audio bilang “postpone”, opsi bisa menulis “delay”. Kalau audio bilang “costly”, opsi bisa menulis “expensive”.',
      microLesson: 'Latih telinga untuk sinonim, bukan copy-paste kata. Catat meaning, bukan exact wording.',
      tryNow: 'Tulis 5 pasangan sinonim hari ini: postpone-delay, purchase-buy, assist-help, costly-expensive, locate-find.',
      reflection: 'Saat listening, kamu mencari kata yang sama atau makna yang sama?',
      cta: 'Ketik /study → Listening → Catch the Detail.',
      scene: 'A student wearing headphones matching spoken English phrases to paraphrased answer choices on paper',
      sceneVocab: ['listening', 'paraphrase', 'synonym', 'headphones', 'answer choices'],
      focusCallback: 'cat_listening',
    },
  ],
  IELTS: [
    {
      target: 'IELTS',
      label: TARGET_LABELS.IELTS,
      hook: 'IELTS Writing naik bukan karena kata makin rumit, tapi karena ide makin jelas.',
      insight: 'Band tinggi suka kalimat yang punya position jelas, development cukup, dan contoh yang relevan.',
      microLesson: 'Pakai PEEL: Point, Explain, Example, Link. Jangan lompat dari opini ke contoh tanpa explain.',
      tryNow: 'Buat 4 baris PEEL untuk topik: “Online learning is effective.” Maks 5 menit.',
      reflection: 'Contohmu benar-benar membuktikan point, atau cuma cerita tambahan?',
      cta: 'Ketik /study → Writing → Essay Builder.',
      scene: 'A student planning an IELTS essay with four color-coded PEEL blocks on a notebook beside a laptop',
      sceneVocab: ['IELTS writing', 'PEEL', 'essay', 'example', 'argument'],
      focusCallback: 'cat_writing',
    },
    {
      target: 'IELTS',
      label: TARGET_LABELS.IELTS,
      hook: 'True/False/Not Given bukan tes feeling. Ini tes batas bukti.',
      insight: 'TRUE = teks mendukung. FALSE = teks bertentangan. NOT GIVEN = teks tidak memberi cukup bukti, walau terdengar masuk akal.',
      microLesson: 'Jangan pakai pengetahuan luar. Tanya: “Kalimat ini bisa dibuktikan dari teks mana?” Kalau tidak ada, kemungkinan NG.',
      tryNow: 'Ambil 1 kalimat dari artikel. Buat 1 statement yang TRUE, 1 yang FALSE, 1 yang NOT GIVEN.',
      reflection: 'Kamu memilih berdasarkan teks, atau berdasarkan logika umum?',
      cta: 'Ketik /study → Reading → True/False/Not Given.',
      scene: 'A student comparing IELTS reading statements against a passage with three labels TRUE FALSE NOT GIVEN on sticky notes',
      sceneVocab: ['true', 'false', 'not given', 'evidence', 'reading'],
      focusCallback: 'cat_reading',
    },
  ],
  TOEIC: [
    {
      target: 'TOEIC',
      label: TARGET_LABELS.TOEIC,
      hook: 'TOEIC bukan cuma English. Ini simulasi kantor: cepat menangkap maksud, siapa melakukan apa, dan kapan deadline-nya.',
      insight: 'Email TOEIC sering punya clue di subject line, opening sentence, dan final request.',
      microLesson: 'Baca email dengan 3 pertanyaan: tujuan pesan apa, aksi yang diminta apa, deadline/kondisinya apa.',
      tryNow: 'Buka email kerja lama. Ringkas dalam English: purpose, action, deadline. Satu baris saja.',
      reflection: 'Kamu memahami detail, atau sudah tahu tindakan yang harus dilakukan?',
      cta: 'Ketik /study → Reading → Business Reading.',
      scene: 'An office worker reading a business email with highlighted subject line, requested action, and deadline on a monitor',
      sceneVocab: ['email', 'deadline', 'request', 'office', 'business reading'],
      focusCallback: 'cat_reading',
    },
    {
      target: 'TOEIC',
      label: TARGET_LABELS.TOEIC,
      hook: 'Di TOEIC Listening Part 2, jawaban terbaik sering bukan jawaban lengkap — tapi response paling natural.',
      insight: '“When will the report be ready?” bisa dijawab “By Friday.” Singkat, tapi tepat.',
      microLesson: 'Latih WH-question mapping: when → time, where → place, who → person, why → reason, how → method/condition.',
      tryNow: 'Buat 5 response pendek: when/by Friday, where/in the meeting room, who/Ms. Chen, why/because of traffic, how/by email.',
      reflection: 'Kamu mencari grammar lengkap atau response yang paling masuk akal?',
      cta: 'Ketik /study → Listening → Quick Response.',
      scene: 'A professional wearing earbuds practicing short TOEIC question responses with WH words mapped to answer types on sticky notes',
      sceneVocab: ['when', 'where', 'who', 'why', 'response'],
      focusCallback: 'cat_listening',
    },
  ],
  TOEFL_IBT: [
    {
      target: 'TOEFL_IBT',
      label: TARGET_LABELS.TOEFL_IBT,
      hook: 'Independent Writing: kamu tidak perlu opini orisinal. TOEFL nilai kejelasan + organisasi.',
      insight: 'Template 4 paragraf (intro + 2 reasons + conclusion) bekerja di 90% soal.',
      microLesson: 'Tulis thesis yang menyebut 2 alasan spesifik. Setiap reason paragraph: topic sentence → example → explanation.',
      tryNow: 'Pilih 1 prompt, tulis outline 4 paragraf dalam 5 menit (tulis utuh belum perlu).',
      reflection: 'Thesis kamu menyebut 2 alasan spesifik, atau cuma opini umum?',
      cta: 'Ketik /study → Writing → Essay Outlines.',
      scene: 'A student outlining a 4-paragraph essay on a whiteboard, with thesis and 2 reasons connected by arrows',
      sceneVocab: ['thesis', 'reason', 'example', 'essay', 'paragraph'],
      focusCallback: 'cat_writing',
    },
    {
      target: 'TOEFL_IBT',
      label: TARGET_LABELS.TOEFL_IBT,
      hook: 'Listening lecture sering jawabannya bukan kata yang diucapkan, tapi implikasinya.',
      insight: 'Professor jarang bilang "important". Mereka bilang: "what I really want to emphasize is…"',
      microLesson: 'Latih "implied meaning": setelah dengar 1 kalimat profesor, tanya ke diri sendiri — apa yang dia benar-benar mau saya ingat?',
      tryNow: 'Putar 1 TED talk 3 menit, tulis 2 implied points yang tidak disebut eksplisit.',
      reflection: 'Kamu jawab sesuai kata yang diucapkan, atau sesuai maksud profesor?',
      cta: 'Ketik /study → Listening → Lecture Implication.',
      scene: 'A student listening to a TED talk with a notebook, marking implied points that the speaker emphasizes',
      sceneVocab: ['implied', 'emphasize', 'meaning', 'lecture', 'point'],
      focusCallback: 'cat_listening',
    },
    {
      target: 'TOEFL_IBT',
      label: TARGET_LABELS.TOEFL_IBT,
      hook: 'Vocabulary TOEFL: 1 kata akademik bisa punya 3 sinonim. Pelajari 1 + 2 sinonim = 3 kata untuk 1 slot.',
      insight: '"Important" = crucial, vital, significant. Ketiganya sering muncul di jawaban.',
      microLesson: 'Setiap jumpa academic word baru, tambahkan 2 sinonim umum. Cek di /vocab.',
      tryNow: 'Ambil 5 kata akademik dari reading passage hari ini. Tulis 2 sinonim untuk masing-masing.',
      reflection: 'Apakah sinonim kamu muncul di pilihan jawaban TOEFL?',
      cta: 'Ketik /vocab untuk latihan dengan FSRS.',
      scene: 'A student writing word clusters in a notebook — "important" with arrows to "crucial" and "vital"',
      sceneVocab: ['synonym', 'academic', 'crucial', 'vital', 'vocabulary'],
      focusCallback: 'cat_vocab',
    },
    {
      target: 'TOEFL_IBT',
      label: TARGET_LABELS.TOEFL_IBT,
      hook: 'Reading inference: 4 dari 5 soal TOEFL inference bisa dijawab tanpa baca passage detail.',
      insight: 'Fungsi kalimat (cause, contrast, example) lebih penting dari vocabulary detail.',
      microLesson: 'Untuk inference questions, fokus pada: 1) tujuan author, 2) tone keseluruhan, 3) fungsi paragraf pertama/terakhir.',
      tryNow: 'Ambil 1 reading passage, baca paragraf 1 dan terakhir saja. Tebak 3 inference questions.',
      reflection: 'Jawaban inference kamu berdasarkan text atau feelings?',
      cta: 'Ketik /study → Reading → Inference Practice.',
      scene: 'A student with a highlighter marking only the first and last paragraphs of a reading passage',
      sceneVocab: ['inference', 'author', 'tone', 'paragraph', 'purpose'],
      focusCallback: 'cat_reading',
    },
    {
      target: 'IELTS',
      label: TARGET_LABELS.IELTS,
      hook: 'Writing Task 2: paragraph 2 selalu lebih penting dari intro. Recruiter IELTS baca paragraph 2 duluan.',
      insight: 'Body paragraph kamu harus punya: topic sentence + explanation + example + link ke thesis.',
      microLesson: 'Tulis body paragraph pertama dengan formula TEEL: Topic sentence, Explain, Example/Evidence, Link back.',
      tryNow: 'Ambil 1 task 2 prompt, tulis 1 body paragraph TEEL utuh (200 kata).',
      reflection: 'Body paragraph kamu punya example spesifik, atau generic?',
      cta: 'Ketik /study → Writing → Task 2 Body.',
      scene: 'A student writing a TEEL-structured paragraph with topic, explanation, example, and link highlighted in different colors',
      sceneVocab: ['topic sentence', 'example', 'paragraph', 'TEEL', 'body'],
      focusCallback: 'cat_writing',
    },
    {
      target: 'IELTS',
      label: TARGET_LABELS.IELTS,
      hook: 'Speaking Part 2 cue card: 1 menit terasa singkat karena kamu lupa struktur. Solusinya: PREP.',
      insight: 'PREP = Point (thesis 1 kalimat), Reason, Example, Point (restate thesis). 2 menit = 4 P.',
      microLesson: 'Untuk setiap cue card, prepare 4 P: Point → Reason → Example → Point. Bicara 2 menit = sekitar 250-300 kata.',
      tryNow: 'Ambil 1 cue card random, bicara 2 menit dengan timer. Rekam voice message.',
      reflection: 'Apakah kamu bisa finish dalam 2 menit, atau kehabisan waktu?',
      cta: 'Ketik /speak untuk latihan IELTS 3-Part.',
      scene: 'A student using PREP structure on a sticky note while speaking into a voice recorder, with a 2-minute timer in the background',
      sceneVocab: ['cue card', 'PREP', 'point', 'example', '2 minutes'],
      focusCallback: 'cat_speaking',
    },
    {
      target: 'IELTS',
      label: TARGET_LABELS.IELTS,
      hook: 'Reading: TRUE/FALSE/NOT GIVEN sering keliru di NOT GIVEN. NOT GIVEN ≠ FALSE.',
      insight: 'NOT GIVEN = info tidak ada di passage (bisa benar di dunia nyata, tapi passage tidak sebut).',
      microLesson: 'Untuk NOT GIVEN, tanyakan: apakah passage secara eksplisit mengatakan ini? Jika tidak → NOT GIVEN, bukan FALSE.',
      tryNow: 'Cari 5 soal TRUE/FALSE/NOT GIVEN. Highlight di passage: TRUE/FALSE punya text evidence, NOT GIVEN tidak punya.',
      reflection: 'Berapa NOT GIVEN yang kamu jawab benar? Jika <60%, focus ke logic distinction.',
      cta: 'Ketik /study → Reading → True/False/NG.',
      scene: 'A student highlighting True/False/Not Given answers in different colors, with NOT GIVEN having no highlight in the text',
      sceneVocab: ['TRUE', 'FALSE', 'NOT GIVEN', 'passage', 'evidence'],
      focusCallback: 'cat_reading',
    },
    {
      target: 'IELTS',
      label: TARGET_LABELS.IELTS,
      hook: 'Listening: kalau kamu kehilangan 1 jawaban, LANJUT. Jangan replay di kepala.',
      insight: 'IELTS Listening tiap section hanya diputar 1 kali. Kehilangan 1 = kehilangan momentum section itu.',
      microLesson: 'Practice "predict the answer" sebelum audio play. Prediksi tipe (nama/angka/tanggal) fokus dengar itu.',
      tryNow: 'Putar 1 IELTS listening section. Pause setelah setiap question stem, prediksi tipe jawaban.',
      reflection: 'Berapa detik kamu "stuck" di jawaban yang hilang?',
      cta: 'Ketik /study → Listening → Predict & Listen.',
      scene: 'A student with a worksheet predicting answer types (name, number, date) before each IELTS listening question',
      sceneVocab: ['predict', 'audio', 'answer type', 'section', 'focus'],
      focusCallback: 'cat_listening',
    },
    {
      target: 'TOEIC',
      label: TARGET_LABELS.TOEIC,
      hook: 'Reading Part 7: banyak double passages = banyak soal. Strategi: baca pertanyaan dulu, lalu scan teks.',
      insight: 'Skimming > reading. TOEIC tidak nilai pemahaman detail, hanya informasi spesifik.',
      microLesson: 'Untuk setiap passage, baca questions dulu (45 detik), highlight key info yang dicari, baru scan teks untuk kata yang sama.',
      tryNow: 'Ambil 1 TOEIC Part 7 passage, coba teknik ini. Bandingkan waktu vs baca utuh.',
      reflection: 'Apakah kamu lebih cepat dengan teknik ini, atau baca utuh?',
      cta: 'Ketik /study → Reading → TOEIC Speed.',
      scene: 'A student scanning a TOEIC Part 7 passage with highlighted keywords from questions on a separate sheet',
      sceneVocab: ['skim', 'scan', 'keyword', 'question', 'passage'],
      focusCallback: 'cat_reading',
    },
    {
      target: 'TOEIC',
      label: TARGET_LABELS.TOEIC,
      hook: 'Listening Part 4 (talks): announcement selalu ada: WHO, WHAT, WHERE, WHEN.',
      insight: '4W formula. Tapi 50% soal TOEIC hanya test 1-2 dari 4W ini. Fokus ke WHAT.',
      microLesson: 'Latih "selective listening": saat dengar talk, fokus ke WHAT (informasi utama) dan WHERE (lokasi spesifik).',
      tryNow: 'Putar 1 short announcement (YouTube), identifikasi WHO/WHAT/WHERE/WHEN. Tulis 4 kalimat.',
      reflection: 'Apakah kamu bisa identify WHAT dalam 5 detik pertama?',
      cta: 'Ketik /study → Listening → Announcements.',
      scene: 'A student listening to an airport announcement and writing 4W notes: Who, What, Where, When',
      sceneVocab: ['announcement', '4W', 'who', 'what', 'where'],
      focusCallback: 'cat_listening',
    },
    {
      target: 'TOEIC',
      label: TARGET_LABELS.TOEIC,
      hook: 'Grammar: TOEIC suka test preposisi + kata kerja phrasal. Pelajari 30 phrasal verbs paling umum.',
      insight: 'Top 10 phrasal verbs TOEIC: take off, put off, call off, get along, look forward to, find out, etc.',
      microLesson: 'Setiap hari, pelajari 3 phrasal verbs baru + contoh kalimat bisnis. Cek /vocab untuk drill.',
      tryNow: 'Tulis 5 kalimat email bisnis pakai 5 phrasal verbs berbeda.',
      reflection: 'Berapa phrasal verbs yang kamu pakai di email minggu ini?',
      cta: 'Ketik /vocab untuk drill phrasal verbs.',
      scene: 'A student with sticky notes of phrasal verbs (take off, put off, call off) on a laptop, writing business email examples',
      sceneVocab: ['phrasal verb', 'take off', 'email', 'business', 'common'],
      focusCallback: 'cat_vocab',
    },
  ],
};

function dayIndex(date = new Date()): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
}

export function normalizeTargetTest(targetTest?: string | null): TargetTest {
  if (targetTest === 'TOEFL_ITP' || targetTest === 'IELTS' || targetTest === 'TOEIC') return targetTest;
  return 'TOEFL_IBT';
}

export function getDailyFocusLesson(targetTest?: string | null, date = new Date()): DailyLesson {
  const target = normalizeTargetTest(targetTest);
  const lessons = DAILY_LESSONS[target];
  return lessons[dayIndex(date) % lessons.length];
}

export function renderDailyFocusLesson(lesson: DailyLesson, name?: string | null): string {
  const firstName = name?.trim().split(/\s+/)[0] || 'Teman';
  const emoji = TARGET_EMOJI[lesson.target];
  return `${emoji} *Lesson hari ini buat ${lesson.label}*\n\n` +
    `_${firstName}, stop scroll 20 detik. Ini bisa langsung kepakai di latihanmu hari ini:_\n\n` +
    `🔥 ${lesson.hook}\n\n` +
    `🧠 *Insight*\n${lesson.insight}\n\n` +
    `⚡ *Micro-lesson*\n${lesson.microLesson}\n\n` +
    `🎯 *Coba sekarang*\n${lesson.tryNow}\n\n` +
    `💭 *Self-check*\n${lesson.reflection}\n\n` +
    `🚀 ${lesson.cta}`;
}

export function renderStudyMenuIntro(targetTest?: string | null): string {
  const lesson = getDailyFocusLesson(targetTest);
  const emoji = TARGET_EMOJI[lesson.target];
  return `📚 *Menu Belajar ${emoji} ${lesson.label}*\n\n` +
    `Hari ini fokus kecil dulu:\n` +
    `🔥 ${lesson.hook}\n\n` +
    `Pilih jalur latihan di bawah. Kalau cuma punya 5 menit, mulai dari “Lesson Hari Ini”.`;
}

export function dailyLessonKeyboard(lesson: DailyLesson) {
  return {
    inline_keyboard: [
      [{ text: '🚀 Latih fokus ini', callback_data: lesson.focusCallback }],
      [{ text: '📚 Buka menu belajar', callback_data: 'study_menu' }],
      [{ text: '💬 Tanya tutor', callback_data: 'study_ask' }],
    ],
  };
}
