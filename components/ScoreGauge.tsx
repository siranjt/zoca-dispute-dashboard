'use client';

import { useEffect, useState } from 'react';

const MAX = 8;

export default function ScoreGauge({ score }: { score: number }) {
  const [animProgress, setAnimProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1400;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setAnimProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const clamped = Math.max(-MAX, Math.min(MAX, score));
  const displayedScore = Math.round(clamped * animProgress);
  const pctOfMax = Math.abs(clamped) / MAX;
  const animPct = pctOfMax * animProgress;
  const color = clamped >= 4 ? '#10B981' : clamped <= -2 ? '#EF4444' : '#F59E0B';

  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ - circ * animPct;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 160, height: 160 }}>
        <svg
          viewBox="0 0 100 100"
          width="160"
          height="160"
          role="img"
          aria-label={`Dispute score: ${clamped}`}
        >
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(10,37,64,0.08)" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke 0.4s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-4xl font-extrabold tabular-nums leading-none" style={{ color }}>
            {displayedScore > 0 ? `+${displayedScore}` : displayedScore}
          </div>
          <div className="text-[10px] text-ink-dim mt-1 uppercase tracking-wider">
            ±{MAX} max
          </div>
        </div>
      </div>
    </div>
  );
}
