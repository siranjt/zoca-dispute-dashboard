'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  'Fetching dispute from Stripe',
  'Matching customer to BaseSheet',
  'Streaming 90 days of comms across 5 channels',
  'Scoring 8 signals with Claude',
  'Generating counter-response draft',
];

export default function Loading() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-8 pt-8">
      {/* Breadcrumb */}
      <div>
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <span>←</span> All disputes
        </span>
      </div>

      {/* Headline skeleton */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-ink-dim">
          <Skel w={140} h={11} />
        </div>
        <Skel w={360} h={48} />
        <Skel w={240} h={16} />
      </header>

      {/* Pulsing recommendation block with active step */}
      <section className="rounded-2xl border border-accent-purple/30 animate-shimmer-bar p-6 sm:p-8">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-dim mb-2">
          Analysing with Claude
        </div>
        <div className="flex items-center gap-3">
          <Spinner />
          <div className="text-2xl sm:text-3xl font-extrabold text-ink">{STEPS[step]}…</div>
        </div>
        <div className="mt-3 text-sm text-ink-muted">
          This usually takes 30-60 seconds. The page will refresh automatically when ready.
        </div>
      </section>

      {/* Step list */}
      <section className="rounded-2xl border border-line bg-surface/50 backdrop-blur-sm p-6">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-dim mb-4">
          Pipeline
        </div>
        <ol className="space-y-3">
          {STEPS.map((label, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 text-sm transition-opacity ${
                i <= step ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <span className="w-4 h-4 inline-flex items-center justify-center">
                {i < step ? (
                  <span className="text-accent-green">✓</span>
                ) : i === step ? (
                  <Spinner small />
                ) : (
                  <span className="text-ink-dim">○</span>
                )}
              </span>
              <span
                className={i === step ? 'text-ink' : i < step ? 'text-ink-muted' : 'text-ink-dim'}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Skeleton cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-5">
          <SkeletonCard rows={6} />
          <SkeletonCard rows={6} />
        </div>
        <div className="lg:col-span-2 space-y-5">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={6} />
        </div>
      </div>
    </div>
  );
}

function Spinner({ small }: { small?: boolean }) {
  const size = small ? 12 : 18;
  const border = small ? 1.5 : 2;
  return (
    <span
      className="animate-spin-slow inline-block"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${border}px solid rgba(167,151,196,0.2)`,
        borderTopColor: '#F0A5CE',
      }}
    />
  );
}

function Skel({ w, h, full }: { w?: number; h: number; full?: boolean }) {
  return (
    <span
      className="animate-shimmer-skel inline-block rounded"
      style={{
        width: full ? '100%' : w,
        height: h,
      }}
    />
  );
}

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/50 backdrop-blur-sm p-5 sm:p-6">
      <Skel w={80} h={11} />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 items-center">
            <Skel w={70} h={11} />
            <div className="flex-1">
              <Skel h={12} full />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
