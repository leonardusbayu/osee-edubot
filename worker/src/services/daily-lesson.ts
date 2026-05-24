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
  TOEFL_IBT: [
    {
      target: 'TOEFL_IBT',
      label: TARGET_LABELS.TOEFL_IBT,
      hook: 'Kalau reading TOEFL terasa panjang, masalahnya sering bukan vocab — tapi kamu membaca semua kalimat seolah semuanya penting.',
      insight: 'TOEFL iBT suka menyembunyikan jawaban di fungsi kalimat: contrast, cause, example, atau definition.',
      microLesson: 'Cari signal words dulu: however, therefore, for example, in other words. Setelah itu baru baca kalimat sebelum/sesudahnya.',
      tryNow: 'Latihan 60 detik: ambil 1 paragraf English, lingkari 3 signal words, lalu tulis fungsi tiap kalimat: reason/example/contrast/result.',
      reflection: 'Pertanyaan kecil: tadi kamu mencari arti kata, atau mencari fungsi kalimat?',
      cta: 'Ketik /study lalu pilih Reading → Vocab in Context atau Speed Reading.',
      scene: 'A focused student at a desk scanning an academic passage on a tablet, with highlighted connector words and a notebook showing cause, contrast, example symbols',
      sceneVocab: ['however', 'therefore', 'example', 'contrast', 'academic passage'],
      focusCallback: 'cat_reading',
    },
    {
      target: 'TOEFL_IBT',
      label: TARGET_LABELS.TOEFL_IBT,
      hook: 'Speaking TOEFL bukan lomba aksen. Ini lomba struktur dalam 45 detik.',
      insight: 'Jawaban yang terdengar lancar biasanya punya kerangka: opinion → reason → example → closing.',
      microLesson: 'Pakai OREO: Opinion, Reason, Example, Opinion again. Satu alasan kuat lebih bagus daripada tiga alasan mentah.',
      tryNow: 'Rekam 30 detik: “I prefer studying in the morning.” Pakai 1 reason + 1 example pribadi.',
      reflection: 'Apakah jawabanmu punya contoh spesifik, atau masih terlalu umum?',
      cta: 'Ketik /speak atau /study → Speaking → Express Opinion.',
      scene: 'A student recording a short English speaking answer on a phone with a simple OREO framework card on the desk',
      sceneVocab: ['opinion', 'reason', 'example', 'recording', 'speaking'],
      focusCallback: 'cat_speaking',
    },
  ],
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
    `${firstName}, stop scroll 20 detik. Ini bisa langsung kepakai di latihanmu hari ini:\n\n` +
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
