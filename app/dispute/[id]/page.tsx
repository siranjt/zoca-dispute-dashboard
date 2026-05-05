import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDispute, formatAmount } from '@/lib/stripe';
import { matchCustomer } from '@/lib/basesheet';
import { getCommsForEntity, commsCounts } from '@/lib/comms';
import { scoreDispute, extractDissatisfactionEvidence } from '@/lib/signals';
import { buildDraft } from '@/lib/draft';
import CounterDraft from '@/components/CounterDraft';
import RecommendationHero from '@/components/RecommendationHero';
import ScoreGauge from '@/components/ScoreGauge';
import SignalGrid from '@/components/SignalGrid';
import ChannelMixBar from '@/components/ChannelMixBar';
import AmbientSparkles from '@/components/AmbientSparkles';
import PrintPdfButton from '@/components/PrintPdfButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const maxDuration = 60;

export default async function DisputePage({ params }: { params: { id: string } }) {
  if (!params.id?.startsWith('du_')) notFound();

  let result: Awaited<ReturnType<typeof getDispute>>;
  try {
    result = await getDispute(params.id);
  } catch (e: any) {
    return (
      <div className="rounded-2xl border border-accent-red/40 bg-accent-red-bg/40 px-5 py-4 text-sm text-accent-red mt-12">
        Failed to load dispute: {e?.message ?? 'unknown error'}
      </div>
    );
  }
  const { dispute, charge, customer } = result;

  let baseSheet = null;
  let commsEvents: Awaited<ReturnType<typeof getCommsForEntity>> = [];
  let enrichmentError: string | null = null;
  try {
    baseSheet = await matchCustomer({
      customerId: charge?.customer && typeof charge.customer === 'string' ? charge.customer : null,
      email: customer?.email ?? charge?.billing_details?.email ?? null,
      phone: customer?.phone ?? charge?.billing_details?.phone ?? null,
      name: customer?.name ?? charge?.billing_details?.name ?? null,
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

  const customerName =
    customer?.name || charge?.billing_details?.name || baseSheet?.bizname || 'Dispute';

  // Comms that signal trouble in the lead-up to this dispute (PDF-only section).
  const dissatisfactionEvents = extractDissatisfactionEvidence({
    events: commsEvents,
    disputeCreatedAt: dispute.created * 1000,
    recentDays: 10,
    extendedDays: 30,
  });

  return (
    <div className="space-y-8 pt-8 relative">
      <AmbientSparkles intervalMs={2200} />

      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent-pink transition print:hidden"
        >
          <span>←</span> All disputes
        </Link>
        <PrintPdfButton />
      </div>

      {/* HEADLINE */}
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-ink-dim">
          <span className="font-mono">{dispute.id}</span>
          <span>·</span>
          <span>opened {new Date(dispute.created * 1000).toISOString().slice(0, 10)}</span>
        </div>
        {/* On-screen: customer name as the H1 (analyzer behaviour preserved) */}
        <h1 className="text-pink-shimmer text-4xl sm:text-5xl font-extrabold tracking-tight m-0 print:hidden">
          {customerName}
        </h1>

        {/* PDF-only H1: business name (highlighted). Falls back to cardholder
            ONLY when BaseSheet has no match; the info block below makes the
            match status explicit either way. Identical JSX runs for every
            dispute — variations in output reflect variations in source data,
            not in the code path. */}
        <h1 className="hidden print:block text-pink-shimmer text-4xl font-extrabold tracking-tight m-0">
          {baseSheet?.bizname?.trim() || customerName}
        </h1>

        <p className="text-base text-ink-muted">
          {formatAmount(dispute.amount, dispute.currency)} · reason:{' '}
          <span className="text-ink">{dispute.reason}</span>
        </p>

        {/* PRINT-ONLY supporting line: cardholder + AM. Always renders for every dispute. */}
        <div className="hidden print:block pt-3 mt-2 border-t border-gray-300">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500">Cardholder: </span>
              <strong className="text-black">{customerName}</strong>
            </div>
            <div>
              <span className="text-gray-500">Account manager: </span>
              <strong className="text-black">
                {baseSheet?.am_name?.trim() || 'Not assigned'}
              </strong>
            </div>
            <div>
              <span className="text-gray-500">Business: </span>
              <strong className="text-black">
                {baseSheet?.bizname?.trim() || 'Not in BaseSheet'}
              </strong>
            </div>
            <div>
              <span className="text-gray-500">Entity ID: </span>
              <strong className="text-black font-mono text-xs">
                {baseSheet?.entity_id?.trim() || '—'}
              </strong>
            </div>
          </div>
        </div>
      </header>

      {/* RECOMMENDATION HERO */}
      <RecommendationHero
        recommendation={report.recommendation}
        rationale={report.rationale}
        evidenceDueIso={evidenceDueDate ? evidenceDueDate.toISOString().slice(0, 10) : null}
        daysUntilDue={daysUntilDue}
      />

      {enrichmentError && (
        <div className="rounded-2xl border border-accent-yellow/40 bg-accent-yellow-bg/40 px-5 py-3 text-sm text-accent-yellow">
          Enrichment partially failed: {enrichmentError}
        </div>
      )}

      {/* SCORE + SIGNALS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Score">
          <div className="flex justify-center mb-4">
            <ScoreGauge score={report.score} />
          </div>
          <div className="flex items-center justify-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                report.source === 'llm'
                  ? 'bg-accent-purple-bg text-accent-purple'
                  : 'bg-elevated text-ink-muted'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  report.source === 'llm' ? 'bg-accent-purple' : 'bg-ink-dim'
                }`}
              ></span>
              {report.source === 'llm' ? 'Scored by Claude' : 'Scored by regex'}
            </span>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Card title="Signals">
            <SignalGrid signals={report.signals} />
            {report.llmError && (
              <p className="text-xs text-accent-yellow mt-3" title={report.llmError}>
                LLM call failed, fell back to regex.
              </p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 print:block">
        {/* LEFT: Stripe + Customer (hidden in PDF — kept for the on-screen analyzer only) */}
        <div className="lg:col-span-1 space-y-5 print:hidden">
          <Card title="Stripe">
            <Field label="Status" value={dispute.status.replace(/_/g, ' ')} />
            <Field label="Reason" value={dispute.reason} />
            <Field label="Amount" value={formatAmount(dispute.amount, dispute.currency)} />
            <Field
              label="Opened"
              value={new Date(dispute.created * 1000).toISOString().slice(0, 10)}
            />
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
            <div className="pt-3 mt-2 border-t border-line-soft">
              <a
                href={`https://dashboard.stripe.com/disputes/${dispute.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent-pink hover:text-accent-pink-strong transition"
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
                <div className="border-t border-line-soft my-2"></div>
                <Field label="Business" value={baseSheet.bizname} />
                <Field label="Entity ID" value={baseSheet.entity_id} mono />
                <Field label="Chargebee ID" value={baseSheet.customer_id} mono />
                <Field label="Account manager" value={baseSheet.am_name || '—'} />
                <Field label="Sales partner" value={baseSheet.sp_name || '—'} />
                <Field label="Phone" value={baseSheet.phone_number || '—'} />
                <Field label="Status" value={baseSheet.chrone_zoca_status || '—'} />
              </>
            ) : (
              <p className="text-sm text-accent-yellow mt-3 pt-3 border-t border-line-soft">
                Could not match this customer to a Zoca BaseSheet record. Comms enrichment is
                skipped.
              </p>
            )}
          </Card>
        </div>

        {/* RIGHT: Comms + Draft (Draft hidden in PDF) */}
        <div className="lg:col-span-2 print:col-span-3 space-y-5">
          <Card title={`Communications · last 90 days · ${counts.total} events`}>
            <div className="text-xs text-ink-dim mb-3 flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <span className="text-ink-dim">Team→client:</span>{' '}
                <span className="text-ink">{counts.bySide.team}</span>
              </span>
              <span>
                <span className="text-ink-dim">Client→team:</span>{' '}
                <span className="text-ink">{counts.bySide.client}</span>
              </span>
            </div>
            <ChannelMixBar
              counts={{
                app_chat: counts.byChannel.app_chat || 0,
                email: counts.byChannel.email || 0,
                phone: counts.byChannel.phone || 0,
                sms: counts.byChannel.sms || 0,
                video: counts.byChannel.video || 0,
              }}
            />
            {/* On-screen: full 90-day timeline */}
            <div className="mt-4 pt-4 border-t border-line-soft print:hidden">
              {commsEvents.length === 0 ? (
                <p className="text-sm text-ink-dim">No comms found in the last 90 days.</p>
              ) : (
                <ol className="space-y-2 max-h-[28rem] overflow-y-auto pr-2">
                  {commsEvents.slice(0, 100).map((e, i) => (
                    <li
                      key={i}
                      className={`text-xs p-3 rounded-xl border ${
                        e.side === 'team'
                          ? 'border-accent-purple/20 bg-accent-purple-bg/20'
                          : e.side === 'client'
                          ? 'border-accent-pink/20 bg-accent-pink-bg/20'
                          : 'border-line-soft bg-elevated/30'
                      }`}
                    >
                      <div className="flex items-center justify-between text-ink-dim">
                        <span>
                          <strong
                            className={
                              e.side === 'team'
                                ? 'text-accent-purple'
                                : e.side === 'client'
                                ? 'text-accent-pink'
                                : 'text-ink-muted'
                            }
                          >
                            {e.side === 'team' ? 'Zoca' : e.side === 'client' ? 'Customer' : '—'}
                          </strong>
                          <span className="ml-1.5">· {e.channel}</span>
                        </span>
                        <span className="tabular-nums">
                          {new Date(e.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      <div className="mt-1.5 text-ink whitespace-pre-wrap break-words">
                        {e.body || <span className="italic text-ink-dim">(no body)</span>}
                      </div>
                      {e.extras && (
                        <div className="mt-1.5 text-ink-dim">
                          {Object.entries(e.extras)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* PDF-only: filtered evidence — 10-day full dissatisfaction + 30-day complaint/refund.
                Always renders for every dispute, even when zero events match. */}
            <div className="hidden print:block mt-4 pt-4 border-t border-gray-300">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                Lead-up to dispute · filtered evidence
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Pulled from two windows: any dissatisfaction signal in the 10 days before the
                dispute, plus complaint or refund language anywhere in the 30 days before. Combined,
                deduped, sorted oldest-first.
              </p>
              {dissatisfactionEvents.length === 0 ? (
                <div className="text-xs p-3 rounded border border-gray-300 bg-gray-50 text-gray-700">
                  <strong>No dissatisfaction or complaint signals detected.</strong> The chargeback
                  appears to come without a paper trail of warnings — strengthens the case for a
                  fight, since there's no evidence the customer raised concerns first.
                </div>
              ) : (
                <ol className="space-y-2">
                  {dissatisfactionEvents.map((e, i) => (
                    <li key={i} className="text-xs p-2 rounded border border-gray-300">
                      <div className="flex items-center justify-between text-gray-500">
                        <span>
                          <strong className="text-black">
                            {e.side === 'team'
                              ? 'Zoca'
                              : e.side === 'client'
                                ? 'Customer'
                                : '—'}
                          </strong>
                          <span className="ml-1.5">· {e.channel}</span>
                        </span>
                        <span className="tabular-nums">
                          {new Date(e.createdAt).toISOString().slice(0, 10)}
                        </span>
                      </div>
                      <div className="mt-1 text-black whitespace-pre-wrap break-words">
                        {e.body}
                      </div>
                      {e.extras && (
                        <div className="mt-1 text-gray-500">
                          {Object.entries(e.extras)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {/* Build-version stamp so it's obvious which deploy generated this PDF */}
              <div className="text-[9px] text-gray-400 mt-4 pt-3 border-t border-gray-200 font-mono">
                Report generated {new Date().toISOString()} · build v3 · 10d full + 30d narrow
                comms filter active
              </div>
            </div>
          </Card>

          <div className="print:hidden">
            <Card title="Counter-response draft">
              <CounterDraft draft={draft} disputeId={dispute.id} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface/50 backdrop-blur-sm border border-line rounded-2xl p-5 sm:p-6">
      <h2 className="text-[10px] font-semibold text-ink-dim uppercase tracking-wider mb-4">
        {title}
      </h2>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-1.5 text-sm">
      <div className="text-ink-dim col-span-1">{label}</div>
      <div
        className={`col-span-2 break-all text-ink ${mono ? 'font-mono text-xs text-ink-muted' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}
