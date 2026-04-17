#!/usr/bin/env node
// Dry-run audit and (optionally) promote draft test_contents to published.
//
// This wraps POST /api/v1/admin/content/audit-and-publish so the same logic
// used by the (future) admin UI runs here against the live worker. The
// validator itself lives in TypeScript so we don't reimplement it here —
// the worker owns the truth.
//
// Usage:
//   # Preview what would happen (safe, no DB writes):
//   node scripts/audit_and_publish_drafts.mjs
//
//   # Scope to a section or question_type:
//   node scripts/audit_and_publish_drafts.mjs --section=listening
//   node scripts/audit_and_publish_drafts.mjs --question_type=listen_conversation
//
//   # Different test:
//   node scripts/audit_and_publish_drafts.mjs --test_type=IELTS
//
//   # Actually promote (flips status=draft -> published for passing rows):
//   node scripts/audit_and_publish_drafts.mjs --apply
//
//   # Treat warnings as blockers (stricter gate):
//   node scripts/audit_and_publish_drafts.mjs --strict-warnings
//
// Env:
//   WORKER_URL       - e.g. https://edubot-worker.<you>.workers.dev
//                      (defaults to https://edubot-worker.leonardusbayu.workers.dev)
//   ADMIN_API_KEY    - value matching the worker secret of the same name.
//                      Required. Do NOT commit this to source.

const DEFAULT_WORKER_URL = 'https://edubot-api.edubot-leonardus.workers.dev';

function parseArgs(argv) {
  const out = { apply: false, strict_warnings: false };
  for (const a of argv.slice(2)) {
    if (a === '--apply') out.apply = true;
    else if (a === '--strict-warnings') out.strict_warnings = true;
    else if (a.startsWith('--')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      out[k] = v ?? '1';
    }
  }
  return out;
}

function fmt(n) {
  return String(n).padStart(4);
}

async function main() {
  const args = parseArgs(process.argv);
  const workerUrl = (process.env.WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, '');
  const apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ADMIN_API_KEY env var is required.');
    console.error('Set it with your admin key, e.g.  set ADMIN_API_KEY=...  (Windows)  or  export ADMIN_API_KEY=...  (bash)');
    process.exit(1);
  }

  const params = new URLSearchParams();
  params.set('test_type', args.test_type || 'TOEFL_IBT');
  if (args.section) params.set('section', args.section);
  if (args.question_type) params.set('question_type', args.question_type);
  if (args.limit) params.set('limit', args.limit);
  params.set('dry_run', args.apply ? '0' : '1');
  params.set('strict_warnings', args.strict_warnings ? '1' : '0');

  const url = `${workerUrl}/api/v1/admin/content/audit-and-publish?${params.toString()}`;
  console.log(`[audit] POST ${url}`);
  console.log(`[audit] apply=${args.apply}  strict_warnings=${args.strict_warnings}`);

  const res = await fetch(url, { method: 'POST', headers: { 'X-API-Key': apiKey } });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[audit] HTTP ${res.status}: ${text}`);
    process.exit(1);
  }
  const body = await res.json();

  console.log();
  console.log(`test_type:       ${body.test_type}`);
  console.log(`section filter:  ${body.section ?? '(all)'}`);
  console.log(`type filter:     ${body.question_type ?? '(all)'}`);
  console.log(`dry_run:         ${body.dry_run}`);
  console.log(`strict_warnings: ${body.strict_warnings}`);
  console.log(`evaluated:       ${body.evaluated}`);
  console.log(`would_publish:   ${body.would_publish}`);
  console.log(`would_skip:      ${body.would_skip}`);
  console.log(`promoted:        ${body.promoted}`);

  if (Array.isArray(body.by_type) && body.by_type.length > 0) {
    console.log();
    console.log('By section / question_type:');
    console.log('  section              question_type                       pass  skip');
    for (const row of body.by_type) {
      const sec = (row.section || '').padEnd(20);
      const qt = (row.question_type || '').padEnd(35);
      console.log(`  ${sec} ${qt} ${fmt(row.would_publish)} ${fmt(row.would_skip)}`);
    }
  }

  if (Array.isArray(body.skip_sample) && body.skip_sample.length > 0) {
    console.log();
    console.log(`Sample skipped (showing up to ${body.skip_sample.length}):`);
    for (const s of body.skip_sample.slice(0, 15)) {
      const first = (s.errors && s.errors[0]) || '(no reason)';
      console.log(`  #${s.id}  [${s.section}/${s.question_type}]  ${first}`);
    }
    if (body.would_skip > body.skip_sample.length) {
      console.log(`  ... and ${body.would_skip - body.skip_sample.length} more`);
    }
  }

  if (!args.apply) {
    console.log();
    console.log('This was a dry run. To actually promote passing drafts, re-run with --apply.');
  } else {
    console.log();
    console.log(`Promoted ${body.promoted} rows from draft -> published.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
