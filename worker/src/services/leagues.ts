// Weekly league system — Bronze → Silver → Gold → Diamond → Champion.
// Runs weekly via cron. Top N promote, bottom N demote.

import type { Env } from '../types';

const LEAGUE_ORDER = ['bronze', 'silver', 'gold', 'diamond', 'champion'];
const PROMOTION_THRESHOLDS: Record<string, number> = {
  bronze: 100,    // XP needed to promote from bronze → silver
  silver: 250,
  gold: 500,
  diamond: 1000,
  champion: 99999, // can't promote further
};
const DEMOTION_THRESHOLDS: Record<string, number> = {
  bronze: 0,      // can't demote from bronze
  silver: 30,     // below 30 XP = demote to bronze
  gold: 80,
  diamond: 200,
  champion: 400,
};

function nextLeague(current: string): string {
  const idx = LEAGUE_ORDER.indexOf(current);
  return idx < LEAGUE_ORDER.length - 1 ? LEAGUE_ORDER[idx + 1] : current;
}

function prevLeague(current: string): string {
  const idx = LEAGUE_ORDER.indexOf(current);
  return idx > 0 ? LEAGUE_ORDER[idx - 1] : current;
}

function weekStart(): string {
  const now = new Date(Date.now() + 7 * 3600 * 1000); // WIB
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Monday = start
  const monday = new Date(now.getTime() - diff * 86400000);
  return monday.toISOString().slice(0, 10);
}

export async function ensureLeagueRow(env: Env, userId: number): Promise<void> {
  const ws = weekStart();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_leagues (user_id, league, weekly_xp, week_start)
     VALUES (?, 'bronze', 0, ?)`,
  ).bind(userId, ws).run();

  // Reset weekly XP if new week
  await env.DB.prepare(
    `UPDATE user_leagues SET weekly_xp = 0, week_start = ?
      WHERE user_id = ? AND week_start != ?`,
  ).bind(ws, userId, ws).run();
}

export async function addLeagueXp(env: Env, userId: number, xp: number): Promise<void> {
  await ensureLeagueRow(env, userId);
  await env.DB.prepare(
    `UPDATE user_leagues SET weekly_xp = weekly_xp + ? WHERE user_id = ?`,
  ).bind(xp, userId).run();
}

export interface LeagueProfile {
  league: string;
  weekly_xp: number;
  rank: number;
  total_in_league: number;
  promote_threshold: number;
  demote_threshold: number;
}

export async function getLeagueProfile(env: Env, userId: number): Promise<LeagueProfile> {
  await ensureLeagueRow(env, userId);
  const row = await env.DB.prepare(
    `SELECT * FROM user_leagues WHERE user_id = ?`,
  ).bind(userId).first<any>();

  const league = row?.league || 'bronze';

  // Rank within league this week
  const rank = await env.DB.prepare(
    `SELECT COUNT(*) + 1 AS rank FROM user_leagues
      WHERE league = ? AND weekly_xp > ? AND week_start = ?`,
  ).bind(league, row?.weekly_xp || 0, row?.week_start || weekStart()).first<{ rank: number }>();

  const total = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM user_leagues WHERE league = ? AND week_start = ?`,
  ).bind(league, row?.week_start || weekStart()).first<{ n: number }>();

  return {
    league,
    weekly_xp: Number(row?.weekly_xp || 0),
    rank: Number(rank?.rank || 1),
    total_in_league: Number(total?.n || 1),
    promote_threshold: PROMOTION_THRESHOLDS[league] || 9999,
    demote_threshold: DEMOTION_THRESHOLDS[league] || 0,
  };
}

/**
 * Weekly league resolution — run Sunday night via cron.
 * Promotes users above threshold, demotes below threshold.
 * Idempotent: only runs once per week (checked via week_start update).
 */
export async function resolveWeeklyLeagues(env: Env): Promise<{ promoted: number; demoted: number; stayed: number }> {
  const ws = weekStart();
  const nextWeekMonday = new Date(Date.now() + 7 * 3600 * 1000 + 7 * 86400000); // +7 days WIB
  const nextWs = nextWeekMonday.toISOString().slice(0, 10);

  const { results: allUsers } = await env.DB.prepare(
    `SELECT user_id, league, weekly_xp FROM user_leagues WHERE week_start = ?`,
  ).bind(ws).all<any>();

  let promoted = 0, demoted = 0, stayed = 0;

  for (const u of allUsers || []) {
    const league = u.league || 'bronze';
    const xp = Number(u.weekly_xp || 0);
    let action = 'stayed';
    let newLeague = league;

    if (xp >= (PROMOTION_THRESHOLDS[league] || 99999)) {
      newLeague = nextLeague(league);
      if (newLeague !== league) { action = 'promoted'; promoted++; }
      else stayed++;
    } else if (xp < (DEMOTION_THRESHOLDS[league] || 0) && league !== 'bronze') {
      newLeague = prevLeague(league);
      action = 'demoted'; demoted++;
    } else {
      stayed++;
    }

    // Record history
    const weekEnd = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    await env.DB.prepare(
      `INSERT INTO league_history (user_id, week_start, week_end, league, weekly_xp, action)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(u.user_id, ws, weekEnd, league, xp, action).run();

    // Update league and advance week_start to next week (prevents idempotency issues)
    await env.DB.prepare(
      `UPDATE user_leagues SET league = ?, prev_league = ?, promoted_at = datetime('now'), weekly_xp = 0, week_start = ?
        WHERE user_id = ?`,
    ).bind(newLeague, league, nextWs, u.user_id).run();
  }

  return { promoted, demoted, stayed };
}

export async function getLeagueLeaderboard(env: Env, league: string, limit = 20) {
  const ws = weekStart();
  const { results } = await env.DB.prepare(
    `SELECT ul.user_id, u.full_name, u.username, ul.weekly_xp
       FROM user_leagues ul JOIN users u ON u.id = ul.user_id
      WHERE ul.league = ? AND ul.week_start = ?
      ORDER BY ul.weekly_xp DESC LIMIT ?`,
  ).bind(league, ws, limit).all<any>();
  return results || [];
}
