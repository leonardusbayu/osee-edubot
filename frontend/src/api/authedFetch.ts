import { useAuthStore } from '../stores/auth';

/**
 * Helper to get the Telegram user ID from URL params (primary) or WebApp SDK (fallback).
 * URL params are always available immediately; SDK may not be ready on first render.
 */
export function getTelegramUserId(): string | null {
  // Primary: check URL params first (available immediately when page loads)
  const urlParams = new URLSearchParams(window.location.search);
  const tgIdFromUrl = urlParams.get('tg_id');
  if (tgIdFromUrl) return tgIdFromUrl;

  // Fallback: try SDK (may not be ready on first render)
  try {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user as any;
    if (user?.id) return String(user.id);
  } catch {}

  return null;
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

  return fetch(fullUrl, {
    ...options,
    headers: mergedHeaders,
  });
}
