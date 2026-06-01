type TelegramHaptic = {
  impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged?: () => void;
};

type TelegramBackButton = {
  show?: () => void;
  hide?: () => void;
  onClick?: (handler: () => void) => void;
  offClick?: (handler: () => void) => void;
};

type TelegramCloudStorage = {
  getItem?: (key: string, callback: (error: string | null, value: string | null) => void) => void;
  setItem?: (key: string, value: string, callback?: (error: string | null, success: boolean) => void) => void;
};

type TelegramUser = {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramInitDataUnsafe = {
  user?: TelegramUser;
  start_param?: string;
  [key: string]: unknown;
};

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: TelegramInitDataUnsafe;
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  disableVerticalSwipes?: () => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  switchInlineQuery?: (query: string, chatTypes?: string[]) => void;
  BackButton?: TelegramBackButton;
  CloudStorage?: TelegramCloudStorage;
  HapticFeedback?: TelegramHaptic;
  themeParams?: Record<string, string>;
  colorScheme?: string;
};

// NOTE: Global Window['Telegram'] is provided by @telegram-apps/sdk.
// We avoid redeclaring it here to prevent type conflicts.

const TG_ID_STORAGE_KEY = 'edubot_tg_id';
let memoTgId: string | null = null;

function readSessionValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Telegram webviews may block storage. Memory cache still covers SPA navigation.
  }
}

function normalizeTelegramId(value: string | number | undefined): string | null {
  if (value === undefined) return null;
  const clean = String(value).replace('.0', '').trim();
  return clean.length > 0 ? clean : null;
}

export function getTelegramWebApp(): TelegramWebApp | null {
  try {
    return window.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

export function initTelegramApp(): TelegramWebApp | null {
  const tg = getTelegramWebApp();
  if (!tg) return null;

  try { tg.ready?.(); } catch {}
  try { tg.expand?.(); } catch {}
  try { tg.disableVerticalSwipes?.(); } catch {}

  return tg;
}

export function getTelegramInitData(): string | null {
  const initData = getTelegramWebApp()?.initData;
  return initData && initData.length > 0 ? initData : null;
}

export function hasTelegramInitData(): boolean {
  return getTelegramInitData() !== null;
}

export function resolveTelegramUserId(): string | null {
  if (memoTgId) return memoTgId;

  const cached = readSessionValue(TG_ID_STORAGE_KEY);
  if (cached) {
    memoTgId = cached;
    return cached;
  }

  let resolved: string | null = null;

  try {
    const params = new URLSearchParams(window.location.search);
    resolved = normalizeTelegramId(params.get('tg_id') ?? params.get('telegram_id') ?? undefined);
  } catch {}

  if (!resolved) {
    resolved = normalizeTelegramId(getTelegramWebApp()?.initDataUnsafe?.user?.id);
  }

  if (resolved) {
    memoTgId = resolved;
    writeSessionValue(TG_ID_STORAGE_KEY, resolved);
  }

  return resolved;
}

export function getTelegramStartParam(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('startapp') ?? params.get('start') ?? params.get('tgWebAppStartParam');
    if (fromUrl) return fromUrl;
  } catch {}
  return getTelegramWebApp()?.initDataUnsafe?.start_param ?? null;
}

export function openTelegramLink(url: string): boolean {
  const tg = getTelegramWebApp();
  try {
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
      return true;
    }
    if (tg?.openLink) {
      tg.openLink(url);
      return true;
    }
  } catch {}
  return false;
}

export function shareTelegramText(text: string, url = 'https://t.me/osee_IBT_IELTS_tutor_bot'): boolean {
  const tg = getTelegramWebApp();
  try {
    if (tg?.switchInlineQuery) {
      tg.switchInlineQuery(text, ['users', 'groups', 'channels']);
      return true;
    }
  } catch {}

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  return openTelegramLink(shareUrl);
}

export function closeTelegramMiniApp(): void {
  try { getTelegramWebApp()?.close?.(); } catch {}
}

export function telegramHapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void {
  try { getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style); } catch {}
}

export function telegramHapticNotification(type: 'error' | 'success' | 'warning'): void {
  try { getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.(type); } catch {}
}

export function telegramHapticSelection(): void {
  try { getTelegramWebApp()?.HapticFeedback?.selectionChanged?.(); } catch {}
}

export function bindTelegramBackButton(handler: () => void): () => void {
  const backButton = getTelegramWebApp()?.BackButton;
  if (!backButton?.show || !backButton.onClick || !backButton.offClick) {
    return () => {};
  }

  try {
    backButton.show();
    backButton.onClick(handler);
  } catch {
    return () => {};
  }

  return () => {
    try { backButton.offClick?.(handler); } catch {}
    try { backButton.hide?.(); } catch {}
  };
}
