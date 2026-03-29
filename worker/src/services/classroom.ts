import type { Env } from '../types';

// --- Daily Quiz ---

const QUIZ_QUESTIONS = [
  { q: 'She ___ to school every day.\n\na) go  b) goes  c) going  d) gone', a: 'b', topic: 'sv_agreement' },
  { q: 'I bought ___ apple at the store.\n\na) a  b) an  c) the  d) -', a: 'b', topic: 'articles' },
  { q: 'Yesterday, he ___ the bus.\n\na) miss  b) missed  c) missing  d) misses', a: 'b', topic: 'tenses' },
  { q: 'The meeting is ___ Monday.\n\na) in  b) at  c) on  d) by', a: 'c', topic: 'prepositions' },
  { q: 'This house ___ in 1990.\n\na) built  b) was built  c) is built  d) building', a: 'b', topic: 'passive' },
  { q: 'If I ___ rich, I would travel.\n\na) am  b) was  c) were  d) be', a: 'c', topic: 'conditionals' },
  { q: '"Crucial" most likely means:\n\na) small  b) important  c) dangerous  d) old', a: 'b', topic: 'vocabulary' },
  { q: 'Can you ___ a decision?\n\na) do  b) make  c) take  d) have', a: 'b', topic: 'collocations' },
  { q: 'Everyone ___ happy today.\n\na) are  b) is  c) were  d) be', a: 'b', topic: 'sv_agreement' },
  { q: 'She is ___ honest person.\n\na) a  b) an  c) the  d) -', a: 'b', topic: 'articles' },
  { q: 'I have ___ here since 2020.\n\na) live  b) lived  c) living  d) lives', a: 'b', topic: 'tenses' },
  { q: 'The book is ___ the table.\n\na) in  b) at  c) on  d) by', a: 'c', topic: 'prepositions' },
  { q: '"Determine" means:\n\na) forget  b) find out  c) ignore  d) celebrate', a: 'b', topic: 'vocabulary' },
  { q: 'There was ___ rain last night.\n\na) strong  b) big  c) heavy  d) hard', a: 'c', topic: 'collocations' },
  { q: 'The news ___ shocking.\n\na) are  b) is  c) were  d) have', a: 'b', topic: 'sv_agreement' },
  { q: 'She ___ (help) is always ___.\n\na) helpless  b) helpful  c) helping  d) helped', a: 'b', topic: 'word_formation' },
  { q: 'I ___ to the store tomorrow.\n\na) go  b) went  c) will go  d) going', a: 'c', topic: 'tenses' },
  { q: 'The man ___ called you is here.\n\na) which  b) who  c) what  d) where', a: 'b', topic: 'relative_clauses' },
  { q: '"Implement" means:\n\na) destroy  b) put into action  c) forget  d) delay', a: 'b', topic: 'vocabulary' },
  { q: 'She doesn\'t ___ coffee.\n\na) likes  b) like  c) liking  d) liked', a: 'b', topic: 'sv_agreement' },
];

export async function postDailyQuiz(env: Env) {
  // Find all classes with group_chat_id
  const classes = await env.DB.prepare(
    'SELECT id, group_chat_id FROM classes WHERE group_chat_id IS NOT NULL AND is_active = 1'
  ).all();

  for (const cls of classes.results as any[]) {
    const groupId = cls.group_chat_id;
    if (!groupId) continue;

    // Pick random question
    const q = QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];

    // Save quiz
    await env.DB.prepare(
      'INSERT INTO daily_quiz (class_id, question_text, correct_answer, posted_at, active) VALUES (?, ?, ?, ?, 1)'
    ).bind(cls.id, q.q, q.a, new Date().toISOString()).run();

    // Post to group
    const msg = `Quiz Harian!\n\n${q.q}\n\nBalas dengan huruf jawaban (a/b/c/d). Yang pertama bener dapat +5 poin!`;
    await sendToGroup(env, groupId, msg);
  }
}

export async function handleGroupQuizAnswer(env: Env, groupChatId: string, userId: number, userName: string, answer: string) {
  // Find active quiz for this group
  const cls = await env.DB.prepare(
    'SELECT id FROM classes WHERE group_chat_id = ?'
  ).bind(groupChatId).first() as any;
  if (!cls) return null;

  const quiz = await env.DB.prepare(
    'SELECT * FROM daily_quiz WHERE class_id = ? AND active = 1 ORDER BY posted_at DESC LIMIT 1'
  ).bind(cls.id).first() as any;
  if (!quiz) return null;

  const isCorrect = answer.toLowerCase().trim() === quiz.correct_answer.toLowerCase();

  if (isCorrect && !quiz.first_correct_user_id) {
    // First correct answer!
    await env.DB.prepare(
      'UPDATE daily_quiz SET first_correct_user_id = ?, answered_count = answered_count + 1 WHERE id = ?'
    ).bind(userId, quiz.id).run();

    // Award bonus points
    const week = getWeekString();
    await env.DB.prepare(
      `INSERT INTO class_leaderboard (class_id, user_id, week, bonus_points, correct_answers, questions_answered)
       VALUES (?, ?, ?, 5, 1, 1)
       ON CONFLICT(class_id, user_id, week) DO UPDATE SET
       bonus_points = bonus_points + 5, correct_answers = correct_answers + 1, questions_answered = questions_answered + 1`
    ).bind(cls.id, userId, week).run();

    return { correct: true, first: true, userName };
  } else if (isCorrect) {
    // Correct but not first
    const week = getWeekString();
    await env.DB.prepare(
      `INSERT INTO class_leaderboard (class_id, user_id, week, correct_answers, questions_answered)
       VALUES (?, ?, ?, 1, 1)
       ON CONFLICT(class_id, user_id, week) DO UPDATE SET
       correct_answers = correct_answers + 1, questions_answered = questions_answered + 1`
    ).bind(cls.id, userId, week).run();

    await env.DB.prepare(
      'UPDATE daily_quiz SET answered_count = answered_count + 1 WHERE id = ?'
    ).bind(quiz.id).run();

    return { correct: true, first: false, userName };
  } else {
    // Wrong
    const week = getWeekString();
    await env.DB.prepare(
      `INSERT INTO class_leaderboard (class_id, user_id, week, questions_answered)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(class_id, user_id, week) DO UPDATE SET questions_answered = questions_answered + 1`
    ).bind(cls.id, userId, week).run();

    return { correct: false, first: false, userName };
  }
}

// --- Leaderboard ---

export async function postWeeklyLeaderboard(env: Env) {
  const classes = await env.DB.prepare(
    'SELECT id, group_chat_id, name FROM classes WHERE group_chat_id IS NOT NULL AND is_active = 1'
  ).all();

  const week = getWeekString();

  for (const cls of classes.results as any[]) {
    const groupId = cls.group_chat_id;
    if (!groupId) continue;

    const lb = await env.DB.prepare(
      `SELECT u.name, cl.correct_answers, cl.questions_answered, cl.bonus_points,
       (cl.correct_answers * 10 + cl.bonus_points) as total_score
       FROM class_leaderboard cl
       JOIN users u ON cl.user_id = u.id
       WHERE cl.class_id = ? AND cl.week = ?
       ORDER BY total_score DESC
       LIMIT 10`
    ).bind(cls.id, week).all();

    if (lb.results.length === 0) continue;

    let msg = `Leaderboard Minggu Ini\nKelas: ${cls.name}\n\n`;
    const medals = ['🥇', '🥈', '🥉'];

    for (let i = 0; i < lb.results.length; i++) {
      const s = lb.results[i] as any;
      const medal = i < 3 ? medals[i] : `${i + 1}.`;
      const acc = s.questions_answered > 0 ? Math.round((s.correct_answers / s.questions_answered) * 100) : 0;
      msg += `${medal} ${s.name} — ${s.total_score} pts (${acc}% akurasi)\n`;
    }

    msg += '\nTerus latihan untuk naik peringkat!';
    await sendToGroup(env, groupId, msg);
  }
}

// --- Peer Challenge ---

export async function createChallenge(env: Env, challengerId: number, opponentId: number, classId: number | null) {
  // Generate 5 random grammar questions
  const questions = [];
  const indices = new Set<number>();
  while (indices.size < 5) {
    indices.add(Math.floor(Math.random() * QUIZ_QUESTIONS.length));
  }
  for (const i of indices) {
    questions.push(QUIZ_QUESTIONS[i]);
  }

  const result = await env.DB.prepare(
    'INSERT INTO challenges (class_id, challenger_id, opponent_id, questions, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(classId, challengerId, opponentId, JSON.stringify(questions), 'pending').run();

  return { challengeId: result.meta.last_row_id, questions };
}

export async function submitChallengeAnswer(env: Env, challengeId: number, userId: number, answers: string[]) {
  const challenge = await env.DB.prepare('SELECT * FROM challenges WHERE id = ?').bind(challengeId).first() as any;
  if (!challenge) return null;

  const questions = JSON.parse(challenge.questions);
  let score = 0;
  for (let i = 0; i < Math.min(answers.length, questions.length); i++) {
    if (answers[i].toLowerCase().trim() === questions[i].a.toLowerCase()) score++;
  }

  if (userId === challenge.challenger_id) {
    await env.DB.prepare('UPDATE challenges SET challenger_score = ? WHERE id = ?').bind(score, challengeId).run();
  } else {
    await env.DB.prepare('UPDATE challenges SET opponent_score = ?, status = ? WHERE id = ?').bind(score, 'completed', challengeId).run();
  }

  return { score, total: questions.length };
}

// --- Discussion Forum ---

export async function postDiscussionPrompt(env: Env) {
  const prompts = [
    'Do you think online learning is better than in-person classes? Why or why not?',
    'What is the most important skill for success in life? Explain your answer.',
    'Should students be required to learn a foreign language? Give reasons.',
    'Is technology making people less social? Share your opinion.',
    'What changes would you make to the education system in your country?',
    'Do you prefer working alone or in a team? Explain.',
    'Should homework be banned? Give your argument.',
    'What is more important: talent or hard work? Why?',
  ];

  const classes = await env.DB.prepare(
    'SELECT id, group_chat_id FROM classes WHERE group_chat_id IS NOT NULL AND is_active = 1'
  ).all();

  const prompt = prompts[Math.floor(Math.random() * prompts.length)];

  for (const cls of classes.results as any[]) {
    if (!cls.group_chat_id) continue;
    const msg = `Discussion Time!\n\n"${prompt}"\n\nJawab dalam BAHASA INGGRIS (min 2 kalimat). Aku akan koreksi grammar kamu!`;
    await sendToGroup(env, cls.group_chat_id as string, msg);
  }
}

export async function correctGrammarInGroup(env: Env, text: string): Promise<string | null> {
  if (!env.OPENAI_API_KEY || text.length < 10) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [
          { role: 'system', content: 'Koreksi grammar kalimat English berikut. Kalau sudah benar, tulis "Kalimat kamu sudah benar!". Kalau ada error, tulis versi yang benar dan jelaskan 1 baris kenapa. Pakai "kamu". Maks 3 baris.' },
          { role: 'user', content: text },
        ],
      }),
    });
    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

// --- Teams ---

export async function createTeams(env: Env, classId: number, teamSize: number = 4) {
  // Get all students in class
  const students = await env.DB.prepare(
    "SELECT u.id, u.name FROM users u JOIN class_enrollments ce ON u.id = ce.user_id WHERE ce.class_id = ? AND ce.status = 'active'"
  ).bind(classId).all();

  const shuffled = [...students.results].sort(() => Math.random() - 0.5);
  const teams: any[] = [];
  let teamNum = 1;

  for (let i = 0; i < shuffled.length; i += teamSize) {
    const members = shuffled.slice(i, i + teamSize);
    const teamName = `Tim ${teamNum}`;

    const result = await env.DB.prepare(
      'INSERT INTO teams (class_id, name) VALUES (?, ?)'
    ).bind(classId, teamName).run();

    const teamId = result.meta.last_row_id;
    for (const m of members) {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)'
      ).bind(teamId, (m as any).id).run();
    }

    teams.push({ id: teamId, name: teamName, members: members.map((m: any) => m.name) });
    teamNum++;
  }

  return teams;
}

// --- Peer Review ---

export async function submitForPeerReview(env: Env, writerId: number, essayText: string, classId: number | null) {
  await env.DB.prepare(
    'INSERT INTO peer_reviews (class_id, writer_id, essay_text, status) VALUES (?, ?, ?, ?)'
  ).bind(classId, writerId, essayText, 'pending').run();
}

export async function assignPeerReview(env: Env, classId: number): Promise<any | null> {
  // Find unreviewed essay
  const essay = await env.DB.prepare(
    "SELECT * FROM peer_reviews WHERE class_id = ? AND status = 'pending' AND reviewer_id IS NULL ORDER BY created_at ASC LIMIT 1"
  ).bind(classId).first() as any;
  if (!essay) return null;

  // Find a student who isn't the writer
  const reviewer = await env.DB.prepare(
    "SELECT u.id FROM users u JOIN class_enrollments ce ON u.id = ce.user_id WHERE ce.class_id = ? AND u.id != ? ORDER BY RANDOM() LIMIT 1"
  ).bind(classId, essay.writer_id).first() as any;
  if (!reviewer) return null;

  await env.DB.prepare(
    'UPDATE peer_reviews SET reviewer_id = ?, status = ? WHERE id = ?'
  ).bind(reviewer.id, 'assigned', essay.id).run();

  return { reviewId: essay.id, reviewerId: reviewer.id, essayText: essay.essay_text };
}

// --- Helpers ---

function getWeekString(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function sendToGroup(env: Env, groupChatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: groupChatId, text }),
  });
}
