'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DisputeListItem } from '@/lib/stripe';
import type { BaseSheetRow } from '@/lib/basesheet';

type EnrichedDispute = DisputeListItem & { baseSheet: BaseSheetRow | null };

type TabKey = 'needs_response' | 'in_review' | 'won' | 'lost' | 'all';

const TAB_ORDER: { key: TabKey; label: string }[] = [
  { key: 'needs_response', label: 'Needs response' },
  { key: 'in_review', label: 'In review' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'all', label: 'All disputes' },
];

function isNeedsResponse(d: { status: string }) {
  return d.status === 'warning_needs_response' || d.status === 'needs_response';
}
function isInReview(d: { status: string }) {
  return d.status === 'warning_under_review' || d.status === 'under_review';
}

function applyTab(disputes: EnrichedDispute[], tab: TabKey): EnrichedDispute[] {
  switch (tab) {
    case 'needs_response':
      return disputes.filter(isNeedsResponse);
    case 'in_review':
      return disputes.filter(isInReview);
    case 'won':
      return disputes.filter((d) => d.status === 'won');
    case 'lost':
      return disputes.filter((d) => d.status === 'lost');
    case 'all':
      return disputes;
  }
}

export default function DisputesTable({
  disputes,
  enrichmentError,
}: {
  disputes: EnrichedDispute[];
  enrichmentError: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial = (searchParams?.get('status') as TabKey | null) || 'needs_response';
  const valid = TAB_ORDER.some((t) => t.key === initial) ? initial : 'needs_response';
  const [tab, setTab] = useState<TabKey>(valid as TabKey);

  // Keep URL in sync (shallow — no server refetch)
  useEffect(() => {
    const current = searchParams?.get('status');
    if (current === tab) return;
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('status', tab);
    router.replace(`/?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const counts = useMemo(
    () => ({
      needs_response: disputes.filter(isNeedsResponse).length,
      in_review: disputes.filter(isInReview).length,
      won: disputes.filter((d) => d.status === 'won').length,
      lost: disputes.filter((d) => d.status === 'lost').length,
      all: disputes.length,
    }),
    [disputes],
  );

  const visible = useMemo(() => applyTab(disputes, tab), [disputes, tab]);

  return (
    <section className="rounded-2xl border border-line bg-surface/40 backdrop-blur-sm overflow-hidden">
      {/* Tab strip */}
      <div className="px-5 pt-5 pb-4 flex flex-wrap items-center gap-2 border-b border-line-soft">
        {TAB_ORDER.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
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
            </button>
          );
        })}
      </div>

      {enrichmentError && (
        <div className="px-5 py-3 text-xs text-accent-yellow bg-accent-yellow-bg/20 border-b border-line-soft">
          BaseSheet enrichment partially failed: {enrichmentError}. Customer/AM columns may be empty.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-ink-dim">
              <th className="text-left px-5 py-3 font-medium">Entity ID</th>
              <th className="text-left px-3 py-3 font-medium">Business name</th>
              <th className="text-left px-3 py-3 font-medium">AM Name</th>
              <th className="text-left px-3 py-3 font-medium">SP name + Email</th>
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
            {visible.length === 0 && (
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
                {/* Entity ID */}
                <td className="px-5 py-4 font-mono text-[11px] text-ink-muted">
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
                    <Link
                      href={`/dispute/${d.id}`}
                      className="text-ink group-hover:text-accent-pink transition font-medium"
                    >
                      {d.baseSheet.bizname}
                    </Link>
                  ) : (
                    <Link
                      href={`/dispute/${d.id}`}
                      className="text-xs text-ink-dim italic group-hover:text-accent-pink transition"
                    >
                      no BaseSheet match
                    </Link>
                  )}
                </td>

                {/* AM Name */}
                <td className="px-3 py-4 text-ink-muted">
                  {d.baseSheet?.am_name?.trim() || <span className="text-ink-dim">—</span>}
                </td>

                {/* SP name + Email */}
                <td className="px-3 py-4">
                  <div className="text-ink">
                    {d.baseSheet?.sp_name?.trim() || (
                      <span className="text-ink-dim">—</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-dim mt-0.5">{d.customerEmail || '—'}</div>
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
  );
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
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
