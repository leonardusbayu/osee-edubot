import { useState } from 'react';
import { authedFetch, getTelegramUserId } from '../api/authedFetch';

interface Props {
  // Accepts unknown shapes (string fallback IDs, null, undefined, numbers)
  // and internally coerces. The server insists on a positive integer, so
  // anything else causes the button to render nothing rather than open a
  // modal that will 400 on submit.
  contentId: number | string | null | undefined;
  subIndex?: number | null;
  attemptId?: number | null;
  // Optional compact style (icon-only) for in-question placement
  compact?: boolean;
}

const REASONS: { code: string; label: string }[] = [
  { code: 'wrong_answer', label: 'Jawaban yang ditandai benar sepertinya salah' },
  { code: 'broken_audio', label: 'Audio tidak bisa diputar atau terpotong' },
  { code: 'broken_options', label: 'Pilihan jawaban kosong, rusak, atau tidak masuk akal' },
  { code: 'confusing_question', label: 'Pertanyaan tidak jelas atau tidak cocok dengan bacaan' },
  { code: 'typo', label: 'Ada typo atau salah tulis' },
  { code: 'other', label: 'Lainnya' },
];

/**
 * One-tap "Report issue" button that opens a lightweight modal.
 * Renders nothing if contentId is missing.
 */
export default function ReportIssueButton({ contentId, subIndex, attemptId, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coerce + validate: the backend requires a positive integer content_id.
  // String-shaped IDs (e.g. legacy 'fallback-1') → NaN → render nothing.
  const numericContentId =
    typeof contentId === 'number'
      ? contentId
      : typeof contentId === 'string' && /^\d+$/.test(contentId)
        ? Number(contentId)
        : NaN;
  if (!Number.isFinite(numericContentId) || numericContentId <= 0) return null;

  async function submit() {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      // Belt-and-suspenders auth: if the JWT is expired and initData refresh
      // is failing, still let the server identify the user via tg_id query
      // param. Uses the shared cached lookup so route navigations (which
      // strip ?tg_id= from the URL) don't leave us without an identity.
      const tgId = getTelegramUserId();
      const qs = tgId ? `?tg_id=${encodeURIComponent(tgId)}` : '';

      const res = await authedFetch(`/api/content-reports${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: numericContentId,
          sub_index: subIndex ?? null,
          attempt_id: attemptId ?? null,
          reason_code: reason,
          free_text: note.trim() || null,
          tg_id: tgId, // also in body as a last-resort fallback
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal mengirim laporan' }));
        // Combine top-level error with detail so the user sees WHY it failed
        // (e.g. "Gagal menyimpan laporan — no such table: content_reports")
        const msg = err.detail
          ? `${err.error || 'Gagal'} — ${err.detail}`
          : (err.error || `Gagal mengirim laporan (${res.status})`);
        throw new Error(msg);
      }
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setReason(''); setNote(''); }, 1500);
    } catch (e: any) {
      setError(e.message || 'Gagal mengirim laporan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'text-xs text-tg-hint hover:text-tg-button underline'
            : 'text-xs text-tg-hint hover:text-tg-button flex items-center gap-1 py-1 px-2 rounded'
        }
        aria-label="Laporkan masalah pada soal ini"
      >
        ⚠ Laporkan masalah
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="bg-tg-bg w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Laporkan masalah</h3>
              {!submitting && (
                <button onClick={() => setOpen(false)} className="text-tg-hint text-xl leading-none">✕</button>
              )}
            </div>

            {done ? (
              <p className="text-sm text-green-500 py-4 text-center">✓ Terima kasih — laporan terkirim.</p>
            ) : (
              <>
                <p className="text-xs text-tg-hint mb-3">Soal #{numericContentId}{subIndex != null ? `.${subIndex + 1}` : ''}</p>

                <div className="space-y-2 mb-4">
                  {REASONS.map((r) => (
                    <label
                      key={r.code}
                      className={`flex items-start gap-2 p-2.5 rounded-lg cursor-pointer border text-sm ${
                        reason === r.code ? 'border-tg-button bg-tg-button/10' : 'border-tg-secondary'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.code}
                        checked={reason === r.code}
                        onChange={() => setReason(r.code)}
                        className="mt-0.5"
                      />
                      <span className="flex-1">{r.label}</span>
                    </label>
                  ))}
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 1000))}
                  placeholder="Detail tambahan (opsional)"
                  className="w-full bg-tg-secondary rounded-lg p-2 text-sm mb-3"
                  rows={3}
                />

                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-2 rounded-lg border border-tg-secondary text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!reason || submitting}
                    className="flex-1 py-2 rounded-lg bg-tg-button text-tg-button-text text-sm font-medium disabled:opacity-50"
                  >
                    {submitting ? 'Mengirim...' : 'Kirim laporan'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
