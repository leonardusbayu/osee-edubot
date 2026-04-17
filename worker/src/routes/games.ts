// Mini-game API routes: Speed Drill, Wordle, Gap-Fill, Gamification profile.

import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { awardXp, getGamificationProfile, ensureDailyQuests } from '../services/gamification';
import { spendCoins } from '../services/coins';
import { getLeagueProfile, getLeagueLeaderboard } from '../services/leagues';

export const gameRoutes = new Hono<{ Bindings: Env }>();

// ─── Gamification Profile ─────────────────────────────────────

// GET /api/games/profile — full gamification state
gameRoutes.get('/profile', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  await ensureDailyQuests(c.env, user.id);
  const profile = await getGamificationProfile(c.env, user.id);
  return c.json(profile);
});

// GET /api/games/leaderboard?game_type=speed_drill&period=week
gameRoutes.get('/leaderboard', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const gameType = c.req.query('game_type') || 'speed_drill';
  const period = c.req.query('period') || 'week';
  let limit = parseInt(c.req.query('limit') || '20');
  if (isNaN(limit) || limit < 1) limit = 20;
  limit = Math.min(50, limit);

  const dateFilter = period === 'day' ? '-1 day' : period === 'month' ? '-30 days' : '-7 days';

  const { results } = await c.env.DB.prepare(
    `SELECT gs.user_id, u.full_name, u.username,
            MAX(gs.score) AS best_score,
            COUNT(*) AS games_played,
            SUM(gs.xp_earned) AS total_xp_earned
       FROM game_scores gs
       JOIN users u ON u.id = gs.user_id
      WHERE gs.game_type = ?
        AND gs.created_at > datetime('now', ?)
      GROUP BY gs.user_id
      ORDER BY best_score DESC
      LIMIT ?`,
  ).bind(gameType, dateFilter, limit).all<any>();

  // Find current user's rank
  const myBest = await c.env.DB.prepare(
    `SELECT MAX(score) AS best FROM game_scores
      WHERE user_id = ? AND game_type = ? AND created_at > datetime('now', ?)`,
  ).bind(user.id, gameType, dateFilter).first<{ best: number | null }>();

  return c.json({
    game_type: gameType,
    period,
    leaderboard: results || [],
    my_best: myBest?.best || 0,
  });
});

// ─── Speed Vocabulary Drill ───────────────────────────────────

// GET /api/games/speed-drill/start?count=10 — get drill words
gameRoutes.get('/speed-drill/start', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let count = parseInt(c.req.query('count') || '10');
  if (isNaN(count) || count < 1) count = 10;
  count = Math.min(20, Math.max(5, count));
  const testType = c.req.query('test_type') || user.target_test || 'TOEFL_IBT';

  // Pull vocabulary items from test_contents — we look for questions with
  // short answer options (vocabulary-style). If not enough, we fall back to
  // any MCQ question and treat option_a as a "definition".
  const { results: items } = await c.env.DB.prepare(
    `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer, section
       FROM test_contents
      WHERE test_type = ? AND status = 'published'
        AND section IN ('reading', 'vocabulary', 'structure')
        AND option_a IS NOT NULL AND option_b IS NOT NULL
      ORDER BY RANDOM()
      LIMIT ?`,
  ).bind(testType, count * 2).all<any>(); // fetch extra for distractor pool

  if (!items?.length || items.length < count) {
    return c.json({ error: 'Not enough vocabulary content', available: items?.length || 0 }, 400);
  }

  // Build drill items: each has a "word/phrase" (from question_text) and
  // the correct answer + 3 distractors from other items
  const drillItems: Array<{
    id: number;
    prompt: string;
    options: string[];
    correct_index: number;
  }> = [];

  const selected = items.slice(0, count);
  const allOptions = items.map((i: any) => {
    const key = (i.correct_answer || 'A').toUpperCase();
    const optMap: Record<string, string> = { A: i.option_a, B: i.option_b, C: i.option_c, D: i.option_d };
    return optMap[key] || i.option_a;
  });

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i] as any;
    const correctKey = (item.correct_answer || 'A').toUpperCase();
    const optMap: Record<string, string> = { A: item.option_a, B: item.option_b, C: item.option_c, D: item.option_d };
    const correctAnswer = optMap[correctKey] || item.option_a;

    // Pick 3 random distractors from other items' correct answers
    const distractors: string[] = [];
    const shuffledOpts = [...allOptions].sort(() => Math.random() - 0.5);
    for (const opt of shuffledOpts) {
      if (opt !== correctAnswer && distractors.length < 3) {
        distractors.push(opt);
      }
    }
    // If not enough distractors, use the item's own wrong options
    const wrongOpts = [item.option_a, item.option_b, item.option_c, item.option_d].filter(
      (o: string) => o && o !== correctAnswer,
    );
    while (distractors.length < 3 && wrongOpts.length > 0) {
      distractors.push(wrongOpts.pop()!);
    }

    // Shuffle options and find correct index
    const options = [correctAnswer, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correctAnswer);

    // Truncate question for speed-drill display
    const prompt = (item.question_text || '').length > 120
      ? item.question_text.substring(0, 120) + '…'
      : item.question_text || 'Choose the correct answer';

    drillItems.push({
      id: item.id,
      prompt,
      options,
      correct_index: correctIndex,
    });
  }

  return c.json({
    game_type: 'speed_drill',
    item_count: drillItems.length,
    time_limit_seconds: 60,
    items: drillItems,
  });
});

// POST /api/games/speed-drill/finish — submit drill results
gameRoutes.post('/speed-drill/finish', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const { correct_count, total_count, time_seconds, answers } = body;

  if (typeof correct_count !== 'number' || typeof total_count !== 'number') {
    return c.json({ error: 'Missing correct_count / total_count' }, 400);
  }

  // Score formula: base points + speed bonus + streak bonus
  const accuracy = total_count > 0 ? correct_count / total_count : 0;
  const baseScore = correct_count * 100;
  const timeBonus = Math.max(0, Math.round((60 - (time_seconds || 60)) * 5));
  const streakBonus = Math.round(accuracy >= 0.8 ? correct_count * 20 : 0);
  const totalScore = baseScore + timeBonus + streakBonus;

  // Store game score
  await c.env.DB.prepare(
    `INSERT INTO game_scores (user_id, game_type, score, time_seconds, correct_count, total_count, streak_bonus, metadata, xp_earned)
     VALUES (?, 'speed_drill', ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    user.id, totalScore, time_seconds || null, correct_count, total_count,
    streakBonus, JSON.stringify({ answers: answers || [] }),
    0, // will be set after awardXp
  ).run();

  // Award XP based on performance (scales with accuracy: 0%→5 XP, 100%→35 XP)
  const xpAmount = Math.round(5 + accuracy * 30 + (totalScore > 500 ? 10 : 0));
  const xpResult = await awardXp(c.env, user.id, 'speed_drill', {
    amount: xpAmount,
    detail: `score=${totalScore} correct=${correct_count}/${total_count}`,
  });

  return c.json({
    score: totalScore,
    base_score: baseScore,
    time_bonus: timeBonus,
    streak_bonus: streakBonus,
    accuracy: Math.round(accuracy * 100),
    ...xpResult,
  });
});

// ─── Wordle-style Word Game ─────────────────────────────────────

// GET /api/games/wordle/today — get today's word
gameRoutes.get('/wordle/today', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  // Deterministic daily word based on date seed (WIB timezone)
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const today = now.toISOString().slice(0, 10);
  const seed = today.split('-').reduce((s, n) => s + parseInt(n), 0);

  // TOEFL/IELTS vocabulary words (5-7 letters, common in academic English)
  const WORD_BANK = [
    'focus', 'adapt', 'brief', 'claim', 'draft', 'grant', 'hence', 'infer',
    'major', 'occur', 'prior', 'quote', 'range', 'scope', 'trend', 'valid',
    'yield', 'amend', 'bloom', 'grasp', 'novel', 'rigid', 'surge', 'urban',
    'vital', 'alter', 'boost', 'chief', 'dense', 'equip', 'fleet', 'globe',
    'harsh', 'labor', 'merit', 'phase', 'rapid', 'shift', 'theme', 'unity',
    'asset', 'broad', 'civic', 'dwell', 'elite', 'forum', 'imply', 'logic',
    'moral', 'panel', 'relay', 'stark', 'toxic', 'vigor', 'worth', 'acute',
    'blend', 'craft', 'decay', 'exile', 'fiber', 'haven', 'issue', 'legal',
    'model', 'nerve', 'onset', 'prime', 'reign', 'steep', 'trace', 'venue',
  ];

  const word = WORD_BANK[seed % WORD_BANK.length];

  // Check if user already played today
  const played = await c.env.DB.prepare(
    `SELECT id, score FROM game_scores
      WHERE user_id = ? AND game_type = 'wordle' AND created_at > datetime('now', '-24 hours')
      ORDER BY created_at DESC LIMIT 1`,
  ).bind(user.id).first<any>();

  return c.json({
    word_length: word.length,
    max_guesses: 6,
    already_played: !!played,
    previous_score: played?.score || null,
    date: today,
    // Don't send the word! Client validates guesses via /check endpoint
  });
});

// POST /api/games/wordle/check — check a guess
gameRoutes.post('/wordle/check', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { guess } = await c.req.json();
  if (!guess || typeof guess !== 'string') return c.json({ error: 'Missing guess' }, 400);

  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const today = now.toISOString().slice(0, 10);
  const seed = today.split('-').reduce((s, n) => s + parseInt(n), 0);
  const WORD_BANK = [
    'focus', 'adapt', 'brief', 'claim', 'draft', 'grant', 'hence', 'infer',
    'major', 'occur', 'prior', 'quote', 'range', 'scope', 'trend', 'valid',
    'yield', 'amend', 'bloom', 'grasp', 'novel', 'rigid', 'surge', 'urban',
    'vital', 'alter', 'boost', 'chief', 'dense', 'equip', 'fleet', 'globe',
    'harsh', 'labor', 'merit', 'phase', 'rapid', 'shift', 'theme', 'unity',
    'asset', 'broad', 'civic', 'dwell', 'elite', 'forum', 'imply', 'logic',
    'moral', 'panel', 'relay', 'stark', 'toxic', 'vigor', 'worth', 'acute',
    'blend', 'craft', 'decay', 'exile', 'fiber', 'haven', 'issue', 'legal',
    'model', 'nerve', 'onset', 'prime', 'reign', 'steep', 'trace', 'venue',
  ];
  const word = WORD_BANK[seed % WORD_BANK.length];
  const g = guess.toLowerCase().trim();

  if (g.length !== word.length) {
    return c.json({ error: `Guess must be ${word.length} letters` }, 400);
  }

  // Generate result: 'correct', 'present', 'absent' per letter
  const result: Array<{ letter: string; status: 'correct' | 'present' | 'absent' }> = [];
  const wordChars = word.split('');
  const used = new Array(word.length).fill(false);

  // First pass: exact matches
  for (let i = 0; i < g.length; i++) {
    if (g[i] === wordChars[i]) {
      result.push({ letter: g[i], status: 'correct' });
      used[i] = true;
    } else {
      result.push({ letter: g[i], status: 'absent' });
    }
  }

  // Second pass: present but wrong position
  for (let i = 0; i < g.length; i++) {
    if (result[i].status === 'correct') continue;
    for (let j = 0; j < wordChars.length; j++) {
      if (!used[j] && g[i] === wordChars[j]) {
        result[i].status = 'present';
        used[j] = true;
        break;
      }
    }
  }

  const isWin = g === word;

  return c.json({
    result,
    is_correct: isWin,
    word: isWin ? word : undefined, // only reveal on win
  });
});

// POST /api/games/wordle/finish — record wordle result
gameRoutes.post('/wordle/finish', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { won, guesses_used } = await c.req.json();
  const score = won ? Math.max(100, 700 - (guesses_used - 1) * 100) : 0;

  await c.env.DB.prepare(
    `INSERT INTO game_scores (user_id, game_type, score, correct_count, total_count, metadata, xp_earned)
     VALUES (?, 'wordle', ?, ?, ?, ?, 0)`,
  ).bind(user.id, score, won ? 1 : 0, guesses_used || 6,
         JSON.stringify({ won, guesses_used })).run();

  if (won) {
    const xpResult = await awardXp(c.env, user.id, 'wordle_win', {
      detail: `guesses=${guesses_used}`,
    });
    return c.json({ score, ...xpResult });
  }

  return c.json({ score, xp_earned: 0 });
});

// ─── XP award endpoint for other activities ─────────────────────

// ─── Listening Gap-Fill Game ─────────────────────────────────────

// GET /api/games/gap-fill/start?count=5 — get gap-fill items from listening content
gameRoutes.get('/gap-fill/start', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let count = parseInt(c.req.query('count') || '5');
  if (isNaN(count) || count < 1) count = 5;
  count = Math.min(10, Math.max(3, count));
  const testType = c.req.query('test_type') || user.target_test || 'TOEFL_IBT';
  const difficulty = c.req.query('difficulty') || 'medium'; // easy=3blanks, medium=4, hard=5

  // Pull listening-section content with passage_text (the transcript)
  const { results: items } = await c.env.DB.prepare(
    `SELECT id, passage_text, question_text, correct_answer, option_a, option_b, option_c, option_d
       FROM test_contents
      WHERE test_type = ? AND status = 'published'
        AND section = 'listening'
        AND passage_text IS NOT NULL AND LENGTH(passage_text) > 50
      ORDER BY RANDOM()
      LIMIT ?`,
  ).bind(testType, count).all<any>();

  if (!items?.length) {
    return c.json({ error: 'Not enough listening content', available: 0 }, 400);
  }

  const blanksPerItem = difficulty === 'easy' ? 3 : difficulty === 'hard' ? 5 : 4;

  const gapItems: Array<{
    id: number;
    transcript_with_gaps: string;
    blanked_words: Array<{ index: number; word: string; options: string[] }>;
    question: string;
  }> = [];

  for (const item of items) {
    const text = (item as any).passage_text as string;
    const words = text.split(/\s+/);
    if (words.length < 20) continue;

    // Pick words to blank — skip short words, articles, prepositions
    const SKIP = new Set(['a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'but', 'for', 'it', 'he', 'she', 'we', 'they', 'i']);
    const candidates: number[] = [];
    for (let i = 0; i < words.length; i++) {
      const clean = words[i].replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (clean.length >= 4 && !SKIP.has(clean)) {
        candidates.push(i);
      }
    }

    // Shuffle and pick blanks with minimum spacing
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const blanked: number[] = [];
    for (const idx of shuffled) {
      if (blanked.length >= blanksPerItem) break;
      // Ensure blanks aren't adjacent
      if (blanked.every(b => Math.abs(b - idx) >= 3)) {
        blanked.push(idx);
      }
    }
    blanked.sort((a, b) => a - b);

    if (blanked.length < 2) continue;

    // Build transcript with gaps and word options
    const gappedWords = [...words];
    const blankedEntries: Array<{ index: number; word: string; options: string[] }> = [];

    for (const idx of blanked) {
      const original = words[idx].replace(/[^a-zA-Z']/g, '');
      // Generate distractors from nearby words
      const distractorPool = candidates
        .filter(c => !blanked.includes(c))
        .map(c => words[c].replace(/[^a-zA-Z']/g, ''))
        .filter(w => w.length >= 3 && w.toLowerCase() !== original.toLowerCase());
      const distractors = distractorPool.sort(() => Math.random() - 0.5).slice(0, 3);
      while (distractors.length < 3) {
        distractors.push(words[Math.floor(Math.random() * words.length)].replace(/[^a-zA-Z']/g, '') || 'word');
      }

      const options = [original, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
      blankedEntries.push({ index: idx, word: original, options });
      gappedWords[idx] = `___[${blankedEntries.length}]___`;
    }

    gapItems.push({
      id: (item as any).id,
      transcript_with_gaps: gappedWords.join(' '),
      blanked_words: blankedEntries,
      question: (item as any).question_text || '',
    });
  }

  return c.json({
    game_type: 'gap_fill',
    difficulty,
    item_count: gapItems.length,
    items: gapItems,
  });
});

// POST /api/games/gap-fill/finish — submit gap-fill results
gameRoutes.post('/gap-fill/finish', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { correct_count, total_count, time_seconds, difficulty } = await c.req.json();
  if (typeof correct_count !== 'number' || typeof total_count !== 'number') {
    return c.json({ error: 'Missing counts' }, 400);
  }

  const accuracy = total_count > 0 ? correct_count / total_count : 0;
  const diffMultiplier = difficulty === 'hard' ? 1.5 : difficulty === 'easy' ? 0.8 : 1.0;
  const score = Math.round(correct_count * 120 * diffMultiplier);

  await c.env.DB.prepare(
    `INSERT INTO game_scores (user_id, game_type, score, time_seconds, correct_count, total_count, metadata, xp_earned)
     VALUES (?, 'gap_fill', ?, ?, ?, ?, ?, 0)`,
  ).bind(user.id, score, time_seconds || null, correct_count, total_count,
         JSON.stringify({ difficulty })).run();

  const xpAmount = Math.round(15 + accuracy * 15);
  const xpResult = await awardXp(c.env, user.id, 'gap_fill', {
    amount: xpAmount,
    detail: `score=${score} ${difficulty} correct=${correct_count}/${total_count}`,
  });

  return c.json({ score, accuracy: Math.round(accuracy * 100), ...xpResult });
});

// POST /api/games/xp — generic XP award (called by other services)
gameRoutes.post('/xp', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { source, amount, detail } = await c.req.json();
  if (!source) return c.json({ error: 'Missing source' }, 400);

  const result = await awardXp(c.env, user.id, source, { amount, detail });
  return c.json(result);
});

// ─── Coin Shop ──────────────────────────────────────────────────

// GET /api/games/shop — list shop items + user coins
gameRoutes.get('/shop', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { results: items } = await c.env.DB.prepare(
    `SELECT * FROM coin_shop WHERE active = 1`,
  ).all();
  const xp = await c.env.DB.prepare(
    `SELECT coins FROM user_xp WHERE user_id = ?`,
  ).bind(user.id).first<{ coins: number }>();

  return c.json({ coins: Number(xp?.coins || 0), items: items || [] });
});

// POST /api/games/shop/buy — purchase shop item
gameRoutes.post('/shop/buy', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { item_id } = await c.req.json();
  const item = await c.env.DB.prepare(
    `SELECT * FROM coin_shop WHERE id = ? AND active = 1`,
  ).bind(item_id).first<any>();
  if (!item) return c.json({ error: 'Item not found' }, 404);

  const result = await spendCoins(c.env, user.id, item.price, 'shop_purchase', item.id);
  if (!result.success) return c.json({ error: 'Koin tidak cukup', coins: result.total_coins, price: item.price }, 400);

  // Apply effect
  if (item.effect_type === 'streak_freeze') {
    await c.env.DB.prepare(
      `UPDATE user_xp SET streak_freezes = COALESCE(streak_freezes, 0) + ? WHERE user_id = ?`,
    ).bind(parseInt(item.effect_value), user.id).run();
  } else if (item.effect_type === 'extra_questions') {
    await c.env.DB.prepare(
      `INSERT INTO referral_bonus_quota (user_id, bonus_questions, reason)
       VALUES (?, ?, 'coin_shop_purchase')
       ON CONFLICT(user_id) DO UPDATE SET bonus_questions = bonus_questions + ?`,
    ).bind(user.id, parseInt(item.effect_value), parseInt(item.effect_value)).run();
  }

  return c.json({ ok: true, item: item.name, coins_remaining: result.total_coins });
});

// ─── Leagues ────────────────────────────────────────────────────

// GET /api/games/league — current user league + rank
gameRoutes.get('/league', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const profile = await getLeagueProfile(c.env, user.id);
  return c.json(profile);
});

// GET /api/games/league/leaderboard?league=gold
gameRoutes.get('/league/leaderboard', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const league = c.req.query('league') || 'bronze';
  const lb = await getLeagueLeaderboard(c.env, league, 20);
  return c.json({ league, leaderboard: lb });
});

// ─── Friend Quests ──────────────────────────────────────────────

// POST /api/games/friend-quest/create
gameRoutes.post('/friend-quest/create', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { partner_ids, quest_type, target_value, days } = await c.req.json();
  if (!partner_ids?.length || !quest_type || !target_value) {
    return c.json({ error: 'Missing partner_ids, quest_type, target_value' }, 400);
  }

  const deadline = new Date(Date.now() + (days || 7) * 86400000).toISOString();
  const insert = await c.env.DB.prepare(
    `INSERT INTO friend_quests (creator_id, quest_type, target_value, deadline, reward_coins)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(user.id, quest_type, target_value, deadline, 100).run();
  const questId = (insert as any).meta?.last_row_id;

  // Add creator + partners
  const allIds = [user.id, ...partner_ids.slice(0, 3)];
  for (const uid of allIds) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO friend_quest_members (quest_id, user_id) VALUES (?, ?)`,
    ).bind(questId, uid).run();
  }

  return c.json({ ok: true, quest_id: questId, members: allIds.length, deadline });
});

// GET /api/games/friend-quest/active
gameRoutes.get('/friend-quest/active', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT fq.*, fqm.current_value, fqm.completed
       FROM friend_quests fq
       JOIN friend_quest_members fqm ON fqm.quest_id = fq.id
      WHERE fqm.user_id = ? AND fq.status = 'active'
      ORDER BY fq.deadline`,
  ).bind(user.id).all<any>();

  // For each quest, get all members' progress
  const quests = [];
  for (const q of results || []) {
    const { results: members } = await c.env.DB.prepare(
      `SELECT fqm.*, u.full_name, u.username
         FROM friend_quest_members fqm JOIN users u ON u.id = fqm.user_id
        WHERE fqm.quest_id = ?`,
    ).bind(q.id).all<any>();
    quests.push({ ...q, members: members || [] });
  }

  return c.json({ quests });
});

// ─── Drag the Words (#8) ────────────────────────────────────────

// GET /api/games/drag-words/start?count=5
gameRoutes.get('/drag-words/start', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let count = parseInt(c.req.query('count') || '5');
  if (isNaN(count) || count < 1) count = 5;
  count = Math.min(10, Math.max(3, count));
  const testType = c.req.query('test_type') || user.target_test || 'TOEFL_IBT';

  // Pull sentences from passage_text of reading/structure content
  const { results: items } = await c.env.DB.prepare(
    `SELECT id, passage_text, question_text
       FROM test_contents
      WHERE test_type = ? AND status = 'published'
        AND section IN ('reading', 'structure', 'grammar')
        AND passage_text IS NOT NULL AND LENGTH(passage_text) > 30
      ORDER BY RANDOM() LIMIT ?`,
  ).bind(testType, count * 3).all<any>();

  const exercises: Array<{
    id: number;
    scrambled_words: string[];
    correct_order: string[];
    hint: string;
  }> = [];

  for (const item of items || []) {
    if (exercises.length >= count) break;
    const text = ((item as any).passage_text as string) || '';
    // Extract a sentence (first sentence between 5-15 words)
    const sentences = text.split(/[.!?]/).map(s => s.trim()).filter(s => {
      const wc = s.split(/\s+/).length;
      return wc >= 5 && wc <= 15;
    });
    if (!sentences.length) continue;

    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    const words = sentence.split(/\s+/);
    const correct = [...words];
    const scrambled = [...words].sort(() => Math.random() - 0.5);

    // Don't use if scrambled happens to match correct
    if (scrambled.join(' ') === correct.join(' ')) {
      // Swap first two
      if (scrambled.length >= 2) [scrambled[0], scrambled[1]] = [scrambled[1], scrambled[0]];
    }

    exercises.push({
      id: (item as any).id,
      scrambled_words: scrambled,
      correct_order: correct,
      hint: (item as any).question_text || 'Arrange the words in correct order',
    });
  }

  return c.json({ game_type: 'drag_words', item_count: exercises.length, items: exercises });
});

// POST /api/games/drag-words/finish
gameRoutes.post('/drag-words/finish', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { correct_count, total_count, time_seconds } = await c.req.json();
  const accuracy = total_count > 0 ? correct_count / total_count : 0;
  const score = Math.round(correct_count * 150);

  await c.env.DB.prepare(
    `INSERT INTO game_scores (user_id, game_type, score, time_seconds, correct_count, total_count, xp_earned)
     VALUES (?, 'drag_words', ?, ?, ?, ?, 0)`,
  ).bind(user.id, score, time_seconds || null, correct_count, total_count).run();

  const xpResult = await awardXp(c.env, user.id, 'speed_drill', {
    amount: Math.round(10 + accuracy * 20),
    detail: `drag_words score=${score}`,
  });

  return c.json({ score, accuracy: Math.round(accuracy * 100), ...xpResult });
});

// ─── Dictation Mode (#9) ────────────────────────────────────────

// GET /api/games/dictation/start?count=5
gameRoutes.get('/dictation/start', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let count = parseInt(c.req.query('count') || '5');
  if (isNaN(count) || count < 1) count = 5;
  count = Math.min(10, Math.max(3, count));
  const testType = c.req.query('test_type') || user.target_test || 'TOEFL_IBT';

  // Use listening content that has passage_text as the transcript
  const { results: items } = await c.env.DB.prepare(
    `SELECT id, passage_text
       FROM test_contents
      WHERE test_type = ? AND status = 'published'
        AND section = 'listening'
        AND passage_text IS NOT NULL AND LENGTH(passage_text) > 30
      ORDER BY RANDOM() LIMIT ?`,
  ).bind(testType, count).all<any>();

  const exercises: Array<{
    id: number;
    sentence: string;             // the correct text (hidden from student initially)
    word_count: number;
    tts_text: string;             // text to send to TTS for audio generation
  }> = [];

  for (const item of items || []) {
    const text = ((item as any).passage_text as string) || '';
    const sentences = text.split(/[.!?]/).map(s => s.trim()).filter(s => {
      const wc = s.split(/\s+/).length;
      return wc >= 5 && wc <= 20;
    });
    if (!sentences.length) continue;

    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    exercises.push({
      id: (item as any).id,
      sentence, // frontend should NOT display this until after submission
      word_count: sentence.split(/\s+/).length,
      tts_text: sentence,
    });
    if (exercises.length >= count) break;
  }

  return c.json({ game_type: 'dictation', item_count: exercises.length, items: exercises });
});

// POST /api/games/dictation/check — compare student transcription vs original
gameRoutes.post('/dictation/check', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { original, typed } = await c.req.json();
  if (!original || !typed) return c.json({ error: 'Missing original or typed' }, 400);

  const origWords = original.toLowerCase().replace(/[^a-z'\s]/g, '').split(/\s+/).filter(Boolean);
  const typedWords = typed.toLowerCase().replace(/[^a-z'\s]/g, '').split(/\s+/).filter(Boolean);

  // Word-by-word comparison
  const results: Array<{ expected: string; got: string; correct: boolean }> = [];
  let correctCount = 0;

  for (let i = 0; i < origWords.length; i++) {
    const expected = origWords[i];
    const got = typedWords[i] || '';
    const isCorrect = expected === got;
    if (isCorrect) correctCount++;
    results.push({ expected, got, correct: isCorrect });
  }

  const accuracy = origWords.length > 0 ? correctCount / origWords.length : 0;

  return c.json({
    correct_count: correctCount,
    total_words: origWords.length,
    accuracy: Math.round(accuracy * 100),
    word_results: results,
  });
});

// POST /api/games/dictation/finish
gameRoutes.post('/dictation/finish', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { correct_count, total_count, time_seconds } = await c.req.json();
  const accuracy = total_count > 0 ? correct_count / total_count : 0;
  const score = Math.round(correct_count * 80 + accuracy * 200);

  await c.env.DB.prepare(
    `INSERT INTO game_scores (user_id, game_type, score, time_seconds, correct_count, total_count, xp_earned)
     VALUES (?, 'dictation', ?, ?, ?, ?, 0)`,
  ).bind(user.id, score, time_seconds || null, correct_count, total_count).run();

  const xpResult = await awardXp(c.env, user.id, 'speed_drill', {
    amount: Math.round(12 + accuracy * 18),
    detail: `dictation score=${score}`,
  });
  return c.json({ score, accuracy: Math.round(accuracy * 100), ...xpResult });
});

// ─── Mark the Words (#10) ───────────────────────────────────────

// GET /api/games/mark-words/start?count=5
gameRoutes.get('/mark-words/start', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let count = parseInt(c.req.query('count') || '5');
  if (isNaN(count) || count < 1) count = 5;
  count = Math.min(10, Math.max(3, count));
  const testType = c.req.query('test_type') || user.target_test || 'TOEFL_IBT';

  // Criteria types for marking exercises
  const CRITERIA = [
    { label: 'Tandai semua kata kerja (verbs)', pattern: /\b(is|am|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|may|might|can|could|must|need|go|goes|went|come|came|take|took|make|made|give|gave|get|got|know|knew|think|thought|see|saw|find|found|say|said|tell|told|ask|asked|use|used|try|tried|leave|left|call|called|keep|kept|let|show|showed|begin|began|seem|help|helped|talk|talked|turn|turned|start|started|run|ran|move|moved|live|lived|believe|believed|bring|brought|happen|happened|write|wrote|provide|provided|sit|sat|stand|stood|lose|lost|pay|paid|meet|met|include|included|continue|continued|set|learn|learned|change|changed|lead|led|understand|understood|watch|watched|follow|followed|stop|stopped|create|created|speak|spoke|read|allow|allowed|add|added|spend|spent|grow|grew|open|opened|walk|walked|win|won|offer|offered|remember|remembered|consider|considered|appear|appeared|buy|bought|serve|served|die|died|send|sent|build|built|stay|stayed|fall|fell|cut|reach|reached|kill|killed|remain|remained|suggest|suggested|raise|raised|pass|passed|sell|sold|require|required|report|reported|decide|decided|pull|pulled|develop|developed|describe|described)\b/gi },
    { label: 'Tandai semua kata sifat (adjectives)', pattern: /\b(good|great|new|old|big|small|long|short|high|low|young|important|different|large|local|social|possible|real|hard|early|major|better|best|free|strong|special|difficult|certain|clear|full|close|recent|likely|natural|similar|hot|cold|dark|light|fast|slow|easy|happy|sad|rich|poor|beautiful|simple|single|whole|particular|available|political|economic|public|human|international|general|physical|environmental|financial|medical|basic|current|serious|traditional|cultural|common|individual|national|legal|military|significant|successful|popular|foreign|professional|personal|wide|deep|additional|necessary|critical|primary|final|complex|private|entire|various|potential|previous|present|original|usual|typical|positive|negative|effective|appropriate|independent|capable|ancient|commercial|scientific|modern|industrial|existing|massive|academic|digital|competitive|relevant|alternative|specific|substantial|familiar|sufficient|regional|technical)\b/gi },
    { label: 'Tandai semua linking words/transitions', pattern: /\b(however|moreover|furthermore|therefore|consequently|meanwhile|nevertheless|nonetheless|although|whereas|while|despite|besides|additionally|similarly|likewise|conversely|alternatively|subsequently|accordingly|hence|thus|otherwise|instead|indeed|certainly|specifically|particularly|especially|notably|significantly|ultimately|essentially|basically|primarily|initially|finally|eventually|previously|currently|recently|frequently|occasionally|rarely|merely|simply|apparently|presumably|approximately|relatively|virtually)\b/gi },
  ];

  const { results: items } = await c.env.DB.prepare(
    `SELECT id, passage_text
       FROM test_contents
      WHERE test_type = ? AND status = 'published'
        AND section = 'reading'
        AND passage_text IS NOT NULL AND LENGTH(passage_text) > 100
      ORDER BY RANDOM() LIMIT ?`,
  ).bind(testType, count).all<any>();

  const exercises: Array<{
    id: number;
    passage: string;
    criteria: string;
    correct_words: Array<{ word: string; index: number }>;
  }> = [];

  for (const item of items || []) {
    if (exercises.length >= count) break;
    const text = ((item as any).passage_text as string) || '';
    // Take first ~100 words
    const words = text.split(/\s+/).slice(0, 100);
    const passage = words.join(' ');

    const criterion = CRITERIA[Math.floor(Math.random() * CRITERIA.length)];
    const correctWords: Array<{ word: string; index: number }> = [];

    for (let i = 0; i < words.length; i++) {
      const clean = words[i].replace(/[^a-zA-Z]/g, '');
      if (criterion.pattern.test(clean)) {
        correctWords.push({ word: clean, index: i });
      }
      criterion.pattern.lastIndex = 0; // reset regex
    }

    if (correctWords.length >= 3) {
      exercises.push({
        id: (item as any).id,
        passage,
        criteria: criterion.label,
        correct_words: correctWords,
      });
    }
  }

  return c.json({ game_type: 'mark_words', item_count: exercises.length, items: exercises });
});

// POST /api/games/mark-words/finish
gameRoutes.post('/mark-words/finish', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { correct_count, total_count, time_seconds } = await c.req.json();
  const accuracy = total_count > 0 ? correct_count / total_count : 0;
  const score = Math.round(correct_count * 100 + accuracy * 150);

  await c.env.DB.prepare(
    `INSERT INTO game_scores (user_id, game_type, score, time_seconds, correct_count, total_count, xp_earned)
     VALUES (?, 'mark_words', ?, ?, ?, ?, 0)`,
  ).bind(user.id, score, time_seconds || null, correct_count, total_count).run();

  const xpResult = await awardXp(c.env, user.id, 'speed_drill', {
    amount: Math.round(10 + accuracy * 15),
    detail: `mark_words score=${score}`,
  });
  return c.json({ score, accuracy: Math.round(accuracy * 100), ...xpResult });
});

// ─── Heatmap (#12) ──────────────────────────────────────────────

// GET /api/games/heatmap?weeks=52 — activity heatmap data
gameRoutes.get('/heatmap', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let weeks = parseInt(c.req.query('weeks') || '26');
  if (isNaN(weeks) || weeks < 1) weeks = 26;
  weeks = Math.min(52, weeks);
  const daysBack = weeks * 7;

  const { results } = await c.env.DB.prepare(
    `SELECT DATE(created_at) AS day, SUM(amount) AS xp
       FROM xp_log
      WHERE user_id = ? AND created_at > datetime('now', ?)
      GROUP BY DATE(created_at)
      ORDER BY day`,
  ).bind(user.id, `-${daysBack} days`).all<any>();

  // Build full date grid
  const grid: Array<{ date: string; xp: number; intensity: number }> = [];
  const xpMap = new Map<string, number>();
  for (const r of results || []) xpMap.set(r.day as string, Number(r.xp || 0));

  const now = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const xp = xpMap.get(dateStr) || 0;
    // Intensity: 0=none, 1=light, 2=medium, 3=heavy, 4=extreme
    const intensity = xp === 0 ? 0 : xp < 30 ? 1 : xp < 80 ? 2 : xp < 200 ? 3 : 4;
    grid.push({ date: dateStr, xp, intensity });
  }

  return c.json({ weeks, grid, total_active_days: (results || []).length });
});
