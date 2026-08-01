'use client';

import { useEffect, useState } from 'react';

export default function InternalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('[InternalError]', error);
  }, [error]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>Module Error</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
          This module encountered an error. Try again or return to the dashboard.
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, background: '#0f172a', color: '#fff',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = '/internal/dashboard'; }}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, background: '#fff', color: '#334155',
            }}
          >
            Dashboard
          </button>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer',
            fontSize: '12px', color: '#94a3b8', background: 'transparent',
          }}
        >
          {showDetails ? 'Hide' : 'Details'}
        </button>

        {showDetails && (
          <div style={{
            marginTop: '12px', padding: '12px', borderRadius: '8px',
            background: '#fef2f2', border: '1px solid #fecaca', textAlign: 'left',
          }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', margin: '0 0 4px' }}>
              {error.name || 'Error'}
            </p>
            <p style={{ fontSize: '12px', color: '#991b1b', margin: 0, wordBreak: 'break-word' }}>
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
  );
}
