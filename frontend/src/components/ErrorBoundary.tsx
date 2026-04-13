import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[EduBot] Error caught by boundary:', error, info);
    // Try to report to backend
    try {
      const apiBase = (import.meta as any).env?.VITE_API_URL || 'https://edubot-api.edubot-leonardus.workers.dev/api';
      fetch(`${apiBase}/analytics/error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'client',
          error_type: 'render',
          message: error.message,
          stack: error.stack?.substring(0, 2000),
          url: window.location.href,
          metadata: { componentStack: info?.componentStack?.substring(0, 500) },
        }),
      }).catch(() => {});
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-6">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">😵</div>
            <h2 className="text-lg font-bold text-tg-text mb-2">
              Oops, terjadi kesalahan
            </h2>
            <p className="text-sm text-tg-hint mb-4">
              {this.props.fallbackMessage || 'Halaman ini mengalami error. Coba muat ulang.'}
            </p>
            {this.state.error && (
              <details className="text-left mb-4">
                <summary className="text-xs text-tg-hint cursor-pointer">Detail error</summary>
                <pre className="text-xs bg-tg-secondary p-2 rounded mt-1 overflow-auto max-h-32 whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-tg-button text-tg-button-text px-6 py-2.5 rounded-xl font-medium"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
