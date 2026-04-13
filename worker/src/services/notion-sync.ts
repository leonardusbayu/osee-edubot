import type { Env } from '../types';

// Notion API helper with exponential backoff retry logic
async function notionRequest(env: Env, method: string, path: string, body?: any, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`https://api.notion.com/v1${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // Rate limited — wait and retry
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '1');
        const waitMs = Math.min(retryAfter * 1000, 5000);
        console.warn(`Notion rate limited on ${method} ${path}, waiting ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      // Server error — retry with backoff
      if (res.status >= 500) {
        const waitMs = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
        console.warn(`Notion server error ${res.status} on ${method} ${path}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Notion API ${method} ${path}: ${res.status} ${text}`);
      }

      return res.json() as any;
    } catch (e: any) {
      // Network error — retry
      if (attempt < retries - 1 && !e.message?.includes('Notion API')) {
        const waitMs = Math.pow(2, attempt) * 500;
        console.warn(`Notion network error on ${method} ${path}: ${e.message}, retrying in ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Notion API ${method} ${path}: failed after ${retries} retries`);
}

// Query all pages in a Notion database (paginated)
async function queryAllPages(env: Env, dbId: string): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest(env, 'POST', `/databases/${dbId}/query`, body);
    pages.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

// Get title from Notion page
function getPageTitle(page: any): string {
  for (const prop of Object.values(page.properties) as any[]) {
    if (prop.type === 'title' && prop.title?.length > 0) {
      return prop.title.map((t: any) => t.plain_text).join('');
    }
  }
  return '';
}

// Get number property
function getNum(page: any, name: string): number | null {
  return page.properties[name]?.number ?? null;
}

// Safely convert D1 value to number (D1 sometimes returns "123.0" strings)
function toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toInt(val: any): number {
  return Math.round(toNum(val));
}

// ────────────────────────────────────────
// SYNC STUDENTS
// ────────────────────────────────────────
export async function syncStudents(env: Env) {
  if (!env.NOTION_API_KEY || !env.NOTION_STUDENTS_DB) return { synced: 0, skipped: 'no config' };

  // Fetch all students from D1
  const students = await env.DB.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM test_attempts WHERE user_id = u.id) as total_attempts,
      (SELECT ROUND(AVG(accuracy), 1) FROM (
        SELECT CASE WHEN COUNT(*) > 0
          THEN (SUM(CASE WHEN aa.is_correct = 1 THEN 1.0 ELSE 0.0 END) / COUNT(*)) * 100
          ELSE 0 END as accuracy
        FROM test_attempts ta2
        JOIN attempt_answers aa ON aa.attempt_id = ta2.id
        WHERE ta2.user_id = u.id AND ta2.status = 'completed'
        GROUP BY ta2.id
      )) as avg_score,
      (SELECT COALESCE(SUM(questions_answered), 0) FROM daily_question_logs
       WHERE user_id = u.id AND question_date = date('now')) as questions_today,
      (SELECT COALESCE(SUM(bonus_questions), 0) FROM referral_bonus_quota WHERE user_id = u.id) as bonus_quota
    FROM users u WHERE u.role != 'banned'
    ORDER BY u.created_at DESC
  `).all();

  // Get existing Notion pages indexed by telegram_id
  const existingPages = await queryAllPages(env, env.NOTION_STUDENTS_DB);
  const existingByTgId = new Map<number, string>();
  for (const p of existingPages) {
    const tgId = getNum(p, 'Telegram ID');
    if (tgId) existingByTgId.set(tgId, p.id);
  }

  let synced = 0;
  let errors = 0;
  for (const s of (students.results || []) as any[]) {
    try {
      const props: any = {
        'Name': { title: [{ text: { content: s.name || `User ${s.telegram_id}` } }] },
        'Telegram ID': { number: toInt(s.telegram_id) },
        'Role': { select: { name: s.role || 'student' } },
        'Total Attempts': { number: toInt(s.total_attempts) },
        'Avg Score': { number: toNum(s.avg_score) },
        'Questions Today': { number: toInt(s.questions_today) },
        'Daily Quota': { number: 10 + toInt(s.bonus_quota) },
        'Premium': { checkbox: !!s.is_premium },
      };

      if (s.target_test) props['Target Test'] = { select: { name: s.target_test } };
      if (s.proficiency_level) props['Current Level'] = { select: { name: s.proficiency_level } };
      if (s.premium_until) props['Premium Expires'] = { date: { start: s.premium_until.split('T')[0] } };

      const existingPageId = existingByTgId.get(toInt(s.telegram_id));
      if (existingPageId) {
        await notionRequest(env, 'PATCH', `/pages/${existingPageId}`, { properties: props });
      } else {
        await notionRequest(env, 'POST', '/pages', {
          parent: { database_id: env.NOTION_STUDENTS_DB },
          properties: props,
        });
      }
      synced++;
    } catch (e: any) {
      console.error(`Failed to sync student ${s.name || s.telegram_id}:`, e.message);
      errors++;
    }
    if (synced + errors >= 25) break;
  }

  return { synced, errors, updated: existingByTgId.size, created: synced - Math.min(existingByTgId.size, synced) };
}

// ────────────────────────────────────────
// SYNC TEST ATTEMPTS (last 7 days only)
// ────────────────────────────────────────
export async function syncAttempts(env: Env) {
  if (!env.NOTION_API_KEY || !env.NOTION_ATTEMPTS_DB) return { synced: 0, skipped: 'no config' };

  // Fetch recent completed attempts
  const attempts = await env.DB.prepare(`
    SELECT ta.*, u.name as student_name, u.telegram_id,
      (SELECT COUNT(*) FROM attempt_answers WHERE attempt_id = ta.id AND is_correct = 1) as correct_count,
      (SELECT COUNT(*) FROM attempt_answers WHERE attempt_id = ta.id) as answer_count
    FROM test_attempts ta
    JOIN users u ON u.id = ta.user_id
    WHERE ta.started_at >= datetime('now', '-7 days')
    ORDER BY ta.started_at DESC
  `).all();

  // Get existing pages by attempt started_at + telegram_id (dedup key)
  const existingPages = await queryAllPages(env, env.NOTION_ATTEMPTS_DB);
  const existingKeys = new Set<string>();
  for (const p of existingPages) {
    const tgId = getNum(p, 'Telegram ID');
    const title = getPageTitle(p);
    if (tgId) existingKeys.add(`${tgId}:${title}`);
  }

  let synced = 0;
  let errors = 0;
  for (const a of (attempts.results || []) as any[]) {
    try {
      const testName = `${a.test_type || 'practice'} - ${a.section || 'mixed'}`;
      const dedupKey = `${a.telegram_id}:${testName} ${(a.started_at || '').slice(0, 10)}`;

      // Skip if already synced (rough dedup by title match)
      if (existingKeys.has(dedupKey)) continue;

      const totalQ = toInt(a.total_questions) || toInt(a.answer_count) || 0;
      const correct = toInt(a.correct_count);
      const accuracy = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;

      const props: any = {
        'Test Name': { title: [{ text: { content: `${testName} ${(a.started_at || '').slice(0, 10)}` } }] },
        'Student Name': { rich_text: [{ text: { content: a.student_name || 'Unknown' } }] },
        'Telegram ID': { number: toInt(a.telegram_id) },
        'Total Questions': { number: totalQ },
        'Correct Answers': { number: correct },
        'Accuracy %': { number: accuracy },
        'Score': { number: accuracy },
        'Status': { select: { name: a.status === 'completed' ? 'completed' : a.status === 'in_progress' ? 'in_progress' : 'abandoned' } },
      };

      const validSections = ['reading', 'listening', 'speaking', 'writing', 'mixed'];
      const section = (a.current_section || a.section || '').toLowerCase();
      if (section && validSections.includes(section)) props['Section'] = { select: { name: section } };
      if (a.started_at) props['Started At'] = { date: { start: a.started_at } };
      if (a.finished_at) props['Finished At'] = { date: { start: a.finished_at } };

      // Calculate time spent
      if (a.started_at && a.finished_at) {
        const mins = Math.round((new Date(a.finished_at).getTime() - new Date(a.started_at).getTime()) / 60000);
        if (mins > 0 && mins < 300) props['Time Spent (min)'] = { number: mins };
      }

      await notionRequest(env, 'POST', '/pages', {
        parent: { database_id: env.NOTION_ATTEMPTS_DB },
        properties: props,
      });
      synced++;
    } catch (e: any) {
      console.error(`Failed to sync attempt ${a.id}:`, e.message);
      errors++;
    }

    // Cloudflare Workers limit: max ~40 subrequests per invocation
    if (synced + errors >= 20) break;
  }

  return { synced, errors, total_attempts: (attempts.results || []).length, capped: synced + errors >= 20 };
}

// ────────────────────────────────────────
// SYNC WEEKLY REPORTS (runs on Monday cron)
// ────────────────────────────────────────
export async function syncWeeklyReports(env: Env) {
  if (!env.NOTION_API_KEY || !env.NOTION_WEEKLY_DB) return { synced: 0, skipped: 'no config' };

  // Get per-student weekly stats for the past 7 days
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = new Date().toISOString().split('T')[0];

  const weeklyStats = await env.DB.prepare(`
    SELECT u.id, u.name, u.telegram_id, u.proficiency_level,
      COUNT(ta.id) as tests_taken,
      (SELECT COUNT(*) FROM attempt_answers aa
       JOIN test_attempts t ON t.id = aa.attempt_id
       WHERE t.user_id = u.id AND t.started_at >= ?) as questions_answered,
      ROUND(
        CASE WHEN COUNT(DISTINCT ta.id) > 0
        THEN (SELECT AVG(sub.acc) FROM (
          SELECT (SUM(CASE WHEN aa0.is_correct = 1 THEN 1.0 ELSE 0.0 END) / COUNT(*)) * 100 as acc
          FROM attempt_answers aa0
          JOIN test_attempts t0 ON t0.id = aa0.attempt_id
          WHERE t0.user_id = u.id AND t0.started_at >= ?
          GROUP BY t0.id
        ) sub)
        ELSE 0 END, 1) as avg_accuracy,
      -- Best section by accuracy
      (SELECT aa2.section FROM attempt_answers aa2
       JOIN test_attempts t2 ON t2.id = aa2.attempt_id
       WHERE t2.user_id = u.id AND t2.started_at >= ?
       GROUP BY aa2.section
       ORDER BY (SUM(CASE WHEN aa2.is_correct = 1 THEN 1.0 ELSE 0.0 END) / COUNT(*)) DESC
       LIMIT 1) as best_section,
      -- Weakest section by accuracy
      (SELECT aa3.section FROM attempt_answers aa3
       JOIN test_attempts t3 ON t3.id = aa3.attempt_id
       WHERE t3.user_id = u.id AND t3.started_at >= ?
       GROUP BY aa3.section
       ORDER BY (SUM(CASE WHEN aa3.is_correct = 1 THEN 1.0 ELSE 0.0 END) / COUNT(*)) ASC
       LIMIT 1) as weakest_section
    FROM users u
    JOIN test_attempts ta ON ta.user_id = u.id AND ta.started_at >= ?
    WHERE u.role != 'banned'
    GROUP BY u.id
    HAVING tests_taken > 0
    ORDER BY tests_taken DESC
  `).bind(weekStartStr, weekStartStr, weekStartStr, weekStartStr, weekStartStr).all();

  let synced = 0;
  let errors = 0;
  for (const s of (weeklyStats.results || []) as any[]) {
    try {
      const props: any = {
        'Report Title': { title: [{ text: { content: `${s.name} — Week ${weekStartStr}` } }] },
        'Student Name': { rich_text: [{ text: { content: s.name || 'Unknown' } }] },
        'Telegram ID': { number: toInt(s.telegram_id) },
        'Week Start': { date: { start: weekStartStr } },
        'Week End': { date: { start: weekEndStr } },
        'Tests Taken': { number: toInt(s.tests_taken) },
        'Questions Answered': { number: toInt(s.questions_answered) },
        'Avg Accuracy %': { number: toNum(s.avg_accuracy) },
        'Level Change': { select: { name: 'same' } },
      };

      const validSections = ['reading', 'listening', 'speaking', 'writing'];
      if (s.best_section && validSections.includes(s.best_section)) {
        props['Best Section'] = { select: { name: s.best_section } };
      }
      if (s.weakest_section && validSections.includes(s.weakest_section)) {
        props['Weakest Section'] = { select: { name: s.weakest_section } };
      }

      await notionRequest(env, 'POST', '/pages', {
        parent: { database_id: env.NOTION_WEEKLY_DB },
        properties: props,
      });
      synced++;
    } catch (e: any) {
      console.error(`Failed to sync weekly report for ${s.name || s.telegram_id}:`, e.message);
      errors++;
    }
  }

  return { synced, errors, week: weekStartStr };
}

// ────────────────────────────────────────
// MAIN SYNC — called by cron
// ────────────────────────────────────────
// Sync a single type — keeps each call under Cloudflare's 50 subrequest limit
export async function handleNotionSync(env: Env, type?: string) {
  if (!env.NOTION_API_KEY) {
    console.log('Notion sync skipped: NOTION_API_KEY not set');
    return { skipped: 'no NOTION_API_KEY' };
  }

  const target = type || 'students'; // default to students
  console.log(`Starting Notion sync: ${target}...`);

  try {
    if (target === 'students') {
      const result = await syncStudents(env);
      console.log('Students synced:', result);
      return { type: 'students', ...result };
    } else if (target === 'attempts') {
      const result = await syncAttempts(env);
      console.log('Attempts synced:', result);
      return { type: 'attempts', ...result };
    } else if (target === 'weekly') {
      const result = await syncWeeklyReports(env);
      console.log('Weekly synced:', result);
      return { type: 'weekly', ...result };
    }
  } catch (e: any) {
    console.error(`${target} sync failed:`, e.message);
    return { type: target, error: e.message };
  }
}

// Weekly sync — includes weekly report generation
export async function handleNotionWeeklySync(env: Env) {
  if (!env.NOTION_API_KEY) return;

  try {
    const report = await syncWeeklyReports(env);
    console.log('Weekly reports synced:', report);
    return report;
  } catch (e: any) {
    console.error('Weekly report sync failed:', e.message);
    return { error: e.message };
  }
}
