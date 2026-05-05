'use client';

import { useTransition } from 'react';

export default function RefreshButton({ action }: { action: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await action();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-medium transition ${
        isPending
          ? 'border-accent-purple/40 bg-accent-purple-bg text-accent-purple cursor-wait'
          : 'border-accent-pink-strong/60 text-accent-pink hover:bg-accent-pink-bg'
      }`}
    >
      <span
        className={`inline-block w-3 h-3 rounded-full border-[1.5px] ${
          isPending
            ? 'border-accent-purple/30 border-t-accent-purple animate-spin-slow'
            : 'border-accent-pink/40 border-t-accent-pink'
        }`}
        aria-hidden
      />
      {isPending ? 'Refreshing…' : 'Refresh live data'}
    </button>
  );
}
