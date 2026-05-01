# EduBot Bug-Hunting Pipeline

Run the full local pipeline:

```bash
npm run bug-hunt
```

The pipeline writes four artifacts:

```text
artifacts/bug-hunt-report.md
artifacts/bug-hunt-report.html
artifacts/bug-hunt-summary.json
artifacts/bug-hunt-ledger.jsonl
```

The Markdown report is optimized for GitHub summaries. The HTML report is a
read-only static dashboard. The JSON summary is machine-readable for scripts,
and the JSONL ledger is append-only history so bug-hunt runs remain resumable.

## What It Runs

1. Worker TypeScript check
2. Frontend TypeScript check
3. Frontend production build
4. Worker unit tests
5. Frontend unit tests
6. Static regression guards for diagnostic, Telegram callbacks, and FSRS
7. Production auth smoke tests
8. Indonesian tone audit
9. Production stuck-state queries for diagnostic, exercises, test attempts, and error logs
10. Content spot check
11. Duplicate content audit
12. Optional OpenAI triage summary
13. Freshness check for git branch/commit, relevant dirty files, and bug-hunt
    pipeline inputs

## Machine-Readable Contract

At the end of each run the script prints deterministic lines:

```text
METRIC hard_failures=0
METRIC soft_findings=1
METRIC steps_total=14
ARTIFACT markdown_report=artifacts/bug-hunt-report.md
ARTIFACT html_report=artifacts/bug-hunt-report.html
ARTIFACT summary_json=artifacts/bug-hunt-summary.json
ARTIFACT ledger=artifacts/bug-hunt-ledger.jsonl
```

Use these lines for dashboards or automation instead of scraping prose.

## Freshness Policy

Each run records git branch, commit, relevant worktree status, and a hash of the
bug-hunt pipeline inputs. A freshness finding is added if those inputs change
while the run is executing. Dirty files are reported but do not fail the run by
themselves; they are context for whether the result is safe to trust.

## Required Secrets For Full Production Checks

Set these as GitHub repository secrets for the scheduled workflow:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
OPENAI_API_KEY
```

Without Cloudflare secrets, production D1 checks are skipped. Without `OPENAI_API_KEY`, the deterministic checks still run, but AI triage is skipped.

## Cron

The workflow `.github/workflows/bug-hunt.yml` runs daily at `20:15 UTC`, which is `03:15 WIB`.

You can also start it manually from GitHub Actions with `workflow_dispatch`.

## Policy

Hard failures fail the workflow:

- TypeScript failures
- Frontend build failure
- Security/auth smoke-test failure
- Regression guard failure

Soft findings do not fail the workflow but appear in the report:

- Unit test gaps/failures while coverage is incomplete
- Tone findings
- Content spot-check findings
- Duplicate audit findings
- OpenAI triage warnings
- Freshness drift while a run is executing
