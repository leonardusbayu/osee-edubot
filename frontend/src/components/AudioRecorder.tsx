import { useState, useRef, useEffect } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number; // seconds
}

export default function AudioRecorder({ onRecordingComplete, maxDuration = 120 }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [checkingMic, setCheckingMic] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  async function startRecording() {
    setMicError(null);
    setCheckingMic(true);
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError('Perangkat ini tidak mendukung perekaman suara. Coba gunakan bot Telegram dan kirim voice message.');
        setCheckingMic(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        onRecordingComplete(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);
      setAudioUrl(null);
      setMicError(null);

      revokeAudioUrl();

      timerRef.current = window.setInterval(() => {
        setDuration((d) => {
          if (d + 1 >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('[EduBot] Microphone error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError('Akses mikrofon ditolak. Buka pengaturan browser dan izinkan akses mikrofon untuk halaman ini.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicError('Mikrofon tidak ditemukan. Pastikan perangkat kamu memiliki mikrofon yang berfungsi.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setMicError('Mikrofon sedang digunakan aplikasi lain. Tutup aplikasi lain dan coba lagi.');
      } else {
        setMicError('Tidak bisa mengakses mikrofon. Coba kirim voice message ke bot @OSEE_TOEFL_IELTS_TOEIC_study_bot sebagai alternatif.');
      }
    } finally {
      setCheckingMic(false);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }

  function revokeAudioUrl() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  const minutes = Math.floor(duration / 60);
  const secs = duration % 60;

  return (
    <div className="flex flex-col items-center gap-3 p-4">
      {micError && (
        <div className="w-full bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
          <div className="flex items-start gap-2">
            <span className="text-lg">🎙️</span>
            <div>
              <p className="text-sm font-medium text-red-700 mb-1">Mikrofon Tidak Tersedia</p>
              <p className="text-xs text-red-600 leading-relaxed">{micError}</p>
            </div>
          </div>
          <button
            onClick={() => setMicError(null)}
            className="mt-2 text-xs text-tg-button font-medium"
          >
            Coba Lagi
          </button>
        </div>
      )}

      <div className="text-2xl font-mono">
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>

      {isRecording ? (
        <button
          onClick={stopRecording}
          className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg animate-pulse"
        >
          <div className="w-6 h-6 bg-white rounded-sm"></div>
        </button>
      ) : (
        <button
          onClick={startRecording}
          disabled={checkingMic}
          className="w-16 h-16 rounded-full bg-tg-button flex items-center justify-center shadow-lg disabled:opacity-50"
        >
          {checkingMic ? (
            <div className="w-5 h-5 border-2 border-tg-button-text border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <div className="w-6 h-6 bg-tg-button-text rounded-full"></div>
          )}
        </button>
      )}

      <p className="text-sm text-tg-hint">
        {checkingMic ? 'Memeriksa mikrofon...' : isRecording ? 'Merekam... tap untuk stop' : audioUrl ? 'Rekaman tersimpan' : 'Tap untuk merekam'}
      </p>

      {audioUrl && (
        <audio controls src={audioUrl} className="w-full max-w-xs mt-2" onError={() => { setAudioUrl(null); }} />
      )}
    </div>
  );
}
