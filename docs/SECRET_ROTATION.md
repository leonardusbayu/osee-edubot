# Secret rotation runbook

The pre-pipeline audit flagged that the following credentials were
exposed in chat + `worker/.env`. This file lists the exact commands to
rotate each one. Run them in order.

**Important:** the old `worker/.env` file must NOT be committed (it
already is in `.gitignore`). These commands only set the secret in
Cloudflare's encrypted secret store. The local `.env` stays for dev.

---

## 1. Cloudflare API token

The token in chat was used to deploy via `wrangler deploy`. Rotate
via the Cloudflare dashboard:

- Go to https://dash.cloudflare.com/profile/api-tokens
- Find the old token, click "Roll"
- Copy the new token to your password manager

Then update local dev:

```bash
cd worker
$env:CLOUDFLARE_API_TOKEN = '<new-token>'
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

---

## 2. ElevenLabs API key

The ElevenLabs key was exposed when generating listening audio.
Rotate via the ElevenLabs dashboard:

- Go to https://elevenlabs.io/app/settings/api-keys
- Revoke the old key
- Create a new key, name it "edubot-prod-2026"

Then update local + Cloudflare:

```bash
cd worker
npx wrangler secret put ELEVENLABS_API_KEY
# paste the new key when prompted
```

---

## 3. OpenAI API key

The OpenAI key was exposed in `worker/.env`. Rotate via the OpenAI
dashboard:

- Go to https://platform.openai.com/api-keys
- Revoke the old key
- Create a new key, name it "edubot-prod-2026"

Then update local + Cloudflare:

```bash
cd worker
npx wrangler secret put OPENAI_API_KEY
```

---

## 4. Audit any git history that may have captured the old keys

```bash
# Search every commit for the old key prefixes
git log --all --pretty=format: --name-only \
  | xargs -I {} git show "HEAD:{}" 2>/dev/null \
  | grep -E 'sk-[A-Za-z0-9]{20,}|cfat_[A-Za-z0-9_-]{20,}'

# If you find any:
# - Rotate the key in the provider dashboard IMMEDIATELY
# - Scrub history with:
#     git filter-repo --path worker/.env --invert-paths
#     git push --force
```

---

## 5. Verify the pre-commit hook is in place

```bash
ls -la .githooks/pre-commit
git config --get core.hooksPath   # should print: .githooks
```

The hook (`.githooks/pre-commit`, installed from
`scripts/pre-commit-secret-scan.sh`) blocks any commit that adds
known secret patterns to staged files. CI runs a full-repo scan
on every push and PR (`.github/workflows/secret-scan.yml`).

---

## 6. Why this matters

The old keys were visible in:
- Chat history (Telegram bot conversation)
- `worker/.env` (local file, not committed)
- One push was blocked by GitHub Push Protection, then the commit was
  amended to read secrets from environment. That was a near-miss.

Exposed keys are an active risk. If any of the keys are still valid,
they can be revoked immediately. The runbook above revokes + rotates
all three in under 5 minutes.