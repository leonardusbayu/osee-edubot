// ═══════════════════════════════════════════════════════
// BOSS BATTLES
// 
// Every 50 XP earned, student faces a "boss battle" —
// a 5-question challenge on their weakest topics.
// Win = bonus XP + coins. Lose = retry with hints.
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export interface BossBattle {
  id: number;
  user_id: number;
  xp_threshold: number;       // XP level when battle was triggered
  questions: string;          // JSON array of question IDs
  current_question: number;   // 0-4
  correct_answers: number;
  status: 'active' | 'won' | 'lost';
  started_at: string;
  completed_at: string | null;
}

/**
 * Check if a user should trigger a boss battle.
 * Called after XP is awarded.
 */
export async function checkBossBattleTrigger(env: Env, userId: number, totalXp: number): Promise<boolean> {
  // Get last boss battle XP threshold
  const lastBattle = await env.DB.prepare(
    `SELECT xp_threshold FROM boss_battles WHERE user_id = ? ORDER BY id DESC LIMIT 1`
  ).bind(userId).first() as any;

  const lastThreshold = lastBattle?.xp_threshold || 0;
  const nextThreshold = Math.floor(totalXp / 50) * 50;

  if (nextThreshold > lastThreshold && nextThreshold > 0) {
    // Trigger boss battle!
    await createBossBattle(env, userId, nextThreshold);
    return true;
  }

  return false;
}

/**
 * Create a new boss battle for a user.
 */
async function createBossBattle(env: Env, userId: number, xpThreshold: number): Promise<void> {
  // Get 5 questions from weakest topics
  const weakTopics = await env.DB.prepare(
    `SELECT topic FROM topic_mastery WHERE user_id = ? AND exercises_attempted >= 3
     ORDER BY accuracy_percent ASC LIMIT 3`
  ).bind(userId).all() as any;

  let questionIds: number[] = [];

  if (weakTopics.results && weakTopics.results.length > 0) {
    for (const topic of weakTopics.results) {
      const questions = await env.DB.prepare(
        `SELECT id FROM test_contents WHERE topic = ? AND status = 'published' ORDER BY RANDOM() LIMIT 2`
      ).bind(topic.topic).all() as any;

      if (questions.results) {
        questionIds.push(...questions.results.map((q: any) => q.id));
      }

      if (questionIds.length >= 5) break;
    }
  }

  // Fallback: random questions if not enough weak topics
  if (questionIds.length < 5) {
    const fallback = await env.DB.prepare(
      `SELECT id FROM test_contents WHERE status = 'published' ORDER BY RANDOM() LIMIT ?`
    ).bind(5 - questionIds.length).all() as any;

    if (fallback.results) {
      questionIds.push(...fallback.results.map((q: any) => q.id));
    }
  }

  if (questionIds.length === 0) return;

  await env.DB.prepare(
    `INSERT INTO boss_battles (user_id, xp_threshold, questions, current_question, correct_answers, status)
     VALUES (?, ?, ?, 0, 0, 'active')`
  ).bind(userId, xpThreshold, JSON.stringify(questionIds.slice(0, 5))).run();
}

/**
 * Get active boss battle for a user.
 */
export async function getActiveBossBattle(env: Env, userId: number): Promise<BossBattle | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM boss_battles WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`
  ).bind(userId).first() as any;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    xp_threshold: row.xp_threshold,
    questions: row.questions,
    current_question: row.current_question,
    correct_answers: row.correct_answers,
    status: row.status,
    started_at: row.started_at,
    completed_at: row.completed_at,
  };
}

/**
 * Submit an answer for the current boss battle question.
 */
export async function submitBossBattleAnswer(
  env: Env,
  userId: number,
  battleId: number,
  wasCorrect: boolean,
): Promise<{ battleComplete: boolean; won: boolean; correctCount: number; totalQuestions: number }> {
  const battle = await getActiveBossBattle(env, userId);
  if (!battle || battle.id !== battleId) {
    return { battleComplete: false, won: false, correctCount: 0, totalQuestions: 5 };
  }

  const questionIds: number[] = JSON.parse(battle.questions);
  const newCorrect = battle.correct_answers + (wasCorrect ? 1 : 0);
  const newQuestionIndex = battle.current_question + 1;

  // Check if battle is complete (all 5 questions answered)
  if (newQuestionIndex >= 5) {
    const won = newCorrect >= 3; // Need 3/5 to win
    await env.DB.prepare(
      `UPDATE boss_battles SET correct_answers = ?, current_question = ?,
         status = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(newCorrect, newQuestionIndex, won ? 'won' : 'lost', battleId).run();

    return {
      battleComplete: true,
      won,
      correctCount: newCorrect,
      totalQuestions: 5,
    };
  }

  // Update progress
  await env.DB.prepare(
    `UPDATE boss_battles SET correct_answers = ?, current_question = ? WHERE id = ?`
  ).bind(newCorrect, newQuestionIndex, battleId).run();

  return {
    battleComplete: false,
    won: false,
    correctCount: newCorrect,
    totalQuestions: 5,
  };
}

/**
 * Format boss battle intro message.
 */
export function formatBossBattleIntro(xpThreshold: number): string {
  return `⚔️ BOSS BATTLE! ⚔️\n\nKamu udah capai ${xpThreshold} XP — waktunya hadapi Boss!\n\n5 soal dari topik terlemah kamu. Jawab 3/5 benar untuk menang!\n\nHadiah: +50 XP bonus + 100 koin 🎁\n\nSiap? Kirim "siap" untuk mulai!`;
}

/**
 * Format boss battle result message.
 */
export function formatBossBattleResult(won: boolean, correct: number, total: number): string {
  if (won) {
    return `🎉 BOSS DEFEATED!\n\nKamu jawab ${correct}/${total} benar!\n\n+50 XP bonus\n+100 koin\n\nKeren banget! Boss berikutnya di ${Math.floor((correct + 50) / 50) * 50 + 50} XP. 💪`;
  } else {
    return `💀 Boss terlalu kuat...\n\nKamu jawab ${correct}/${total} benar (butuh 3).\n\nNggak apa-apa — latihan lagi dan coba lagi. Boss akan muncul lagi nanti. 🔥`;
  }
}
