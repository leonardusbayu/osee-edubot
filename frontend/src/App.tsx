import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import TestSelection from './pages/TestSelection';
import TestRunner from './pages/TestRunner';
import TestResults from './pages/TestResults';
import Progress from './pages/Progress';
import Dashboard from './pages/Dashboard';
import AdminContent from './pages/AdminContent';

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

window.onerror = () => true;
window.onunhandledrejection = () => true;

function App() {
  const { setTokens } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }
    } catch (e) {
      // ignore
    }

    // Don't authenticate — just show the app
    // Auth will happen lazily when needed
    setLoading(false);
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
        <Route path="/admin/*" element={<AdminContent />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}

export default App;
