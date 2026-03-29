import { useState, useRef } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number; // seconds
}

export default function AudioRecorder({ onRecordingComplete, maxDuration = 120 }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        setAudioUrl(url);
        onRecordingComplete(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);
      setAudioUrl(null);

      timerRef.current = window.setInterval(() => {
        setDuration((d) => {
          if (d + 1 >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      alert('Microphone access is required for speaking tasks.');
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

  const minutes = Math.floor(duration / 60);
  const secs = duration % 60;

  return (
    <div className="flex flex-col items-center gap-3 p-4">
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
          className="w-16 h-16 rounded-full bg-tg-button flex items-center justify-center shadow-lg"
        >
          <div className="w-6 h-6 bg-tg-button-text rounded-full"></div>
        </button>
      )}

      <p className="text-sm text-tg-hint">
        {isRecording ? 'Recording... tap to stop' : audioUrl ? 'Recording saved' : 'Tap to record'}
      </p>

      {audioUrl && (
        <audio controls src={audioUrl} className="w-full max-w-xs mt-2" />
      )}
    </div>
  );
}
