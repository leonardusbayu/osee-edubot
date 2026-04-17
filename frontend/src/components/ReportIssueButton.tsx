import { useState } from 'react';
import { authedFetch } from '../api/authedFetch';

interface ReportIssueButtonProps {
  contentId?: number | string | null;
  attemptId?: number | null;
  compact?: boolean;
}

const REASONS = [
  { value: 'wrong_answer', label: 'Kunci jawaban salah' },
  { value: 'unclear', label: 'Soal tidak jelas' },
  { value: 'audio', label: 'Audio bermasalah' },
  { value: 'translation', label: 'Terjemahan salah' },
  { value: 'other', label: 'Lainnya' },
];

export default function ReportIssueButton({ contentId, attemptId, compact }: ReportIssueButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit() {
    if (!contentId) return;
    setStatus('sending');
    try {
      const res = await authedFetch('/api/content/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: contentId,
          attempt_id: attemptId ?? null,
          reason,
          note: note.trim() || null,
        }),
      });
      setStatus(res.ok ? 'sent' : 'error');
      if (res.ok) {
        setTimeout(() => {
          setOpen(false);
          setStatus('idle');
          setNote('');
          setReason(REASONS[0].value);
        }, 1200);
      }
    } catch {
      setStatus('error');
    }
  }

  if (!contentId) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Laporkan masalah pada soal ini"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'text-xs text-tg-hint hover:text-tg-text underline-offset-2 hover:underline'
            : 'text-sm text-tg-hint hover:text-tg-text px-2 py-1 rounded'
        }
      >
        🚩 Lapor
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Laporkan masalah"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-tg-bg w-full max-w-md rounded-2xl p-4 shadow-xl">
            <h2 className="text-base font-semibold text-tg-text mb-3">Laporkan soal</h2>

            <label className="block text-sm text-tg-text mb-1">Alasan</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full mb-3 px-3 py-2 rounded-lg bg-tg-secondary text-tg-text"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <label className="block text-sm text-tg-text mb-1">Catatan (opsional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Jelaskan masalahnya…"
              className="w-full mb-3 px-3 py-2 rounded-lg bg-tg-secondary text-tg-text"
            />

            {status === 'sent' && (
              <p className="text-sm text-green-500 mb-2">Terima kasih! Laporan terkirim.</p>
            )}
            {status === 'error' && (
              <p className="text-sm text-red-500 mb-2">Gagal mengirim. Coba lagi.</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm text-tg-hint"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={status === 'sending' || status === 'sent'}
                className="px-4 py-2 text-sm rounded-lg bg-tg-button text-tg-button-text disabled:opacity-50"
              >
                {status === 'sending' ? 'Mengirim…' : 'Kirim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
