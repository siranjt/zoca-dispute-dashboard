'use client';

import { useEffect, useState } from 'react';
import AnimatedNumber from './AnimatedNumber';

const REC_STYLES: Record<string, { word: string; color: string; bgClass: string; borderClass: string; breatheClass: string }> = {
  FIGHT: {
    word: 'FIGHT',
    color: '#4ADE80',
    bgClass: 'bg-accent-green-bg/40',
    borderClass: 'border-accent-green/40',
    breatheClass: 'breathe-green',
  },
  REFUND: {
    word: 'REFUND',
    color: '#F87171',
    bgClass: 'bg-accent-red-bg/40',
    borderClass: 'border-accent-red/40',
    breatheClass: 'breathe-pink',
  },
  'NEEDS AM CALL': {
    word: 'NEEDS AM CALL',
    color: '#FDE047',
    bgClass: 'bg-accent-yellow-bg/40',
    borderClass: 'border-accent-yellow/40',
    breatheClass: 'breathe-pink',
  },
};

export default function RecommendationHero({
  recommendation,
  rationale,
  evidenceDueIso,
  daysUntilDue,
}: {
  recommendation: string;
  rationale: string;
  evidenceDueIso: string | null;
  daysUntilDue: number | null;
}) {
  const style = REC_STYLES[recommendation] || REC_STYLES.FIGHT;
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 100);
    return () => clearTimeout(id);
  }, []);

  return (
    <section
      className={`rounded-2xl border ${style.borderClass} ${style.bgClass} ${style.breatheClass} backdrop-blur-sm p-6 sm:p-8 transition-all duration-500`}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-dim">
        Recommendation
      </div>
      <div
        className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight"
        style={{ color: style.color }}
      >
        {style.word.split('').map((ch, i) => (
          <span
            key={i}
            className="inline-block"
            style={{
              opacity: 0,
              transform: 'translateY(20px)',
              animation: `letter-in 0.5s forwards ${300 + i * 60}ms`,
            }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </div>
      <div className="mt-3 text-base text-ink leading-relaxed max-w-3xl">{rationale}</div>
      {evidenceDueIso && (
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs"
          style={{ background: `${style.color}26`, color: style.color }}
        >
          <span>Evidence due {evidenceDueIso}</span>
          {daysUntilDue !== null && (
            <>
              <span className="opacity-50">·</span>
              <span className="font-semibold tabular-nums min-w-[18px] text-center">
                <AnimatedNumber value={daysUntilDue} duration={800} delay={500} />
              </span>
              <span>days remaining</span>
            </>
          )}
        </div>
      )}
    </section>
  );
}
