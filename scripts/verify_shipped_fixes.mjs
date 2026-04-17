#!/usr/bin/env node
// Verify shipped security/auth fixes against production.
// Run from repo root: node scripts/verify_shipped_fixes.mjs

const API = 'https://edubot-api.edubot-leonardus.workers.dev';

const tests = [
  {
    name: 'Bot webhook rejects POST without secret header',
    url: `${API}/api/bot/webhook`,
    method: 'POST',
    body: JSON.stringify({ update_id: 1 }),
    headers: { 'Content-Type': 'application/json' },
    expect: [401, 403],
  },
  {
    name: 'Bot webhook rejects invalid secret header',
    url: `${API}/api/bot/webhook`,
    method: 'POST',
    body: JSON.stringify({ update_id: 1 }),
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'bogus-token',
    },
    expect: [401, 403],
  },
  {
    name: 'Tests /start rejects anonymous',
    url: `${API}/api/tests/start`,
    method: 'POST',
    body: JSON.stringify({ section: 'reading' }),
    headers: { 'Content-Type': 'application/json' },
    expect: [401],
  },
  {
    name: 'Speaking /evaluate rejects anonymous',
    url: `${API}/api/speaking/evaluate`,
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
    expect: [401],
  },
  {
    name: 'Writing /evaluate rejects anonymous',
    url: `${API}/api/writing/evaluate`,
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
    expect: [401],
  },
  {
    name: 'TTS /speak rejects anonymous (GET)',
    url: `${API}/api/tts/speak?text=hello`,
    method: 'GET',
    expect: [401],
  },
  {
    name: 'TTS /dialogue rejects anonymous',
    url: `${API}/api/tts/dialogue`,
    method: 'POST',
    body: JSON.stringify({ text: 'hello' }),
    headers: { 'Content-Type': 'application/json' },
    expect: [401],
  },
  {
    name: 'Health check is public',
    url: `${API}/api/health`,
    method: 'GET',
    expect: [200],
  },
];

let passed = 0;
let failed = 0;

console.log('\n=== Verifying shipped auth/security fixes ===\n');

for (const t of tests) {
  try {
    const res = await fetch(t.url, {
      method: t.method,
      headers: t.headers || {},
      body: t.body,
    });
    const ok = t.expect.includes(res.status);
    if (ok) {
      console.log(`  PASS  ${t.name}  (${res.status})`);
      passed++;
    } else {
      console.log(`  FAIL  ${t.name}  expected ${t.expect.join('/')}, got ${res.status}`);
      failed++;
    }
  } catch (e) {
    console.log(`  ERR   ${t.name}  ${e.message}`);
    failed++;
  }
}

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);

console.log('Manual checks still needed (require real Telegram user):');
console.log('  1. Streak counter increments after /review answer');
console.log('  2. Mock-mode test returns TIME_EXPIRED after 30s+deadline');
console.log('  3. Duplicate payment webhook returns {duplicate: true}');
console.log('  4. Diagnostic completion grants 3-day premium trial (once)');
console.log('  5. 7/10 quota hit triggers upgrade nudge (once per WIB day)');

process.exit(failed > 0 ? 1 : 0);
