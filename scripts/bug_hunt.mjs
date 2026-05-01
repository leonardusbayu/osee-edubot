#!/usr/bin/env node
// EduBot bug-hunt orchestrator.
//
// Runs local build/type checks, production stuck-state checks, content audits,
// regression guards, and optional AI triage in one sequence.
//
// Usage:
//   node scripts/bug_hunt.mjs
//   npm run bug-hunt
//
// Optional env:
//   CLOUDFLARE_API_TOKEN   Enables production D1 checks via wrangler.
//   CLOUDFLARE_ACCOUNT_ID  Wrangler/account context for CI.
//   OPENAI_API_KEY         Enables AI triage if BUG_HUNT_AI=1.
//   BUG_HUNT_AI=1          Ask OpenAI to summarize likely root causes.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WORKER = path.join(ROOT, 'worker');
const FRONTEND = path.join(ROOT, 'frontend');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'bug-hunt-report.md');
const HTML_REPORT_PATH = path.join(ARTIFACT_DIR, 'bug-hunt-report.html');
const SUMMARY_PATH = path.join(ARTIFACT_DIR, 'bug-hunt-summary.json');
const LEDGER_PATH = path.join(ARTIFACT_DIR, 'bug-hunt-ledger.jsonl');

const startedAt = new Date();
const runId = `bh_${startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${crypto.randomBytes(4).toString('hex')}`;
const report = [];
const summary = [];
const stepRecords = [];
let hardFailures = 0;
let softFindings = 0;
let startFreshness = null;
let endFreshness = null;
let freshnessSummary = null;
let finalized = false;
let ledgerWritten = false;

function ensureArtifacts() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function section(title) {
  report.push(`\n## ${title}\n`);
}

function fence(text) {
  return `\n\`\`\`text\n${String(text || '').trim().slice(0, 20000)}\n\`\`\`\n`;
}

function safeRel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/') || '.';
}

function capture(command, opts = {}) {
  const res = spawnSync(command, {
    cwd: opts.cwd || ROOT,
    shell: true,
    encoding: 'utf8',
    maxBuffer: opts.maxBuffer || 20 * 1024 * 1024,
    env: process.env,
  });
  return {
    ok: res.status === 0,
    status: res.status,
    output: `${res.stdout || ''}${res.stderr || ''}`.trim(),
  };
}

function gitValue(command) {
  const res = capture(command, { cwd: ROOT, maxBuffer: 1024 * 1024 });
  return res.ok ? res.output.trim() : null;
}

function relevantStatusLines() {
  const res = capture('git status --porcelain --untracked-files=all', { cwd: ROOT });
  if (!res.ok) return [];
  return res.output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const rel = line.slice(3).replace(/\\/g, '/');
      return !rel.startsWith('artifacts/') && !rel.includes('/.wrangler/') && !rel.startsWith('.wrangler/');
    });
}

function updateHashWithFile(hash, rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return;
  hash.update(`file:${rel}\n`);
  hash.update(fs.readFileSync(abs));
  hash.update('\n');
}

function updateHashWithDirectory(hash, rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return;
  const files = fs.readdirSync(abs).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) updateHashWithFile(hash, path.join(rel, file).replace(/\\/g, '/'));
}

function pipelineFingerprint() {
  const hash = crypto.createHash('sha256');
  [
    'package.json',
    'package-lock.json',
    'worker/package.json',
    'worker/package-lock.json',
    'frontend/package.json',
    'frontend/package-lock.json',
    'scripts/bug_hunt.mjs',
    'scripts/verify_shipped_fixes.mjs',
    'scripts/tone_audit.mjs',
    'scripts/content_spotcheck.mjs',
    'scripts/duplicate_audit.mjs',
    'docs/BUG_HUNTING.md',
    '.github/workflows/bug-hunt.yml',
  ].forEach((rel) => updateHashWithFile(hash, rel));
  updateHashWithDirectory(hash, 'worker/migrations');
  return hash.digest('hex');
}

function collectFreshness() {
  const status = relevantStatusLines();
  return {
    branch: gitValue('git rev-parse --abbrev-ref HEAD'),
    commit: gitValue('git rev-parse HEAD'),
    relevant_status: status,
    relevant_status_hash: crypto.createHash('sha256').update(status.join('\n')).digest('hex'),
    pipeline_fingerprint: pipelineFingerprint(),
  };
}

function compareFreshness(start, end) {
  if (!start || !end) return { changed: false, reasons: [], dirty_files: 0 };
  const reasons = [];
  if (start.commit !== end.commit) reasons.push('git commit changed during run');
  if (start.branch !== end.branch) reasons.push('git branch changed during run');
  if (start.relevant_status_hash !== end.relevant_status_hash) reasons.push('relevant worktree status changed during run');
  if (start.pipeline_fingerprint !== end.pipeline_fingerprint) reasons.push('bug-hunt pipeline inputs changed during run');
  return {
    changed: reasons.length > 0,
    reasons,
    dirty_files: end.relevant_status.length,
  };
}

function runStep(name, command, opts = {}) {
  const cwd = opts.cwd || ROOT;
  const hard = opts.hard !== false;
  const skip = opts.skip;
  section(name);

  const record = {
    name,
    command,
    cwd: safeRel(cwd),
    hard,
    status: 'PASS',
    exit_code: null,
    duration_ms: 0,
    skipped: false,
    finding: null,
  };

  if (skip) {
    report.push(`Skipped: ${skip}\n`);
    summary.push({ name, status: 'SKIP', hard });
    record.status = 'SKIP';
    record.skipped = true;
    record.finding = skip;
    stepRecords.push(record);
    return { ok: true, skipped: true, output: '', record };
  }

  const t0 = Date.now();
  const res = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 60 * 1024 * 1024,
    env: process.env,
  });
  const ms = Date.now() - t0;
  const output = `${res.stdout || ''}${res.stderr || ''}`;
  const ok = res.status === 0;
  record.exit_code = res.status ?? null;
  record.duration_ms = ms;
  record.status = ok ? 'PASS' : hard ? 'FAIL' : 'FINDING';

  report.push(`Command: \`${command}\`\n`);
  report.push(`CWD: \`${path.relative(ROOT, cwd) || '.'}\`\n`);
  report.push(`Exit: \`${res.status ?? 'unknown'}\` (${ms} ms)\n`);
  report.push(fence(output || '(no output)'));

  if (!ok) {
    if (hard) hardFailures++;
    else softFindings++;
  }
  summary.push({ name, status: record.status, hard });
  stepRecords.push(record);
  return { ok, output, status: res.status, record };
}

function runD1(name, sql, opts = {}) {
  const hasToken = !!process.env.CLOUDFLARE_API_TOKEN;
  const escaped = sql.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  const result = runStep(
    name,
    `npx wrangler d1 execute edubot-db --remote --json --command "${escaped}"`,
    {
      cwd: WORKER,
      hard: opts.hard === true,
      skip: hasToken ? undefined : 'CLOUDFLARE_API_TOKEN is not set',
    },
  );

  if (opts.expectEmpty && result.ok && !result.skipped) {
    const rows = parseWranglerRows(result.output);
    if (rows.length > 0) {
      softFindings++;
      const last = summary[summary.length - 1];
      if (last?.name === name && last.status === 'PASS') last.status = 'FINDING';
      if (result.record) {
        result.record.status = 'FINDING';
        result.record.finding = `expected zero rows, found ${rows.length}`;
      }
      report.push(`Finding: expected zero rows, found ${rows.length}.\n`);
    }
  }

  return result;
}

function parseWranglerRows(output) {
  try {
    const start = output.indexOf('[');
    if (start < 0) return [];
    const parsed = JSON.parse(output.slice(start));
    return Array.isArray(parsed?.[0]?.results) ? parsed[0].results : [];
  } catch {
    return [];
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function staticRegressionGuards() {
  section('Static Regression Guards');
  const checks = [];

  const diagnostic = read('worker/src/services/diagnostic.ts');
  const webhook = read('worker/src/bot/webhook.ts');
  const fsrs = read('worker/src/services/fsrs-engine.ts');

  checks.push({
    name: 'Diagnostic truncates long Telegram passages',
    ok: diagnostic.includes('MAX_PASSAGE_CHARS') && diagnostic.includes('passage continues di aplikasi'),
  });
  checks.push({
    name: 'Diagnostic builds section-ordered question list',
    ok: diagnostic.includes('function buildDiagnosticOrder') && diagnostic.includes('COMMON_GRAMMAR'),
  });
  checks.push({
    name: 'Diagnostic has GPT free-text scoring fallback',
    ok: diagnostic.includes('evaluateDiagnosticFreeText') && diagnostic.includes('band_1_6'),
  });
  checks.push({
    name: 'Diagnostic no longer returns done=false with null nextQuestion',
    ok: !/done:\s*false[^\n{}]*nextQuestion:\s*null|nextQuestion:\s*null[^\n{}]*done:\s*false/s.test(diagnostic),
  });
  checks.push({
    name: 'Diagnostic callback has visible error boundary',
    ok: webhook.includes('diagnostic callback error') && webhook.includes('Ada gangguan saat memproses jawaban diagnostic'),
  });
  checks.push({
    name: 'FSRS review UI exposes Again/Hard/Good/Easy',
    ok: webhook.includes('reviewKeyboard') && webhook.includes('review:hard') && webhook.includes('review:easy'),
  });
  checks.push({
    name: 'FSRS retention uses cache',
    ok: fsrs.includes('fsrs_retention_cache') && fsrs.includes('invalidateRetentionCache'),
  });

  let failed = 0;
  for (const c of checks) {
    report.push(`- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}\n`);
    if (!c.ok) failed++;
  }

  if (failed) hardFailures += failed;
  const status = failed ? 'FAIL' : 'PASS';
  summary.push({ name: 'Static Regression Guards', status, hard: true });
  stepRecords.push({
    name: 'Static Regression Guards',
    command: 'static in-process checks',
    cwd: '.',
    hard: true,
    status,
    exit_code: failed ? 1 : 0,
    duration_ms: 0,
    skipped: false,
    finding: failed ? `${failed} static guard(s) failed` : null,
  });
}

async function aiTriage() {
  if (process.env.BUG_HUNT_AI !== '1') {
    section('AI Triage');
    report.push('Skipped: BUG_HUNT_AI is not set to 1.\n');
    summary.push({ name: 'AI Triage', status: 'SKIP', hard: false });
    stepRecords.push({ name: 'AI Triage', command: 'OpenAI chat completion', cwd: '.', hard: false, status: 'SKIP', exit_code: null, duration_ms: 0, skipped: true, finding: 'BUG_HUNT_AI is not set to 1' });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    section('AI Triage');
    report.push('Skipped: OPENAI_API_KEY is not set.\n');
    summary.push({ name: 'AI Triage', status: 'SKIP', hard: false });
    stepRecords.push({ name: 'AI Triage', command: 'OpenAI chat completion', cwd: '.', hard: false, status: 'SKIP', exit_code: null, duration_ms: 0, skipped: true, finding: 'OPENAI_API_KEY is not set' });
    return;
  }

  section('AI Triage');
  const compact = report.join('').slice(-45000);
  const model = process.env.BUG_HUNT_OPENAI_MODEL || 'gpt-4o-mini';
  const t0 = Date.now();

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: 'You are a senior QA engineer for EduBot. Analyze the audit report. Prioritize bugs that can block users from completing onboarding, diagnostic tests, exercises, speaking/writing evaluations, payments, or reviews. Return concise Markdown: Critical, High, Medium, Suggested next fixes. Only cite evidence present in the report.',
          },
          { role: 'user', content: compact },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      softFindings++;
      report.push(`AI triage failed: ${data?.error?.message || res.status}\n`);
      summary.push({ name: 'AI Triage', status: 'FINDING', hard: false });
      stepRecords.push({ name: 'AI Triage', command: `OpenAI chat completion (${model})`, cwd: '.', hard: false, status: 'FINDING', exit_code: null, duration_ms: Date.now() - t0, skipped: false, finding: data?.error?.message || `HTTP ${res.status}` });
      return;
    }
    const text = data.choices?.[0]?.message?.content || '(empty AI response)';
    report.push(text.trim() + '\n');
    summary.push({ name: 'AI Triage', status: 'PASS', hard: false });
    stepRecords.push({ name: 'AI Triage', command: `OpenAI chat completion (${model})`, cwd: '.', hard: false, status: 'PASS', exit_code: 0, duration_ms: Date.now() - t0, skipped: false, finding: null });
  } catch (e) {
    softFindings++;
    report.push(`AI triage failed: ${e?.message || e}\n`);
    summary.push({ name: 'AI Triage', status: 'FINDING', hard: false });
    stepRecords.push({ name: 'AI Triage', command: `OpenAI chat completion (${model})`, cwd: '.', hard: false, status: 'FINDING', exit_code: null, duration_ms: Date.now() - t0, skipped: false, finding: e?.message || String(e) });
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusClass(status) {
  if (status === 'PASS') return 'pass';
  if (status === 'FAIL') return 'fail';
  if (status === 'FINDING') return 'finding';
  return 'skip';
}

function finalizeRunMetadata() {
  if (finalized) return;
  endFreshness = collectFreshness();
  freshnessSummary = compareFreshness(startFreshness, endFreshness);

  section('Freshness Check');
  if (freshnessSummary.changed) {
    softFindings++;
    report.push(`FINDING: Bug-hunt inputs changed while the run was executing.\n`);
    for (const reason of freshnessSummary.reasons) report.push(`- ${reason}\n`);
    summary.push({ name: 'Freshness Check', status: 'FINDING', hard: false });
    stepRecords.push({ name: 'Freshness Check', command: 'git/status fingerprint comparison', cwd: '.', hard: false, status: 'FINDING', exit_code: null, duration_ms: 0, skipped: false, finding: freshnessSummary.reasons.join('; ') });
  } else {
    report.push('PASS: Git branch, commit, relevant worktree status, and pipeline fingerprint stayed stable during the run.\n');
    summary.push({ name: 'Freshness Check', status: 'PASS', hard: false });
    stepRecords.push({ name: 'Freshness Check', command: 'git/status fingerprint comparison', cwd: '.', hard: false, status: 'PASS', exit_code: 0, duration_ms: 0, skipped: false, finding: null });
  }
  if (endFreshness.relevant_status.length > 0) {
    report.push(`\nRelevant dirty files at finish (${endFreshness.relevant_status.length}):\n`);
    for (const line of endFreshness.relevant_status.slice(0, 50)) report.push(`- ${line}\n`);
    if (endFreshness.relevant_status.length > 50) report.push(`- ... ${endFreshness.relevant_status.length - 50} more\n`);
  }
  finalized = true;
}

function buildMetrics() {
  return {
    hard_failures: hardFailures,
    soft_findings: softFindings,
    steps_total: summary.length,
    steps_failed: summary.filter((s) => s.status === 'FAIL').length,
    steps_findings: summary.filter((s) => s.status === 'FINDING').length,
    freshness_changed: freshnessSummary?.changed ? 1 : 0,
    relevant_dirty_files: endFreshness?.relevant_status?.length || 0,
  };
}

function buildSummaryPayload(finishedAt) {
  return {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    result: hardFailures > 0 ? 'fail' : softFindings > 0 ? 'finding' : 'pass',
    metrics: buildMetrics(),
    summary,
    steps: stepRecords,
    freshness: {
      changed: freshnessSummary?.changed || false,
      reasons: freshnessSummary?.reasons || [],
      start: startFreshness,
      end: endFreshness,
    },
    artifacts: {
      markdown_report: safeRel(REPORT_PATH),
      html_report: safeRel(HTML_REPORT_PATH),
      summary_json: safeRel(SUMMARY_PATH),
      ledger: safeRel(LEDGER_PATH),
    },
  };
}

function renderHtmlReport(markdown, payload) {
  const cards = [
    ['Hard failures', payload.metrics.hard_failures],
    ['Soft findings', payload.metrics.soft_findings],
    ['Steps', payload.metrics.steps_total],
    ['Dirty files', payload.metrics.relevant_dirty_files],
  ];
  const rows = payload.summary.map((s) => `
        <tr>
          <td>${escapeHtml(s.name)}</td>
          <td><span class="pill ${statusClass(s.status)}">${escapeHtml(s.status)}</span></td>
          <td>${s.hard ? 'hard' : 'soft'}</td>
        </tr>`).join('');
  const artifactRows = Object.entries(payload.artifacts).map(([name, rel]) => `
        <li><strong>${escapeHtml(name)}</strong>: <code>${escapeHtml(rel)}</code></li>`).join('');
  const freshnessReasons = payload.freshness.reasons.length > 0
    ? payload.freshness.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')
    : '<li>No freshness drift detected.</li>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EduBot Bug Hunt ${escapeHtml(payload.run_id)}</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #0f172a; color: #e2e8f0; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 56px; }
    h1, h2 { letter-spacing: -0.02em; }
    .meta, .card, table, pre { background: rgba(15, 23, 42, 0.82); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22); }
    .meta { padding: 18px 20px; color: #cbd5e1; }
    .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin: 22px 0; }
    .card { padding: 18px; }
    .card b { display: block; font-size: 28px; color: #fff; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 12px 14px; border-bottom: 1px solid rgba(148, 163, 184, 0.18); text-align: left; }
    th { color: #93c5fd; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; }
    .pill { display: inline-block; padding: 4px 9px; border-radius: 999px; font-weight: 700; font-size: 12px; }
    .pass { background: #14532d; color: #bbf7d0; }
    .finding { background: #713f12; color: #fde68a; }
    .fail { background: #7f1d1d; color: #fecaca; }
    .skip { background: #334155; color: #cbd5e1; }
    pre { padding: 18px; overflow: auto; white-space: pre-wrap; line-height: 1.45; }
    code { color: #bfdbfe; }
    a { color: #93c5fd; }
  </style>
</head>
<body>
  <main>
    <h1>EduBot Bug Hunt</h1>
    <div class="meta">
      <div><strong>Run:</strong> <code>${escapeHtml(payload.run_id)}</code></div>
      <div><strong>Started:</strong> ${escapeHtml(payload.started_at)}</div>
      <div><strong>Finished:</strong> ${escapeHtml(payload.finished_at)}</div>
      <div><strong>Result:</strong> <span class="pill ${payload.result === 'pass' ? 'pass' : payload.result === 'fail' ? 'fail' : 'finding'}">${escapeHtml(payload.result.toUpperCase())}</span></div>
    </div>
    <section class="grid">
      ${cards.map(([label, value]) => `<div class="card">${escapeHtml(label)}<b>${escapeHtml(value)}</b></div>`).join('\n      ')}
    </section>
    <h2>Step Summary</h2>
    <table>
      <thead><tr><th>Step</th><th>Status</th><th>Gate</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Freshness</h2>
    <div class="meta"><ul>${freshnessReasons}</ul></div>
    <h2>Artifacts</h2>
    <div class="meta"><ul>${artifactRows}</ul></div>
    <h2>Markdown Report</h2>
    <pre>${escapeHtml(markdown)}</pre>
  </main>
</body>
</html>`;
}

function writeLedger(payload) {
  if (ledgerWritten) return;
  fs.appendFileSync(LEDGER_PATH, `${JSON.stringify(payload)}\n`);
  ledgerWritten = true;
}

function writeReport() {
  ensureArtifacts();
  finalizeRunMetadata();
  const finishedAt = new Date();
  const payload = buildSummaryPayload(finishedAt);
  const metricLines = Object.entries(payload.metrics).map(([name, value]) => `METRIC ${name}=${value}`);
  const artifactLines = Object.entries(payload.artifacts).map(([name, rel]) => `ARTIFACT ${name}=${rel}`);
  const header = [
    '# EduBot Bug Hunt Report',
    '',
    `Run ID: ${runId}`,
    `Started: ${startedAt.toISOString()}`,
    `Finished: ${finishedAt.toISOString()}`,
    `Hard failures: ${hardFailures}`,
    `Soft findings: ${softFindings}`,
    '',
    '## Summary',
    '',
    '| Step | Status | Gate |',
    '|---|---:|---|',
    ...summary.map(s => `| ${s.name} | ${s.status} | ${s.hard ? 'hard' : 'soft'} |`),
    '',
    '## Machine-readable output',
    '',
    ...metricLines,
    ...artifactLines,
    '',
  ];
  const markdown = `${header.join('\n')}\n${report.join('')}`;
  fs.writeFileSync(REPORT_PATH, markdown);
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(HTML_REPORT_PATH, renderHtmlReport(markdown, payload));
  writeLedger(payload);
  console.log(`\nBug hunt report written to ${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`HTML report written to ${path.relative(ROOT, HTML_REPORT_PATH)}`);
  console.log(`Summary JSON written to ${path.relative(ROOT, SUMMARY_PATH)}`);
  console.log(`Ledger appended at ${path.relative(ROOT, LEDGER_PATH)}`);
  for (const line of metricLines) console.log(line);
  for (const line of artifactLines) console.log(line);
}

async function main() {
  ensureArtifacts();
  startFreshness = collectFreshness();

  runStep('Worker TypeScript', 'npx tsc --noEmit', { cwd: WORKER, hard: true });
  runStep('Frontend TypeScript', 'npx tsc --noEmit', { cwd: FRONTEND, hard: true });
  runStep('Frontend Production Build', 'npm run build', { cwd: FRONTEND, hard: true });
  runStep('Worker Unit Tests', 'npm test', { cwd: WORKER, hard: false });
  runStep('Frontend Unit Tests', 'npm test -- --passWithNoTests', { cwd: FRONTEND, hard: false });

  staticRegressionGuards();

  runStep('Production Auth Smoke Tests', 'node scripts/verify_shipped_fixes.mjs', { cwd: ROOT, hard: true });
  runStep('Indonesian Tone Audit', 'node scripts/tone_audit.mjs', { cwd: ROOT, hard: false });

  runD1('Production Stuck Diagnostic Sessions', `
    SELECT id, user_id, current_question, created_at
    FROM diagnostic_sessions
    WHERE status = 'in_progress'
      AND created_at < datetime('now', '-30 minutes')
    ORDER BY created_at ASC
    LIMIT 25;
  `, { expectEmpty: true });
  runD1('Production Stuck Exercise Sessions', `
    SELECT id, user_id, type, status, created_at, completed_at
    FROM exercise_sessions
    WHERE status = 'active'
      AND created_at < datetime('now', '-1 hour')
    ORDER BY created_at ASC
    LIMIT 25;
  `, { expectEmpty: true });
  runD1('Production Stuck Test Attempts', `
    SELECT id, user_id, test_type, current_section, status, started_at, current_question_index
    FROM test_attempts
    WHERE status = 'in_progress'
      AND started_at < datetime('now', '-2 hours')
    ORDER BY started_at ASC
    LIMIT 25;
  `, { expectEmpty: true });
  runD1('Production Recent Worker Errors', `
    SELECT id, error_type, message, created_at
    FROM error_logs
    WHERE created_at >= datetime('now', '-24 hours')
    ORDER BY created_at DESC
    LIMIT 50;
  `, { expectEmpty: true });
  runD1('Production Content Coverage', `
    SELECT test_type, section, question_type, difficulty, COUNT(*) AS n
    FROM test_contents
    WHERE status = 'published'
    GROUP BY test_type, section, question_type, difficulty
    ORDER BY test_type, section, question_type, difficulty;
  `);

  runStep('Content Spot Check', 'node scripts/content_spotcheck.mjs', {
    cwd: ROOT,
    hard: false,
    skip: process.env.CLOUDFLARE_API_TOKEN ? undefined : 'CLOUDFLARE_API_TOKEN is not set',
  });
  runStep('Duplicate Content Audit', 'node scripts/duplicate_audit.mjs', {
    cwd: ROOT,
    hard: false,
    skip: process.env.CLOUDFLARE_API_TOKEN ? undefined : 'CLOUDFLARE_API_TOKEN is not set',
  });

  await aiTriage();
  writeReport();

  process.exitCode = hardFailures > 0 ? 1 : 0;
}

main().catch((e) => {
  hardFailures++;
  if (!startFreshness) startFreshness = collectFreshness();
  section('Fatal Orchestrator Error');
  report.push(fence(e?.stack || e?.message || e));
  writeReport();
  process.exit(1);
});
