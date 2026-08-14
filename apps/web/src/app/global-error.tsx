'use client';

import { useEffect, useState } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const dashboardPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/vendors')
    ? '/vendors/dashboard'
    : '/internal/dashboard';

  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f8fafc', color: '#1e293b' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
              An unexpected error occurred. You can try reloading this page or go back to the dashboard.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
              <button
                onClick={() => reset()}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 600, background: '#0f172a', color: '#fff',
                }}
              >
                Try again
              </button>
              <button
                onClick={() => {
                  window.location.href = dashboardPath;
                }}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 600, background: '#fff', color: '#334155',
                }}
              >
                Go to Dashboard
              </button>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer',
                fontSize: '12px', color: '#94a3b8', background: 'transparent',
              }}
            >
              {showDetails ? 'Hide details' : 'Show error details'}
            </button>

            {showDetails && (
              <div style={{
                marginTop: '16px', padding: '16px', borderRadius: '8px',
                background: '#fef2f2', border: '1px solid #fecaca', textAlign: 'left',
              }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', margin: '0 0 8px' }}>
                  {error.name || 'Error'}
                </p>
                <p style={{ fontSize: '12px', color: '#991b1b', margin: '0 0 4px', wordBreak: 'break-word' }}>
                  {error.message}
                </p>
                {error.digest && (
                  <p style={{ fontSize: '11px', color: '#b91c1c', margin: '8px 0 0', fontFamily: 'monospace' }}>
                    Digest: {error.digest}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
