import { useEffect, useState } from 'react';

interface TimerProps {
  initialSeconds: number;
  onExpire?: () => void;
  className?: string;
}

export default function Timer({ initialSeconds, onExpire, className = '' }: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) {
      onExpire?.();
      return;
    }

    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          onExpire?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isLow = seconds < 120;

  return (
    <span className={`font-mono font-bold ${isLow ? 'text-red-500' : 'text-tg-text'} ${className}`}>
      {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
}
