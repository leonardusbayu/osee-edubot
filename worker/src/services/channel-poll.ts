import type { Env } from '../types';

// Native Telegram POLL quizzes — the tap-to-vote mechanic that replaces
// "comment your answer" text quizzes. Telegram quiz polls render an
// inline interactive widget: students tap an option, instantly see if
// they're right (confetti for correct, shake for wrong), and the
// explanation pops up after voting. Zero friction, far higher engagement
// than asking people to type an answer in comments.
//
// Telegram sendPoll (type:'quiz') constraints we honor here:
//   - options: array of 2–10 plain strings, each ≤ 100 chars
//   - question: ≤ 300 chars
//   - correct_option_id: 0-based index into options (REQUIRED for quiz)
//   - explanation: ≤ 200 chars, shown after the user votes (supports HTML)
//   - is_anonymous: true so the channel audience can't see who voted
//
// Channel id resolution mirrors postToChannel() in contentGenerator.ts.

interface PollOpts {
  question: string;
  options: string[];   // 2–4 (Telegram allows up to 10; we cap to keep it tappable)
  correctIndex: number;
  explanation: string;
  testType: string;
}

// ---------------------------------------------------------------------------
// Hardcoded fallback bank — exam-accurate poll questions across TOEFL/IELTS.
// Used when the live test_contents bank is thin or returns nothing usable.
// Each option is kept ≤ 100 chars, explanation ≤ 200 chars (HTML-safe).
// ---------------------------------------------------------------------------
export const POLL_FALLBACKS: PollOpts[] = [
  {
    question: 'Pick the correct word: "Despite ___ busy schedule, she studied every day."',
    options: ['her', 'hers', 'herself', "she's"],
    correctIndex: 0,
    explanation: '"Despite" is a preposition, so it takes a noun phrase. "Despite her busy schedule" = meskipun jadwalnya padat.',
    testType: 'TOEFL_IBT',
  },
  {
    question: '"___ the heavy rain, the flight departed on time." Which connector fits?',
    options: ['Despite', 'Although', 'Because', 'Since'],
    correctIndex: 0,
    explanation: '"Despite" + noun = meskipun. "Although" needs a full clause; "Because/Since" mean "karena" (cause, not contrast).',
    testType: 'TOEFL_ITP',
  },
  {
    question: '"Neither the students nor the teacher ___ present." Choose the verb.',
    options: ['was', 'were', 'are', 'have been'],
    correctIndex: 0,
    explanation: 'Proximity rule: the verb agrees with the nearest noun. "the teacher" (singular) sits before the verb → "was".',
    testType: 'TOEFL_ITP',
  },
  {
    question: '"If I ___ more money, I would invest in property." Pick the verb.',
    options: ['had', 'have', 'would have', 'had had'],
    correctIndex: 0,
    explanation: 'Second conditional: If + past simple + would + base verb. "If I had more money..." = andai aku punya lebih banyak uang.',
    testType: 'IELTS',
  },
  {
    question: 'IELTS Reading skill: a sentence stated in the passage but with different wording is a...',
    options: ['Paraphrase', 'Distractor', 'Inference', 'Contradiction'],
    correctIndex: 0,
    explanation: 'A paraphrase keeps the same meaning with different words — the core of True/False/Not Given and matching tasks.',
    testType: 'IELTS',
  },
  {
    question: '"Her writing improved ___ this year." Which form is correct?',
    options: ['significantly', 'significant', 'significance', 'signify'],
    correctIndex: 0,
    explanation: '"Improved" is a verb, so it needs the adverb "significantly". "Significant" is an adjective; "significance" a noun.',
    testType: 'TOEFL_IBT',
  },
];

// ---------------------------------------------------------------------------
// Build poll options from the live question bank, reusing the same shape
// logic as contentGenerator.pullRandomQuizFromBank. Returns null when D1
// has nothing usable (caller falls back to POLL_FALLBACKS).
// ---------------------------------------------------------------------------
export async function buildPollFromBank(env: Env, testType?: string): Promise<PollOpts | null> {
  try {
    // Sample broadly across MCQ-shaped question types. Optionally bias by
    // test_type when the caller asks for a specific exam.
    const typeFilter = testType ? 'AND test_type = ?' : '';
    const stmt = env.DB.prepare(
      `SELECT id, content, section, test_type, question_type
       FROM test_contents
       WHERE status = 'published'
         AND question_type IN (
           'read_academic_passage','read_in_daily_life',
           'complete_the_words','listen_choose_response',
           'listen_academic_talk','true_false_not_given',
           'multiple_choice','matching_headings'
         )
         ${typeFilter}
       ORDER BY RANDOM() LIMIT 25`
    );
    const rows = testType
      ? await stmt.bind(testType).all<{ id: number; content: string; section: string; test_type: string; question_type: string }>()
      : await stmt.all<{ id: number; content: string; section: string; test_type: string; question_type: string }>();

    for (const row of rows.results || []) {
      try {
        const c = JSON.parse(row.content);
        const questionRaw: string = c.question_text || c.question || c.direction || '';
        const optionsRaw = c.options || c.choices || [];
        let options: string[] = Array.isArray(optionsRaw)
          ? optionsRaw.map((o: any) => (typeof o === 'string' ? o : (o?.text || o?.label || ''))).filter(Boolean)
          : [];

        // Telegram quiz polls need plain, label-free option strings. Strip a
        // leading "A) " / "B. " / "1) " prefix if the bank stored one.
        options = options.map((o: string) => o.replace(/^\s*[A-Da-d1-4][).\.]\s*/, '').trim());

        if (!questionRaw || options.length < 2 || questionRaw.length < 10) continue;

        // Normalize the correct answer to an index (number / letter / text).
        let correctIndex = 0;
        const correctRaw = c.answers?.[0] ?? c.correct_answer ?? c.correct ?? c.answer;
        if (typeof correctRaw === 'number') {
          correctIndex = correctRaw;
        } else if (typeof correctRaw === 'string') {
          if (/^[A-Z]$/i.test(correctRaw.trim())) {
            correctIndex = correctRaw.toUpperCase().charCodeAt(0) - 65;
          } else {
            const idx = options.findIndex(
              (o: string) => o.trim().toLowerCase() === correctRaw.trim().toLowerCase()
            );
            if (idx >= 0) correctIndex = idx;
          }
        }
        if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

        // Telegram caps options at 10; we keep it tappable at 2–4.
        options = options.slice(0, 4).map((o: string) => o.slice(0, 100));
        // After slicing, ensure correctIndex still points at a valid option.
        if (correctIndex >= options.length) correctIndex = 0;
        if (options.length < 2) continue;

        const explanationRaw = c.explanation || `Jawaban benar: ${options[correctIndex]}.`;

        return {
          question: questionRaw.slice(0, 300),
          options,
          correctIndex,
          explanation: String(explanationRaw).slice(0, 200),
          testType: row.test_type,
        };
      } catch {
        /* skip malformed row */
      }
    }
    return null;
  } catch (e) {
    console.error('[poll] buildPollFromBank error (non-fatal):', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Send a native Telegram quiz poll to the channel and log it to channel_posts.
// Returns { ok, messageId }. Best-effort — never throws.
// ---------------------------------------------------------------------------
export async function postQuizPoll(
  env: Env,
  opts: PollOpts
): Promise<{ ok: boolean; messageId: number | null }> {
  const channelId = env.TELEGRAM_BOT_TOKEN.includes('test')
    ? '@TOEFL_IELTS_Indonesia_Test'
    : '-1003884450070';

  // Sanitize to Telegram's hard limits so the API doesn't reject the call.
  const question = (opts.question || '').slice(0, 300);
  let options = (opts.options || [])
    .map((o) => String(o).slice(0, 100))
    .filter((o) => o.length > 0)
    .slice(0, 10);
  let correctIndex = opts.correctIndex;
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    correctIndex = 0;
  }
  // explanation is HTML-capable; keep ≤ 200 chars per Telegram spec.
  const explanation = (opts.explanation || '').slice(0, 200);

  let messageId: number | null = null;
  let status = 'failed';
  let errorMsg: string | null = null;

  // Guard: a quiz poll needs at least 2 options.
  if (options.length < 2) {
    errorMsg = 'poll needs >=2 options';
  } else {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPoll`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: channelId,
            question,
            options,
            type: 'quiz',
            correct_option_id: correctIndex,
            explanation,
            explanation_parse_mode: 'HTML',
            is_anonymous: true,
          }),
        }
      );
      const result = (await response.json()) as any;
      if (result.ok) {
        messageId = result.result?.message_id ?? null;
        status = 'sent';
      } else {
        errorMsg = result.description || 'Unknown error';
        console.error('Channel poll failed:', result);
      }
    } catch (e: any) {
      errorMsg = e?.message || String(e);
      console.error('Failed to post poll to channel:', e);
    }
  }

  // Log to channel_posts (post_type 'poll_quiz', store question as content)
  // so the poll shows up in channel analytics alongside text posts.
  try {
    await env.DB.prepare(
      `INSERT INTO channel_posts (post_type, post_content, content_preview, message_id, sent_to_channel, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'poll_quiz',
        question,
        question.substring(0, 100),
        messageId,
        channelId,
        status,
        errorMsg
      )
      .run();
  } catch (e) {
    console.error('Failed to log channel poll:', e);
  }

  return { ok: status === 'sent', messageId };
}

// ---------------------------------------------------------------------------
// One-call daily poll: pull from the bank (or fall back), prepend a hook to
// the question, and post. Best-effort — returns the postQuizPoll result, or
// { ok:false } if everything failed.
// ---------------------------------------------------------------------------
export async function postDailyPollQuiz(
  env: Env,
  testType?: string
): Promise<{ ok: boolean; messageId: number | null }> {
  try {
    let opts = await buildPollFromBank(env, testType);
    if (!opts) {
      // Fall back to the hardcoded bank, biased by testType when given.
      const pool = testType
        ? POLL_FALLBACKS.filter((p) => p.testType === testType)
        : POLL_FALLBACKS;
      const chosen = (pool.length > 0 ? pool : POLL_FALLBACKS);
      opts = chosen[Math.floor(Math.random() * chosen.length)];
    }

    // Open with an addictive hook. Telegram question cap is 300 chars, so
    // trim the original to leave room for the prefix.
    const HOOK = '🧠 Tebak jawabannya — jangan ngintip! ';
    const room = 300 - HOOK.length;
    const hooked = `${HOOK}${(opts.question || '').slice(0, Math.max(0, room))}`;

    return await postQuizPoll(env, { ...opts, question: hooked });
  } catch (e) {
    console.error('postDailyPollQuiz error (non-fatal):', e);
    return { ok: false, messageId: null };
  }
}
