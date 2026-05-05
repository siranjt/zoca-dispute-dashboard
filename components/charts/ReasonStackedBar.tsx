'use client';

import { useEffect, useState } from 'react';

export type ReasonRow = { reason: string; count: number };

const REASON_COLORS = ['#EC4899', '#A78BFA', '#FDE047', '#4ADE80', '#F0A5CE', '#A797C4', '#6F5E8E', '#C0DD97'];

export default function ReasonStackedBar({
  rows,
  active,
  onSelect,
}: {
  rows: ReasonRow[];
  active: string | null;
  onSelect: (reason: string) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

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
    return <div className="text-xs text-ink-dim text-center py-4">No reasons yet</div>;
  }

  const total = Math.max(1, rows.reduce((sum, r) => sum + r.count, 0));
  const sorted = [...rows].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-3">
      <div className="flex h-6 rounded-md overflow-hidden">
        {sorted.map((r, i) => {
          const pct = (r.count / total) * 100;
          const isActive = active === r.reason;
          const isDimmed = (active && !isActive) || (hovered && hovered !== r.reason);
          return (
            <button
              key={r.reason}
              onClick={() => onSelect(r.reason)}
              onMouseEnter={() => setHovered(r.reason)}
              onMouseLeave={() => setHovered(null)}
              title={`${r.reason}: ${r.count}`}
              className="transition-opacity"
              style={{
                background: REASON_COLORS[i % REASON_COLORS.length],
                width: `${pct * progress}%`,
                opacity: isDimmed ? 0.35 : 1,
                transition: 'width 1.1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s',
                cursor: 'pointer',
              }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
        {sorted.map((r, i) => {
          const isActive = active === r.reason;
          return (
            <button
              key={r.reason}
              onClick={() => onSelect(r.reason)}
              onMouseEnter={() => setHovered(r.reason)}
              onMouseLeave={() => setHovered(null)}
              className={`flex items-center gap-1.5 transition ${
                isActive ? 'text-ink font-medium' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ background: REASON_COLORS[i % REASON_COLORS.length] }}
              />
              <span>{r.reason}</span>
              <span className="text-ink-dim tabular-nums">({r.count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
