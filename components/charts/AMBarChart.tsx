'use client';

import { useEffect, useState } from 'react';

export type AMRow = {
  name: string;
  amount: number;
  count: number;
  /** Last 6 weeks of dispute counts, oldest first. */
  trend: number[];
};

const GRADIENTS = [
  ['#EC4899', '#A78BFA'],
  ['#FDE047', '#4ADE80'],
  ['#4ADE80', '#A78BFA'],
  ['#F0A5CE', '#FDE047'],
  ['#A78BFA', '#4ADE80'],
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

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
    return <div className="text-xs text-ink-dim text-center py-8">No AM data yet</div>;
  }

  const max = Math.max(...rows.map((r) => r.amount), 1);

  return (
    <div className="space-y-2.5">
      {rows.map((row, i) => {
        const isActive = active === row.name;
        const isFirst = i === 0;
        const widthPct = (row.amount / max) * 100 * Math.min(1, progress * 1.2);
        const grad = GRADIENTS[hashIndex(row.name, GRADIENTS.length)];
        const textOnGrad = grad[0] === '#FDE047' || grad[0] === '#F0A5CE' ? '#14092A' : '#fff';

        return (
          <button
            key={row.name}
            onClick={() => onSelect(row.name)}
            className={`w-full text-left transition rounded-xl px-2 py-1.5 ${
              isActive
                ? 'bg-elevated/60 border border-accent-pink/30'
                : 'border border-transparent hover:bg-elevated/30'
            }`}
            style={{ opacity: progress < 0.05 ? 0 : 1, transition: 'opacity 0.4s, background-color 0.2s' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`,
                  color: textOnGrad,
                }}
              >
                {initials(row.name)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span
                    className={`text-sm truncate ${
                      isFirst || isActive ? 'text-ink font-medium' : 'text-ink-muted'
                    }`}
                  >
                    {row.name}
                  </span>
                  <span className="text-xs text-ink-dim tabular-nums whitespace-nowrap ml-2">
                    <span className={isFirst ? 'text-accent-pink font-semibold' : 'text-ink font-medium'}>
                      ${row.amount.toLocaleString()}
                    </span>
                    <span className="ml-1">· {row.count}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-elevated/60 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, widthPct))}%`,
                      background: isFirst
                        ? `linear-gradient(90deg, ${grad[0]}, ${grad[1]})`
                        : '#A78BFA',
                      transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
              </div>

              <Sparkline
                points={row.trend}
                color={grad[0]}
                accent={grad[1]}
                width={44}
                height={20}
                progress={progress}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Sparkline({
  points,
  color,
  accent,
  width,
  height,
  progress,
}: {
  points: number[];
  color: string;
  accent: string;
  width: number;
  height: number;
  progress: number;
}) {
  if (!points.length) {
    return <div style={{ width, height }} />;
  }
  const max = Math.max(1, ...points);
  const PAD = 2;
  const innerW = width - PAD * 2;
  const innerH = height - PAD * 2;
  const coords = points.map((v, i) => {
    const x = points.length === 1 ? width / 2 : PAD + (i / (points.length - 1)) * innerW;
    const y = PAD + innerH - (v / max) * innerH;
    return { x, y };
  });
  const visiblePts = Math.max(1, Math.floor(coords.length * progress));
  const visible = coords.slice(0, visiblePts);
  const polyline = visible.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const last = visible[visible.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="flex-shrink-0">
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last.x} cy={last.y} r={2} fill={accent} />}
    </svg>
  );
}
