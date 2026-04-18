// Friend quest progress engine.
//
// Called from awardXp() so every XP-earning activity automatically advances
// relevant quests. Quest types map to events:
//   'complete_questions' ← any question_correct / question_wrong
//   'earn_xp'            ← any xp earned (uses the xp amount as the delta)
//   'speaking_drills'    ← speaking_complete source
//   'streak_days'        ← advanced separately by the streak milestone cron
//                          (not wired here because streaks update once/day,
//                          not per-action)
//
// When a member's current_value reaches the quest's target_value, we flip
// their completed flag and grant the coin reward. A quest with multiple
// members completes when ALL members finish (or when deadline hits, handled
// by a separate cleanup cron — deferred for now since deadlines are 7d+).
//
// Tracks P2 BUGS.md #11 — previously friend_quest_members.current_value
// was never incremented, so quests could be created but never completed.

import type { Env } from '../types';
import { earnCoins } from './coins';

type QuestEventType = 'complete_questions' | 'earn_xp' | 'speaking_drills' | 'streak_days';

const SOURCE_TO_EVENTS: Record<string, Array<{ type: QuestEventType; delta: (xp: number) => number }>> = {
  question_correct: [
    { type: 'complete_questions', delta: () => 1 },
    { type: 'earn_xp', delta: (xp) => xp },
  ],
  question_wrong: [
    { type: 'complete_questions', delta: () => 1 },
    { type: 'earn_xp', delta: (xp) => xp },
  ],
  speaking_complete: [
    { type: 'speaking_drills', delta: () => 1 },
    { type: 'earn_xp', delta: (xp) => xp },
  ],
  writing_complete: [
    { type: 'earn_xp', delta: (xp) => xp },
  ],
  speed_drill: [
    { type: 'earn_xp', delta: (xp) => xp },
  ],
  gap_fill: [
    { type: 'earn_xp', delta: (xp) => xp },
  ],
  wordle_win: [
    { type: 'earn_xp', delta: (xp) => xp },
  ],
  review_card: [
    { type: 'earn_xp', delta: (xp) => xp },
  ],
};

/**
 * Apply quest progress after an XP-earning action. Best-effort — any
 * subsystem failure is logged and swallowed so a broken friend_quests
 * table doesn't break the core XP loop.
 */
export async function recordQuestEvent(
  env: Env,
  userId: number,
  source: string,
  xpEarned: number,
): Promise<void> {
  const events = SOURCE_TO_EVENTS[source];
  if (!events || events.length === 0) return;

  try {
    // Fetch all active quests the user is part of, with their current_value.
    // JOIN quest_type so we only have to hit the DB once per call.
    const { results } = await env.DB.prepare(
      `SELECT fq.id AS quest_id, fq.quest_type, fq.target_value, fq.reward_coins, fq.creator_id,
              fqm.id AS member_id, fqm.current_value, fqm.completed
         FROM friend_quest_members fqm
         JOIN friend_quests fq ON fq.id = fqm.quest_id
        WHERE fqm.user_id = ?
          AND fqm.completed = 0
          AND fq.status = 'active'
          AND datetime(fq.deadline) > datetime('now')`
    ).bind(userId).all<any>();

    if (!results || results.length === 0) return;

    for (const row of results) {
      const matchingEvent = events.find((e) => e.type === row.quest_type);
      if (!matchingEvent) continue;

      const delta = matchingEvent.delta(xpEarned);
      if (delta <= 0) continue;

      const newValue = Number(row.current_value || 0) + delta;
      const target = Number(row.target_value || 0);
      const justCompleted = newValue >= target;

      await env.DB.prepare(
        `UPDATE friend_quest_members
            SET current_value = ?, completed = ?
          WHERE id = ?`
      ).bind(newValue, justCompleted ? 1 : 0, row.member_id).run();

      if (justCompleted) {
        // Grant the coin reward. Use earnCoins so the normal log + balance
        // bookkeeping happens; source='friend_quest' distinguishes these
        // from regular earnings.
        try {
          await earnCoins(env, userId, 'friend_quest', {
            amount: Number(row.reward_coins || 100),
            detail: `quest ${row.quest_id} completed`,
          });
        } catch (e: any) {
          console.error('[friend-quests] reward grant failed:', e?.message || e);
        }

        // Mark the whole quest as completed if every member finished.
        try {
          const { results: remaining } = await env.DB.prepare(
            `SELECT COUNT(*) AS n FROM friend_quest_members
              WHERE quest_id = ? AND completed = 0`
          ).bind(row.quest_id).all<any>();
          const stillOpen = Number(remaining?.[0]?.n || 0);
          if (stillOpen === 0) {
            await env.DB.prepare(
              `UPDATE friend_quests SET status = 'completed' WHERE id = ?`
            ).bind(row.quest_id).run();
          }
        } catch (e: any) {
          console.error('[friend-quests] status update failed:', e?.message || e);
        }
      }
    }
  } catch (e: any) {
    console.error('[friend-quests] recordQuestEvent failed:', e?.message || e);
  }
}
