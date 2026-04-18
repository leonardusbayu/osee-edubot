# Obsidian + Claude Desktop Setup

**Goal:** give Claude Desktop sessions a persistent "second brain" in Obsidian
that complements the in-repo bug tracker. Useful for: quick thinking notes,
architecture sketches, session retrospectives, things too loose for a GitHub
issue or commit message.

**What you already have (don't duplicate):**
- `docs/BUGS.md` — structured bug log, lives in git, read at every session start via CLAUDE.md
- GitHub Issues (https://github.com/leonardusbayu/osee-edubot/issues) — stakeholder-facing items, already MCP-wired

**What Obsidian adds:**
- Rich linking across notes (`[[session-2026-04-18]]` style)
- Daily notes / session logs Claude can append to
- Pinned knowledge (e.g. "IELTS band descriptors", "common Indonesian student mistakes")
- Searchable across sessions without needing git commits

---

## One-time setup

### 1. Install Obsidian
https://obsidian.md → download for your OS → create a new vault called `EduBot`.

Suggested folder layout inside the vault:
```
EduBot/
├── 00-index.md              ← landing page; link-hub
├── sessions/                ← one note per Claude session
│   └── 2026-04-18.md
├── architecture/            ← long-form design docs
├── playbooks/               ← "how to do X" recipes
└── scratch/                 ← transient thoughts
```

### 2. Install the Obsidian MCP server
There are several community options. Recommended: **[`mcp-obsidian`](https://github.com/MarkusPfundstein/mcp-obsidian)** (Python, well-maintained).

Prereq: **Local REST API** plugin inside Obsidian itself.

In Obsidian:
1. Settings → Community plugins → Turn on community plugins (if not already)
2. Browse → search "Local REST API" → Install → Enable
3. Open the plugin's settings, note the **API Key** and **Port** (default 27124 for HTTPS / 27123 for HTTP)

Then install the MCP server on your machine:
```bash
# macOS / Linux
pipx install mcp-obsidian

# or with uv (preferred)
uv tool install mcp-obsidian

# Windows (PowerShell)
pip install mcp-obsidian
```

### 3. Wire it into Claude Desktop
Open `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Add an `obsidian` entry alongside any existing MCP servers:
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "mcp-obsidian",
      "env": {
        "OBSIDIAN_API_KEY": "<paste from the REST API plugin>",
        "OBSIDIAN_HOST": "127.0.0.1",
        "OBSIDIAN_PORT": "27124"
      }
    }
  }
}
```

If you're using `uv`-installed command, the `command` may need the full path — on macOS usually `/Users/<you>/.local/bin/mcp-obsidian`. `which mcp-obsidian` tells you.

### 4. Restart Claude Desktop
Quit fully (not just close the window — on macOS, cmd+Q). Relaunch. In a new chat, you should see Obsidian tools available (e.g. `obsidian-list-files-in-vault`, `obsidian-patch-content`, `obsidian-search`).

### 5. Smoke test
Open a chat in Claude Desktop and ask:
> List the files in my Obsidian vault.

You should see Claude call `obsidian-list-files-in-vault`. If it errors with "ECONNREFUSED" the REST API plugin isn't running (check Obsidian is open).

---

## How to use it with EduBot

### Start-of-session ritual
Ask Claude:
> Read `docs/BUGS.md` from the osee-edubot repo, then open my Obsidian session note for today (create if missing). Summarize what we worked on last session and what's open.

Claude will:
1. Pull BUGS.md from GitHub via MCP
2. List open issues via GitHub MCP
3. Create `sessions/2026-04-18.md` in Obsidian with a header
4. Summarize state in chat

### End-of-session ritual
> Write a retrospective to today's session note: what we fixed (commit SHAs), what's still open, what we learned, what to tackle first next session. Then update docs/BUGS.md and close any resolved GitHub issues.

Claude will append structured sections to the Obsidian note AND update the in-repo tracker.

### Pinned architecture notes (write once, reference forever)
Create these manually or ask Claude to draft them:
- `architecture/scoring-pipeline.md` — how `/finish` → `test_results` → `/results` works, where the gotchas are
- `architecture/tts-cache.md` — D1 cache key format, purge command, known failure modes
- `architecture/companion-states.md` — adaptive_mode matrix (validate/celebrate/reconnect/normal) with examples

When Claude has a question like "how does scoring work again?", you can say "check `architecture/scoring-pipeline.md` in my vault" and it'll read the pinned note instead of re-deriving from code.

---

## Testing setup (separate but related)

You mentioned testing. Current state: no test framework wired. Recommendation:

### Minimal viable test setup (can be added in 1 commit)
- **Worker:** `vitest` + `@cloudflare/vitest-pool-workers` — run D1 + Worker tests locally without deploying
- **Frontend:** `vitest` + React Testing Library — component + integration tests
- **CI integration:** add a `test` job to `.github/workflows/deploy.yml` that runs before deploy; deploys only if tests pass

### First tests to write (highest ROI for our bug classes)
1. `tests.ts` scoreAttempt() — speaking/writing band calculation, empty-attempt null return, unknown test_type rejection. This is THE bug cluster from the scoring audit; regression protection is critical.
2. `tts.ts` /speak endpoint — text with `%` character (double-decode regression), cache hit path, OpenAI error body surfaced to client
3. `post-test-review.ts` buildAttemptSummary() — rule-based synthesis for all four scoring paths (strong/wins/no-data/validate-mode)
4. Frontend TestRunner mapQuestion() — listen_and_repeat script fallback, empty error_id skip, grouped handling

Say "set up vitest and write the four priority tests" in a later session and I'll do it end-to-end (takes one commit).

---

## What NOT to put in Obsidian

- **Bug list** — lives in `docs/BUGS.md` + GitHub Issues; Obsidian would duplicate
- **Code** — lives in the repo
- **Stakeholder-facing status** — GitHub Issues is the source of truth
- **Secrets / tokens** — never

Obsidian is for working memory. Git is for canonical state. Keep that split clean and neither tool sprawls.

---

## Troubleshooting

**"MCP server obsidian not responding"**
- Is Obsidian itself open? The REST API plugin only runs while the app is open.
- Check `OBSIDIAN_PORT` matches what the plugin says.
- Try `curl -k https://127.0.0.1:27124/` — should get a JSON response.

**"Tool list empty in Claude Desktop"**
- Hard-quit Claude Desktop (cmd+Q / right-click taskbar → Quit) and reopen.
- Check `claude_desktop_config.json` JSON is valid (no trailing commas).
- Tail the Claude Desktop log: `~/Library/Logs/Claude/mcp*.log` on macOS.

**Stale note after edit outside Claude**
- Ask Claude to re-read: "reload my session note from Obsidian" — there's no push notification; it pulls on demand.
