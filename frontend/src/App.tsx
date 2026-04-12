import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import TestSelection from './pages/TestSelection';
import TestRunner from './pages/TestRunner';
import TestResults from './pages/TestResults';
import Progress from './pages/Progress';
import Dashboard from './pages/Dashboard';
import AdminContent from './pages/AdminContent';
import AdminStudents from './pages/AdminStudents';
import AdminAnalytics from './pages/AdminAnalytics';
import WeaknessDashboard from './pages/WeaknessDashboard';
import AdminPanel from './pages/AdminPanel';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: Record<string, unknown>;
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: any;
        BackButton: any;
        HapticFeedback: any;
        themeParams: Record<string, string>;
        colorScheme: string;
      };
    };
  }
}

function App() {
  const { setTokens } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let tg: any;
    try {
      tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }
    } catch (e) {
      // ignore
    }

    async function authenticateWithRetry(retryCount = 3) {
      for (let i = 0; i < retryCount; i++) {
        try {
          const initData = window.Telegram?.WebApp?.initData;
          if (initData) {
            const apiBase = (import.meta.env.VITE_API_URL as string) || 'https://edubot-api.edubot-leonardus.workers.dev/api';
            const response = await fetch(`${apiBase}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ init_data: initData }),
            });
            if (response.ok) {
              const data = await response.json();
              setTokens(data.access_token, data.refresh_token, data.user);
              return;
            }
          }
          if (i < retryCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (e) {
          console.error('Auth attempt failed:', e);
          if (i < retryCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    }

    authenticateWithRetry().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tg-button mx-auto mb-4"></div>
          <p className="text-tg-hint">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text">
      <Routes>
        <Route path="/" element={<TestSelection />} />
        <Route path="/test" element={<TestSelection />} />
        <Route path="/test/:attemptId" element={<TestRunner />} />
        <Route path="/test/:attemptId/results" element={<TestResults />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/admin/content" element={<AdminContent />} />
        <Route path="/admin/students" element={<AdminStudents />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/weaknesses" element={<WeaknessDashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/panel" element={<AdminPanel />} />
      </Routes>
    </div>
  );
}

export default App;
