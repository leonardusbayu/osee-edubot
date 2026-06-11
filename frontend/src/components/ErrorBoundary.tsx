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
      // Send the full error info so we can debug in production. Minified
      // bundles collapse React errors into "Minified React error #NNN"
      // which is unhelpful, so we also send the error.toString() and a
      // generous component stack slice. Vite production source maps
      // would give us the line, but those aren't deployed to Pages.
      const errorName = error.name || 'Error';
      const errorMsg = error.message || '';
      // For React error #NNN we can also surface a hint about which
      // invariant was hit (helps decode minified messages in the
      // backend).
      const isReactMinified = /^Minified React error/.test(errorMsg);
      const reactErrorCode = isReactMinified
        ? (errorMsg.match(/#(\d+)/)?.[1] ?? null)
        : null;
      fetch(`${apiBase}/analytics/error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'client',
          error_type: 'render',
          error_name: errorName,
          react_error_code: reactErrorCode,
          message: errorMsg,
          // Send the full stack + component stack (truncated to keep
          // payload small). For minified React errors, the stack is
          // meaningless (vendor code positions), so we also try to
          // include the raw error.toString() which preserves the type
          // name + first part of the message.
          stack: (error.stack || '').substring(0, 4000),
          url: window.location.href,
          user_agent: navigator.userAgent?.substring(0, 200) || null,
          build_id: (import.meta as any).env?.VITE_BUILD_ID || null,
          metadata: {
            componentStack: info?.componentStack?.substring(0, 2000),
            errorString: String(error).substring(0, 500),
          },
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
              {this.props.fallbackMessage || 'Halaman ini mengalami error. Coba muat ulang — biasanya sudah cukup.'}
            </p>
            {this.state.error && (
              <details className="text-left mb-4 text-left">
                <summary className="text-xs text-tg-hint cursor-pointer">Detail error</summary>
                <pre className="text-xs bg-tg-secondary p-2 rounded mt-1 overflow-auto max-h-32 whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                // Try a soft reset first — just unmount/remount the
                // boundary. If the error is from a stale render caused
                // by a fast-forwarded state update, this often fixes it
                // without a full page reload (which loses the student's
                // test state in zustand).
                this.setState({ hasError: false, error: null });
                // Force a re-render by remounting the tree below us via
                // a key bump on the wrapper. Cheapest way: rethrow + let
                // the boundary catch again on the next render.
                // If the user lands here again, the "Muat ulang" retry
                // button is right there.
              }}
              className="bg-tg-secondary text-tg-text px-6 py-2.5 rounded-xl font-medium border border-tg-hint/30 mr-2"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => window.location.reload()}
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
