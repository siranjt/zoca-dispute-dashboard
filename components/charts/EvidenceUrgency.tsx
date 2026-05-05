'use client';

import { useEffect, useState } from 'react';

export type UrgencyKey = 'critical' | 'soon' | 'this_week' | 'plenty';

const BANDS: { key: UrgencyKey; label: string; sub: string; color: string }[] = [
  { key: 'critical', label: '≤3 days', sub: 'urgent', color: '#F87171' },
  { key: 'soon', label: '4–7 days', sub: 'soon', color: '#FDE047' },
  { key: 'this_week', label: '8–14 days', sub: 'this week', color: '#A78BFA' },
  { key: 'plenty', label: '15+ days', sub: 'plenty of time', color: '#4ADE80' },
];

export default function EvidenceUrgency({
  counts,
  active,
  onSelect,
}: {
  counts: Record<UrgencyKey, number>;
  active: UrgencyKey | null;
  onSelect: (key: UrgencyKey) => void;
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
  }, []);

  const max = Math.max(1, ...BANDS.map((b) => counts[b.key] || 0));
  const total = BANDS.reduce((s, b) => s + (counts[b.key] || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-ink-muted">
          {total} disputes still need a response
        </div>
        {total === 0 && (
          <span className="text-[10px] text-ink-dim">no urgent items</span>
        )}
      </div>
      <div className="space-y-2.5">
        {BANDS.map((b, i) => {
          const value = counts[b.key] || 0;
          const widthPct = (value / max) * 100;
          const isActive = active === b.key;
          return (
            <button
              key={b.key}
              onClick={() => onSelect(b.key)}
              className={`w-full text-left transition group ${
                isActive ? 'opacity-100' : 'hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-2">
                  <span style={{ color: b.color }} className="font-medium tabular-nums">
                    {b.label}
                  </span>
                  <span className="text-ink-dim">· {b.sub}</span>
                </span>
                <span className="text-ink font-semibold tabular-nums">{value}</span>
              </div>
              <div className="h-2 rounded-full bg-elevated/60 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${widthPct * progress}%`,
                    background:
                      b.key === 'critical'
                        ? 'linear-gradient(90deg, #F87171, #EC4899)'
                        : b.color,
                    transition: `width 1.1s cubic-bezier(0.4, 0, 0.2, 1) ${i * 80}ms`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
