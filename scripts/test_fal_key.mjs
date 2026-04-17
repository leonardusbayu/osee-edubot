#!/usr/bin/env node
// Minimal fal.ai auth probe. Hits gemini-25-flash-image with a trivial
// prompt to confirm the key + billing + model access are all valid.
// Bypasses the worker entirely — so a pass here means the problem is
// on OUR side (wrong secret value), and a fail here means fal's side
// (bad key / no billing / no model access).
//
// Usage:
//   set FAL_API_KEY=<your fal key, format KEY_ID:KEY_SECRET>
//   node scripts/test_fal_key.mjs

const key = process.env.FAL_API_KEY;
if (!key) {
  console.error('ERROR: FAL_API_KEY env var required.');
  console.error('  Windows CMD:   set FAL_API_KEY=KEY_ID:KEY_SECRET');
  console.error('  PowerShell:    $env:FAL_API_KEY="KEY_ID:KEY_SECRET"');
  process.exit(1);
}

// Sanity: fal keys are KEY_ID:KEY_SECRET. If there's no colon, the key
// is incomplete — catch this before the round trip.
if (!key.includes(':')) {
  console.warn('WARN: FAL_API_KEY has no colon. Real fal keys are two hex strings joined by ":". Your key may be incomplete.');
}

const url = 'https://fal.run/fal-ai/gemini-25-flash-image';
const body = { prompt: 'simple test diagram with a circle and an arrow', num_images: 1, output_format: 'png' };

console.log(`POST ${url}`);
console.log(`Key prefix: ${key.slice(0, 8)}... (length ${key.length}, contains colon: ${key.includes(':')})`);
console.log('Sending request (can take ~15s)...');

const started = Date.now();
const resp = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Key ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

const text = await resp.text();
let json;
try { json = JSON.parse(text); } catch { json = null; }

console.log(`\nResponse after ${elapsed}s: HTTP ${resp.status}`);
if (resp.ok && json?.images?.[0]?.url) {
  console.log('SUCCESS — key works and has access to the model.');
  console.log('Image URL:', json.images[0].url);
  console.log('\nIf the worker is still 401-ing, re-put the secret:');
  console.log('  cd worker && npx wrangler secret put FAL_API_KEY');
  process.exit(0);
} else {
  console.log('FAIL — fal rejected the request.');
  console.log('Response body:', text.slice(0, 500));
  if (resp.status === 401) {
    console.log('\n401 diagnosis:');
    console.log('  - Bad/expired key, OR');
    console.log('  - No billing on the fal account (gemini-25-flash-image is paid).');
    console.log('  Check https://fal.ai/dashboard/keys and https://fal.ai/dashboard/billing');
  } else if (resp.status === 402 || resp.status === 403) {
    console.log('\nLooks like a billing/plan issue. Check https://fal.ai/dashboard/billing');
  }
  process.exit(1);
}
