'use client';

import { useEffect, useState } from 'react';

export type AMRow = { name: string; amount: number; count: number };

export default function AMBarChart({
  rows,
  active,
  onSelect,
}: {
  rows: AMRow[];
  active: string | null;
  onSelect: (am: string) => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1300;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rows.length]);

  if (rows.length === 0) {
    return (
      <div className="text-xs text-ink-dim text-center py-8">No AM data yet</div>
    );
  }

  const max = Math.max(...rows.map((r) => r.amount), 1);

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const isActive = active === row.name;
        const widthPct = (row.amount / max) * 100 * Math.min(1, progress * 1 + i * 0.05);
        return (
          <button
            key={row.name}
            onClick={() => onSelect(row.name)}
            className={`w-full text-left group transition ${isActive ? 'opacity-100' : 'hover:opacity-100'}`}
          >
            <div className="flex justify-between items-baseline mb-1">
              <span
                className={`text-xs ${
                  isActive ? 'text-ink font-medium' : 'text-ink-muted group-hover:text-ink'
                }`}
              >
                {row.name}
              </span>
              <span className="text-xs text-ink-dim tabular-nums">
                ${row.amount.toLocaleString()} · {row.count}
              </span>
            </div>
            <div className="h-2 rounded-full bg-elevated/50 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min(100, Math.max(0, widthPct))}%`,
                  background: isActive ? '#EC4899' : '#A78BFA',
                  transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s',
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
