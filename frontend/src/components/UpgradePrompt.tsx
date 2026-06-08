/**
 * UpgradePrompt — shown when a free user hits a premium-only limit
 * (e.g. daily quota reached, speaking eval, etc). Opens the bot's
 * premium purchase flow via deep link, where the user can choose
 * between Telegram Stars, GoPay, or WhatsApp.
 *
 * Two variants:
 *   - inline: a button next to the error message (default)
 *   - card:   a standalone full-width card with hero text + button
 *
 * Usage:
 *   {error && <UpgradePrompt reason={error} variant="inline" />}
 */
import { openTelegramLink } from '../utils/telegram';

const BOT_PURCHASE_URL = 'https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot?start=premium';

interface Props {
  reason?: string;        // The error reason (e.g. "Batas harian tercapai")
  variant?: 'inline' | 'card';
}

export default function UpgradePrompt({ reason, variant = 'inline' }: Props) {
  function handleUpgrade() {
    openTelegramLink(BOT_PURCHASE_URL);
  }

  if (variant === 'card') {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-2xl p-5 mb-4">
        <div className="text-2xl mb-2">⭐</div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Upgrade Premium</h3>
        <p className="text-sm text-gray-700 mb-3">
          {reason || 'Akses unlimited soal, Speaking eval dengan AI, dan study plan personal.'}
        </p>
        <ul className="text-xs text-gray-600 mb-4 space-y-1">
          <li>✅ Unlimited soal (10/hari → unlimited)</li>
          <li>✅ AI Speaking evaluation (Whisper + GPT)</li>
          <li>✅ Personalized study plan + lesson harian</li>
          <li>✅ Certificate di skor target</li>
        </ul>
        <button
          onClick={handleUpgrade}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-xl transition"
        >
          ⭐ Upgrade Sekarang (dari 375 ⭐ / 7 hari)
        </button>
        <p className="text-[11px] text-gray-500 mt-2 text-center">
          Bayar via Telegram Stars • Instant • Tanpa ribet
        </p>
      </div>
    );
  }

  // inline variant: button on the red error banner
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
      <p className="mb-2">{reason || 'Batas harian tercapai!'}</p>
      <button
        onClick={handleUpgrade}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-3 rounded-lg transition"
      >
        ⭐ Upgrade ke Premium — mulai 375 ⭐
      </button>
    </div>
  );
}
