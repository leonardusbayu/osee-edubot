# CONVENTIONS.md — Code Patterns

## TypeScript

### Types
- All API interfaces in `worker/src/types.ts` or route files
- Frontend types in `frontend/src/types/index.ts`
- Use `interface` not `type` for object shapes
- Nullable fields use `| null` not `undefined`

### Env bindings
```typescript
// worker/src/types.ts
export interface Env {
  DB: D1Database;
  AUDIO_BUCKET?: R2Bucket;
  TELEGRAM_BOT_TOKEN: string;
  OPENAI_API_KEY: string;
  JWT_SECRET: string;
  // ...
}
```

## Hono Routes

### Pattern
```typescript
// Route files export a Hono instance
export const testRoutes = new Hono<{ Bindings: Env }>();

testRoutes.get('/available', async (c) => {
  // Access env via c.env
  // Return c.json({ ... }) or c.text(..., status)
});
```

### Auth check
```typescript
const user = await getAuthUser(c.req.raw, c.env);
if (!user) return c.json({ error: 'Unauthorized' }, 401);
```

## API Response Format

### Success
```typescript
return c.json({ field: value });
```

### Error
```typescript
return c.json({ error: 'Human-readable message' }, 400); // 400, 401, 403, 404, 500
```

### Known error codes
- `LIMIT_REACHED` — quota exceeded (returns 403 with quota details)
- All quota responses include: `{ daily_limit, used_today, bonus_quota, remaining, reset_at }`

## Database (D1)

### Prepared statements (always use)
```typescript
const result = await c.env.DB.prepare(
  'SELECT * FROM table WHERE id = ?'
).bind(id).first();

const results = await c.env.DB.prepare(
  'SELECT * FROM table WHERE field = ?'
).bind(value).all();
```

### JSON fields
- Store complex objects as JSON strings: `JSON.stringify(data)`
- Parse on read: `JSON.parse(row.json_field || '{}')`
- Always handle parse errors: `try { ... } catch {}`

### Timestamps
- Store as ISO strings: `new Date().toISOString()`
- Use `datetime('now')` for D1 default values
- Daily reset at midnight WIB = 17:00 UTC

## Telegram Bot

### Message sending
```typescript
async function sendMessage(env: Env, chatId: number, text: string, replyMarkup?: any) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup }),
  });
}
```

### Clean text for Telegram
```typescript
// Strip markdown Telegram can't render
.replace(/#{1,6}\s*/g, '')     // Remove headers
.replace(/\*\*(.+?)\*\*/g, '$1') // Bold
.replace(/\*(.+?)\*/g, '$1')   // Italic
.replace(/`(.+?)`/g, '$1')     // Code
```

## Frontend Components

### State management
- Test session state: Zustand store in `stores/test.ts`
- Auth tokens: Zustand store in `stores/auth.ts`
- No Redux — keep it simple

### API calls
- Use `authedFetch` helper for authenticated requests (reads from URL params + header)
- Standard `fetch` for public endpoints

### Routing
- React Router v6
- Routes defined in `App.tsx`
- Telegram Mini App URL format: `https://domain/app/{route}`

## Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `content-generator.ts`, `test-selection.tsx` |
| Functions | camelCase | `checkTestAccess`, `handleSubmitAnswer` |
| Interfaces | PascalCase | `PremiumInfo`, `QuotaInfo` |
| Constants | SCREAMING_SNAKE | `DAILY_QUESTION_LIMIT`, `REFERRAL_BONUS_PER_INVITE` |
| CSS classes | kebab-case | `bg-tg-secondary`, `text-tg-button` |
| Env vars | UPPER_SNAKE | `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY` |

## File Organization

```
worker/src/
  index.ts          — Main entry, cron handlers, route mounting
  types.ts          — Shared TypeScript interfaces
  bot/
    webhook.ts      — All Telegram bot logic (large — use offset when editing)
  routes/           — One file per API route group
  services/         — Business logic, separated by domain

frontend/src/
  App.tsx           — Router + auth initialization
  pages/            — One file per page/component
  api/              — API client functions
  stores/           — Zustand stores
  components/       — Shared React components
```

## Error Handling

### In routes
- Always wrap DB calls in try/catch
- Log errors: `console.error('Description:', e)`
- Return generic error to client: `return c.json({ error: '...' }, 500)`

### In cron handlers
- Errors caught at top level, logged, never crash
- `ctx.waitUntil()` for async operations

## Import Patterns

```typescript
// Dynamic import for large modules (Cloudflare Workers bundle optimization)
const { functionName } = await import('./services/module');

// Relative imports
import { something } from '../services/module';
import type { Env } from '../types';
```

## CSS/Tailwind

- Use Telegram theme variables: `bg-tg-bg`, `text-tg-text`, `text-tg-hint`, `bg-tg-secondary`, `text-tg-button`
- No custom CSS files unless absolutely necessary
- Mobile-first, works on low-end Android 3G
