'use client';

/**
 * Last-resort boundary: replaces the root layout, so it ships its own document
 * and its own styles — global CSS does not reach this tree.
 */
export default function GlobalError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: '#020617',
          color: '#f1f5f9',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <title>FleetTracker — error</title>
        <section
          style={{
            width: '100%',
            maxWidth: '28rem',
            border: '1px solid #1e293b',
            borderRadius: '0.5rem',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '1.5rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>FleetTracker crashed</h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>
            The application shell failed to render.
          </p>
          <p
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              background: 'rgba(244, 63, 94, 0.1)',
              color: '#fda4af',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.75rem',
              wordBreak: 'break-word',
            }}
          >
            {error.message || 'Unknown error'}
            {error.digest ? ` (digest ${error.digest})` : ''}
          </p>
          <button
            type="button"
            onClick={() => (retry ?? reset)()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#1e293b',
              color: '#f1f5f9',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </section>
      </body>
    </html>
  );
}
