'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DisputeListItem } from '@/lib/stripe';
import type { BaseSheetRow } from '@/lib/basesheet';
import AnimatedNumber from './AnimatedNumber';
import StatusDoughnut, { type StatusKey } from './charts/StatusDoughnut';
import AMBarChart, { type AMRow } from './charts/AMBarChart';
import DisputesOverTime, { bucketByWeek } from './charts/DisputesOverTime';
import TopBusinesses, { type BusinessRow } from './charts/TopBusinesses';
import EvidenceUrgency, { type UrgencyKey } from './charts/EvidenceUrgency';
import DisputesTable from './DisputesTable';

type EnrichedDispute = DisputeListItem & { baseSheet: BaseSheetRow | null };

type Filter =
  | { type: 'tab'; value: 'needs_response' | 'in_review' | 'won' | 'lost' | 'all' }
  | { type: 'business'; value: string }
  | { type: 'am'; value: string }
  | { type: 'urgency'; value: UrgencyKey }
  | { type: 'week'; value: number };

const STATUS_LABEL: Record<string, string> = {
  needs_response: 'Needs response',
  in_review: 'In review',
  won: 'Won',
  lost: 'Lost',
  all: 'All disputes',
};
const STATUS_COLOR: Record<string, string> = {
  needs_response: '#EC4899',
  in_review: '#F59E0B',
  won: '#10B981',
  lost: '#8B5CF6',
  all: '#2D5BFF',
};
const URGENCY_LABEL: Record<UrgencyKey, string> = {
  critical: 'Due ≤3 days',
  soon: 'Due 4–7 days',
  this_week: 'Due 8–14 days',
  plenty: 'Due 15+ days',
};
const URGENCY_COLOR: Record<UrgencyKey, string> = {
  critical: '#EF4444',
  soon: '#F59E0B',
  this_week: '#8B5CF6',
  plenty: '#10B981',
};

function isNeedsResponse(d: { status: string }) {
  return d.status === 'warning_needs_response' || d.status === 'needs_response';
}
function isInReview(d: { status: string }) {
  return d.status === 'warning_under_review' || d.status === 'under_review';
}
function daysUntilDue(d: EnrichedDispute, now: number): number | null {
  if (!d.evidenceDueBy) return null;
  return Math.max(0, Math.ceil((d.evidenceDueBy * 1000 - now) / (24 * 60 * 60 * 1000)));
}
function urgencyOf(d: EnrichedDispute, now: number): UrgencyKey | null {
  const days = daysUntilDue(d, now);
  if (days === null) return null;
  if (days <= 3) return 'critical';
  if (days <= 7) return 'soon';
  if (days <= 14) return 'this_week';
  return 'plenty';
}

function applyFilter(disputes: EnrichedDispute[], f: Filter): EnrichedDispute[] {
  if (f.type === 'tab') {
    if (f.value === 'all') return disputes;
    if (f.value === 'needs_response') return disputes.filter(isNeedsResponse);
    if (f.value === 'in_review') return disputes.filter(isInReview);
    if (f.value === 'won') return disputes.filter((d) => d.status === 'won');
    if (f.value === 'lost') return disputes.filter((d) => d.status === 'lost');
  }
  if (f.type === 'business') return disputes.filter((d) => businessKey(d) === f.value);
  if (f.type === 'am') return disputes.filter((d) => d.baseSheet?.am_name === f.value);
  if (f.type === 'urgency') {
    const now = Date.now();
    return disputes.filter((d) => isNeedsResponse(d) && urgencyOf(d, now) === f.value);
  }
  if (f.type === 'week') {
    const start = f.value;
    const end = start + 7 * 24 * 60 * 60 * 1000;
    return disputes.filter((d) => d.created * 1000 >= start && d.created * 1000 < end);
  }
  return disputes;
}

function businessKey(d: EnrichedDispute): string {
  return d.baseSheet?.entity_id || d.customerId || d.id;
}
function businessName(d: EnrichedDispute): string {
  return (
    d.baseSheet?.bizname?.trim() ||
    d.customerName?.trim() ||
    d.customerEmail?.trim() ||
    'Unknown'
  );
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

  const initialStatus = searchParams?.get('status') ?? null;
  const initialFilter: Filter =
    initialStatus && ['needs_response', 'in_review', 'won', 'lost', 'all'].includes(initialStatus)
      ? { type: 'tab', value: initialStatus as 'needs_response' | 'in_review' | 'won' | 'lost' | 'all' }
      : { type: 'tab', value: 'needs_response' };

  const [filter, setFilter] = useState<Filter>(initialFilter);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter.type === 'tab') params.set('status', filter.value);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
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

  const amRows: AMRow[] = useMemo(() => {
    const map = new Map<string, { amount: number; count: number; trend: number[] }>();
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const weeks = 6;
    for (const d of disputes) {
      const am = d.baseSheet?.am_name?.trim();
      if (!am) continue;
      const existing = map.get(am) || { amount: 0, count: 0, trend: new Array(weeks).fill(0) };
      existing.amount += d.amount / 100;
      existing.count += 1;
      const ts = d.created * 1000;
      const weekIdx = Math.floor((now - ts) / weekMs);
      if (weekIdx >= 0 && weekIdx < weeks) {
        existing.trend[weeks - 1 - weekIdx] += 1;
      }
      map.set(am, existing);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, amount: Math.round(v.amount), count: v.count, trend: v.trend }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [disputes]);

  // Top 5 businesses at risk: only count disputes that are actively at risk
  // (needs_response or in_review). Won/lost disputes don't represent live exposure.
  const businessRows: BusinessRow[] = useMemo(() => {
    const map = new Map<string, BusinessRow>();
    for (const d of disputes) {
      if (!isNeedsResponse(d) && !isInReview(d)) continue;
      const id = businessKey(d);
      const existing = map.get(id) || {
        id,
        name: businessName(d),
        entityId: d.baseSheet?.entity_id ?? null,
        amount: 0,
        count: 0,
      };
      existing.amount += d.amount / 100;
      existing.count += 1;
      map.set(id, existing);
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, amount: Math.round(r.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [disputes]);

  const urgencyCounts = useMemo(() => {
    const now = Date.now();
    const counts: Record<UrgencyKey, number> = { critical: 0, soon: 0, this_week: 0, plenty: 0 };
    for (const d of disputes) {
      if (!isNeedsResponse(d)) continue;
      const k = urgencyOf(d, now);
      if (k) counts[k] += 1;
    }
    return counts;
  }, [disputes]);

  const visible = useMemo(() => applyFilter(disputes, filter), [disputes, filter]);

  const activeStatusKey: StatusKey | null =
    filter.type === 'tab' && filter.value !== 'all' ? (filter.value as StatusKey) : null;
  const activeAm = filter.type === 'am' ? filter.value : null;
  const activeBusiness = filter.type === 'business' ? filter.value : null;
  const activeUrgency = filter.type === 'urgency' ? filter.value : null;
  const activeWeek = filter.type === 'week' ? filter.value : null;

  const filterLabel: string =
    filter.type === 'tab'
      ? STATUS_LABEL[filter.value]
      : filter.type === 'business'
        ? `Business: ${businessRows.find((b) => b.id === filter.value)?.name ?? filter.value}`
        : filter.type === 'am'
          ? `AM: ${filter.value}`
          : filter.type === 'urgency'
            ? URGENCY_LABEL[filter.value]
            : filter.type === 'week'
              ? `Week of ${new Date(filter.value).toISOString().slice(0, 10)}`
              : 'All disputes';

  const filterColor: string =
    filter.type === 'tab'
      ? STATUS_COLOR[filter.value] || '#2D5BFF'
      : filter.type === 'urgency'
        ? URGENCY_COLOR[filter.value]
        : '#8B5CF6';

  function setTab(key: 'needs_response' | 'in_review' | 'won' | 'lost' | 'all') {
    setFilter({ type: 'tab', value: key });
  }
  function setBusiness(id: string) {
    setFilter({ type: 'business', value: id });
  }
  function setAm(am: string) {
    setFilter({ type: 'am', value: am });
  }
  function setUrgency(k: UrgencyKey) {
    setFilter({ type: 'urgency', value: k });
  }
  function setWeek(weekStart: number | null) {
    if (weekStart === null) {
      setFilter({ type: 'tab', value: 'all' });
    } else {
      setFilter({ type: 'week', value: weekStart });
    }
  }
  function clearFilter() {
    setFilter({ type: 'tab', value: 'needs_response' });
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* STAT CARDS */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total"
          value={counts.total}
          subtext={`${new Set(disputes.map((d) => d.customerId).filter(Boolean)).size} customers`}
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

      {/* ROW 1: STATUS DOUGHNUT + AM PANEL */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="lg:col-span-1">
          <ChartCard title="Status breakdown" hint="click a slice to filter">
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
        </div>
        <div className="lg:col-span-2">
          <ChartCard title="Top 5 AMs by exposure" hint="click any row to filter">
            <AMBarChart rows={amRows} active={activeAm} onSelect={setAm} />
          </ChartCard>
        </div>
      </section>

      {/* ROW 2: DISPUTES OVER TIME (full width) */}
      <section>
        <ChartCard title="Disputes opened over time" hint="click any week marker">
          <DisputesOverTime
            disputes={disputes.map((d) => ({ created: d.created }))}
            weeks={12}
            activeWeekStart={activeWeek}
            onSelect={setWeek}
          />
        </ChartCard>
      </section>

      {/* ROW 3: TOP BUSINESSES + EVIDENCE URGENCY */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <ChartCard title="Top 5 businesses at risk" hint="click any row to filter">
          <TopBusinesses rows={businessRows} active={activeBusiness} onSelect={setBusiness} />
        </ChartCard>
        <ChartCard title="Evidence-due urgency" hint="among needs-response · click to filter">
          <EvidenceUrgency counts={urgencyCounts} active={activeUrgency} onSelect={setUrgency} />
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
      className={`text-left rounded-2xl border p-4 sm:p-5 group relative transition-all duration-300 backdrop-blur-sm ${
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
      <div className={`mt-1 text-3xl sm:text-4xl font-extrabold tabular-nums ${numberClass}`}>
        <AnimatedNumber value={value} delay={delay + 200} />
      </div>
      <div className="mt-1 text-xs text-ink-dim">{subtext}</div>
      <span className="absolute top-4 right-4 text-ink-dim group-hover:text-ink transition text-sm">
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
    <div className="rounded-2xl border border-line bg-surface/50 backdrop-blur-sm p-4 sm:p-5 hover:border-line-strong transition h-full">
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
