'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary for the console.
 *
 * Next 16 passes `retry()` (re-fetches the segment) alongside the older
 * `reset()` (re-renders the boundary's children as-is). Prefer `retry` when the
 * runtime provides it so a failed server fetch is actually attempted again.
 */
export default function ConsoleError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error('[fleet-tracker] console crashed', error);
  }, [error]);

  return (
    <main className="flex h-dvh items-center justify-center bg-slate-950 p-6 text-slate-100">
      <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-base font-semibold">The console stopped</h1>
        <p className="mt-2 text-sm text-slate-400">
          Something threw while rendering. The fleet itself is unaffected.
        </p>
        <p className="mt-3 break-words rounded-md bg-rose-500/10 p-3 font-mono text-xs text-rose-300">
          {error.message || 'Unknown error'}
          {error.digest ? ` (digest ${error.digest})` : ''}
        </p>
        <button
          type="button"
          onClick={() => (retry ?? reset)()}
          className="mt-4 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
