import Link from 'next/link';
import { listDisputes, formatAmount, isNeedsResponse } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_CLASSES: Record<string, string> = {
  warning_needs_response: 'bg-red-100 text-red-700',
  needs_response: 'bg-red-100 text-red-700',
  warning_under_review: 'bg-amber-100 text-amber-700',
  under_review: 'bg-amber-100 text-amber-700',
  won: 'bg-emerald-100 text-emerald-700',
  warning_closed: 'bg-zinc-100 text-zinc-600',
  lost: 'bg-zinc-200 text-zinc-700',
  charge_refunded: 'bg-zinc-100 text-zinc-600',
};

export default async function Page() {
  let disputes: Awaited<ReturnType<typeof listDisputes>> = [];
  let error: string | null = null;
  try {
    disputes = await listDisputes({ limit: 100 });
  } catch (e: any) {
    error = e?.message ?? 'Unknown error';
  }

  const needsResponse = disputes.filter(isNeedsResponse);
  const totalDue = needsResponse.reduce((sum, d) => sum + d.amount, 0);
  const currency = disputes[0]?.currency ?? 'usd';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zoca-ink">Disputes</h1>
        <p className="text-sm text-zoca-muted mt-1">
          Live data from Stripe. Click into any dispute for the comms timeline, signal scoring, and a
          draft counter-response.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Could not fetch disputes:</strong> {error}
          <br />
          Verify <code>STRIPE_SECRET_KEY</code> is set and has the correct restricted scopes.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Total disputes" value={disputes.length.toString()} />
        <Stat label="Needs response" value={needsResponse.length.toString()} accent />
        <Stat
          label="Amount needing response"
          value={formatAmount(totalDue, currency)}
          accent={totalDue > 0}
        />
      </div>

      <div className="bg-white rounded-lg border border-zoca-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zoca-subtle text-zoca-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Reason</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Opened</th>
              <th className="text-left px-4 py-3">Evidence due</th>
              <th className="text-left px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {disputes.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zoca-muted">
                  No disputes found in Stripe. Nice.
                </td>
              </tr>
            )}
            {disputes.map((d) => (
              <tr key={d.id} className="border-t border-zoca-border hover:bg-zoca-subtle">
                <td className="px-4 py-3">
                  <div className="font-medium text-zoca-ink">
                    {d.customerName || d.customerEmail || '—'}
                  </div>
                  <div className="text-xs text-zoca-muted">{d.customerEmail}</div>
                </td>
                <td className="px-4 py-3 font-medium">{formatAmount(d.amount, d.currency)}</td>
                <td className="px-4 py-3 text-zoca-muted">{d.reason}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_CLASSES[d.status] ?? 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {d.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-zoca-muted">
                  {new Date(d.created * 1000).toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3 text-zoca-muted">
                  {d.evidenceDueBy
                    ? new Date(d.evidenceDueBy * 1000).toISOString().slice(0, 10)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dispute/${d.id}`}
                    className="text-zoca-brand hover:underline text-sm font-medium"
                  >
                    Analyse →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-zoca-border rounded-lg p-4">
      <div className="text-xs text-zoca-muted uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ? 'text-zoca-danger' : 'text-zoca-ink'}`}>
        {value}
      </div>
    </div>
  );
}
