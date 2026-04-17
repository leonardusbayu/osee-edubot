import type { Env, User } from '../types';

// === TEST-SPECIFIC DIAGNOSTIC QUESTION BANKS ===

const COMMON_GRAMMAR = [
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
  {
    id: 7, section: 'grammar', topic: 'prepositions',
    question: 'The meeting is ___ Monday ___ 3 PM.\n\na) in, in\nb) on, at\nc) at, on\nd) in, at',
    answer: 'b',
    explanation: 'Days → "on" (on Monday). Clock time → "at" (at 3 PM).',
  },
  {
    id: 8, section: 'grammar', topic: 'passive_voice',
    question: 'This bridge ___ in 1995.\n\na) built\nb) was built\nc) is built\nd) has built',
    answer: 'b',
    explanation: 'Past passive = was/were + past participle. "Was built" because 1995 is past.',
  },
];

const COMMON_VOCAB = [
  {
    id: 9, section: 'vocabulary', topic: 'academic_words',
    audio_text: 'Before approving the medication, researchers must carefully evaluate the trial results to find out whether the drug is safe for human use.',
    question: 'Dengarkan audio, lalu jawab:\n\nThe scientist wants to ___ whether the drug is safe.\n\na) determine\nb) create\nc) ignore\nd) celebrate',
    answer: 'a',
    explanation: '"Determine" = find out / decide. Common academic word.',
  },
  {
    id: 10, section: 'vocabulary', topic: 'academic_words',
    audio_text: 'Following months of public debate, officials put the new policy into action across every province at the start of the past year.',
    question: 'Dengarkan audio, lalu jawab:\n\nThe government ___ new regulations last year.\n\na) implemented\nb) decorated\nc) entertained\nd) abandoned',
    answer: 'a',
    explanation: '"Implemented" = put into action.',
  },
  {
    id: 11, section: 'vocabulary', topic: 'collocations',
    audio_text: 'Manager: We have a tight deadline, so I need you to choose between the two options quickly. Can you give me your final answer today?',
    question: 'Dengarkan audio, lalu jawab:\n\nCan you ___ a decision quickly?\n\na) do\nb) make\nc) take\nd) have',
    answer: 'b',
    explanation: '"Make a decision" is the correct collocation.',
  },
  {
    id: 12, section: 'vocabulary', topic: 'collocations',
    audio_text: 'Weather reporter: The storm brought strong downpours throughout the evening, and the streets were flooded by morning after hours of continuous rainfall.',
    question: 'Dengarkan audio, lalu jawab:\n\nThere was ___ rain last night.\n\na) strong\nb) big\nc) heavy\nd) hard',
    answer: 'c',
    explanation: '"Heavy rain" is the natural English collocation.',
  },
];

const COMMON_READING = [
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
];

const COMMON_LISTENING = [
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
];

// === TEST-SPECIFIC QUESTIONS ===

const TOEFL_IBT_EXTRA = [
  {
    id: 19, section: 'writing', topic: 'email',  // ID 19 = TOEFL iBT writing
    audio_text: 'Write a short email to your professor. Explain that you will miss class tomorrow because you have a doctor\'s appointment. Ask if you can get the notes from a classmate.',
    question: 'Dengarkan instruksi di atas, lalu tulis email pendek (3-5 kalimat) ke profesor kamu.\n\nTulis dalam bahasa Inggris:',
    answer: '_free_text_',
    explanation: '',
  },
  {
    id: 20, section: 'grammar', topic: 'word_formation',
    question: 'She is very ___ (help). She always helps everyone.\n\na) helpless\nb) helpful\nc) helping\nd) helped',
    answer: 'b',
    explanation: '"-ful" suffix means "full of". Helpful = full of help.',
  },
];

const IELTS_EXTRA = [
  {
    id: 21, section: 'reading', topic: 'true_false_not_given',  // Unique IDs per test type
    question: 'Read:\n"Coffee was first discovered in Ethiopia. A shepherd noticed his goats became energetic after eating certain berries. By the 15th century, coffee was being cultivated in Yemen."\n\nStatement: Coffee was first grown in Ethiopia.\n\na) True\nb) False\nc) Not Given',
    answer: 'c',
    explanation: 'The passage says coffee was DISCOVERED in Ethiopia, but CULTIVATED in Yemen. Where it was first grown is not clearly stated.',
  },
  {
    id: 22, section: 'speaking', topic: 'cue_card',
    audio_text: 'Describe a book that you have read recently. You should say: what the book was about, why you chose to read it, what you learned from it, and explain whether you would recommend it to others.',
    question: 'Dengarkan instruksi di atas. Kamu punya 1 menit persiapan, lalu bicara selama 2 menit.\n\nJawab dalam bahasa Inggris (tulis jawabanmu):',
    answer: '_free_text_',
    explanation: 'IELTS Speaking Part 2: Cue card task. You should speak for 1-2 minutes covering all the points.',
  },
];

const TOEFL_ITP_EXTRA = [
  {
    id: 23, section: 'grammar', topic: 'error_identification',
    question: 'Find the error:\n\n"The professor, along with his students, (A) are attending (B) the conference (C) which is held (D) annually."\n\na) A\nb) B\nc) C\nd) D',
    answer: 'a',
    explanation: '"Along with" does not change the subject. The subject is "professor" (singular), so it should be "is attending".',
  },
  {
    id: 24, section: 'grammar', topic: 'sentence_completion',
    question: '___ the weather is bad, the outdoor event will be postponed.\n\na) Despite\nb) Should\nc) Unless\nd) Although',
    answer: 'b',
    explanation: '"Should the weather be bad" = "If the weather is bad" (formal inversion). Common in TOEFL ITP Structure.',
  },
];

const TOEIC_EXTRA = [
  {
    id: 25, section: 'vocabulary', topic: 'business_vocabulary',
    question: 'The quarterly report shows a significant ___ in revenue.\n\na) increase\nb) meeting\nc) schedule\nd) department',
    answer: 'a',
    explanation: '"Increase in revenue" is a common business collocation. TOEIC focuses on workplace vocabulary.',
  },
  {
    id: 26, section: 'reading', topic: 'business_reading',
    question: 'Read:\n"All employees must submit their time sheets by Friday at 5 PM. Late submissions will not be processed until the following pay period."\n\nWhat happens if time sheets are submitted late?\n\na) Employees will be fired\nb) Payment will be delayed\nc) Time sheets will be rejected\nd) A fine will be charged',
    answer: 'b',
    explanation: '"Not processed until the following pay period" means payment will be delayed, not rejected.',
  },
];

// Build test-specific question banks
function getQuestionsForTest(testType: string) {
  const base = [...COMMON_GRAMMAR, ...COMMON_VOCAB, ...COMMON_READING, ...COMMON_LISTENING];

  switch (testType) {
    case 'IELTS':
      return [...base, ...IELTS_EXTRA];
    case 'TOEFL_ITP':
      return [...base, ...TOEFL_ITP_EXTRA];
    case 'TOEIC':
      return [...base, ...TOEIC_EXTRA];
    case 'TOEFL_IBT':
    default:
      return [...base, ...TOEFL_IBT_EXTRA];
  }
}

// Target scores per test type
const TARGET_SCORES: Record<string, { label: string; value: number }> = {
  'TOEFL_IBT': { label: 'Band 4', value: 4 },
  'IELTS': { label: 'Band 6.0', value: 6 },
  'TOEFL_ITP': { label: 'Score 500', value: 500 },
  'TOEIC': { label: 'Score 600', value: 600 },
};

// Keep backward compat
export const DIAGNOSTIC_QUESTIONS = getQuestionsForTest('TOEFL_IBT');

export async function startDiagnostic(env: Env, user: User): Promise<string> {
  const existing = await env.DB.prepare(
    "SELECT id FROM diagnostic_sessions WHERE user_id = ? AND status = 'in_progress'"
  ).bind(user.id).first();

  if (existing) {
    await env.DB.prepare(
      "DELETE FROM diagnostic_sessions WHERE id = ?"
    ).bind(existing.id).run();
  }

  const testType = user.target_test || 'TOEFL_IBT';

  // Store test_type in the session so we use the right questions throughout
  await env.DB.prepare(
    "INSERT INTO diagnostic_sessions (user_id, current_question, answers, status) VALUES (?, 0, ?, 'in_progress')"
  ).bind(user.id, JSON.stringify({ test_type: testType })).run();

  const { TEST_NAMES } = await import('./teaching');
  const testName = TEST_NAMES[testType] || 'English Test';

  const questions = getQuestionsForTest(testType);
  const lastQ = questions[questions.length - 1];
  const sections = testType === 'TOEIC'
    ? 'Soal 1-8: Grammar\nSoal 9-12: Vocabulary\nSoal 13-15: Reading\nSoal 16-18: Listening\nSoal 19: Business Vocabulary\nSoal 20: Business Reading'
    : testType === 'IELTS'
    ? 'Soal 1-8: Grammar\nSoal 9-12: Vocabulary\nSoal 13-15: Reading\nSoal 16-18: Listening\nSoal 19: True/False/Not Given\nSoal 20: Speaking (Cue Card)'
    : testType === 'TOEFL_ITP'
    ? 'Soal 1-8: Grammar\nSoal 9-12: Vocabulary\nSoal 13-15: Reading\nSoal 16-18: Listening\nSoal 19: Error Identification\nSoal 20: Sentence Completion'
    : 'Soal 1-8: Grammar\nSoal 9-12: Vocabulary\nSoal 13-15: Reading\nSoal 16-18: Listening\nSoal 19: Writing\nSoal 20: Word Formation';

  return `Diagnostic Test ${testName}

Aku akan kasih ${questions.length} soal untuk ukur level kamu sekarang.
Hasilnya: peta kelemahan + estimasi skor.

${sections}

Siap? Ketik "mulai" untuk start.`;
}

export async function getNextQuestion(env: Env, userId: number): Promise<{ question: string; questionNum: number; total: number; done: boolean; audioText?: string }> {
  const session = await env.DB.prepare(
    "SELECT * FROM diagnostic_sessions WHERE user_id = ? AND status = 'in_progress'"
  ).bind(userId).first() as any;

  if (!session) {
    return { question: 'Belum ada sesi diagnostic. Ketik /diagnostic untuk mulai.', questionNum: 0, total: 20, done: true };
  }

  // Extract test_type from answers JSON (first item might be {test_type: ...})
  const testType = extractTestType(session.answers);
  const questions = getQuestionsForTest(testType);
  const qIndex = session.current_question;

  if (qIndex >= questions.length) {
    return { question: '', questionNum: qIndex, total: questions.length, done: true };
  }

  const q = questions[qIndex] as any;
  const questionText = `Soal ${qIndex + 1}/${questions.length} [${q.section}]\n\n${q.question}`;

  return {
    question: questionText,
    questionNum: qIndex + 1,
    total: questions.length,
    done: false,
    audioText: q.audio_text || undefined,
  };
}

function extractTestType(answersJson: string): string {
  try {
    const parsed = JSON.parse(answersJson || '[]');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.test_type) {
      return parsed.test_type;
    }
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.test_type) {
      return parsed[0].test_type;
    }
  } catch {}
  return 'TOEFL_IBT';
}

function extractAnswers(answersJson: string): any[] {
  try {
    const parsed = JSON.parse(answersJson || '[]');
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && parsed.test_type && parsed.answers) {
      return parsed.answers;
    }
  } catch {}
  return [];
}

export async function submitAnswer(env: Env, userId: number, answer: string): Promise<{
  feedback: string;
  nextQuestion: string | null;
  nextAudioText?: string;
  done: boolean;
  results?: any;
  trialGranted?: boolean;
}> {
  const session = await env.DB.prepare(
    "SELECT * FROM diagnostic_sessions WHERE user_id = ? AND status = 'in_progress'"
  ).bind(userId).first() as any;

  if (!session) {
    return { feedback: 'Tidak ada sesi diagnostic aktif.', nextQuestion: null, done: true };
  }

  const testType = extractTestType(session.answers);
  const questions = getQuestionsForTest(testType);
  const qIndex = session.current_question;
  const q = questions[qIndex];
  const answers = extractAnswers(session.answers);

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

  // Update session — store test_type + answers
  const nextIndex = qIndex + 1;
  const sessionData = { test_type: testType, answers };
  await env.DB.prepare(
    "UPDATE diagnostic_sessions SET current_question = ?, answers = ? WHERE id = ?"
  ).bind(nextIndex, JSON.stringify(sessionData), session.id).run();

  // Build feedback. For wrong answers, try personalized AI feedback that
  // references this student's history (weak concepts, repeated mistakes,
  // streak). Falls back to canned text on any failure.
  let feedback = '';
  if (isWriting) {
    feedback = 'Writing disimpan. Nanti aku review.';
  } else if (isCorrect) {
    feedback = `Bener! ${q.explanation}`;
  } else {
    try {
      const { generatePersonalizedWrongAnswerFeedback } = await import('./student-context');
      feedback = await generatePersonalizedWrongAnswerFeedback(env, userId, {
        question: q.question,
        student_answer: answer.trim(),
        correct_answer: q.answer,
        canned_explanation: q.explanation || '',
        section: q.section || 'unknown',
        topic: q.topic,
      });
    } catch (e) {
      console.error('diagnostic: personalized feedback failed:', e);
      feedback = `Belum tepat. Jawaban: ${q.answer.toUpperCase()}\n${q.explanation}`;
    }
  }

  // Check if done
  if (nextIndex >= questions.length) {
    const results = calculateResults(answers, testType);

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

    try {
      const { initSkillsFromDiagnostic } = await import('./prerequisites');
      await initSkillsFromDiagnostic(env, userId, results);
    } catch {}

    await env.DB.prepare(
      "UPDATE diagnostic_sessions SET status = 'completed' WHERE id = ?"
    ).bind(session.id).run();

    // Grant 3-day premium trial on first diagnostic completion (one-time).
    // This lets the user experience unlimited questions + AI tutor + speaking
    // evaluation during the first 72h after their placement test, which is
    // when motivation is highest.
    let trialGranted = false;
    try {
      const existing = await env.DB.prepare(
        'SELECT is_premium, premium_until FROM users WHERE id = ?'
      ).bind(userId).first() as any;

      // Only grant if user has never been premium AND hasn't already used the trial
      if (existing && !existing.is_premium && !existing.premium_until) {
        const alreadyTrialed = await env.DB.prepare(
          `SELECT 1 FROM star_transactions WHERE user_id = ? AND payment_id = 'DIAGNOSTIC_TRIAL' LIMIT 1`
        ).bind(userId).first();

        if (!alreadyTrialed) {
          const trialUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
          await env.DB.prepare(
            `UPDATE users SET is_premium = 1, premium_until = ? WHERE id = ?`
          ).bind(trialUntil, userId).run();

          // Record the trial in star_transactions so we can tell a trial from a paid grant
          await env.DB.prepare(
            `INSERT INTO star_transactions (user_id, amount, type, description, status, payment_id, created_at)
             VALUES (?, 0, 'trial_3d', 'DIAGNOSTIC_TRIAL', 'completed', 'DIAGNOSTIC_TRIAL', datetime('now'))`
          ).bind(userId).run();

          trialGranted = true;
        }
      }
    } catch (e) {
      console.error('Diagnostic trial grant error:', e);
    }

    return { feedback, nextQuestion: null, done: true, results, trialGranted };
  }

  const next = questions[nextIndex] as any;
  const nextText = `Soal ${nextIndex + 1}/${questions.length} [${next.section}]\n\n${next.question}`;

  return { feedback, nextQuestion: nextText, nextAudioText: next.audio_text || undefined, done: false };
}

function calculateResults(answers: any[], testType: string = 'TOEFL_IBT') {
  const sections: Record<string, { correct: number; total: number; topics: Record<string, { correct: number; total: number }> }> = {
    grammar: { correct: 0, total: 0, topics: {} },
    vocabulary: { correct: 0, total: 0, topics: {} },
    reading: { correct: 0, total: 0, topics: {} },
    listening: { correct: 0, total: 0, topics: {} },
  };

  // IELTS/TOEIC may have speaking section too
  if (testType === 'IELTS') {
    sections.speaking = { correct: 0, total: 0, topics: {} };
  }

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

  // Find weaknesses
  const weaknesses: string[] = [];
  for (const [secName, sec] of Object.entries(sections)) {
    for (const [topic, stats] of Object.entries(sec.topics)) {
      if (stats.total > 0 && (stats.correct / stats.total) < 0.5) {
        weaknesses.push(topic);
      }
    }
  }

  // Estimate writing band
  const wordCount = writingAnswer.split(/\s+/).filter(Boolean).length;
  let writingBand = 1;
  if (wordCount >= 20) writingBand = 2;
  if (wordCount >= 40) writingBand = 3;
  if (wordCount >= 60) writingBand = 3.5;
  if (wordCount >= 80) writingBand = 4;
  if (wordCount >= 120) writingBand = 5;
  if (wordCount >= 160) writingBand = 5.5;
  if (wordCount >= 200) writingBand = 6;

  // Calculate estimated score based on test type
  const sectionBands = Object.values(sections).map(s =>
    s.total > 0 ? Math.min(6, Math.round((s.correct / s.total) * 6 * 2) / 2) : 1
  );
  sectionBands.push(writingBand);
  const rawBand = sectionBands.reduce((a, b) => a + b, 0) / sectionBands.length;

  let estimatedBand: number;
  if (testType === 'IELTS') {
    // IELTS: 1-9 band scale
    estimatedBand = Math.round(Math.min(9, rawBand * 1.5) * 2) / 2;
  } else if (testType === 'TOEFL_ITP') {
    // TOEFL ITP: 310-677 scale
    estimatedBand = Math.round(310 + (rawBand / 6) * (677 - 310));
  } else if (testType === 'TOEIC') {
    // TOEIC: 10-990 scale
    estimatedBand = Math.round((rawBand / 6) * 990 / 5) * 5;
  } else {
    // TOEFL iBT: band 1-6
    estimatedBand = Math.round(rawBand * 2) / 2;
  }

  return {
    grammar: sections.grammar,
    vocab: sections.vocabulary,
    reading: sections.reading,
    listening: sections.listening,
    writingBand,
    writingWordCount: wordCount,
    weaknesses,
    estimatedBand,
    testType,
  };
}

export function formatResults(results: any): string {
  const g = results.grammar;
  const v = results.vocab;
  const r = results.reading;
  const l = results.listening;
  const testType = results.testType || 'TOEFL_IBT';

  const bar = (correct: number, total: number) => {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return pct >= 67 ? `${pct}%` : pct >= 50 ? `${pct}%` : `${pct}% !!`;
  };

  const target = TARGET_SCORES[testType] || TARGET_SCORES['TOEFL_IBT'];

  let msg = `HASIL DIAGNOSTIC\n\n`;
  msg += `Grammar: ${g.correct}/${g.total} (${bar(g.correct, g.total)})\n`;
  msg += `Vocabulary: ${v.correct}/${v.total} (${bar(v.correct, v.total)})\n`;
  msg += `Reading: ${r.correct}/${r.total} (${bar(r.correct, r.total)})\n`;
  msg += `Listening: ${l.correct}/${l.total} (${bar(l.correct, l.total)})\n`;
  msg += `Writing: Band ${results.writingBand} (${results.writingWordCount} kata)\n\n`;

  if (testType === 'TOEFL_ITP') {
    msg += `Estimasi Skor: ${results.estimatedBand}\n`;
    msg += `Target: ${target.label}\n`;
    msg += results.estimatedBand >= target.value ? `Kamu sudah di level target!\n` : `Gap: ${target.value - results.estimatedBand} poin\n`;
  } else if (testType === 'TOEIC') {
    msg += `Estimasi Skor: ${results.estimatedBand}\n`;
    msg += `Target: ${target.label}\n`;
    msg += results.estimatedBand >= target.value ? `Kamu sudah di level target!\n` : `Gap: ${target.value - results.estimatedBand} poin\n`;
  } else {
    msg += `Estimasi Band: ${results.estimatedBand}\n`;
    msg += `Target: ${target.label}\n`;
    msg += results.estimatedBand >= target.value ? `Kamu sudah di level target!\n` : `Gap: ${target.value - results.estimatedBand} band\n`;
  }

  if (results.weaknesses.length > 0) {
    msg += `\nKelemahan: ${results.weaknesses.join(', ')}\n`;
  }

  msg += `\nMau aku buatkan study plan? Ketik kapan target tes kamu (contoh: "2 bulan lagi" atau "1 Juni 2026")`;

  return msg;
}
