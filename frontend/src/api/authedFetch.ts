import { useAuthStore } from '../stores/auth';

const TG_ID_STORAGE_KEY = 'edubot_tg_id';

// In-memory fallback for sessionStorage. Telegram's in-app webview (especially
// on iOS) sometimes blocks or wipes sessionStorage for iframed mini apps. If
// sessionStorage fails silently, audio URLs lose their tg_id and media fetches
// 401. A module-level variable survives react-router navigations within the
// same SPA session and doesn't depend on storage permissions.
let memoTgId: string | null = null;

/**
 * Resolve the Telegram user ID and STASH it in memory + sessionStorage.
 * React-router navigations replace the URL with `/test/:attemptId`, which
 * erases the `?tg_id=` param passed in by the bot keyboard. Without that
 * param, media URLs (TTS `<audio src>`) and other anonymous endpoints lose
 * their auth and return 401. So on first read we persist; later reads fall
 * back to the cache. Memory cache wins over storage so iOS webview users who
 * get sessionStorage blocked still have a working value.
 *
 * Exported so other modules (TestRunner's media-URL builder, ReportIssueButton,
 * etc.) can share the same cached value instead of re-doing URL/SDK lookups
 * that have since been wiped.
 */
export function getTelegramUserId(): string | null {
  // 0a. In-memory cache — never fails, survives nav within the SPA session.
  if (memoTgId) return memoTgId;

  // 0b. sessionStorage — covers full page refreshes when memory is wiped.
  try {
    const cached = sessionStorage.getItem(TG_ID_STORAGE_KEY);
    if (cached) {
      memoTgId = cached;
      return cached;
    }
  } catch {}

  // 1. URL param (bot keyboard passes this on initial mini-app open).
  let resolved: string | null = null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('tg_id');
    if (fromUrl) resolved = fromUrl.replace('.0', '');
  } catch {}

  // 2. Telegram SDK (may not be populated on first render; some clients never populate).
  if (!resolved) {
    try {
      const user = window.Telegram?.WebApp?.initDataUnsafe?.user as any;
      if (user?.id) resolved = String(user.id);
    } catch {}
  }

  if (resolved) {
    memoTgId = resolved;
    try { sessionStorage.setItem(TG_ID_STORAGE_KEY, resolved); } catch {}
  }
  return resolved;
}

/**
 * Build auth headers from the auth store (JWT) or Telegram user ID fallback.
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const { accessToken } = useAuthStore.getState();

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const tgUserId = getTelegramUserId();
  if (tgUserId) {
    headers['X-Telegram-User-Id'] = tgUserId;
  }

  return headers;
}

/**
 * Authenticated fetch — includes JWT and/or Telegram user ID headers automatically.
 * Drop-in replacement for bare fetch() calls in pages that need authentication.
 * Handles 401 by attempting to re-authenticate with Telegram initData.
 */
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const apiBase = (import.meta.env.VITE_API_URL as string) || 'https://edubot-api.edubot-leonardus.workers.dev/api';
  const fullUrl = url.startsWith('/api') ? `${apiBase}${url.substring(4)}` : url;

  const adminSecret = (import.meta.env.VITE_ADMIN_SECRET as string) || '';
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  let response = await fetch(fullUrl, {
    ...options,
    headers: mergedHeaders,
  });

  // Handle 401 by attempting token refresh
  if (response.status === 401) {
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (initData) {
        // Try to re-authenticate
        const loginRes = await fetch(`${apiBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ init_data: initData }),
        });

        if (loginRes.ok) {
          const { access_token } = await loginRes.json();
          if (access_token) {
            // Update auth store with new token
            useAuthStore.setState({ accessToken: access_token });

            // Retry the original request with new token
            const freshHeaders: Record<string, string> = {
              ...getAuthHeaders(),
              ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
              ...(options.headers as Record<string, string> || {}),
            };
            response = await fetch(fullUrl, {
              ...options,
              headers: freshHeaders,
            });
          }
        }
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
    }
  }

  return response;
}
