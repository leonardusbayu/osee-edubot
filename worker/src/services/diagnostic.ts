import type { Env, User } from '../types';

// 20 diagnostic questions — hardcoded for consistency (same test for all students)
export const DIAGNOSTIC_QUESTIONS = [
  // --- GRAMMAR: Articles (2) ---
  {
    id: 1, section: 'grammar', topic: 'articles',
    question: 'I want to buy ___ umbrella.\n\na) a\nb) an\nc) the\nd) (nothing)',
    answer: 'b',
    explanation: '"Umbrella" starts with a vowel SOUND, so we use "an".',
  },
  {
    id: 2, section: 'grammar', topic: 'articles',
    question: '___ sun rises in ___ east.\n\na) A, an\nb) The, the\nc) A, the\nd) The, an',
    answer: 'b',
    explanation: 'We use "the" for things that are unique (only one sun, one east).',
  },
  // --- GRAMMAR: Tenses (2) ---
  {
    id: 3, section: 'grammar', topic: 'tenses',
    question: 'Yesterday, she ___ to the market.\n\na) go\nb) goes\nc) went\nd) going',
    answer: 'c',
    explanation: '"Yesterday" = past time, so we use past tense "went".',
  },
  {
    id: 4, section: 'grammar', topic: 'tenses',
    question: 'I have ___ here since 2020.\n\na) live\nb) lived\nc) living\nd) lives',
    answer: 'b',
    explanation: '"Since 2020" = Present Perfect. have + past participle (lived).',
  },
  // --- GRAMMAR: S-V Agreement (2) ---
  {
    id: 5, section: 'grammar', topic: 'sv_agreement',
    question: 'Everyone ___ happy today.\n\na) are\nb) is\nc) were\nd) been',
    answer: 'b',
    explanation: '"Everyone" is singular (even though it means many people). Use "is".',
  },
  {
    id: 6, section: 'grammar', topic: 'sv_agreement',
    question: 'The news ___ shocking.\n\na) are\nb) is\nc) were\nd) have been',
    answer: 'b',
    explanation: '"News" is uncountable and always singular. Use "is".',
  },
  // --- GRAMMAR: Prepositions (1) ---
  {
    id: 7, section: 'grammar', topic: 'prepositions',
    question: 'The meeting is ___ Monday ___ 3 PM.\n\na) in, in\nb) on, at\nc) at, on\nd) in, at',
    answer: 'b',
    explanation: 'Days → "on" (on Monday). Clock time → "at" (at 3 PM).',
  },
  // --- GRAMMAR: Passive Voice (1) ---
  {
    id: 8, section: 'grammar', topic: 'passive_voice',
    question: 'This bridge ___ in 1995.\n\na) built\nb) was built\nc) is built\nd) has built',
    answer: 'b',
    explanation: 'Past passive = was/were + past participle. "Was built" because 1995 is past.',
  },
  // --- VOCABULARY (4) — with audio for pronunciation ---
  {
    id: 9, section: 'vocabulary', topic: 'academic_words',
    audio_text: 'determine. The scientist wants to determine whether the drug is safe.',
    question: 'Dengarkan audio, lalu jawab:\n\nThe scientist wants to ___ whether the drug is safe.\n\na) determine\nb) create\nc) ignore\nd) celebrate',
    answer: 'a',
    explanation: '"Determine" = find out / decide. Common academic TOEFL word.',
  },
  {
    id: 10, section: 'vocabulary', topic: 'academic_words',
    audio_text: 'implemented. The government implemented new regulations last year.',
    question: 'Dengarkan audio, lalu jawab:\n\nThe government ___ new regulations last year.\n\na) implemented\nb) decorated\nc) entertained\nd) abandoned',
    answer: 'a',
    explanation: '"Implemented" = put into action. Key word for TOEFL academic passages.',
  },
  {
    id: 11, section: 'vocabulary', topic: 'collocations',
    audio_text: 'make a decision. Can you make a decision quickly?',
    question: 'Dengarkan audio, lalu jawab:\n\nCan you ___ a decision quickly?\n\na) do\nb) make\nc) take\nd) have',
    answer: 'b',
    explanation: '"Make a decision" is the correct collocation. Not "do" or "take".',
  },
  {
    id: 12, section: 'vocabulary', topic: 'collocations',
    audio_text: 'heavy rain. There was heavy rain last night.',
    question: 'Dengarkan audio, lalu jawab:\n\nThere was ___ rain last night.\n\na) strong\nb) big\nc) heavy\nd) hard',
    answer: 'c',
    explanation: '"Heavy rain" is the natural English collocation. Not "strong rain".',
  },
  // --- READING (3) ---
  {
    id: 13, section: 'reading', topic: 'main_idea',
    question: 'Read:\n"Bees play a crucial role in pollinating crops. Without them, many fruits and vegetables would not grow. Scientists are concerned about declining bee populations worldwide."\n\nWhat is the main idea?\n\na) Bees make honey\nb) Bees are important for food production\nc) Scientists study insects\nd) Crops need water',
    answer: 'b',
    explanation: 'The passage talks about bees pollinating crops and the concern about their decline.',
  },
  {
    id: 14, section: 'reading', topic: 'detail',
    question: 'From the same passage about bees: What are scientists concerned about?\n\na) Too many bees\nb) Bees attacking people\nc) Declining bee populations\nd) New types of bees',
    answer: 'c',
    explanation: 'Direct quote: "Scientists are concerned about declining bee populations."',
  },
  {
    id: 15, section: 'reading', topic: 'vocabulary_context',
    question: 'In the passage, "crucial" most likely means:\n\na) small\nb) very important\nc) dangerous\nd) interesting',
    answer: 'b',
    explanation: '"Crucial" = extremely important, essential.',
  },
  // --- LISTENING (3) — with TTS audio ---
  {
    id: 16, section: 'listening', topic: 'conversation',
    audio_text: 'Man: I thought the exam was tomorrow. Woman: No, it was moved up to today.',
    question: 'Dengarkan audio di atas, lalu jawab:\n\nWhat does the woman mean?\n\na) The exam is tomorrow\nb) The exam was cancelled\nc) The exam is today\nd) The exam is next week',
    answer: 'c',
    explanation: '"Moved up" = made earlier. The exam is now today, not tomorrow.',
  },
  {
    id: 17, section: 'listening', topic: 'inference',
    audio_text: 'Woman: Could you turn down the music? I\'m trying to study.',
    question: 'Dengarkan audio di atas, lalu jawab:\n\nWhat is the woman asking?\n\na) To turn off the light\nb) To make the music quieter\nc) To change the song\nd) To stop studying',
    answer: 'b',
    explanation: '"Turn down" = reduce the volume. She wants it quieter.',
  },
  {
    id: 18, section: 'listening', topic: 'purpose',
    audio_text: 'Student: Professor, I was wondering if I could get an extension on the paper?',
    question: 'Dengarkan audio di atas, lalu jawab:\n\nWhat is the student trying to do?\n\na) Submit the paper early\nb) Ask for more time\nc) Cancel the assignment\nd) Change the topic',
    answer: 'b',
    explanation: '"Extension" = more time to complete something.',
  },
  // --- WRITING (1) — free text, AI scored ---
  {
    id: 19, section: 'writing', topic: 'email',
    audio_text: 'Write a short email to your professor. Explain that you will miss class tomorrow because you have a doctor\'s appointment. Ask if you can get the notes from a classmate.',
    question: 'Dengarkan instruksi di atas, lalu tulis email pendek (3-5 kalimat) ke profesor kamu.\n\nTulis dalam bahasa Inggris:',
    answer: '_free_text_',
    explanation: '',
  },
  // --- BONUS: Word Formation ---
  {
    id: 20, section: 'grammar', topic: 'word_formation',
    question: 'She is very ___ (help). She always helps everyone.\n\na) helpless\nb) helpful\nc) helping\nd) helped',
    answer: 'b',
    explanation: '"-ful" suffix means "full of". Helpful = full of help.',
  },
];

export async function startDiagnostic(env: Env, userId: number): Promise<string> {
  // Check if there's an active session
  const existing = await env.DB.prepare(
    "SELECT id FROM diagnostic_sessions WHERE user_id = ? AND status = 'in_progress'"
  ).bind(userId).first();

  if (existing) {
    // Reset it
    await env.DB.prepare(
      "DELETE FROM diagnostic_sessions WHERE id = ?"
    ).bind(existing.id).run();
  }

  // Create new session
  await env.DB.prepare(
    "INSERT INTO diagnostic_sessions (user_id, current_question, answers, status) VALUES (?, 0, '[]', 'in_progress')"
  ).bind(userId).run();

  return `Diagnostic Test TOEFL iBT

Aku akan kasih 20 soal untuk ukur level kamu sekarang.
Hasilnya: peta kelemahan + estimasi Band Score.

Soal 1-8: Grammar
Soal 9-12: Vocabulary
Soal 13-15: Reading
Soal 16-18: Listening
Soal 19: Writing
Soal 20: Word Formation

Siap? Ketik "mulai" untuk start.`;
}

export async function getNextQuestion(env: Env, userId: number): Promise<{ question: string; questionNum: number; total: number; done: boolean; audioText?: string }> {
  const session = await env.DB.prepare(
    "SELECT * FROM diagnostic_sessions WHERE user_id = ? AND status = 'in_progress'"
  ).bind(userId).first() as any;

  if (!session) {
    return { question: 'Belum ada sesi diagnostic. Ketik /diagnostic untuk mulai.', questionNum: 0, total: 20, done: true };
  }

  const qIndex = session.current_question;

  if (qIndex >= DIAGNOSTIC_QUESTIONS.length) {
    return { question: '', questionNum: qIndex, total: DIAGNOSTIC_QUESTIONS.length, done: true };
  }

  const q = DIAGNOSTIC_QUESTIONS[qIndex] as any;
  const questionText = `Soal ${qIndex + 1}/${DIAGNOSTIC_QUESTIONS.length} [${q.section}]\n\n${q.question}`;

  return {
    question: questionText,
    questionNum: qIndex + 1,
    total: DIAGNOSTIC_QUESTIONS.length,
    done: false,
    audioText: q.audio_text || undefined,
  };
}

export async function submitAnswer(env: Env, userId: number, answer: string): Promise<{
  feedback: string;
  nextQuestion: string | null;
  nextAudioText?: string;
  done: boolean;
  results?: any;
}> {
  const session = await env.DB.prepare(
    "SELECT * FROM diagnostic_sessions WHERE user_id = ? AND status = 'in_progress'"
  ).bind(userId).first() as any;

  if (!session) {
    return { feedback: 'Tidak ada sesi diagnostic aktif.', nextQuestion: null, done: true };
  }

  const qIndex = session.current_question;
  const q = DIAGNOSTIC_QUESTIONS[qIndex];
  const answers = JSON.parse(session.answers || '[]');

  // Check answer
  const isWriting = q.answer === '_free_text_';
  const isCorrect = isWriting ? null : answer.trim().toLowerCase() === q.answer.toLowerCase();

  answers.push({
    question_id: q.id,
    section: q.section,
    topic: q.topic,
    answer: answer.trim(),
    correct: isCorrect,
    is_writing: isWriting,
  });

  // Update session
  const nextIndex = qIndex + 1;
  await env.DB.prepare(
    "UPDATE diagnostic_sessions SET current_question = ?, answers = ? WHERE id = ?"
  ).bind(nextIndex, JSON.stringify(answers), session.id).run();

  // Build feedback
  let feedback = '';
  if (isWriting) {
    feedback = 'Writing disimpan. Nanti aku review.';
  } else if (isCorrect) {
    feedback = `Bener! ${q.explanation}`;
  } else {
    feedback = `Belum tepat. Jawaban: ${q.answer.toUpperCase()}\n${q.explanation}`;
  }

  // Check if done
  if (nextIndex >= DIAGNOSTIC_QUESTIONS.length) {
    // Calculate results
    const results = calculateResults(answers);

    // Save to diagnostic_results
    await env.DB.prepare(
      `INSERT INTO diagnostic_results (user_id, grammar_score, grammar_total, vocab_score, vocab_total,
       reading_score, reading_total, listening_score, listening_total, writing_band, weaknesses, estimated_band)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      userId,
      results.grammar.correct, results.grammar.total,
      results.vocab.correct, results.vocab.total,
      results.reading.correct, results.reading.total,
      results.listening.correct, results.listening.total,
      results.writingBand,
      JSON.stringify(results.weaknesses),
      results.estimatedBand,
    ).run();

    // Initialize skill scores from diagnostic
    try {
      const { initSkillsFromDiagnostic } = await import('./prerequisites');
      await initSkillsFromDiagnostic(env, userId, results);
    } catch {}

    // Mark session complete
    await env.DB.prepare(
      "UPDATE diagnostic_sessions SET status = 'completed' WHERE id = ?"
    ).bind(session.id).run();

    return {
      feedback,
      nextQuestion: null,
      done: true,
      results,
    };
  }

  // Get next question
  const next = DIAGNOSTIC_QUESTIONS[nextIndex] as any;
  const nextText = `Soal ${nextIndex + 1}/${DIAGNOSTIC_QUESTIONS.length} [${next.section}]\n\n${next.question}`;

  return { feedback, nextQuestion: nextText, nextAudioText: next.audio_text || undefined, done: false };
}

function calculateResults(answers: any[]) {
  const sections: Record<string, { correct: number; total: number; topics: Record<string, { correct: number; total: number }> }> = {
    grammar: { correct: 0, total: 0, topics: {} },
    vocabulary: { correct: 0, total: 0, topics: {} },
    reading: { correct: 0, total: 0, topics: {} },
    listening: { correct: 0, total: 0, topics: {} },
  };

  let writingAnswer = '';

  for (const a of answers) {
    if (a.is_writing) {
      writingAnswer = a.answer;
      continue;
    }

    const sec = sections[a.section];
    if (!sec) continue;

    sec.total++;
    if (a.correct) sec.correct++;

    if (!sec.topics[a.topic]) sec.topics[a.topic] = { correct: 0, total: 0 };
    sec.topics[a.topic].total++;
    if (a.correct) sec.topics[a.topic].correct++;
  }

  // Find weaknesses (topics with < 50% accuracy)
  const weaknesses: string[] = [];
  for (const [secName, sec] of Object.entries(sections)) {
    for (const [topic, stats] of Object.entries(sec.topics)) {
      if (stats.total > 0 && (stats.correct / stats.total) < 0.5) {
        weaknesses.push(topic);
      }
    }
  }

  // Estimate writing band (rough: based on word count and basic assessment)
  const wordCount = writingAnswer.split(/\s+/).filter(Boolean).length;
  let writingBand = 1;
  if (wordCount >= 30) writingBand = 2;
  if (wordCount >= 50) writingBand = 3;
  if (wordCount >= 80) writingBand = 3.5;

  // Calculate estimated band
  const sectionBands = Object.values(sections).map(s =>
    s.total > 0 ? Math.min(6, Math.round((s.correct / s.total) * 6 * 2) / 2) : 1
  );
  sectionBands.push(writingBand);
  const estimatedBand = Math.round((sectionBands.reduce((a, b) => a + b, 0) / sectionBands.length) * 2) / 2;

  return {
    grammar: sections.grammar,
    vocab: sections.vocabulary,
    reading: sections.reading,
    listening: sections.listening,
    writingBand,
    writingWordCount: wordCount,
    weaknesses,
    estimatedBand,
  };
}

export function formatResults(results: any): string {
  const g = results.grammar;
  const v = results.vocab;
  const r = results.reading;
  const l = results.listening;

  const bar = (correct: number, total: number) => {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return pct >= 67 ? `${pct}%` : pct >= 50 ? `${pct}%` : `${pct}% !!`;
  };

  let msg = `HASIL DIAGNOSTIC\n\n`;
  msg += `Grammar: ${g.correct}/${g.total} (${bar(g.correct, g.total)})\n`;
  msg += `Vocabulary: ${v.correct}/${v.total} (${bar(v.correct, v.total)})\n`;
  msg += `Reading: ${r.correct}/${r.total} (${bar(r.correct, r.total)})\n`;
  msg += `Listening: ${l.correct}/${l.total} (${bar(l.correct, l.total)})\n`;
  msg += `Writing: Band ${results.writingBand} (${results.writingWordCount} kata)\n\n`;

  msg += `Estimasi Band: ${results.estimatedBand}\n`;
  msg += `Target: Band 4\n`;

  if (results.estimatedBand >= 4) {
    msg += `Kamu sudah di level target!\n`;
  } else {
    msg += `Gap: ${4 - results.estimatedBand} band\n`;
  }

  if (results.weaknesses.length > 0) {
    msg += `\nKelemahan: ${results.weaknesses.join(', ')}\n`;
  }

  msg += `\nMau aku buatkan study plan? Ketik kapan target tes kamu (contoh: "2 bulan lagi" atau "1 Juni 2026")`;

  return msg;
}
