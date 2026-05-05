'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DisputeListItem } from '@/lib/stripe';
import type { BaseSheetRow } from '@/lib/basesheet';
import AnimatedNumber from './AnimatedNumber';
import StatusDoughnut, { type StatusKey } from './charts/StatusDoughnut';
import AMBarChart, { type AMRow } from './charts/AMBarChart';
import ReasonStackedBar, { type ReasonRow } from './charts/ReasonStackedBar';
import DisputesTable from './DisputesTable';

type EnrichedDispute = DisputeListItem & { baseSheet: BaseSheetRow | null };

type Filter =
  | { type: 'tab'; value: 'needs_response' | 'in_review' | 'won' | 'lost' | 'all' }
  | { type: 'reason'; value: string }
  | { type: 'am'; value: string };

const TAB_KEYS = ['needs_response', 'in_review', 'won', 'lost', 'all'] as const;
const STATUS_KEYS: StatusKey[] = ['needs_response', 'in_review', 'won', 'lost'];

const STATUS_LABEL: Record<string, string> = {
  needs_response: 'Needs response',
  in_review: 'In review',
  won: 'Won',
  lost: 'Lost',
  all: 'All disputes',
};

const STATUS_COLOR: Record<string, string> = {
  needs_response: '#EC4899',
  in_review: '#FDE047',
  won: '#4ADE80',
  lost: '#A78BFA',
  all: '#F0A5CE',
};

function isNeedsResponse(d: { status: string }) {
  return d.status === 'warning_needs_response' || d.status === 'needs_response';
}
function isInReview(d: { status: string }) {
  return d.status === 'warning_under_review' || d.status === 'under_review';
}

function applyFilter(disputes: EnrichedDispute[], f: Filter): EnrichedDispute[] {
  if (f.type === 'tab') {
    if (f.value === 'all') return disputes;
    if (f.value === 'needs_response') return disputes.filter(isNeedsResponse);
    if (f.value === 'in_review') return disputes.filter(isInReview);
    if (f.value === 'won') return disputes.filter((d) => d.status === 'won');
    if (f.value === 'lost') return disputes.filter((d) => d.status === 'lost');
  }
  if (f.type === 'reason') return disputes.filter((d) => d.reason === f.value);
  if (f.type === 'am') return disputes.filter((d) => d.baseSheet?.am_name === f.value);
  return disputes;
}

export default function Dashboard({
  disputes,
  enrichmentError,
}: {
  disputes: EnrichedDispute[];
  enrichmentError: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial = (searchParams?.get('status') as Filter['value'] | null) || 'needs_response';
  const initialFilter: Filter = TAB_KEYS.includes(initial as any)
    ? { type: 'tab', value: initial as any }
    : { type: 'tab', value: 'needs_response' };

  const [filter, setFilter] = useState<Filter>(initialFilter);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (filter.type === 'tab') {
      params.set('status', filter.value);
      params.delete('reason');
      params.delete('am');
    } else if (filter.type === 'reason') {
      params.set('reason', filter.value);
      params.delete('status');
      params.delete('am');
    } else if (filter.type === 'am') {
      params.set('am', filter.value);
      params.delete('status');
      params.delete('reason');
    }
    router.replace(`/?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const counts = useMemo(() => {
    const by: Record<StatusKey, number> = {
      needs_response: disputes.filter(isNeedsResponse).length,
      in_review: disputes.filter(isInReview).length,
      won: disputes.filter((d) => d.status === 'won').length,
      lost: disputes.filter((d) => d.status === 'lost').length,
    };
    const total = disputes.length;
    const totalDue = disputes.filter(isNeedsResponse).reduce((sum, d) => sum + d.amount, 0);
    return { ...by, total, totalDue };
  }, [disputes]);

  const reasonRows: ReasonRow[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of disputes) {
      const r = d.reason || 'unknown';
      map.set(r, (map.get(r) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([reason, count]) => ({ reason, count }));
  }, [disputes]);

  const amRows: AMRow[] = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const d of disputes) {
      const am = d.baseSheet?.am_name?.trim();
      if (!am) continue;
      const existing = map.get(am) || { amount: 0, count: 0 };
      existing.amount += d.amount / 100;
      existing.count += 1;
      map.set(am, existing);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, amount: Math.round(v.amount), count: v.count }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [disputes]);

  const visible = useMemo(() => applyFilter(disputes, filter), [disputes, filter]);

  const activeStatusKey: StatusKey | null = filter.type === 'tab' && filter.value !== 'all' ? (filter.value as StatusKey) : null;
  const activeAm = filter.type === 'am' ? filter.value : null;
  const activeReason = filter.type === 'reason' ? filter.value : null;

  const filterLabel =
    filter.type === 'tab'
      ? STATUS_LABEL[filter.value]
      : filter.type === 'reason'
        ? `Reason: ${filter.value}`
        : `AM: ${filter.value}`;

  const filterColor =
    filter.type === 'tab'
      ? STATUS_COLOR[filter.value] || '#F0A5CE'
      : filter.type === 'reason'
        ? '#A78BFA'
        : '#A78BFA';

  function setTab(key: Filter['value']) {
    setFilter({ type: 'tab', value: key } as Filter);
  }
  function setReason(reason: string) {
    setFilter({ type: 'reason', value: reason });
  }
  function setAm(am: string) {
    setFilter({ type: 'am', value: am });
  }
  function clearFilter() {
    setFilter({ type: 'tab', value: 'needs_response' });
  }

  return (
    <div className="space-y-8">
      {/* STAT CARDS */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total disputes"
          value={counts.total}
          subtext={`${new Set(disputes.map((d) => d.customerId).filter(Boolean)).size} unique customers`}
          numberClass="text-ink"
          isActive={filter.type === 'tab' && filter.value === 'all'}
          onClick={() => setTab('all')}
          delay={0}
        />
        <StatCard
          label="Needs response"
          value={counts.needs_response}
          subtext={`${formatMoney(counts.totalDue)} at risk`}
          numberClass="text-accent-pink-strong"
          isActive={filter.type === 'tab' && filter.value === 'needs_response'}
          onClick={() => setTab('needs_response')}
          delay={80}
        />
        <StatCard
          label="In review"
          value={counts.in_review}
          subtext="awaiting Stripe"
          numberClass="text-accent-yellow"
          isActive={filter.type === 'tab' && filter.value === 'in_review'}
          onClick={() => setTab('in_review')}
          delay={160}
        />
        <StatCard
          label="Won"
          value={counts.won}
          subtext="evidence accepted"
          numberClass="text-accent-green"
          isActive={filter.type === 'tab' && filter.value === 'won'}
          onClick={() => setTab('won')}
          delay={240}
        />
        <StatCard
          label="Lost"
          value={counts.lost}
          subtext="charged back"
          numberClass="text-accent-purple"
          isActive={filter.type === 'tab' && filter.value === 'lost'}
          onClick={() => setTab('lost')}
          delay={320}
        />
      </section>

      {/* CHARTS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Status breakdown" hint="click any segment">
          <StatusDoughnut
            counts={{
              needs_response: counts.needs_response,
              in_review: counts.in_review,
              won: counts.won,
              lost: counts.lost,
            }}
            active={activeStatusKey}
            onSelect={(k) => setTab(k)}
          />
        </ChartCard>
        <ChartCard title="Top 5 AMs by exposure" hint="click any bar">
          <AMBarChart rows={amRows} active={activeAm} onSelect={setAm} />
        </ChartCard>
      </section>

      <section>
        <ChartCard title="Reason breakdown" hint="click any segment">
          <ReasonStackedBar rows={reasonRows} active={activeReason} onSelect={setReason} />
        </ChartCard>
      </section>

      {/* FILTER CHIP */}
      <section className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-ink-dim">Active filter:</span>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition"
          style={{
            background: `${filterColor}22`,
            color: filterColor,
            borderColor: `${filterColor}55`,
          }}
        >
          {filterLabel}
          <span className="opacity-70 tabular-nums">· {visible.length}</span>
        </span>
        {!(filter.type === 'tab' && filter.value === 'needs_response') && (
          <button
            onClick={clearFilter}
            className="text-xs text-accent-pink hover:text-accent-pink-strong transition"
          >
            reset ↺
          </button>
        )}
      </section>

      {/* TABLE */}
      <DisputesTable
        disputes={visible}
        enrichmentError={enrichmentError}
        showTabs={false}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  numberClass,
  isActive,
  onClick,
  delay,
}: {
  label: string;
  value: number;
  subtext: string;
  numberClass: string;
  isActive: boolean;
  onClick: () => void;
  delay: number;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setEntered(true), delay);
    return () => clearTimeout(id);
  }, [delay]);

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border p-5 group relative transition-all duration-300 backdrop-blur-sm ${
        isActive
          ? 'border-accent-pink-strong bg-accent-pink-bg/40 breathe-pink active-conic-border'
          : 'border-line bg-surface/50 hover:border-line-strong'
      }`}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(12px)',
        transitionProperty: 'opacity, transform, border-color, background-color',
      }}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-dim">{label}</div>
      <div className={`mt-1 text-4xl font-extrabold tabular-nums ${numberClass}`}>
        <AnimatedNumber value={value} delay={delay + 200} />
      </div>
      <div className="mt-1 text-xs text-ink-dim">{subtext}</div>
      <span className="absolute top-5 right-5 text-ink-dim group-hover:text-ink transition text-sm">
        →
      </span>
    </button>
  );
}

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/50 backdrop-blur-sm p-5 hover:border-line-strong transition">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">{title}</h3>
        {hint && <span className="text-[10px] text-ink-dim">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
