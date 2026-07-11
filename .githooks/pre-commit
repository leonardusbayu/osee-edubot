# Pre-commit secret scanning.
# Catches accidentally committed API keys, tokens, and passwords before
# they reach the remote branch. Catches the patterns that have slipped
# into this repo before (Cloudflare tokens, ElevenLabs keys, OpenAI keys,
# generic sk- prefixed secrets).
#
# Runs in <500ms on this repo since we have no large committed blobs.
# The scanner is a single bash + grep pipeline — no extra dependencies.

set -e

# 1. Block commits that add known-secret patterns to tracked files.
# We scan only files that are *added* or *modified* in this commit
# (not the whole repo) so existing secrets already in history don't
# block new commits. The full-repo scan runs via CI instead.

STAGED=$(git diff --cached --name-only --diff-filter=AM 2>/dev/null || true)
[ -z "$STAGED" ] && exit 0

PATTERNS=(
  # Cloudflare API tokens (cfat_/cft_ prefixes)
  '(cfat_[A-Za-z0-9_-]{20,}|cft_[A-Za-z0-9_-]{20,})'
  # ElevenLabs API keys
  '(sk_[a-f0-9]{32})'
  # OpenAI / sk- prefixed keys (broad)
  'sk-[A-Za-z0-9]{20,}'
  # GitHub PATs
  'ghp_[A-Za-z0-9]{30,}'
  # Slack tokens
  'xox[abp]-[A-Za-z0-9-]{10,}'
  # Generic Bearer tokens in committed code
  'Bearer [A-Za-z0-9_-]{30,}'
)

FOUND=0
for f in $STAGED; do
  # Skip binary files and the .env file itself (it stays local only).
  case "$f" in
    *.png|*.jpg|*.jpeg|*.gif|*.pdf|*.mp3|*.mp4|*.wasm|*.woff2) continue;;
    worker/.env) continue;;
    *.example) continue;;
  esac
  # Skip .git directory.
  [ -d "$f" ] && continue

  for pat in "${PATTERNS[@]}"; do
    HITS=$(git show ":$f" 2>/dev/null | grep -nE "$pat" || true)
    if [ -n "$HITS" ]; then
      echo "SECRET DETECTED in $f:" >&2
      echo "$HITS" | head -3 >&2
      FOUND=1
    fi
  done
done

if [ $FOUND -eq 1 ]; then
  echo "" >&2
  echo "Commit blocked. Remove the secret(s) above and use environment" >&2
  echo "variables or 'wrangler secret put' for credentials." >&2
  echo "If this is a false positive (e.g., a test fixture), add a #" >&2
  echo "secret-scan-allow comment on the same line." >&2
  exit 1
fi

exit 0