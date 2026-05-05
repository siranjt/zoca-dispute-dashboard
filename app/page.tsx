import Link from 'next/link';
import { listDisputes, formatAmount, isNeedsResponse, type DisputeListItem } from '@/lib/stripe';
import { matchCustomer, type BaseSheetRow } from '@/lib/basesheet';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TabKey = 'needs_response' | 'won' | 'lost' | 'all';

const TAB_ORDER: { key: TabKey; label: string }[] = [
  { key: 'needs_response', label: 'Needs response' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'all', label: 'All disputes' },
];

type EnrichedDispute = DisputeListItem & { baseSheet: BaseSheetRow | null };

function applyTab(disputes: EnrichedDispute[], tab: TabKey): EnrichedDispute[] {
  switch (tab) {
    case 'needs_response':
      return disputes.filter(isNeedsResponse);
    case 'won':
      return disputes.filter((d) => d.status === 'won');
    case 'lost':
      return disputes.filter((d) => d.status === 'lost');
    case 'all':
      return disputes;
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const requestedTab = (searchParams?.status as TabKey) || 'needs_response';
  const tab: TabKey = TAB_ORDER.some((t) => t.key === requestedTab)
    ? (requestedTab as TabKey)
    : 'needs_response';

  let disputes: DisputeListItem[] = [];
  let error: string | null = null;
  try {
    disputes = await listDisputes({ limit: 100 });
  } catch (e: any) {
    error = e?.message ?? 'Unknown error';
  }

  // Enrich each dispute with BaseSheet (single fetch, cached, linear matches)
  let enrichmentError: string | null = null;
  let enriched: EnrichedDispute[] = disputes.map((d) => ({ ...d, baseSheet: null }));
  try {
    enriched = await Promise.all(
      disputes.map(async (d) => {
        const baseSheet = await matchCustomer({
          customerId: d.customerId ?? null,
          email: d.customerEmail ?? null,
        });
        return { ...d, baseSheet };
      }),
    );
  } catch (e: any) {
    enrichmentError = e?.message ?? 'BaseSheet enrichment failed';
  }

  const counts: Record<TabKey, number> = {
    needs_response: enriched.filter(isNeedsResponse).length,
    won: enriched.filter((d) => d.status === 'won').length,
    lost: enriched.filter((d) => d.status === 'lost').length,
    all: enriched.length,
  };

  const visible = applyTab(enriched, tab);

  const needsResponse = enriched.filter(isNeedsResponse);
  const underReview = enriched.filter(
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
          <span className="text-ink font-semibold">{visible.length}</span>
          <span className="text-ink-dim mx-1">/ {enriched.length}</span>
          <span className="text-ink-dim mx-3">·</span>
          <span className="text-ink-dim mr-2">LAST REFRESH</span>
          <span className="text-ink font-semibold">{refreshTime}</span>
          <span className="text-ink-dim mx-3">·</span>
          <span className="text-ink-dim">{refreshDate}</span>
        </div>
        <a
          href="/"
          className="px-4 py-1.5 rounded-full border border-accent-pink-strong/60 text-accent-pink hover:bg-accent-pink-bg transition text-sm font-medium"
        >
          ↻ Refresh live data
        </a>
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
          label="Under review"
          value={underReview.length.toString()}
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

      {/* DISPUTES TABLE WITH TABS */}
      <section className="rounded-2xl border border-line bg-surface/40 backdrop-blur-sm overflow-hidden">
        {/* Tab strip */}
        <div className="px-5 pt-5 pb-4 flex flex-wrap items-center gap-2 border-b border-line-soft">
          {TAB_ORDER.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/?status=${t.key}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  active
                    ? 'border border-accent-pink-strong bg-accent-pink-bg/40 text-accent-pink'
                    : 'border border-line text-ink-muted hover:text-ink hover:border-line-strong'
                }`}
              >
                {t.label}{' '}
                <span className={active ? 'text-ink ml-1' : 'text-ink ml-1 font-semibold'}>
                  {counts[t.key]}
                </span>
              </Link>
            );
          })}
        </div>

        {enrichmentError && (
          <div className="px-5 py-3 text-xs text-accent-yellow bg-accent-yellow-bg/20 border-b border-line-soft">
            BaseSheet enrichment partially failed: {enrichmentError}. Customer/AM columns may be
            empty.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-dim">
                <th className="text-left px-5 py-3 font-medium">Customer</th>
                <th className="text-left px-3 py-3 font-medium">Entity ID</th>
                <th className="text-left px-3 py-3 font-medium">Business name</th>
                <th className="text-left px-3 py-3 font-medium">AM Name</th>
                <th className="text-left px-3 py-3 font-medium">Amount</th>
                <th className="text-left px-3 py-3 font-medium">Reason</th>
                <th className="text-left px-3 py-3 font-medium">Status</th>
                <th className="text-left px-3 py-3 font-medium">Charge date</th>
                <th className="text-left px-3 py-3 font-medium">Dispute opened</th>
                <th className="text-left px-3 py-3 font-medium">Evidence due</th>
                <th className="text-right px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && !error && (
                <tr>
                  <td colSpan={11} className="px-5 py-16 text-center text-ink-dim">
                    No disputes match this filter.
                  </td>
                </tr>
              )}
              {visible.map((d) => (
                <tr
                  key={d.id}
                  className="border-t border-line-soft hover:bg-elevated/40 transition group"
                >
                  {/* Customer */}
                  <td className="px-5 py-4">
                    <Link href={`/dispute/${d.id}`} className="block">
                      <div className="font-medium text-ink group-hover:text-accent-pink transition">
                        {d.customerName || d.customerEmail || '—'}
                      </div>
                      <div className="text-xs text-ink-dim mt-0.5">{d.customerEmail}</div>
                    </Link>
                  </td>

                  {/* Entity ID */}
                  <td className="px-3 py-4 font-mono text-[11px] text-ink-muted">
                    {d.baseSheet?.entity_id ? (
                      <span title={d.baseSheet.entity_id}>
                        {d.baseSheet.entity_id.slice(0, 8)}…
                      </span>
                    ) : (
                      <span className="text-ink-dim">—</span>
                    )}
                  </td>

                  {/* Business name */}
                  <td className="px-3 py-4">
                    {d.baseSheet?.bizname ? (
                      <span className="text-ink">{d.baseSheet.bizname}</span>
                    ) : (
                      <span className="text-xs text-ink-dim italic">no match</span>
                    )}
                  </td>

                  {/* AM Name */}
                  <td className="px-3 py-4 text-ink-muted">
                    {d.baseSheet?.am_name?.trim() || <span className="text-ink-dim">—</span>}
                  </td>

                  {/* Amount */}
                  <td className="px-3 py-4 font-medium text-ink tabular-nums">
                    {formatAmount(d.amount, d.currency)}
                  </td>

                  {/* Reason */}
                  <td className="px-3 py-4 text-ink-muted text-xs">{d.reason}</td>

                  {/* Status */}
                  <td className="px-3 py-4">
                    <StatusPill status={d.status} />
                  </td>

                  {/* Charge date */}
                  <td className="px-3 py-4 text-ink-muted tabular-nums text-xs">
                    {d.chargeCreated
                      ? new Date(d.chargeCreated * 1000).toISOString().slice(0, 10)
                      : '—'}
                  </td>

                  {/* Dispute opened */}
                  <td className="px-3 py-4 text-ink-muted tabular-nums text-xs">
                    {new Date(d.created * 1000).toISOString().slice(0, 10)}
                  </td>

                  {/* Evidence due */}
                  <td className="px-3 py-4 text-ink-muted tabular-nums text-xs">
                    {d.evidenceDueBy
                      ? new Date(d.evidenceDueBy * 1000).toISOString().slice(0, 10)
                      : '—'}
                  </td>

                  {/* Action */}
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <Link
                      href={`/dispute/${d.id}`}
                      className="text-accent-pink hover:text-accent-pink-strong text-sm font-medium"
                    >
                      Analyse →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    warning_needs_response: {
      bg: 'bg-accent-pink-bg',
      text: 'text-accent-pink',
      label: 'needs response',
    },
    needs_response: {
      bg: 'bg-accent-pink-bg',
      text: 'text-accent-pink',
      label: 'needs response',
    },
    warning_under_review: {
      bg: 'bg-accent-yellow-bg',
      text: 'text-accent-yellow',
      label: 'under review',
    },
    under_review: { bg: 'bg-accent-yellow-bg', text: 'text-accent-yellow', label: 'under review' },
    won: { bg: 'bg-accent-green-bg', text: 'text-accent-green', label: 'won' },
    warning_closed: { bg: 'bg-elevated', text: 'text-ink-muted', label: 'closed' },
    lost: { bg: 'bg-accent-purple-bg', text: 'text-accent-purple', label: 'lost' },
    charge_refunded: { bg: 'bg-elevated', text: 'text-ink-muted', label: 'refunded' },
  };
  const style = styles[status] ?? { bg: 'bg-elevated', text: 'text-ink-muted', label: status };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
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
