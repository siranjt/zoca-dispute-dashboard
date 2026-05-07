'use client';

import { useEffect, useMemo, useState } from 'react';

export type WeekBucket = { weekStart: number; count: number; label: string };

export default function DisputesOverTime({
  disputes,
  weeks = 12,
  activeWeekStart,
  onSelect,
}: {
  disputes: { created: number }[];
  weeks?: number;
  activeWeekStart: number | null;
  onSelect: (weekStart: number | null) => void;
}) {
  const buckets = useMemo(() => bucketByWeek(disputes, weeks), [disputes, weeks]);
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
  }, [buckets.length]);

  const max = Math.max(1, ...buckets.map((b) => b.count));
  const W = 600;
  const H = 110;
  const PAD_X = 12;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 18;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const points = buckets.map((b, i) => {
    const x = buckets.length === 1 ? W / 2 : PAD_X + (i / (buckets.length - 1)) * innerW;
    const y = PAD_TOP + innerH - (b.count / max) * innerH * progress;
    return { x, y, b };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath =
    points.length === 0
      ? ''
      : `M ${points[0].x} ${PAD_TOP + innerH} L ${points
          .map((p) => `${p.x} ${p.y}`)
          .join(' L ')} L ${points[points.length - 1].x} ${PAD_TOP + innerH} Z`;

  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-ink-muted">
          {total} disputes opened in the last {weeks} weeks
        </div>
        {activeWeekStart !== null && (
          <button
            onClick={() => onSelect(null)}
            className="text-[10px] text-accent-pink hover:text-accent-pink-strong transition"
          >
            clear week filter ↺
          </button>
        )}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="120"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Area chart of disputes opened over the last ${weeks} weeks`}
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="dot-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#EC4899" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="dot-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#2D5BFF" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
          <line x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + innerH} y2={PAD_TOP + innerH} stroke="rgba(10,37,64,0.10)" strokeWidth="1" />
          <line x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + innerH / 2} y2={PAD_TOP + innerH / 2} stroke="rgba(10,37,64,0.05)" strokeWidth="1" strokeDasharray="2 4" />
          {points.length > 0 && (
            <>
              <path d={areaPath} fill="url(#dot-grad)" />
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="url(#dot-line)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
          {points.map((p, i) => {
            const isActive = activeWeekStart === p.b.weekStart;
            const isLast = i === points.length - 1;
            return (
              <g key={p.b.weekStart}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 5 : isLast ? 4 : 3}
                  fill={isActive ? '#fff' : '#EC4899'}
                  stroke={isActive || isLast ? '#fff' : 'transparent'}
                  strokeWidth={isLast ? 1.5 : 0}
                  style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                  onClick={() => onSelect(p.b.weekStart)}
                >
                  <title>{`${p.b.label}: ${p.b.count} disputes`}</title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-ink-dim">
        <span>{buckets[0]?.label || ''}</span>
        <span>{buckets[Math.floor(buckets.length / 2)]?.label || ''}</span>
        <span>{buckets[buckets.length - 1]?.label || 'this week'}</span>
      </div>
    </div>
  );
}

export function bucketByWeek(disputes: { created: number }[], weeks: number): WeekBucket[] {
  const now = new Date();
  // Snap to start of current week (Monday UTC)
  const day = now.getUTCDay() || 7;
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const monday = todayStart - (day - 1) * 24 * 60 * 60 * 1000;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = monday - i * weekMs;
    buckets.push({ weekStart, count: 0, label: weekLabel(weekStart, i, weeks) });
  }
  for (const d of disputes) {
    const ts = d.created * 1000;
    for (const b of buckets) {
      if (ts >= b.weekStart && ts < b.weekStart + weekMs) {
        b.count += 1;
        break;
      }
    }
  }
  return buckets;
}

function weekLabel(weekStart: number, indexFromOldest: number, total: number): string {
  if (indexFromOldest === total - 1) return 'this week';
  const date = new Date(weekStart);
  const m = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const d = date.getUTCDate();
  return `${m} ${d}`;
}
