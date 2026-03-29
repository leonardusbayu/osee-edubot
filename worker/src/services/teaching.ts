/**
 * OSEE Teaching Engine v2 — Research-Based, Indonesian-Specific
 *
 * Methods:
 * 1. Subconscious Learning (Implicit Pattern Absorption)
 * 2. Significant Repetition Drilling (Spaced + Massed)
 * 3. Templates & Frameworks (Speaking/Writing scaffolds)
 * 4. Metacognition (Think-about-thinking prompts)
 * 5. Psychological Motivation (Loss aversion, progress illusion, commitment devices)
 */

import type { Env, User } from '../types';

// ============================================================
// SPEAKING TEMPLATES — Memorizable frameworks
// ============================================================
export const SPEAKING_TEMPLATES = {
  listen_and_repeat: {
    tips: [
      'Fokus ke RHYTHM, bukan kata per kata. Bahasa Inggris punya beat: da-DA-da-DA',
      'Perhatikan LINKING: "got it" diucapkan "go-dit", bukan "got... it"',
      'Perhatikan STRESS: kata penting diucapkan lebih keras & lambat',
      'Tirukan INTONASI: suara naik di pertanyaan, turun di pernyataan',
    ],
  },
  interview: {
    template_opinion: `Template "OREO" untuk jawab pertanyaan opini:
🔴 O — Opinion: "I believe that..." / "In my opinion..."
🟡 R — Reason: "The main reason is..."
🟢 E — Example: "For instance, in my experience..."
🔴 O — Opinion (ulang): "So that's why I think..."

Contoh:
"Do you prefer studying alone or in groups?"

"I believe that studying in groups is more effective. The main reason is that you can learn from other people's perspectives. For instance, in my experience, when I studied with my classmates for the math exam, they explained concepts I didn't understand, and my score improved significantly. So that's why I think group study works better for me."`,

    template_describe: `Template "STAR" untuk deskripsikan pengalaman:
⭐ S — Situation: "Last year, I was..."
⭐ T — Task: "I needed to..."
⭐ A — Action: "So I decided to..."
⭐ R — Result: "As a result..."

Contoh:
"Describe a challenge you overcame."

"Last year, I was struggling with my English speaking skills. I needed to pass the TOEFL speaking section with at least a band 4. So I decided to practice speaking English for 15 minutes every day by recording myself and listening back. As a result, my pronunciation improved dramatically, and I felt much more confident in conversations."`,

    template_compare: `Template "PMI" untuk pertanyaan perbandingan:
➕ P — Plus (kelebihan opsi 1): "On one hand, ... has the advantage of..."
➖ M — Minus (kekurangan opsi 1): "However, the downside is..."
💡 I — Interesting/Conclusion: "Considering everything, I'd prefer... because..."

Contoh:
"Do you prefer online or in-person classes?"

"On one hand, online classes have the advantage of flexibility — you can study from anywhere and replay lectures. However, the downside is that it's harder to stay focused and you miss the social interaction. Considering everything, I'd prefer in-person classes because the direct interaction with teachers helps me understand difficult concepts better."`,
  },
};

// ============================================================
// WRITING TEMPLATES — Structural frameworks
// ============================================================
export const WRITING_TEMPLATES = {
  email: {
    formal: `Template Email Formal:

Subject: [Topik Spesifik]

Dear [Name/Title],

[Paragraph 1 — Tujuan email]
I am writing to [inform/request/complain about]...

[Paragraph 2 — Detail/Penjelasan]
Specifically, [detail masalah/permintaan]...

[Paragraph 3 — Action yang diminta]
I would appreciate it if you could [action]...

Thank you for your time and consideration.

Sincerely,
[Your Name]`,

    informal: `Template Email Informal:

Hi [Name],

[Paragraph 1 — Pembuka + tujuan]
I hope you're doing well. I'm writing because...

[Paragraph 2 — Detail]
Here's what happened: ...

[Paragraph 3 — Penutup + next step]
Let me know if... / I was wondering if you could...

Thanks!
[Your Name]`,
  },

  academic_discussion: `Template Academic Discussion (TOEFL iBT):

[Kalimat 1 — Posisi kamu]
I agree/disagree with [Student name]'s point that...

[Kalimat 2-3 — Alasan + bukti]
The reason I believe this is... For example, [specific evidence]...

[Kalimat 4 — Counter atau tambahan]
While [opposite view] has some merit, I think [your argument] is stronger because...

[Kalimat 5 — Kesimpulan]
In conclusion, [restate your position with slightly different wording].

⚠️ Tips penting:
- Minimum 100 kata
- HARUS menyebut nama student yang kamu setujui/tidak setujui
- Pakai "academic" vocabulary: furthermore, consequently, nevertheless
- Jangan copy paste dari prompt — pakai kata-kata sendiri`,
};

// ============================================================
// SUBCONSCIOUS LEARNING — Pattern exposure drills
// ============================================================
export const SUBCONSCIOUS_PATTERNS = {
  articles: [
    // Correct patterns for subconscious absorption (read 10x, brain remembers the pattern)
    'I bought A book at THE bookstore.',
    'She is AN honest person.',
    'THE sun rises in THE east.',
    'I need A glass of water.',
    'He is THE best student in THE class.',
    'I saw A dog. THE dog was brown.',
    'She plays THE piano every day.',
    'I want to be AN engineer.',
    'THE United States is A large country.',
    'I ate AN apple for breakfast.',
  ],
  sv_agreement: [
    'She GOES to school every day.',
    'They GO to school every day.',
    'He DOESN\'T like coffee.',
    'Everyone IS happy today.',
    'The students HAVE finished their homework.',
    'Neither of them WANTS to go.',
    'The news IS shocking.',
    'My family ARE all healthy. (British) / My family IS healthy. (American)',
    'Each student HAS a textbook.',
    'The number of students HAS increased.',
  ],
  tenses: [
    'Yesterday, I WENT to the market. (Past Simple)',
    'I HAVE LIVED here since 2020. (Present Perfect — masih berlangsung)',
    'I WAS STUDYING when she called. (Past Continuous — interrupted)',
    'By next year, I WILL HAVE GRADUATED. (Future Perfect)',
    'She HAS ALREADY EATEN lunch. (Present Perfect — completed)',
    'I USED TO play football. (Past habit — sudah tidak lagi)',
    'If I HAD STUDIED harder, I WOULD HAVE PASSED. (Third Conditional)',
    'I AM GOING TO visit Japan next month. (Future plan)',
    'She HAS BEEN WORKING here for 5 years. (Present Perfect Continuous)',
    'They WERE TALKING when the teacher entered. (Past Continuous)',
  ],
};

// ============================================================
// METACOGNITION PROMPTS — Self-reflection triggers
// ============================================================
export const METACOGNITION = {
  before_answer: [
    'Sebelum jawab, tanya dirimu: "Apa yang ditanya sebenarnya?"',
    'Coba eliminasi 2 jawaban yang PASTI salah dulu.',
    'Baca pertanyaan DULU sebelum baca passage — biar tahu apa yang dicari.',
    'Untuk soal "main idea", jawaban yang terlalu spesifik biasanya salah.',
  ],
  after_wrong: [
    'Kenapa kamu pilih jawaban itu? Apa yang membuat kamu terkecoh?',
    'Coba baca lagi penjelasannya. Apa aturan yang kamu belum paham?',
    'Apakah ini kesalahan yang sama dengan sebelumnya? Kalau iya, tandai untuk drill.',
    'Jangan frustrasi — setiap kesalahan = otak kamu sedang belajar pola baru.',
  ],
  after_correct: [
    'Bagus! Tapi tanya dirimu: "Apakah aku yakin, atau tebakan lucky?"',
    'Coba jelaskan KE DIRIMU SENDIRI kenapa jawaban ini benar.',
    'Kalau kamu bisa jelaskan ke orang lain, berarti kamu benar-benar paham.',
  ],
};

// ============================================================
// PSYCHOLOGICAL MOTIVATION TRICKS
// ============================================================
export const MOTIVATION = {
  loss_aversion: [
    'Setiap hari tanpa latihan = kamu lupa 20% dari yang sudah dipelajari (Ebbinghaus Forgetting Curve)',
    'Siswa yang latihan 15 menit/hari naik 1 band dalam 2 bulan. Yang skip sehari, butuh 3 bulan.',
    'Kamu sudah jawab {correct} soal benar. Kalau berhenti sekarang, progress itu terbuang.',
  ],
  progress_illusion: [
    'Kamu sudah menyelesaikan {percentage}% dari target mingguan kamu!',
    'Hanya {remaining} soal lagi untuk menyelesaikan sesi hari ini.',
    'Streak kamu: {streak} hari. Jangan putus!',
  ],
  commitment_device: [
    'Mau set target harian? Ketik "target 10 soal" dan aku akan ingatkan kamu.',
    'Challenge: jawab 5 soal benar berturut-turut. Bisa?',
    'Mini goal: selesaikan 1 set drill Reading sebelum istirahat.',
  ],
  social_proof: [
    'Siswa OSEE rata-rata latihan 20 soal/hari. Kamu sudah {count} hari ini.',
    'Siswa yang konsisten 30 hari biasanya naik 1-2 band score.',
    '85% siswa yang pakai template OREO di Speaking dapat Band 4+.',
  ],
  micro_wins: [
    '🎯 Streak 3 benar! Otakmu mulai mengenali polanya.',
    '💪 Kamu baru saja menguasai konsep yang susah. Itu bukan keberuntungan!',
    '🔥 Akurasi kamu di section ini naik dari minggu lalu!',
  ],
};

// ============================================================
// LESSON GENERATOR — Uses all methods above
// ============================================================
export async function generateLesson(env: Env, user: User, topic: string): Promise<string> {
  const prompt = buildLessonPrompt(user, topic);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        temperature: 0.7,
        messages: [
          { role: 'system', content: TEACHING_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || 'Gagal membuat pelajaran.';
  } catch {
    return 'Maaf, ada masalah. Coba lagi.';
  }
}

export async function generateDrill(env: Env, user: User, section: string, drillType: string): Promise<string> {
  const prompt = buildDrillPrompt(user, section, drillType);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          { role: 'system', content: TEACHING_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || 'Gagal membuat drill.';
  } catch {
    return 'Maaf, ada masalah. Coba lagi.';
  }
}

// ============================================================
// SYSTEM PROMPT — The core teaching personality
// ============================================================
const TEACHING_SYSTEM_PROMPT = `PERAN: Tutor TOEFL iBT, OSEE. DIRI: "Aku". SISWA: "kamu".

ATURAN FORMAT — WAJIB:
1. MAKS 10 BARIS per pesan
2. JANGAN pakai heading (#), bold (**), italic (*), atau markdown. Plain text saja.
3. JANGAN buka dengan "Oke, [nama]! Mari kita..." — langsung ke inti
4. KASIH 1 SOAL per pesan. Tunggu jawaban.
5. Tulis kayak chat WhatsApp, bukan textbook
6. Pakai "Aku" bukan "Gue/Saya"

Bandingkan Bahasa Indonesia vs English di setiap penjelasan.
Contoh + 1 soal. Tunggu jawaban. Feedback + soal berikutnya.`;

function buildLessonPrompt(user: User, topic: string): string {
  const level = user.proficiency_level || 'beginner';

  const topicContent: Record<string, string> = {
    articles: `TOPIK: Articles. Buat pesan pembuka singkat (maks 8 baris):
1. Bandingkan Bahasa vs English (1-2 baris)
2. Kasih 4 contoh kalimat benar (subconscious)
3. Tanya "Lihat polanya?"
4. Kasih 1 SOAL fill-in-blank
5. Akhiri dengan "Jawab?" — tunggu siswa jawab`,

    tenses: `TOPIK: Tenses. Buat pesan pembuka singkat (maks 8 baris):
1. Bahasa: sudah/sedang/akan — verb tetap. English: verb BERUBAH (1-2 baris)
2. Kasih 4 contoh: yesterday I WENT, now I AM GOING, tomorrow I WILL GO
3. Tanya "Lihat polanya?"
4. Kasih 1 SOAL: "Yesterday she ___ (eat) rice."
5. Akhiri dengan "Jawab?"`,

    prepositions: `TOPIK: Prepositions. Buat pesan pembuka singkat (maks 8 baris):
1. Bahasa: "di" buat semua. English punya 3: at/on/in (1-2 baris)
2. Kasih 4 contoh: at 3 PM, on Monday, in January, at the door, on the table, in the room
3. Tanya "Lihat polanya?"
4. Kasih 1 SOAL: "The meeting is ___ Monday ___ 3 PM."
5. Akhiri dengan "Jawab?"`,

    sv_agreement: `TOPIK: Subject-Verb Agreement. Buat pesan pembuka singkat (maks 8 baris):
1. Bahasa: "Dia pergi" "Mereka pergi" — sama. English: She GOES vs They GO (1-2 baris)
2. Kasih 4 contoh: She goes, They go, He plays, We play
3. Tanya "Lihat polanya?"
4. Kasih 1 SOAL: "Everyone (is/are) happy."
5. Akhiri dengan "Jawab?"`,

    speaking_templates: `TOPIK: Speaking Templates. Kasih 1 template saja (yang paling berguna), yaitu OREO:

O — "I believe that..."
R — "The main reason is..."
E — "For instance..."
O — "So that's why I think..."

Kasih 1 contoh lengkap (max 5 baris contoh jawabannya).
Lalu kasih 1 pertanyaan dan minta siswa jawab pakai template OREO.
Total pesan maks 12 baris.`,

    writing_templates: `TOPIK: Writing Templates. Kasih 1 template email saja:
P1: "I am writing to [tujuan]..."
P2: Detail (2-3 kalimat)
P3: "I would appreciate it if you could [request]..."
Kasih 1 contoh email pendek (max 5 baris). Lalu kasih 1 prompt dan minta siswa tulis. Maks 12 baris.`,

    // --- NEW GRAMMAR TOPICS ---
    passive_voice: `TOPIK: Passive Voice. Pembuka singkat maks 8 baris:
Bahasa: "di-" prefix → "dibaca", "dimakan". English: be + V3 → "is read", "was eaten"
Kasih 3 contoh: Active → Passive
"She reads the book" → "The book is read by her"
Lalu 1 soal: "They built this house in 1990." → ubah ke passive. Jawab?`,

    conditionals: `TOPIK: Conditionals (If). Pembuka singkat maks 8 baris:
Bahasa: "Kalau hujan, aku nggak pergi." — simple.
English punya 3 tipe If:
Type 1: If it rains, I will stay. (kemungkinan nyata)
Type 2: If it rained, I would stay. (imajinasi)
Type 3: If it had rained, I would have stayed. (menyesal)
Soal: "If I ___ (have) money, I would buy a car." Jawab?`,

    relative_clauses: `TOPIK: Relative Clauses. Pembuka singkat maks 8 baris:
Bahasa: "yang" buat semua → "orang yang...", "buku yang..."
English: who (orang), which (benda), that (dua-duanya)
Contoh: The man WHO called you is my brother.
The book WHICH I bought is interesting.
Soal: "The girl ___ (who/which) sits next to me is smart." Jawab?`,

    word_formation: `TOPIK: Word Formation (prefix/suffix). Maks 8 baris:
Ini penting buat section "Complete the Words" di TOEFL iBT.
happy → unhappy (un- = kebalikan)
teach → teacher (-er = orang yang)
care → careful (-ful = penuh dengan)
care → careless (-less = tanpa)
Soal: "She is very (help)___. She always helps others." Jawab?`,

    // --- VOCABULARY TOPICS ---
    word_of_day: `TOPIK: Kata Hari Ini. Pilih 1 academic word yang sering muncul di TOEFL.
Format: kata + arti + 2 contoh kalimat + 1 soal (isi kata itu di kalimat baru).
Maks 8 baris. Pilih kata yang jarang diketahui siswa Indonesia level beginner.`,

    academic_words: `TOPIK: Academic Word List. Kasih 3 kata akademik yang sering di TOEFL:
Setiap kata: arti singkat + 1 contoh kalimat.
Lalu 1 soal: kalimat dengan blank, siswa pilih kata mana yang cocok.
Maks 10 baris. Plain text.`,

    collocations: `TOPIK: Collocations (pasangan kata yang natural). Maks 8 baris:
Orang Indonesia sering salah:
"make a decision" BUKAN "do a decision"
"heavy rain" BUKAN "strong rain"
"take a photo" BUKAN "make a photo"
Soal: "Can you ___ (make/do) me a favor?" Jawab?`,

    paraphrasing: `TOPIK: Paraphrasing (menulis ulang kalimat). Maks 8 baris:
Ini skill KRITIS untuk Writing section TOEFL iBT.
Contoh: "Many students find math difficult."
→ "A large number of learners struggle with mathematics."
Kasih 1 kalimat dan minta siswa paraphrase. Tunggu jawaban.`,

    // --- STRATEGY TOPICS ---
    reading_strategy: `TOPIK: Reading Strategy untuk TOEFL iBT. Maks 8 baris:
Kasih 1 tips spesifik (bukan generic). Contoh:
"Baca PERTANYAAN dulu sebelum baca passage. Underline keyword di pertanyaan. Lalu scan passage cari keyword itu."
Atau: "Untuk soal Main Idea, jawaban yang terlalu spesifik = SALAH."
Kasih 1 contoh mini passage + 1 soal untuk praktek strategi ini.`,

    listening_strategy: `TOPIK: Listening Strategy untuk TOEFL iBT. Maks 8 baris:
Kasih 1 tips spesifik. Contoh:
"Dengarkan kata TRANSISI: however, but, actually, in fact — biasanya jawaban ada setelah kata-kata ini."
Atau: "Kalau speaker bilang 'The important thing is...' atau 'What I mean is...' — CATAT itu, biasanya jadi jawaban."
Kasih 1 contoh situasi pendek untuk praktek.`,

    // --- SPEAKING & WRITING EXPAND ---
    pronunciation: `TOPIK: Pronunciation untuk orang Indonesia. Maks 10 baris:
Suara yang PALING susah buat orang Indo:
1. TH: "think" bukan "tink", "this" bukan "dis" — lidah di antara gigi
2. V vs F: "very" bukan "fery" — gigit bibir bawah untuk V
3. -ED endings: "walked" = /wɔːkt/, "needed" = /niːdɪd/, "played" = /pleɪd/
Kasih 3 kata untuk latihan ucapkan. Minta siswa coba.`,

    linking_words: `TOPIK: Linking Words untuk Writing. Maks 8 baris:
Kata-kata INI yang bikin writing kamu terdengar akademik:
Tambahan: Furthermore, Moreover, In addition
Kontras: However, Nevertheless, On the other hand
Sebab-akibat: Therefore, Consequently, As a result
Soal: "She studied hard. ___, she passed the exam." (Therefore/However) Jawab?`,
  };

  const content = topicContent[topic] || `TOPIK: ${topic}. Bandingkan Bahasa vs English (2 baris), kasih 3 contoh, lalu 1 soal. Maks 8 baris.`;

  return `${content}

INGAT: Maks 8 baris. Plain text. Tanpa heading/bold/markdown. 1 soal saja. Langsung ke inti, jangan basa-basi.`;
}

function buildDrillPrompt(user: User, section: string, drillType: string): string {
  return `Buat 1 soal ${section} (${drillType}) untuk level ${user.proficiency_level || 'beginner'}.

Plain text. Maks 6 baris. Langsung soalnya, jangan basa-basi. Akhiri dengan "Jawab?"`;
}
