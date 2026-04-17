/**
 * Telegram WebApp HapticFeedback wrappers.
 * No-ops outside Telegram (e.g. local dev in a regular browser).
 */

type Haptic = {
  impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged?: () => void;
};

function getHaptic(): Haptic | null {
  try {
    const h = (window as any)?.Telegram?.WebApp?.HapticFeedback;
    return h ?? null;
  } catch {
    return null;
  }
}

export function hapticTap(): void {
  getHaptic()?.impactOccurred?.('light');
}

export function hapticHeavy(): void {
  getHaptic()?.impactOccurred?.('heavy');
}

export function hapticSelection(): void {
  getHaptic()?.selectionChanged?.();
}

export function hapticCorrect(): void {
  getHaptic()?.notificationOccurred?.('success');
}

export function hapticWrong(): void {
  getHaptic()?.notificationOccurred?.('error');
}
