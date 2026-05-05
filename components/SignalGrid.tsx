'use client';

import { useEffect, useState } from 'react';

export type Signal = {
  id: string;
  label: string;
  weight: number;
  fired: boolean;
  evidence?: string;
};

export default function SignalGrid({ signals }: { signals: Signal[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {signals.map((s, i) => (
        <SignalCard key={s.id} signal={s} index={i} />
      ))}
    </div>
  );
}

function SignalCard({ signal, index }: { signal: Signal; index: number }) {
  const [entered, setEntered] = useState(false);
  const [ringPct, setRingPct] = useState(0);

  useEffect(() => {
    const id1 = setTimeout(() => setEntered(true), 200 + index * 80);
    const id2 = setTimeout(() => {
      if (signal.fired) {
        setRingPct(Math.abs(signal.weight) / 3);
      }
    }, 700 + index * 80);
    return () => {
      clearTimeout(id1);
      clearTimeout(id2);
    };
  }, [index, signal.fired, signal.weight]);

  const isPositive = signal.weight > 0;
  const ringColor = isPositive ? '#4ADE80' : '#EC4899';
  const baseClasses = signal.fired
    ? isPositive
      ? 'border-accent-green/30 bg-accent-green-bg/30'
      : 'border-accent-pink/30 bg-accent-pink-bg/30'
    : 'border-line-soft bg-elevated/30 opacity-60';

  const radius = 14;
  const circ = 2 * Math.PI * radius;

  return (
    <div
      className={`relative rounded-xl border ${baseClasses} px-4 py-3 transition-all`}
      style={{
        opacity: entered ? (signal.fired ? 1 : 0.6) : 0,
        transform: entered ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.5s, transform 0.5s, background-color 0.3s, border-color 0.3s',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0" style={{ width: 32, height: 32 }}>
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
            <circle cx="16" cy="16" r={radius} fill="none" stroke="rgba(167,151,196,0.15)" strokeWidth="3" />
            <circle
              cx="16"
              cy="16"
              r={radius}
              fill="none"
              stroke={signal.fired ? ringColor : 'rgba(167,151,196,0.15)'}
              strokeWidth="3"
              strokeLinecap="round"
              transform="rotate(-90 16 16)"
              strokeDasharray={circ}
              strokeDashoffset={circ - circ * ringPct}
              style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.3s' }}
            />
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
            style={{ color: signal.fired ? ringColor : '#6F5E8E' }}
          >
            {signal.weight > 0 ? `+${signal.weight}` : signal.weight}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium ${signal.fired ? 'text-ink' : 'text-ink-muted'}`}>
            {signal.label}
          </div>
          {signal.evidence && (
            <div className="text-xs text-ink-muted mt-1 leading-relaxed">{signal.evidence}</div>
          )}
        </div>
      </div>
    </div>
  );
}
