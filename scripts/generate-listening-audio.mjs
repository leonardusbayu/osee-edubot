#!/usr/bin/env node
// Drive bulk listening audio generation against the deployed worker.
//
// Usage:
//   node scripts/generate-listening-audio.mjs --test=IELTS --limit=3   # test run
//   node scripts/generate-listening-audio.mjs --test=IELTS             # all IELTS
//   node scripts/generate-listening-audio.mjs --all                    # everything
//
// The script:
//   1. Fetches the list of listening question IDs from D1 via wrangler.
//   2. For each ID, calls POST /api/admin/audio/generate with X-Bulk-Token.
//   3. Runs N requests in parallel (default 3) with retry on transient failure.
//   4. Prints per-question result + final summary.
//
// Cost: ~$0.30 per 1000 chars on ElevenLabs standard plan. Estimated
// total ~$75 for all 4 tests (~250K chars of scripts). The script
// pauses 250ms between requests to stay within the 5 req/s rate limit.

import { execSync } from 'node:child_process';
import fs from 'node:fs';

// All secrets read from environment — no hardcoded credentials.
// Required env vars:
//   ELEVENLABS_API_KEY   — the ElevenLabs API key (also used as X-Bulk-Token)
//   CF_API_TOKEN          — Cloudflare API token for wrangler D1 commands
// Optional:
//   WORKER_URL            — defaults to the prod worker
//   CONCURRENCY           — defaults to 3
//
// Copy .env or export manually before running:
//   $env:ELEVENLABS_API_KEY = 'sk-...'
//   $env:CF_API_TOKEN = 'cfat-...'
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
const CF_TOKEN = process.env.CF_API_TOKEN;
const WORKER_URL = process.env.WORKER_URL || 'https://edubot-api.edubot-leonardus.workers.dev';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3');

if (!ELEVENLABS_KEY || !CF_TOKEN) {
  console.error('Missing ELEVENLABS_API_KEY or CF_API_TOKEN env var. Set them and retry.');
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
const testFilter = args.find((a) => a.startsWith('--test='))?.split('=')[1];
const allFlag = args.includes('--all');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0;
const idsArg = args.find((a) => a.startsWith('--ids='));
const explicitIds = idsArg ? idsArg.split('=')[1].split(',').map((s) => parseInt(s)).filter(Boolean) : [];
const force = args.includes('--force');

if (!testFilter && !allFlag && explicitIds.length === 0) {
  console.error('Usage: node scripts/generate-listening-audio.mjs --test=IELTS | --all | --ids=1,2,3 [--limit=N]');
  process.exit(1);
}

// Fetch question list via wrangler D1
function fetchQuestionIds(testType) {
  const where = testType
    ? `section = 'listening' AND test_type = '${testType}'`
    : `section = 'listening' AND test_type IN ('IELTS','TOEFL_IBT','TOEFL_ITP','TOEIC')`;
  const cmd = `npx wrangler d1 execute edubot-db --remote --command "SELECT id, test_type, question_type FROM test_contents WHERE ${where} ORDER BY id" --json`;
  const out = execSync(cmd, {
    cwd: 'D:\\claude telegram bot\\worker',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN },
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const j = JSON.parse(out);
  // wrangler --json returns an array of run objects, each with .results
  const arr = Array.isArray(j) ? j[0].results : j.results;
  return arr || [];
}

// Call the worker's single-question generate endpoint
async function generateOne(q) {
  const url = `${WORKER_URL}/api/admin/audio/generate`;
  const body = JSON.stringify({ question_id: q.id, force });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bulk-Token': ELEVENLABS_KEY,
        },
        body,
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        return { ok: true, q, source: j.source, size: j.sizeBytes, segments: j.segments };
      }
      // 4xx = permanent failure (no script, parse error) — don't retry
      if (res.status >= 400 && res.status < 5000 && res.status !== 429) {
        return { ok: false, q, error: j.error || `HTTP ${res.status}`, permanent: true };
      }
      // 5xx or 429 = retry
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      return { ok: false, q, error: j.error || `HTTP ${res.status}` };
    } catch (e) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      return { ok: false, q, error: e?.message || String(e) };
    }
  }
  return { ok: false, q, error: 'exhausted retries' };
}

async function main() {
  let questions;
  if (explicitIds.length > 0) {
    const cmd = `npx wrangler d1 execute edubot-db --remote --command "SELECT id, test_type, question_type FROM test_contents WHERE id IN (${explicitIds.join(',')})" --json`;
    const out = execSync(cmd, {
      cwd: 'D:\\claude telegram bot\\worker',
      env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN },
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const j = JSON.parse(out);
    questions = (Array.isArray(j) ? j[0].results : j.results) || [];
  } else {
    questions = fetchQuestionIds(testFilter);
  }
  if (limit > 0) questions = questions.slice(0, limit);

  console.log(`Generating audio for ${questions.length} questions (concurrency=${CONCURRENCY})`);
  console.log(`Test filter: ${testFilter || 'all'}`);
  console.log('');

  let ok = 0;
  let failed = 0;
  let cached = 0;
  let fresh = 0;
  let totalBytes = 0;
  const failures = [];
  const startMs = Date.now();

  let idx = 0;
  async function worker(workerId) {
    while (idx < questions.length) {
      const q = questions[idx++];
      const result = await generateOne(q);
      if (result.ok) {
        ok++;
        if (result.source === 'cache') cached++; else fresh++;
        totalBytes += result.size || 0;
        const progress = `[${ok + failed}/${questions.length}]`;
        console.log(`${progress} q${q.id} ${q.test_type}/${q.question_type} ${result.source} ${result.size}B ${result.segments}seg`);
      } else {
        failed++;
        if (!result.permanent) console.error(`q${q.id} FAILED: ${result.error}`);
        failures.push({ id: q.id, test_type: q.test_type, question_type: q.question_type, error: result.error });
      }
      // brief pause to avoid ElevenLabs rate limit
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  const elapsed = Math.round((Date.now() - startMs) / 1000);
  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`Total: ${questions.length}`);
  console.log(`OK: ${ok} (cache: ${cached}, fresh: ${fresh})`);
  console.log(`Failed: ${failed}`);
  console.log(`Bytes: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Elapsed: ${elapsed}s (${(questions.length / Math.max(elapsed, 1)).toFixed(2)} q/s)`);

  if (failures.length > 0) {
    fs.writeFileSync('D:\\claude telegram bot\\artifacts\\audio-failures.json', JSON.stringify(failures, null, 2));
    console.log(`\nFailures saved to artifacts/audio-failures.json`);
    // Print first 5 failures
    console.log('\nFirst 5 failures:');
    failures.slice(0, 5).forEach((f) => console.log(`  q${f.id} ${f.test_type}/${f.question_type}: ${f.error}`));
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});