import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { getTelegramUserId } from './api/authedFetch';
import TestSelection from './pages/TestSelection';
import TestRunner from './pages/TestRunner';
import TestResults from './pages/TestResults';
import Progress from './pages/Progress';
import ReportCard from './pages/ReportCard';
import Dashboard from './pages/Dashboard';
import AdminContent from './pages/AdminContent';
import AdminStudents from './pages/AdminStudents';
import AdminAnalytics from './pages/AdminAnalytics';
import SkillPractice from './pages/SkillPractice';
import WeaknessDashboard from './pages/WeaknessDashboard';
import AdminPanel from './pages/AdminPanel';
import TeacherDashboard from './pages/TeacherDashboard';
import ErrorBoundary from './components/ErrorBoundary';

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
  const [sdkMissing, setSdkMissing] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    // Prime the tg_id cache IMMEDIATELY so it survives react-router navigations
    // that strip ?tg_id= from the URL. Media URLs (TTS <audio src>), report
    // button, and other anonymous endpoints all rely on this cached value.
    try { getTelegramUserId(); } catch {}

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

    // Detect missing Telegram SDK (e.g., opened in regular browser) up front
    if (!window.Telegram?.WebApp?.initData) {
      const path = window.location.pathname;
      const isAdminRoute = path.startsWith('/admin') || path === '/dashboard';
      // Also allow if tg_id URL param is present (bot keyboard buttons pass this)
      const hasTgId = !!new URLSearchParams(window.location.search).get('tg_id');
      if (!isAdminRoute && !hasTgId) {
        setSdkMissing(true);
        setLoading(false);
        return;
      }
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
              return true;
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
      return false;
    }

    authenticateWithRetry()
      .then((ok) => {
        // If JWT auth failed but tg_id URL param is present, allow through
        // (authedFetch sends X-Telegram-User-Id header as fallback)
        if (!ok) {
          const hasTgId = !!new URLSearchParams(window.location.search).get('tg_id');
          if (!hasTgId) {
            setAuthFailed(true);
          }
        }
      })
      .finally(() => setLoading(false));
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

  if (sdkMissing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg p-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">📱</div>
          <h1 className="text-xl font-semibold mb-2 text-tg-text">Buka dari Telegram</h1>
          <p className="text-tg-hint mb-4">
            EduBot mini app hanya bisa dibuka lewat Telegram. Buka chat bot @osee_edubot dan ketuk tombol menu untuk masuk.
          </p>
          <a
            href="https://t.me/osee_edubot"
            className="inline-block px-6 py-3 rounded-lg bg-tg-button text-tg-button-text font-semibold"
          >
            Buka Bot
          </a>
        </div>
      </div>
    );
  }

  if (authFailed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg p-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold mb-2 text-tg-text">Gagal masuk</h1>
          <p className="text-tg-hint mb-4">
            Ada masalah saat otentikasi. Coba tutup mini app dan buka lagi dari menu bot.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-block px-6 py-3 rounded-lg bg-tg-button text-tg-button-text font-semibold"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text">
      <Routes>
        <Route path="/" element={<TestSelection />} />
        <Route path="/test" element={<TestSelection />} />
        <Route path="/skill-practice" element={<ErrorBoundary fallbackMessage="Skill Practice gagal dimuat."><SkillPractice /></ErrorBoundary>} />
        <Route path="/test/:attemptId" element={<ErrorBoundary fallbackMessage="Soal gagal dimuat. Coba muat ulang halaman."><TestRunner /></ErrorBoundary>} />
        <Route path="/test/:attemptId/results" element={<ErrorBoundary fallbackMessage="Hasil tes gagal dimuat."><TestResults /></ErrorBoundary>} />
        <Route path="/progress" element={<ErrorBoundary fallbackMessage="Progress gagal dimuat."><Progress /></ErrorBoundary>} />
        <Route path="/report-card" element={<ErrorBoundary fallbackMessage="Laporan gagal dimuat."><ReportCard /></ErrorBoundary>} />
        <Route path="/referral" element={
          <div className="flex items-center justify-center min-h-screen bg-tg-bg p-6">
            <div className="text-center max-w-md">
              <div className="text-5xl mb-4">🎁</div>
              <h1 className="text-xl font-semibold mb-2 text-tg-text">Referral Program</h1>
              <p className="text-tg-hint mb-4">Undang teman kamu dan dapatkan bonus soal gratis! Ketik /referral di bot untuk kode referral.</p>
              <a href="https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot?start=referral" className="inline-block px-6 py-3 rounded-lg bg-tg-button text-tg-button-text font-semibold">Buka Bot</a>
            </div>
          </div>
        } />
        <Route path="/admin/content" element={<AdminContent />} />
        <Route path="/admin/students" element={<AdminStudents />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/weaknesses" element={<WeaknessDashboard />} />
        <Route path="/admin/teacher" element={<TeacherDashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/panel" element={<AdminPanel />} />
      </Routes>
    </div>
  );
}

export default App;
