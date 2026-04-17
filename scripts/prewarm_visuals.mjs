#!/usr/bin/env node
// Pre-warm the visual-explanation cache for the auto-visual concept catalog.
//
// Why: the tutor auto-injects [VISUAL:concept:type] tags when teaching
// high-value concepts. If the cache is cold, the first student to hit
// each (concept, type) pair pays the ~$0.04 fal.ai cost AND waits ~15s
// for generation. Pre-warming during off-hours fixes both.
//
// The catalog lives in worker/src/services/visual-explanation.ts as
// `AUTO_VISUAL_CONCEPTS`. We don't import TS from this Node script —
// instead we parse the exported array out of the source file as JSON-ish
// and walk it. That way the catalog stays single-source-of-truth in TS.
//
// Usage:
//   # Preview what would be generated (safe, no API calls):
//   node scripts/prewarm_visuals.mjs
//
//   # Generate everything missing from the cache:
//   node scripts/prewarm_visuals.mjs --apply
//
//   # Limit spend: stop after N cache-misses (each costs ~$0.04):
//   node scripts/prewarm_visuals.mjs --apply --max-misses=10
//
//   # Only warm a subset:
//   node scripts/prewarm_visuals.mjs --apply --concept=inference
//   node scripts/prewarm_visuals.mjs --apply --type=analogy
//
// Env:
//   WORKER_URL     - defaults to https://edubot-api.edubot-leonardus.workers.dev
//   ADMIN_API_KEY  - required (matches wrangler secret of the same name)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_WORKER_URL = 'https://edubot-api.edubot-leonardus.workers.dev';
const APPROX_COST = 0.04; // per fal.ai image

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_FILE = path.resolve(__dirname, '..', 'worker', 'src', 'services', 'visual-explanation.ts');

function parseArgs(argv) {
  const out = { apply: false, max_misses: Infinity };
  for (const a of argv.slice(2)) {
    if (a === '--apply') out.apply = true;
    else if (a.startsWith('--')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      out[k.replace(/-/g, '_')] = v ?? '1';
    }
  }
  if (out.max_misses !== Infinity) out.max_misses = parseInt(out.max_misses, 10) || Infinity;
  return out;
}

/**
 * Parse AUTO_VISUAL_CONCEPTS out of the TS source. We avoid a full TS
 * parser dependency — the catalog is a simple array literal with a
 * known shape. Each entry is: { concept: '...', types: ['...'], note?: '...' }
 * Returns [{ concept, types }].
 */
function loadCatalog() {
  const src = fs.readFileSync(CATALOG_FILE, 'utf8');
  const startMarker = 'export const AUTO_VISUAL_CONCEPTS';
  const startIdx = src.indexOf(startMarker);
  if (startIdx < 0) {
    throw new Error(`Could not find ${startMarker} in ${CATALOG_FILE}`);
  }
  // Capture from the `[` AFTER `= ` (to skip past the `AutoVisualEntry[]`
  // type annotation's empty brackets) up to the matching `];`.
  const assignIdx = src.indexOf('= [', startIdx);
  if (assignIdx < 0) throw new Error('No `= [` found after AUTO_VISUAL_CONCEPTS');
  const afterEquals = assignIdx + 2; // position of `[` itself
  let depth = 0;
  let endIdx = -1;
  for (let i = afterEquals; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }
  if (endIdx < 0) throw new Error('Unbalanced brackets in AUTO_VISUAL_CONCEPTS');
  const arrayText = src.slice(afterEquals, endIdx + 1);
  // Walk each top-level `{ ... }` block inside the array.
  const entries = [];
  let d = 0;
  let objStart = -1;
  for (let i = 0; i < arrayText.length; i++) {
    const ch = arrayText[i];
    if (ch === '{') {
      if (d === 0) objStart = i;
      d++;
    } else if (ch === '}') {
      d--;
      if (d === 0 && objStart >= 0) {
        const objText = arrayText.slice(objStart, i + 1);
        const concept = (objText.match(/concept:\s*'([^']+)'/) || [])[1];
        const typesMatch = (objText.match(/types:\s*\[([^\]]+)\]/) || [])[1];
        if (concept && typesMatch) {
          const types = [...typesMatch.matchAll(/'([^']+)'/g)].map(m => m[1]);
          entries.push({ concept, types });
        }
        objStart = -1;
      }
    }
  }
  return entries;
}

async function callGenerate(workerUrl, apiKey, concept, type) {
  const resp = await fetch(`${workerUrl}/api/visual/get-or-generate`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ concept, explanation_type: type }),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { error: text }; }
  return { ok: resp.ok, status: resp.status, body: json };
}

async function main() {
  const args = parseArgs(process.argv);
  const workerUrl = (process.env.WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, '');
  const apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ADMIN_API_KEY env var required.');
    console.error('  Windows CMD:  set ADMIN_API_KEY=your_key');
    console.error('  PowerShell:   $env:ADMIN_API_KEY="your_key"');
    console.error('  bash:         export ADMIN_API_KEY=your_key');
    process.exit(1);
  }

  const catalog = loadCatalog();
  const filterConcept = args.concept || null;
  const filterType = args.type || null;

  // Expand to concrete (concept, type) pairs.
  const pairs = [];
  for (const entry of catalog) {
    if (filterConcept && entry.concept !== filterConcept) continue;
    for (const t of entry.types) {
      if (filterType && t !== filterType) continue;
      pairs.push({ concept: entry.concept, type: t });
    }
  }

  console.log(`Worker: ${workerUrl}`);
  console.log(`Catalog: ${catalog.length} concepts, expanded to ${pairs.length} (concept, type) pairs`);
  console.log(`Mode: ${args.apply ? 'APPLY (will call fal.ai on cache miss)' : 'DRY RUN'}`);
  if (args.max_misses !== Infinity) console.log(`Cache-miss budget: ${args.max_misses}`);
  console.log('');

  if (!args.apply) {
    console.log('Pairs that would be requested:');
    for (const p of pairs) console.log(`  - ${p.concept.padEnd(22)}  ${p.type}`);
    console.log('');
    console.log('Re-run with --apply to actually warm the cache.');
    console.log(`Worst-case cost if ALL pairs miss: $${(pairs.length * APPROX_COST).toFixed(2)}`);
    return;
  }

  let hits = 0, misses = 0, failures = 0;
  const missed = [];
  for (const p of pairs) {
    if (misses >= args.max_misses) {
      console.log(`\n[BUDGET] Reached max-misses=${args.max_misses}. Stopping.`);
      break;
    }
    process.stdout.write(`  ${p.concept.padEnd(22)} ${p.type.padEnd(22)} ... `);
    const { ok, status, body } = await callGenerate(workerUrl, apiKey, p.concept, p.type);
    if (!ok) {
      failures++;
      console.log(`FAIL (${status}) ${body.error || ''}`);
      continue;
    }
    if (body.cache_hit) {
      hits++;
      console.log(`hit (id=${body.id}, variant=${body.variant})`);
    } else {
      misses++;
      missed.push(p);
      console.log(`miss → generated (id=${body.id}, variant=${body.variant})`);
    }
  }

  console.log('');
  console.log(`Summary: ${hits} hit, ${misses} miss (generated), ${failures} fail`);
  console.log(`Est. spend this run: $${(misses * APPROX_COST).toFixed(2)}`);
  if (misses > 0) {
    console.log('New cache entries:');
    for (const p of missed) console.log(`  + ${p.concept} / ${p.type}`);
  }
  if (failures > 0) {
    console.log('\nSome pairs failed. Check the worker logs (wrangler tail) for details.');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Fatal:', e?.stack || e);
  process.exit(1);
});
