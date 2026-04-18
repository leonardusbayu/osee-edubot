# Bulk Content Generator — Usage Guide

Fills thin buckets in `test_contents` by learning from existing published
questions in the same `(test_type, section, question_type)` bucket and
generating new ones in the same style.

## Quick start

```bash
cd "D:\claude telegram bot"

# One-time: put secrets in worker/.env (or export as env vars)
#   CLOUDFLARE_API_TOKEN=...
#   CLOUDFLARE_ACCOUNT_ID=6d55097e8961e881b77a4108e1ae40c2
#   OPENAI_API_KEY=sk-...

# First run — dry-run on the hottest bucket (Speaking listen_and_repeat)
npx tsx scripts/bulk-generate-content.ts \
  --test TOEFL_IBT --section speaking --type listen_and_repeat \
  --count 10 --dry-run
```

Dry-run generates + quality-grades without writing. Use it the first time
per bucket to sanity-check the style.

## Real runs — recommended priority (from today's variety audit)

| Priority | Bucket | Current | Target | Command |
|---|---|---|---|---|
| 1 | iBT listen_and_repeat | 37 | 100 | see below |
| 2 | iBT take_interview | 33 | 100 | |
| 3 | iBT integrated_writing | 10 | 40 | |
| 4 | TOEIC text_completion | 4 | 30 | |
| 5 | TOEIC reading_comprehension | 5 | 30 | |
| — | IELTS reading/listening | 8/10 | — | skip for now, too thin for few-shot |

```bash
# Speaking listen_and_repeat — biggest hot zone
npx tsx scripts/bulk-generate-content.ts \
  --test TOEFL_IBT --section speaking --type listen_and_repeat --count 50

# Speaking take_interview
npx tsx scripts/bulk-generate-content.ts \
  --test TOEFL_IBT --section speaking --type take_interview --count 50

# iBT integrated_writing
npx tsx scripts/bulk-generate-content.ts \
  --test TOEFL_IBT --section writing --type integrated_writing --count 25

# TOEIC reading gaps
npx tsx scripts/bulk-generate-content.ts \
  --test TOEIC --section reading --type text_completion --count 25
npx tsx scripts/bulk-generate-content.ts \
  --test TOEIC --section reading --type reading_comprehension --count 25
```

Cost: ~$0.006 per question (GPT-4o-mini gen + QA). Full priority list ≈ $1.

## How it works

1. **Reference fetch** — pulls 10 random published questions from the target
   bucket as few-shot examples. Need at least 3 refs; aborts otherwise.
2. **Topic avoidance** — queries the top 3 over-represented topics in that
   bucket and tells GPT to skip them → forces variety.
3. **Generate in batches** — `gpt-4o-mini` with `response_format=json_object`
   produces 5 questions per call. 2s rate limit between calls.
4. **Copy guard** — rejects any output that shares a ≥5-word phrase with the
   references. Prevents verbatim leaks.
5. **Quality sampler** — every surviving question is graded on a 5-axis
   rubric (clarity, answer_correctness, option_quality, passage_alignment,
   overall). Verdict: pass / concern / fail.
6. **Auto-promote** — only `verdict='pass' AND overall>=4` lands as
   `status='published' + source='ai_generated'`. Concerns and fails land
   as `status='draft'` for manual review.

## Safety rails

- Hard max 100 questions per run
- 2-second rate limit between generation calls
- Anti-copy guard (5-word phrase match vs references)
- Promotion requires pass + overall≥4 — no grey-area promotions
- `source='ai_generated'` column tags every AI-origin row so you can always
  filter, audit, or rollback:
  ```sql
  -- See all AI-generated questions
  SELECT * FROM test_contents WHERE source='ai_generated' ORDER BY created_at DESC;

  -- Rollback ALL AI-generated published rows (if quality proves bad)
  UPDATE test_contents SET status='archived'
   WHERE source='ai_generated' AND status='published';
  ```

## Reviewing the draft batch

After a run, manually review the `concern` verdict batch:

```sql
SELECT id, title, difficulty, content
  FROM test_contents
 WHERE source='ai_generated'
   AND status='draft'
   AND test_type=?
 ORDER BY created_at DESC LIMIT 20;
```

For good ones: `UPDATE test_contents SET status='published' WHERE id=?;`
For bad ones: `UPDATE test_contents SET status='archived' WHERE id=?;`

## Copyright / ethics note

The script learns STYLE / STRUCTURE / DIFFICULTY patterns from real exam
questions already in your bank (which were legitimately licensed / sourced
via your parse scripts). It generates ORIGINAL passages on DIFFERENT topics
in the same cognitive mold.

The copy-guard phrase check is belt-and-suspenders protection — reject any
output that accidentally reuses ≥5 consecutive words from a reference.
