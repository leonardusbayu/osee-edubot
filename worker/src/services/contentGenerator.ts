import type { Env } from '../types';

interface VocabularyItem {
  word: string;
  partOfSpeech: string;
  indonesian: string;
  example: string;
  exampleTranslation: string;
}

interface QuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  section: string;
}

interface GrammarTip {
  title: string;
  rule: string;
  examples: { en: string; id: string }[];
  toeflNote: string;
}

interface IdiomItem {
  idiom: string;
  meaning: string;
  example: string;
  exampleTranslation: string;
}

export async function generateVocabularyOfTheDay(env: Env): Promise<{ text: string; imagePrompt?: string }> {
  const vocabs: VocabularyItem[] = [
    { word: 'Ubiquitous', partOfSpeech: 'adj', indonesian: 'ada di mana-mana', example: 'Smartphones have become ubiquitous in modern society.', exampleTranslation: 'HP udah ada di mana-mana di masyarakat modern.' },
    { word: 'Paradigm', partOfSpeech: 'noun', indonesian: 'cara pandang/pola', example: 'This represents a new paradigm in education.', exampleTranslation: 'Ini nunjukin cara pandang baru soal pendidikan.' },
    { word: 'Pragmatic', partOfSpeech: 'adj', indonesian: 'realistis/praktis', example: 'We need a pragmatic approach to solve this.', exampleTranslation: 'Kita butuh cara yang realistis, bukan yang muluk-muluk.' },
    { word: 'Ephemeral', partOfSpeech: 'adj', indonesian: 'sementara/fana', example: 'Social media fame is often ephemeral.', exampleTranslation: 'Ketenaran di sosmed tuh cuma sebentar, bro.' },
    { word: 'Mitigate', partOfSpeech: 'verb', indonesian: 'meringankan/mengurangi', example: 'Trees help mitigate climate change effects.', exampleTranslation: 'Pohon-pohon bantu减轻 efek perubahan iklim.' },
    { word: 'Exacerbate', partOfSpeech: 'verb', indonesian: 'memperburuk', example: 'The drought exacerbated the food shortage.', exampleTranslation: 'Kekeringan bikin shortage makanan makin parah.' },
    { word: 'Pristine', partOfSpeech: 'adj', indonesian: 'masih asli/belum tersentuh', example: 'They explored the pristine rainforest.', exampleTranslation: 'Mereka jelajahi hutan hujan yang masih sangat asli.' },
    { word: 'Ambiguous', partOfSpeech: 'adj', indonesian: 'ambigu/taksa', example: 'The contract language was deliberately ambiguous.', exampleTranslation: 'Bahasa kontraknya emang sengaja bikin ambigu.' },
    { word: 'Substantiate', partOfSpeech: 'verb', indonesian: 'membuktikan/merupakan bukti', example: 'You need evidence to substantiate your claim.', exampleTranslation: 'Lo butuh bukti buat support klaim lo.' },
    { word: 'Prevalent', partOfSpeech: 'adj', indonesian: 'umum/merajalela', example: 'This disease is prevalent in tropical regions.', exampleTranslation: 'Penyakit ini umum banget di daerah tropis.' },
  ];

  const shuffled = vocabs.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 5);

  let text = `📝 VOCAB HARIAN | TOEFL/IELTS Prep\n\n`;
  text += `Kata-kata yang harus lo hapal hari ini:\n\n`;

  selected.forEach((v, i) => {
    text += `${i + 1}️⃣ *${v.word}* (${v.partOfSpeech})\n`;
    text += `   = ${v.indonesian}\n`;
    text += `   📝 "${v.example}"\n`;
    text += `      → ${v.exampleTranslation}\n\n`;
  });

  text += `💬 Coba bikin kalimat pake kata-kata ini!\n`;
  text += `Share di kolom komentar ↓\n\n`;
  text += `👉 Mau latihan lebih? Klik di bawah ↓\n`;
  text += `https://t.me/osee_IBT_IELTS_tutor_bot?start=vocab_daily\n\n`;
  text += `#toeflvocab #ieltsvocab #belajaringgris #vocab_harian`;

  return { text };
}

export async function generateDailyQuiz(env: Env): Promise<QuizItem> {
  const quizzes: QuizItem[] = [
    {
      question: '"Despite ___ busy schedule, she still found time to study."',
      options: ['A) her', 'B) hers', 'C) herself', 'D) she\'s'],
      correctIndex: 0,
      explanation: '"Despite" itu preposition, jadi harus diikuti noun/pronoun. "Her busy schedule" = noun phrase yang benar. "Despite her busy schedule" = meskipun jadwalnya padat.',
      section: 'Grammar'
    },
    {
      question: '"The professor ___ teaches chemistry is very strict."',
      options: ['A) who', 'B) which', 'C) that', 'D) whose'],
      correctIndex: 0,
      explanation: '"Who" dipake buat people, "which" buat things. Disini "professor" = orang, jadi pakai "who". Kalimat ini restrictive clause, jadi bisa pakai that atau who.',
      section: 'Grammar'
    },
    {
      question: '"Neither the students nor the teacher ___ present."',
      options: ['A) were', 'B) was', 'C) are', 'D) have been'],
      correctIndex: 0,
      explanation: 'Rule: "neither...nor" itu FOLLOWED BY verb. Disini "teacher" (singular) ada di depan nor, jadi verbnya singular "was".Contoh: "Neither he nor I am wrong" (IOR rule).',
      section: 'Grammar'
    },
    {
      question: 'Choose the correct word: "The company needs to ___ its environmental impact."',
      options: ['A) minimize', 'B) miniature', 'C) minimal', 'D) minimally'],
      correctIndex: 0,
      explanation: '"Minimize" = verb (mengurangi). "Minimal" = adjective (minimal). "Minimally" = adverb. Disini butuh verb buat ngelakuin sesuatu terhadap "impact", jadi pakai "minimize".',
      section: 'Vocabulary'
    },
    {
      question: '"Her presentation was met with ___ applause from the audience."',
      options: ['A) tumultuous', 'B) tumultuous', 'C) tumult', 'D) tumultuously'],
      correctIndex: 0,
      explanation: '"Met with" diikuti noun. "Tumultuous applause" = tepuk tangan yang ribut, heboh, heboh banget. "Tumultuous" = adjective yang bener. "Tumultuously" = adverb.',
      section: 'Vocabulary'
    },
    {
      question: '"If I ___ more money, I would buy a house."',
      options: ['A) had', 'B) have', 'C) would have', 'D) had had'],
      correctIndex: 0,
      explanation: 'Ini Second Conditional: If + Past Simple + would/could/might + base verb. Soalnya tentang hypothetical/imaginary situation. "If I had more money" = kalau saja aku punya lebih banyak uang.',
      section: 'Grammar'
    },
    {
      question: 'Word in capitals has the same meaning: "The researcher\'s FINDINGS were groundbreaking."',
      options: ['A) discoveries', 'B) process', 'C) questions', 'D) methods'],
      correctIndex: 0,
      explanation: '"Findings" = discoveries = penemuan-penemuan, hasil penelitian. Dalam konteks research, findings nunjukin apa yang researcher dapetin dari studinya.',
      section: 'Vocabulary'
    },
    {
      question: '"___ the rain, we decided to go outside."',
      options: ['A) Despite', 'B) Although', 'C) Even though', 'D) Though'],
      correctIndex: 0,
      explanation: '"Despite" dan "although" bisa互换. Tapi struktur grammarnya beda: Despite + noun/gerund | Although + clause. Disini "the rain" = noun, jadi pakai "Despite". "Although" butuh clause: "Although it was raining..."',
      section: 'Grammar'
    },
  ];

  const shuffled = quizzes.sort(() => Math.random() - 0.5);
  return shuffled[0];
}

export function formatQuizPost(quiz: QuizItem, replyLink: string): string {
  let text = `🧠 QUIZ HARIAN | TOEFL/IELTS\n\n`;
  text += `Jangan scroll dulu, jawab dulu!\n\n`;
  text += `${quiz.section}:\n`;
  text += `"${quiz.question}"\n\n`;
  quiz.options.forEach(opt => {
    text += `${opt}\n`;
  });
  text += `\n💬 Jawab di kolom komentar!\n`;
  text += `Serius deh, ini tipe soal yang sering muncul di TOEFL/IELTS.\n\n`;
  text += `🤫 Inget jawabannya?\n`;
  text += `Klik ↓↓↓\n`;
  text += `${replyLink}\n`;
  text += `📖 Disitu ada jawaban + penjelasan lengkap + latihan更多!\n\n`;
  text += `#toeflquiz #ieltsquiz #grammar #toefl #ielts #belajaringgris`;

  return text;
}

export async function generateGrammarTip(env: Env): Promise<string> {
  const tips: GrammarTip[] = [
    {
      title: '⚡ "Which" vs "That"',
      rule: 'Which = non-restrictive (tambahan info) | That = restrictive (penentu)',
      examples: [
        { en: 'My phone, which is new, is broken.', id: 'HP-ku, yang baru, udah rusak.' },
        { en: 'The phone that I bought is expensive.', id: 'HP yang aku beli itu mahal.' },
      ],
      toeflNote: 'TOEFL suka test ini! Perhatiin kalo kalimatnya bisa diremove sebagian tanpa mengubah arti → pakai which. Kalo remove-nya mengubah arti → that.'
    },
    {
      title: '⚡ "Neither...nor" Subject-Verb Agreement',
      rule: 'Verb agrees with noun closest to it (proximity rule)',
      examples: [
        { en: 'Neither the students nor the teacher is attending.', id: 'Nebengers student n guru, yang dateng guru.' },
        { en: 'Neither the teacher nor the students are attending.', id: 'Nebengers guru n student, yang dateng student.' },
      ],
      toeflNote: 'Remember: yang dipake buat determine verb itu noun yang PALING DEKAT dengan verb, bukan yangLEBIH BANYAK.'
    },
    {
      title: '⚡ Passive Voice Patterns',
      rule: 'Subject + Be + Past Participle (+ by agent)',
      examples: [
        { en: 'The exam was taken by all students.', id: 'Examnya dit稻草 oleh semua student.' },
        { en: 'The research was conducted over two years.', id: 'Researchnya conducted selama dua tahun.' },
      ],
      toeflNote: 'TOEFL Reading suka passive. Look for: "is/are/was/were/been + V3" pattern.'
    },
    {
      title: '⚡ "Despite/In spite of" vs "Although/Though"',
      rule: 'Despite + Noun/Gerund | Although + Subject + Verb',
      examples: [
        { en: 'Despite the rain, we went out.', id: 'Meskipun hujan, kita tetep keluar.' },
        { en: 'Although it rained, we went out.', id: 'Meskipun hujan turun, kita keluar.' },
      ],
      toeflNote: 'Despite dan Although互换! Tapi struktur grammarnya beda. Jangan samakan!'
    },
    {
      title: '⚡ Relative Clauses: Who/Whom/Whose',
      rule: 'Who = subject | Whom = object | Whose = possessive',
      examples: [
        { en: 'The student who scored highest will be honored.', id: 'Student yang Dapat tertinggi akan dihormati. (who = subject of "scored")' },
        { en: 'The student whom we selected passed.', id: 'Student yang kita pilih lulus. (whom = object of "selected")' },
      ],
      toeflNote: '"Whom" increasingly rare in modern English. TOEFL still tests it. Trick: Replace whom with him/her. If sentence still works → whom is correct.'
    },
  ];

  const shuffled = tips.sort(() => Math.random() - 0.5);
  const tip = shuffled[0];

  let text = `📚 GRAMMAR SNAP | Singkat, langsung paham\n\n`;
  text += `${tip.title}\n\n`;
  text += `📖 Rule:\n${tip.rule}\n\n`;
  text += `💡 Contoh:\n`;
  tip.examples.forEach(ex => {
    text += `• ${ex.en}\n  → ${ex.id}\n`;
  });
  text += `\n🎯 TOEFL Note:\n${tip.toeflNote}\n\n`;
  text += `👉 Lebih banyak latihan? ↓\n`;
  text += `https://t.me/osee_IBT_IELTS_tutor_bot?start=grammar_tip\n\n`;
  text += `#toeflgrammar #ielts #belajaringgris #grammar_tips`;

  return text;
}

export async function generateIdiom(env: Env): Promise<string> {
  const idioms: IdiomItem[] = [
    { idiom: 'Piece of cake', meaning: 'Super easy, gampang banget', example: 'The exam was a piece of cake!', exampleTranslation: 'Examnya gampang banget, anak TK juga bisa.' },
    { idiom: 'Break the ice', meaning: 'Mulai打破僵局, buat suasana jadi nyaman', example: 'His joke helped break the ice at the meeting.', exampleTranslation: 'Jokesnya bantu bikin suasana meeting jadi nyaman.' },
    { idiom: 'Hit the nail on the head', meaning: 'Tepat sekali, bener banget', example: 'You hit the nail on the head with that analysis.', exampleTranslation: 'Analisis lo bener banget, tepat sasaran.' },
    { idiom: 'Bite the bullet', meaning: 'Berani menghadapi sesuatu yang sakit/gak enak', example: 'She had to bite the bullet and tell the truth.', exampleTranslation: 'Dia harus berkorban dan ngomong truth.' },
    { idiom: 'Cost an arm and a leg', meaning: 'Mahal banget, harga selangit', example: 'That designer bag costs an arm and a leg.', exampleTranslation: 'Tas designer itu mahal banget, bisa-bisa mahal satu badan.' },
    { idiom: 'Under the weather', meaning: 'Sedikit sick/unwell, gak enak badan', example: 'I\'m feeling under the weather today.', exampleTranslation: 'Aku lagi gak enak badan nih hari ini.' },
    { idiom: 'Once in a blue moon', meaning: 'Jarang banget, sesekali', example: 'He only visits his hometown once in a blue moon.', exampleTranslation: 'Dia cuma pulang kampung sesekali, jarang banget.' },
    { idiom: 'Spill the beans', meaning: 'Bocorin secrets, spill the tea', example: 'Don\'t spill the beans about the surprise party!', exampleTranslation: 'Jangan bocorin party surprisesnya!' },
    { idiom: 'Hit the books', meaning: ' Belajar keras, nyamber buku', example: 'I need to hit the books for the TOEFL exam.', exampleTranslation: 'Aku harus belajar keras buat TOEFL.' },
    { idiom: 'Kill two birds with one stone', meaning: 'Satu langkah untuk dua tujuan', example: 'Walking to work kills two birds with one stone.', exampleTranslation: 'Jalan kaki ke kantor = sekalian olahraga + ngirit bensin.' },
  ];

  const shuffled = idioms.sort(() => Math.random() - 0.5);
  const idiom = shuffled[0];

  let text = `💬 idiom HARIAN | TOEFL/IELTS Prep\n\n`;
  text += `*${idiom.idiom}*\n\n`;
  text += `📝 Arti: ${idiom.meaning}\n\n`;
  text += `📖 Contoh:\n"${idiom.example}"\n`;
  text += `→ ${idiom.exampleTranslation}\n\n`;
  text += `💡 Coba pake di conversation lo!\n`;
  text += `Share contoh kalimat lo di komentar ↓\n\n`;
  text += `👉 Latihan lebih banyak di ↓\n`;
  text += `https://t.me/osee_IBT_IELTS_tutor_bot?start=idiom_daily\n\n`;
  text += `#toeflidiom #ielts #belajaringgris #idiom_harian`;

  return text;
}

export async function generateStudentSpotlight(env: Env): Promise<string | null> {
  const recentResults = await env.DB.prepare(
    `SELECT u.name, tr.total_score, tr.band_score, tr.created_at
     FROM test_results tr
     JOIN test_attempts ta ON tr.attempt_id = ta.id
     JOIN users u ON ta.user_id = u.id
     WHERE tr.band_score IS NOT NULL
     ORDER BY tr.created_at DESC
     LIMIT 10`
  ).all() as any;

  if (!recentResults.results || recentResults.results.length === 0) {
    return null;
  }

  const shuffled = recentResults.results.sort(() => Math.random() - 0.5);
  const student = shuffled[0];

  const improvement = Math.round((student.band_score || 0) * 10) / 10;

  let text = `🏆 STUDENT SPOTLIGHT\n\n`;
  text += `🎉 ${student.name} baru aja dapet skor:\n\n`;
  text += `📊 Band Score: ${student.band_score}\n`;
  text += `📝 Total Score: ${student.total_score}\n\n`;
  text += `💪 Semangat! Lo juga bisa kayak gitu!\n\n`;
  text += `👉 Coba diagnostic test gratis di ↓\n`;
  text += `https://t.me/osee_IBT_IELTS_tutor_bot?start=spotlight\n\n`;
  text += `#studentspotlight #toefl #ielts #belajaringgris #inspiration`;

  return text;
}

export function generatePromoCTA(): string {
  const ctas = [
    `🎯 MCobain TOEFL/IELTS prep yang beda!\n\nBebas latihan 24/7, gak harus datang ke tempat kursus.-flexible kan?\n\n👉 https://t.me/osee_IBT_IELTS_tutor_bot?start=promo`,
    `📚 Mau belajar TOEFL tapi gak punya waktu buat ke kursus?\n\nBot ini bisa bantu lo latihan di mana aja, kapan aja. Efektif dan fleksibel!\n\n👉 https://t.me/osee_IBT_IELTS_tutor_bot?start=promo`,
    `💡 TOEFL deadline approaching?\n\nGak usah panik! Mulai persiapan dari sekarang. Trial gratis dulu, gak risque!\n\n👉 https://t.me/osee_IBT_IELTS_tutor_bot?start=promo`,
    `🎓 Inget, skor TOEFL/IELTS yang bagus = kesempatan lebih besar untuk sekolah atau kerja impian lo.\n\nMulai sekarang, gak ada yang terlambat!\n\n👉 https://t.me/osee_IBT_IELTS_tutor_bot?start=promo`,
  ];

  const randomIndex = Math.floor(Math.random() * ctas.length);
  return ctas[randomIndex];
}

export async function postToChannel(env: Env, text: string): Promise<boolean> {
  const channelId = env.TELEGRAM_BOT_TOKEN.includes('test') 
    ? '@TOEFL_IELTS_Indonesia_Test' 
    : '-1003884450070';

  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json() as any;
    if (!result.ok) {
      console.error('Channel post failed:', result);
    }
    return result.ok === true;
  } catch (e) {
    console.error('Failed to post to channel:', e);
    return false;
  }
}
