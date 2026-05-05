'use client';

import { useEffect, useState } from 'react';

export type StatusKey = 'needs_response' | 'in_review' | 'won' | 'lost';

const SLICE_DEFS: { key: StatusKey; label: string; color: string }[] = [
  { key: 'needs_response', label: 'Needs response', color: '#EC4899' },
  { key: 'in_review', label: 'In review', color: '#FDE047' },
  { key: 'won', label: 'Won', color: '#4ADE80' },
  { key: 'lost', label: 'Lost', color: '#A78BFA' },
];

export default function StatusDoughnut({
  counts,
  active,
  onSelect,
}: {
  counts: Record<StatusKey, number>;
  active: StatusKey | null;
  onSelect: (key: StatusKey) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState<StatusKey | null>(null);

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
  }, []);

  const total = Math.max(
    1,
    SLICE_DEFS.reduce((sum, s) => sum + (counts[s.key] || 0), 0),
  );

  const radius = 38;
  const cx = 50;
  const cy = 50;

  let cumulative = 0;
  const slices = SLICE_DEFS.map((def) => {
    const value = counts[def.key] || 0;
    const fraction = (value / total) * progress;
    const startAngle = (cumulative / total) * 2 * Math.PI;
    cumulative += value;
    const endAngle = (cumulative / total) * 2 * Math.PI;
    const animatedEnd = startAngle + (endAngle - startAngle) * progress;

    const path = arcPath(cx, cy, radius, startAngle, animatedEnd);
    const isActive = active === def.key;
    const isHovered = hovered === def.key;
    const offsetDist = isActive || isHovered ? 4 : 0;
    const midAngle = (startAngle + animatedEnd) / 2;
    const tx = Math.cos(midAngle - Math.PI / 2) * offsetDist;
    const ty = Math.sin(midAngle - Math.PI / 2) * offsetDist;

    return {
      key: def.key,
      label: def.label,
      color: def.color,
      value,
      fraction,
      path,
      transform: `translate(${tx} ${ty})`,
      opacity: active && !isActive ? 0.5 : 1,
    };
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
        <svg
          viewBox="0 0 100 100"
          width="160"
          height="160"
          role="img"
          aria-label="Doughnut chart of dispute statuses"
        >
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(167,151,196,0.08)" strokeWidth="14" />
          {slices.map((s) => (
            <path
              key={s.key}
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeLinecap="butt"
              transform={s.transform}
              opacity={s.opacity}
              onClick={() => onSelect(s.key)}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer', transition: 'transform 0.2s, opacity 0.2s' }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-extrabold text-ink tabular-nums">
            {hovered
              ? counts[hovered] || 0
              : active
                ? counts[active] || 0
                : Object.values(counts).reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-[10px] text-ink-dim uppercase tracking-wider mt-0.5">
            {hovered
              ? SLICE_DEFS.find((s) => s.key === hovered)?.label
              : active
                ? SLICE_DEFS.find((s) => s.key === active)?.label
                : 'Total'}
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 text-xs">
        {SLICE_DEFS.map((def) => {
          const value = counts[def.key] || 0;
          const isActive = active === def.key;
          return (
            <button
              key={def.key}
              onClick={() => onSelect(def.key)}
              onMouseEnter={() => setHovered(def.key)}
              onMouseLeave={() => setHovered(null)}
              className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md transition ${
                isActive ? 'bg-elevated' : 'hover:bg-elevated/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ background: def.color }}
                />
                <span className={isActive ? 'text-ink font-medium' : 'text-ink-muted'}>
                  {def.label}
                </span>
              </span>
              <span className="text-ink font-medium tabular-nums">{value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  if (endAngle - startAngle <= 0.0001) return '';
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const x1 = cx + r * Math.cos(startAngle - Math.PI / 2);
  const y1 = cy + r * Math.sin(startAngle - Math.PI / 2);
  const x2 = cx + r * Math.cos(endAngle - Math.PI / 2);
  const y2 = cy + r * Math.sin(endAngle - Math.PI / 2);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}
