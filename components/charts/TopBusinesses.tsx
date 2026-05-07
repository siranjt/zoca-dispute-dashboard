'use client';

import { useEffect, useState } from 'react';

export type BusinessRow = { id: string; name: string; entityId: string | null; amount: number; count: number };

export default function TopBusinesses({
  rows,
  active,
  onSelect,
}: {
  rows: BusinessRow[];
  active: string | null;
  onSelect: (id: string) => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rows.length]);

  if (rows.length === 0) {
    return <div className="text-xs text-ink-dim text-center py-6">No customers yet</div>;
  }
  const max = Math.max(...rows.map((r) => r.amount), 1);

  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => {
        const pct = (r.amount / max) * 100 * Math.min(1, progress * 1.2);
        const isFirst = i === 0;
        const isActive = active === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className="w-full text-left group transition"
            style={{ opacity: progress < 0.05 ? 0 : 1, transition: 'opacity 0.4s' }}
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold tabular-nums"
                style={{
                  background: isFirst ? '#FCE7F3' : '#EFF6FF',
                  color: isFirst ? '#BE185D' : '#2D5BFF',
                }}
              >
                {i + 1}
              </span>
              <span
                className={`flex-1 text-sm truncate ${
                  isActive || isFirst ? 'text-ink font-medium' : 'text-ink-muted group-hover:text-ink'
                }`}
              >
                {r.name}
              </span>
              <span className="text-xs text-ink-dim tabular-nums whitespace-nowrap">
                <span className={isFirst ? 'text-accent-pink font-semibold' : 'text-ink font-medium'}>
                  ${r.amount.toLocaleString()}
                </span>
                <span className="text-ink-dim ml-1">· {r.count}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-elevated/60 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  background: isFirst
                    ? 'linear-gradient(90deg, #2D5BFF, #8B5CF6, #EC4899)'
                    : '#2D5BFF',
                  transition: 'width 1.1s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
