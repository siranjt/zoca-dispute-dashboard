import { Suspense } from 'react';
import { revalidatePath, revalidateTag } from 'next/cache';
import { listDisputes, type DisputeListItem } from '@/lib/stripe';
import { matchCustomer, type BaseSheetRow } from '@/lib/basesheet';
import Dashboard from '@/components/Dashboard';
import AmbientSparkles from '@/components/AmbientSparkles';
import RefreshButton from '@/components/RefreshButton';

export const revalidate = 60;
export const runtime = 'nodejs';
export const maxDuration = 60;

async function refreshAction() {
  'use server';
  revalidateTag('disputes');
  revalidateTag('basesheet');
  revalidatePath('/');
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
          name: d.customerName ?? null,
        });
        return { ...d, baseSheet };
      }),
    );
  } catch (e: any) {
    enrichmentError = e?.message ?? 'BaseSheet enrichment failed';
  }

  const refreshTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const refreshDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8 sm:space-y-10 relative">
      <AmbientSparkles />

      {/* HERO */}
      <section className="pt-8 sm:pt-12 relative flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-line bg-surface/50">
          <span className="live-dot"></span>
          <span className="text-sm text-ink-muted">Live Stripe disputes · auto-scored by Claude</span>
        </div>

        <div className="relative inline-block mt-6 sm:mt-8">
          <span
            aria-hidden
            className="header-spark text-accent-pink text-sm"
            style={{ top: '-12px', left: '-22px', animationDelay: '0s' }}
          >
            ✦
          </span>
          <span
            aria-hidden
            className="header-spark text-accent-purple text-xs"
            style={{ top: '-4px', right: '-26px', animationDelay: '0.7s' }}
          >
            ✦
          </span>
          <span
            aria-hidden
            className="header-spark text-accent-yellow text-sm"
            style={{ bottom: '8px', right: '-12px', animationDelay: '1.4s' }}
          >
            ✦
          </span>
          <h1 className="text-pink-shimmer text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight leading-[0.95] m-0">
            Dispute Analyser
          </h1>
        </div>

        <p className="mt-4 sm:mt-6 max-w-2xl text-sm sm:text-base lg:text-lg text-ink-muted leading-relaxed">
          Which Stripe chargebacks Zoca should fight, refund, or escalate to an AM — surfaced from
          live customer comms across App Chat, Email, Phone, SMS, and Video.
        </p>

        <div className="mt-5 sm:mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
          <Feature>Last 100 disputes</Feature>
          <Feature>Live Stripe + Metabase</Feature>
          <Feature>Claude-scored signals</Feature>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red-bg/40 px-5 py-4 text-sm text-accent-red">
          <strong className="text-ink">Could not fetch disputes:</strong> {error}
        </div>
      )}

      {/* STATUS BAR */}
      <section className="rounded-2xl border border-line bg-surface/50 backdrop-blur-sm px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs sm:text-sm text-ink-muted">
          <span className="text-ink-dim mr-2">SHOWING</span>
          <span className="text-ink font-semibold">{enriched.length}</span>
          <span className="text-ink-dim mx-1">/ {enriched.length}</span>
          <span className="text-ink-dim mx-2 sm:mx-3">·</span>
          <span className="text-ink-dim mr-2">LAST REFRESH</span>
          <span className="text-ink font-semibold tabular-nums">{refreshTime}</span>
          <span className="text-ink-dim mx-2 sm:mx-3 hidden sm:inline">·</span>
          <span className="text-ink-dim hidden sm:inline tabular-nums">{refreshDate}</span>
        </div>
        <RefreshButton action={refreshAction} />
      </section>

      {/* INTERACTIVE DASHBOARD */}
      <Suspense
        fallback={
          <div className="rounded-2xl border border-line bg-surface/40 backdrop-blur-sm p-12 text-center text-ink-muted">
            Loading disputes…
          </div>
        }
      >
        <Dashboard disputes={enriched} enrichmentError={enrichmentError} />
      </Suspense>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-accent-pink">✻</span>
      <span>{children}</span>
    </span>
  );
}
