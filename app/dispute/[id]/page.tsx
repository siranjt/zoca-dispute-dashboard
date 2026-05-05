import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDispute, formatAmount } from '@/lib/stripe';
import { matchCustomer } from '@/lib/basesheet';
import { getCommsForEntity, commsCounts } from '@/lib/comms';
import { scoreDispute } from '@/lib/signals';
import { buildDraft } from '@/lib/draft';
import CounterDraft from '@/components/CounterDraft';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RECOMMENDATION_STYLES: Record<string, string> = {
  FIGHT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  REFUND: 'bg-red-100 text-red-800 border-red-200',
  'NEEDS AM CALL': 'bg-amber-100 text-amber-800 border-amber-200',
};

export default async function DisputePage({ params }: { params: { id: string } }) {
  if (!params.id?.startsWith('du_')) notFound();

  let result: Awaited<ReturnType<typeof getDispute>>;
  try {
    result = await getDispute(params.id);
  } catch (e: any) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Failed to load dispute: {e?.message ?? 'unknown error'}
      </div>
    );
  }
  const { dispute, charge, customer } = result;

  // Try to enrich. If anything fails (Metabase down, key mismatch), we still render.
  let baseSheet = null;
  let commsEvents: Awaited<ReturnType<typeof getCommsForEntity>> = [];
  let enrichmentError: string | null = null;
  try {
    baseSheet = await matchCustomer({
      customerId: charge?.customer && typeof charge.customer === 'string' ? charge.customer : null,
      email: customer?.email ?? charge?.billing_details?.email ?? null,
    });
    if (baseSheet?.entity_id) {
      commsEvents = await getCommsForEntity(baseSheet.entity_id, 90);
    }
  } catch (e: any) {
    enrichmentError = e?.message ?? 'Enrichment failed';
  }

  const report = await scoreDispute({
    events: commsEvents,
    disputeCreatedAt: dispute.created * 1000,
    context: {
      disputeReason: dispute.reason,
      disputeAmount: dispute.amount,
      disputeCurrency: dispute.currency,
      customerName: customer?.name ?? charge?.billing_details?.name ?? undefined,
      customerEmail: customer?.email ?? charge?.billing_details?.email ?? undefined,
      bizName: baseSheet?.bizname,
      accountManager: baseSheet?.am_name,
      accountStatus: baseSheet?.chrone_zoca_status,
    },
  });

  const counts = commsCounts(commsEvents);

  const draft = buildDraft({
    dispute,
    charge,
    customer,
    baseSheet,
    events: commsEvents,
    report,
  });

  const evidenceDueDate = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000)
    : null;
  const daysUntilDue = evidenceDueDate
    ? Math.max(0, Math.ceil((evidenceDueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-zoca-brand hover:underline">
          ← All disputes
        </Link>
        <h1 className="text-2xl font-semibold text-zoca-ink mt-2">
          {customer?.name || charge?.billing_details?.name || baseSheet?.bizname || 'Dispute'}
        </h1>
        <p className="text-sm text-zoca-muted">
          {dispute.id} · {formatAmount(dispute.amount, dispute.currency)} · reason: {dispute.reason}
        </p>
      </div>

      {/* Recommendation banner */}
      <div
        className={`rounded-lg border px-5 py-4 ${
          RECOMMENDATION_STYLES[report.recommendation] ?? 'bg-zinc-100 text-zinc-800 border-zinc-200'
        }`}
      >
        <div className="text-xs uppercase tracking-wide opacity-70">Recommendation</div>
        <div className="text-2xl font-semibold mt-1">{report.recommendation}</div>
        <div className="text-sm mt-1 opacity-90">{report.rationale}</div>
        {evidenceDueDate && (
          <div className="text-xs mt-2 opacity-70">
            Evidence due {evidenceDueDate.toISOString().slice(0, 10)}
            {daysUntilDue !== null && ` · ${daysUntilDue} days remaining`}
          </div>
        )}
      </div>

      {enrichmentError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Enrichment partially failed: {enrichmentError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Stripe + customer info */}
        <div className="lg:col-span-1 space-y-6">
          <Card title="Stripe">
            <Field label="Status" value={dispute.status.replace(/_/g, ' ')} />
            <Field label="Reason" value={dispute.reason} />
            <Field label="Amount" value={formatAmount(dispute.amount, dispute.currency)} />
            <Field label="Opened" value={new Date(dispute.created * 1000).toISOString().slice(0, 10)} />
            <Field
              label="Evidence due"
              value={evidenceDueDate ? evidenceDueDate.toISOString().slice(0, 10) : '—'}
            />
            <Field label="Charge" value={charge?.id ?? '—'} mono />
            <Field
              label="Payment intent"
              value={
                typeof dispute.payment_intent === 'string'
                  ? dispute.payment_intent
                  : (dispute.payment_intent as any)?.id ?? '—'
              }
              mono
            />
            <div className="pt-2">
              <a
                href={`https://dashboard.stripe.com/disputes/${dispute.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-zoca-brand hover:underline"
              >
                Open in Stripe ↗
              </a>
            </div>
          </Card>

          <Card title="Customer">
            <Field label="Name" value={customer?.name || charge?.billing_details?.name || '—'} />
            <Field label="Email" value={customer?.email || charge?.billing_details?.email || '—'} />
            <Field label="Stripe customer" value={customer?.id ?? '—'} mono />
            {baseSheet ? (
              <>
                <Field label="Business" value={baseSheet.bizname} />
                <Field label="Entity ID" value={baseSheet.entity_id} mono />
                <Field label="Chargebee ID" value={baseSheet.customer_id} mono />
                <Field label="Account manager" value={baseSheet.am_name || '—'} />
                <Field label="Sales partner" value={baseSheet.sp_name || '—'} />
                <Field label="Phone" value={baseSheet.phone_number || '—'} />
                <Field label="Status" value={baseSheet.chrone_zoca_status || '—'} />
              </>
            ) : (
              <p className="text-sm text-amber-700 mt-2">
                Could not match this customer to a Zoca BaseSheet record. Comms enrichment is skipped.
              </p>
            )}
          </Card>
        </div>

        {/* Right column: signals + comms + draft */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Signals">
            <div className="text-xs text-zoca-muted mb-2 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  report.source === 'llm'
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-zinc-200 text-zinc-700'
                }`}
              >
                {report.source === 'llm' ? 'Scored by Claude' : 'Scored by regex (no LLM key)'}
              </span>
              {report.llmError && (
                <span className="text-amber-700" title={report.llmError}>
                  · LLM call failed, fell back to regex
                </span>
              )}
            </div>
            <div className="space-y-2">
              {report.signals.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    s.fired
                      ? s.weight > 0
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-red-200 bg-red-50'
                      : 'border-zinc-200 bg-zinc-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zoca-ink">{s.label}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        s.weight > 0 ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'
                      }`}
                    >
                      {s.weight > 0 ? `+${s.weight}` : s.weight}
                    </span>
                  </div>
                  {s.evidence && <div className="text-xs text-zoca-muted mt-1">{s.evidence}</div>}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-zoca-muted">Total score: {report.score}</div>
          </Card>

          <Card title={`Communications (last 90 days · ${counts.total} events)`}>
            <div className="text-xs text-zoca-muted mb-3 flex flex-wrap gap-3">
              <span>Team→client: {counts.bySide.team}</span>
              <span>Client→team: {counts.bySide.client}</span>
              <span>App chat: {counts.byChannel.app_chat ?? 0}</span>
              <span>Email: {counts.byChannel.email ?? 0}</span>
              <span>Phone: {counts.byChannel.phone ?? 0}</span>
              <span>SMS: {counts.byChannel.sms ?? 0}</span>
              <span>Video: {counts.byChannel.video ?? 0}</span>
            </div>
            {commsEvents.length === 0 ? (
              <p className="text-sm text-zoca-muted">No comms found in the last 90 days.</p>
            ) : (
              <ol className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {commsEvents.slice(0, 100).map((e, i) => (
                  <li
                    key={i}
                    className={`text-xs p-2 rounded border ${
                      e.side === 'team'
                        ? 'border-blue-100 bg-blue-50'
                        : e.side === 'client'
                        ? 'border-amber-100 bg-amber-50'
                        : 'border-zinc-100 bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-zoca-muted">
                      <span>
                        <strong className="text-zoca-ink">
                          {e.side === 'team' ? 'Zoca' : e.side === 'client' ? 'Customer' : '—'}
                        </strong>{' '}
                        · {e.channel}
                      </span>
                      <span>{new Date(e.createdAt).toISOString().slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <div className="mt-1 text-zoca-ink whitespace-pre-wrap break-words">
                      {e.body || <span className="italic text-zoca-muted">(no body)</span>}
                    </div>
                    {e.extras && (
                      <div className="mt-1 text-zoca-muted">
                        {Object.entries(e.extras)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Counter-response draft">
            <CounterDraft draft={draft} disputeId={dispute.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-zoca-border rounded-lg p-5">
      <h2 className="text-sm font-semibold text-zoca-ink uppercase tracking-wide mb-3">{title}</h2>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1 text-sm">
      <div className="text-zoca-muted col-span-1">{label}</div>
      <div className={`col-span-2 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}
