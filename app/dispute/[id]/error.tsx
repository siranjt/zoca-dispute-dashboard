'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-level error boundary for the dispute detail page.
 * Catches any unhandled error (server-render or client-hydration) and
 * shows the actual message instead of the "Application error" mask.
 */
export default function DisputeErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Make the error easy to grab from the browser console + Vercel logs
    // eslint-disable-next-line no-console
    console.error('[dispute-error]', { message: error.message, digest: error.digest, stack: error.stack });
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto pt-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent-pink transition mb-6"
      >
        <span>←</span> All disputes
      </Link>

      <div className="rounded-2xl border border-accent-red/40 bg-accent-red-bg/60 p-6">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-accent-red mb-2">
          Dispute failed to load
        </div>
        <h1 className="text-2xl font-bold text-ink mb-3">Something broke while rendering this dispute</h1>
        <p className="text-sm text-ink-muted mb-4">
          We didn't crash silently this time — here's the actual error so we can fix it.
        </p>

        <div className="rounded-lg bg-canvas border border-line p-4 mb-4 text-xs font-mono text-ink-muted whitespace-pre-wrap break-words">
          <div className="text-accent-red font-semibold mb-1">{error.name}: {error.message}</div>
          {error.digest && (
            <div className="text-ink-dim mt-1">Vercel digest: {error.digest}</div>
          )}
          {error.stack && (
            <div className="text-ink-dim mt-2 text-[10px] leading-relaxed">
              {error.stack.split('\n').slice(0, 8).join('\n')}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-full bg-accent-pink text-white text-sm font-medium hover:bg-accent-pink-strong transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-full border border-line bg-elevated text-ink text-sm hover:bg-input transition"
          >
            Back to disputes
          </Link>
        </div>

        <p className="text-xs text-ink-dim mt-4">
          If you keep hitting this on the same dispute, screenshot the error block above
          and send it — the message + digest tell us exactly what to fix.
        </p>
      </div>
    </div>
  );
}
