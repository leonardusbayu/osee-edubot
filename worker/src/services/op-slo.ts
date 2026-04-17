// Operational SLO snapshotter.
//
// Runs hourly. Counts activity + errors in the last 60 minutes, writes a
// snapshot row, and fires alerts when:
//
//   - error_rate (total_errors / total_activity) > 0.05 AND
//     ≥3x the 24h baseline AND ≥5 total errors (cuts noise on slow hours)
//   - server_error_count ≥ 20 in an hour (absolute ceiling — regardless
//     of activity, 20 server errors/hour is a real incident)
//   - openai_error_count ≥ 10 (OpenAI outage signal)
//   - whisper_error_count ≥ 5 (speaking path specifically)
//   - activity_drop: total_activity < 30% of 24h baseline AND baseline ≥ 20
//     (catches silent failures where the bot is up but nobody can use it)
//
// Alerts are idempotent per-hour: if the same metric is already firing
// we skip re-firing. When the current snapshot is clean but the previous
// snapshot fired, we emit a single 'resolved' row so operators see the
// recovery.

import type { Env } from '../types';

export interface SloSnapshotResult {
  snapshot_id: number;
  window_minutes: number;
  total_activity: number;
  total_errors: number;
  error_rate: number;
  alerts_fired: string[];
  alerts_resolved: string[];
}

type AlertMetric =
  | 'error_rate'
  | 'server_errors'
  | 'openai_errors'
  | 'whisper_errors'
  | 'activity_drop';

const WINDOW_MINUTES = 60;
const BASELINE_HOURS = 24;

const ERROR_RATE_THRESHOLD = 0.05;
const ERROR_RATE_MULTIPLIER = 3;
const ERROR_RATE_MIN_ERRORS = 5;
const SERVER_ERROR_CEILING = 20;
const OPENAI_ERROR_CEILING = 10;
const WHISPER_ERROR_CEILING = 5;
const ACTIVITY_DROP_RATIO = 0.3;
const ACTIVITY_DROP_MIN_BASELINE = 20;

interface WindowCounts {
  attempts: number;
  answers: number;
  speaking: number;
  server_errors: number;
  client_errors: number;
  bot_errors: number;
  openai_errors: number;
  whisper_errors: number;
}

async function countsForWindow(env: Env, minutesAgo: number, windowMinutes: number): Promise<WindowCounts> {
  const end = `-${minutesAgo} minutes`;
  const start = `-${minutesAgo + windowMinutes} minutes`;

  const [attempts, answers, speaking, errs] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM test_attempts
        WHERE finished_at IS NOT NULL
          AND finished_at > datetime('now', ?)
          AND finished_at <= datetime('now', ?)`,
    ).bind(start, end).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM attempt_answers
        WHERE submitted_at > datetime('now', ?)
          AND submitted_at <= datetime('now', ?)`,
    ).bind(start, end).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM speaking_sessions
        WHERE created_at > datetime('now', ?)
          AND created_at <= datetime('now', ?)`,
    ).bind(start, end).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT
          SUM(CASE WHEN source = 'server' THEN 1 ELSE 0 END) AS server_n,
          SUM(CASE WHEN source = 'client' THEN 1 ELSE 0 END) AS client_n,
          SUM(CASE WHEN source = 'bot' THEN 1 ELSE 0 END) AS bot_n,
          SUM(CASE WHEN (error_type LIKE '%openai%' OR message LIKE '%openai%' OR message LIKE '%OpenAI%') THEN 1 ELSE 0 END) AS openai_n,
          SUM(CASE WHEN (message LIKE '%whisper%' OR message LIKE '%Whisper%' OR error_type LIKE '%whisper%') THEN 1 ELSE 0 END) AS whisper_n
         FROM error_logs
        WHERE created_at > datetime('now', ?)
          AND created_at <= datetime('now', ?)`,
    ).bind(start, end).first<any>(),
  ]);

  return {
    attempts: Number(attempts?.n || 0),
    answers: Number(answers?.n || 0),
    speaking: Number(speaking?.n || 0),
    server_errors: Number(errs?.server_n || 0),
    client_errors: Number(errs?.client_n || 0),
    bot_errors: Number(errs?.bot_n || 0),
    openai_errors: Number(errs?.openai_n || 0),
    whisper_errors: Number(errs?.whisper_n || 0),
  };
}

function totalActivity(w: WindowCounts): number {
  return w.attempts + w.answers + w.speaking;
}

function totalErrors(w: WindowCounts): number {
  return w.server_errors + w.client_errors + w.bot_errors;
}

async function recentFiringAlert(env: Env, metric: AlertMetric, withinHours = 2): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT id FROM system_slo_alerts
      WHERE metric = ? AND state = 'firing'
        AND created_at > datetime('now', ?)
      ORDER BY created_at DESC LIMIT 1`,
  ).bind(metric, `-${withinHours} hours`).first<{ id: number }>();
  return !!row?.id;
}

async function fireAlert(
  env: Env,
  metric: AlertMetric,
  opts: { severity: 'low' | 'medium' | 'high'; current: number; baseline: number; threshold: number; detail: string },
) {
  await env.DB.prepare(
    `INSERT INTO system_slo_alerts
       (metric, severity, current_value, baseline_value, threshold, state, detail)
     VALUES (?, ?, ?, ?, ?, 'firing', ?)`,
  ).bind(metric, opts.severity, opts.current, opts.baseline, opts.threshold, opts.detail).run();
}

async function resolveAlert(env: Env, metric: AlertMetric) {
  await env.DB.prepare(
    `INSERT INTO system_slo_alerts (metric, severity, state, detail)
     VALUES (?, 'low', 'resolved', 'auto-resolved: metric back under threshold')`,
  ).bind(metric).run();
}

export async function runSloSnapshot(env: Env): Promise<SloSnapshotResult> {
  const current = await countsForWindow(env, 0, WINDOW_MINUTES);
  const baselineWindow = await countsForWindow(env, WINDOW_MINUTES, BASELINE_HOURS * 60);

  const currentActivity = totalActivity(current);
  const currentErrors = totalErrors(current);
  const errorRate = currentActivity > 0 ? currentErrors / currentActivity : 0;

  // Baseline is per-hour average across the previous 24 hours
  const baselineActivityPerHour = totalActivity(baselineWindow) / BASELINE_HOURS;
  const baselineErrorsPerHour = totalErrors(baselineWindow) / BASELINE_HOURS;
  const baselineRate = baselineActivityPerHour > 0 ? baselineErrorsPerHour / baselineActivityPerHour : 0;

  const insert = await env.DB.prepare(
    `INSERT INTO system_slo_snapshots
       (window_minutes, attempt_count, answer_count, speaking_count,
        server_error_count, client_error_count, bot_error_count,
        openai_error_count, whisper_error_count, total_activity, error_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(WINDOW_MINUTES, current.attempts, current.answers, current.speaking,
         current.server_errors, current.client_errors, current.bot_errors,
         current.openai_errors, current.whisper_errors, currentActivity, errorRate).run();
  const snapshotId = Number((insert as any).meta?.last_row_id || 0);

  const alertsFired: string[] = [];
  const alertsResolved: string[] = [];

  // Helper that handles the fire-or-resolve lifecycle uniformly.
  const evaluate = async (
    metric: AlertMetric,
    tripped: boolean,
    firePayload: { severity: 'low' | 'medium' | 'high'; current: number; baseline: number; threshold: number; detail: string },
  ) => {
    const alreadyFiring = await recentFiringAlert(env, metric);
    if (tripped && !alreadyFiring) {
      await fireAlert(env, metric, firePayload);
      alertsFired.push(metric);
    } else if (!tripped && alreadyFiring) {
      await resolveAlert(env, metric);
      alertsResolved.push(metric);
    }
  };

  // error_rate: high ratio, meaningfully above baseline, with enough volume
  const errorRateTripped =
    errorRate > ERROR_RATE_THRESHOLD &&
    currentErrors >= ERROR_RATE_MIN_ERRORS &&
    (baselineRate === 0 ? errorRate > ERROR_RATE_THRESHOLD : errorRate >= baselineRate * ERROR_RATE_MULTIPLIER);
  await evaluate('error_rate', errorRateTripped, {
    severity: 'high',
    current: errorRate,
    baseline: baselineRate,
    threshold: ERROR_RATE_THRESHOLD,
    detail: `error_rate=${(errorRate * 100).toFixed(1)}% vs baseline ${(baselineRate * 100).toFixed(1)}%`,
  });

  await evaluate('server_errors', current.server_errors >= SERVER_ERROR_CEILING, {
    severity: 'high',
    current: current.server_errors,
    baseline: baselineWindow.server_errors / BASELINE_HOURS,
    threshold: SERVER_ERROR_CEILING,
    detail: `${current.server_errors} server errors in last hour`,
  });

  await evaluate('openai_errors', current.openai_errors >= OPENAI_ERROR_CEILING, {
    severity: 'high',
    current: current.openai_errors,
    baseline: baselineWindow.openai_errors / BASELINE_HOURS,
    threshold: OPENAI_ERROR_CEILING,
    detail: `${current.openai_errors} OpenAI errors in last hour`,
  });

  await evaluate('whisper_errors', current.whisper_errors >= WHISPER_ERROR_CEILING, {
    severity: 'medium',
    current: current.whisper_errors,
    baseline: baselineWindow.whisper_errors / BASELINE_HOURS,
    threshold: WHISPER_ERROR_CEILING,
    detail: `${current.whisper_errors} Whisper errors in last hour`,
  });

  const activityDropTripped =
    baselineActivityPerHour >= ACTIVITY_DROP_MIN_BASELINE &&
    currentActivity < baselineActivityPerHour * ACTIVITY_DROP_RATIO;
  await evaluate('activity_drop', activityDropTripped, {
    severity: 'medium',
    current: currentActivity,
    baseline: baselineActivityPerHour,
    threshold: baselineActivityPerHour * ACTIVITY_DROP_RATIO,
    detail: `activity=${currentActivity} vs 24h avg ${baselineActivityPerHour.toFixed(1)}/hr`,
  });

  return {
    snapshot_id: snapshotId,
    window_minutes: WINDOW_MINUTES,
    total_activity: currentActivity,
    total_errors: currentErrors,
    error_rate: errorRate,
    alerts_fired: alertsFired,
    alerts_resolved: alertsResolved,
  };
}
