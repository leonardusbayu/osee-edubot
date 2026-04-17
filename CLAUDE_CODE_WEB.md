# Claude Code on the Web — EduBot dispatch guide

Use this to kick off coding tasks against `leonardusbayu/osee-edubot` from Android (or any browser).

## One-time setup

1. **Desktop browser:** go to https://claude.ai/code, sign in, install the **Claude GitHub App** when prompted, grant access to `osee-edubot`.
2. **Create an environment** named `edubot`:
   - **Setup script:**
     ```bash
     cd worker && npm install
     cd ../frontend && npm install
     ```
     If the frontend install ever errors on a rollup native binary, add `|| npm install --force` to the second line.
   - **Network access:** Trusted (default).
   - **Env vars:** leave empty for now. Only add `CLOUDFLARE_API_TOKEN` / `OPENAI_API_KEY` if you later want the sandbox to deploy or hit APIs directly — for normal work, leave them out.
3. **Android:** install the Claude app (Play Store) and sign in. The Code tab shares the same sessions as web.

## Dispatch flow

1. Open Code tab → select `osee-edubot` / `main` → type task → send.
2. Claude works in the sandbox; you can close the app. Push notifications alert you when the session finishes.
3. Review the diff in-app, ask for revisions, then open PR → merge.
4. On your Windows PC: `git pull`, then deploy:
   - Frontend: `cd frontend && npm run build && cd ../worker && npx wrangler pages deploy ../frontend/dist --project-name edubot-webapp`
   - Worker: `cd worker && npx wrangler deploy`
   - Migrations: `cd worker && npx wrangler d1 execute edubot-db --remote --file=./migrations/0NNN_name.sql`

## What NOT to do from the web sandbox

- `npx wrangler deploy` / `pages deploy` — no Cloudflare session inside the sandbox.
- `npx wrangler d1 execute --remote` — same reason. Use the D1 MCP from desktop Claude instead.
- Long-running processes (`wrangler dev`) — sandbox isn't reachable.

Sandbox is good for: writing code, typechecking (`tsc --noEmit`), running offline tests, grepping the codebase, drafting migrations/routes/services.

## Suggested first prompts from phone

- "Audit all files under `worker/src/services/` and list any that are not imported anywhere."
- "Run `tsc --noEmit` in both `worker/` and `frontend/` and report errors."
- "Draft migration 0NN that adds `<column>` to `<table>`, with rollback SQL."

## Before dispatching

Make sure your local work is committed and pushed — otherwise the sandbox starts from a stale `main` and you get merge conflicts when you come back to desktop.
