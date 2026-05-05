import { Suspense } from 'react';
import { revalidateTag } from 'next/cache';
import { listDisputes, formatAmount, isNeedsResponse, type DisputeListItem } from '@/lib/stripe';
import { matchCustomer, type BaseSheetRow } from '@/lib/basesheet';
import DisputesTable from '@/components/DisputesTable';

// ISR: page cache for 60s. First request renders, subsequent requests hit
// the cached HTML instantly. Stale data is served during background regen
// (so users never wait on Stripe + BaseSheet again).
export const revalidate = 60;
export const runtime = 'nodejs';
export const maxDuration = 60;

async function refreshAction() {
  'use server';
  revalidateTag('disputes');
  revalidateTag('basesheet');
}

type EnrichedDispute = DisputeListItem & { baseSheet: BaseSheetRow | null };

export default async function Page() {
  let disputes: DisputeListItem[] = [];
  let error: string | null = null;
  try {
    disputes = await listDisputes({ limit: 100 });
  } catch (e: any) {
    error = e?.message ?? 'Unknown error';
  }

  let enrichmentError: string | null = null;
  let enriched: EnrichedDispute[] = disputes.map((d) => ({ ...d, baseSheet: null }));
  try {
    enriched = await Promise.all(
      disputes.map(async (d) => {
        const baseSheet = await matchCustomer({
          customerId: d.customerId ?? null,
          email: d.customerEmail ?? null,
          phone: d.customerPhone ?? null,
        });
        return { ...d, baseSheet };
      }),
    );
  } catch (e: any) {
    enrichmentError = e?.message ?? 'BaseSheet enrichment failed';
  }

  const needsResponse = enriched.filter(isNeedsResponse);
  const inReview = enriched.filter(
    (d) => d.status === 'warning_under_review' || d.status === 'under_review',
  );
  const won = enriched.filter((d) => d.status === 'won');
  const lost = enriched.filter((d) => d.status === 'lost');
  const totalDue = needsResponse.reduce((sum, d) => sum + d.amount, 0);
  const currency = enriched[0]?.currency ?? 'usd';

  const refreshTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const refreshDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="pt-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-line bg-surface/50">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green"></span>
          <span className="text-sm text-ink-muted">Live Stripe disputes · auto-scored by Claude</span>
        </div>

        <h1 className="mt-8 text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.95]">
          Dispute <span className="text-pink-gradient">Analyser</span>
          <span className="inline-block ml-2 align-top">
            <Sparkle />
          </span>
        </h1>

        <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-ink-muted leading-relaxed">
          Which Stripe chargebacks Zoca should fight, refund, or escalate to an AM — surfaced from
          live customer comms across App Chat, Email, Phone, SMS, and Video.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
          <Feature>Last 100 disputes</Feature>
          <Feature>Live Stripe + Metabase</Feature>
          <Feature>Claude-scored signals</Feature>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red-bg/40 px-5 py-4 text-sm text-accent-red">
          <strong className="text-ink">Could not fetch disputes:</strong> {error}
          <br />
          Verify <code className="text-ink">STRIPE_SECRET_KEY</code> is set on Vercel and has the
          required restricted scopes (Disputes, Charges, Customers, Payment Intents, Reviews).
        </div>
      )}

      {/* STATUS BAR */}
      <section className="rounded-2xl border border-line bg-surface/50 backdrop-blur-sm px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-ink-muted">
          <span className="text-ink-dim mr-2">SHOWING</span>
          <span className="text-ink font-semibold">{enriched.length}</span>
          <span className="text-ink-dim mx-1">/ {enriched.length}</span>
          <span className="text-ink-dim mx-3">·</span>
          <span className="text-ink-dim mr-2">LAST REFRESH</span>
          <span className="text-ink font-semibold">{refreshTime}</span>
          <span className="text-ink-dim mx-3">·</span>
          <span className="text-ink-dim">{refreshDate}</span>
        </div>
        <form action={refreshAction}>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-full border border-accent-pink-strong/60 text-accent-pink hover:bg-accent-pink-bg transition text-sm font-medium"
          >
            ↻ Refresh live data
          </button>
        </form>
      </section>

      {/* STAT CARDS */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total disputes"
          value={enriched.length.toString()}
          subtext={`${new Set(enriched.map((d) => d.customerId).filter(Boolean)).size} unique customers`}
          numberClass="text-ink"
        />
        <StatCard
          label="Needs response"
          value={needsResponse.length.toString()}
          subtext={formatAmount(totalDue, currency) + ' at risk'}
          numberClass="text-accent-pink-strong"
        />
        <StatCard
          label="In review"
          value={inReview.length.toString()}
          subtext="awaiting Stripe"
          numberClass="text-accent-yellow"
        />
        <StatCard
          label="Won"
          value={won.length.toString()}
          subtext="evidence accepted"
          numberClass="text-accent-green"
        />
        <StatCard
          label="Lost"
          value={lost.length.toString()}
          subtext="charged back"
          numberClass="text-accent-purple"
        />
      </section>

      {/* INTERACTIVE TABS + TABLE (client component) */}
      <Suspense
        fallback={
          <div className="rounded-2xl border border-line bg-surface/40 backdrop-blur-sm p-12 text-center text-ink-muted">
            Loading disputes…
          </div>
        }
      >
        <DisputesTable disputes={enriched} enrichmentError={enrichmentError} />
      </Suspense>
    </div>
  );
}

// ─── components ────────────────────────────────────────

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-accent-pink">✻</span>
      <span>{children}</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  subtext,
  numberClass,
}: {
  label: string;
  value: string;
  subtext: string;
  numberClass: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/50 backdrop-blur-sm p-5 group hover:border-line-strong transition relative">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-dim">{label}</div>
      <div className={`mt-1 text-4xl font-extrabold tabular-nums ${numberClass}`}>{value}</div>
      <div className="mt-1 text-xs text-ink-dim">{subtext}</div>
      <span className="absolute top-5 right-5 text-ink-dim group-hover:text-ink transition text-sm">
        →
      </span>
    </div>
  );
}

function Sparkle() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
        fill="#F0A5CE"
      />
    </svg>
  );
}
