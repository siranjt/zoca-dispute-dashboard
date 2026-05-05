import 'server-only';
import type Stripe from 'stripe';
import type { CommsEvent } from './comms';
import type { SignalReport } from './signals';
import type { BaseSheetRow } from './basesheet';
import { formatAmount } from './stripe';

const REASON_NARRATIVES: Record<string, string> = {
  duplicate: 'The customer claims this charge is a duplicate of a separate transaction.',
  fraudulent: 'The cardholder reports this charge as unauthorized.',
  subscription_canceled: 'The cardholder claims they cancelled the subscription before this charge.',
  product_not_received: 'The cardholder claims the product or service was not delivered.',
  product_unacceptable: 'The cardholder claims the product or service did not match what was promised.',
  credit_not_processed: 'The cardholder claims a promised refund or credit was never issued.',
  general: 'The cardholder filed a general dispute without selecting a specific reason.',
  unrecognized: 'The cardholder does not recognize this charge.',
};

export type DraftInput = {
  dispute: Stripe.Dispute;
  charge: Stripe.Charge | null;
  customer: Stripe.Customer | null;
  baseSheet: BaseSheetRow | null;
  events: CommsEvent[];
  report: SignalReport;
};

export function buildDraft(input: DraftInput): string {
  const { dispute, charge, customer, baseSheet, events, report } = input;

  const amount = formatAmount(dispute.amount, dispute.currency);
  const disputedAt = new Date(dispute.created * 1000).toISOString().slice(0, 10);
  const evidenceDue = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toISOString().slice(0, 10)
    : 'unknown';

  const teamEvents = events.filter((e) => e.side === 'team');
  const clientEvents = events.filter((e) => e.side === 'client');
  const reasonNarrative = REASON_NARRATIVES[dispute.reason] ?? `Reason code: ${dispute.reason}.`;

  const businessName = baseSheet?.bizname ?? customer?.name ?? charge?.billing_details?.name ?? 'Customer';
  const customerEmail = customer?.email ?? charge?.billing_details?.email ?? 'unknown';
  const accountManager = baseSheet?.am_name?.trim() || 'Zoca Account Manager';
  const status = baseSheet?.chrone_zoca_status?.trim();

  const lines: string[] = [];
  lines.push(`# Dispute rebuttal — ${dispute.id}`);
  lines.push('');
  lines.push(`**Submitted to:** Stripe Disputes`);
  lines.push(`**Merchant:** Zoca`);
  lines.push(`**Cardholder / Business:** ${businessName} (${customerEmail})`);
  lines.push(`**Disputed amount:** ${amount}`);
  lines.push(`**Charge ID:** ${charge?.id ?? 'n/a'}`);
  lines.push(`**Dispute opened:** ${disputedAt}`);
  lines.push(`**Evidence due:** ${evidenceDue}`);
  lines.push(`**Reason code:** ${dispute.reason}`);
  if (status) lines.push(`**Account status:** ${status}`);
  lines.push(`**Account manager:** ${accountManager}`);
  lines.push('');

  lines.push('## 1. Dispute summary');
  lines.push('');
  lines.push(reasonNarrative);
  lines.push('');
  lines.push(
    `Zoca's position is that the service was delivered as agreed. The evidence below documents the customer relationship, training, and ongoing service delivery for the 90 days preceding the dispute.`,
  );
  lines.push('');

  lines.push('## 2. Customer relationship');
  lines.push('');
  if (baseSheet) {
    lines.push(`- **Business name:** ${baseSheet.bizname}`);
    if (baseSheet.entity_id) lines.push(`- **Zoca entity ID:** ${baseSheet.entity_id}`);
    if (baseSheet.customer_id) lines.push(`- **Chargebee customer ID:** ${baseSheet.customer_id}`);
    if (baseSheet.am_name) lines.push(`- **Account manager:** ${baseSheet.am_name}`);
    if (baseSheet.sp_name) lines.push(`- **Sales partner:** ${baseSheet.sp_name}`);
    if (baseSheet.phone_number) lines.push(`- **Phone on file:** ${baseSheet.phone_number}`);
    if (baseSheet.total_monthly_revenue)
      lines.push(`- **Monthly revenue:** ${baseSheet.total_monthly_revenue}`);
  } else {
    lines.push('_BaseSheet record could not be matched. Please verify customer mapping before submitting._');
  }
  lines.push('');

  lines.push('## 3. Service delivery evidence');
  lines.push('');
  lines.push(
    `Over the 90 days preceding ${disputedAt}, Zoca recorded ${events.length} communication events with this customer (${teamEvents.length} from Zoca, ${clientEvents.length} from the customer) across App Chat, Email, Phone, SMS, and Video.`,
  );
  lines.push('');

  const firedSignals = report.signals.filter((s) => s.fired);
  if (firedSignals.length) {
    lines.push('### Key signals supporting service delivery');
    lines.push('');
    for (const s of firedSignals) {
      lines.push(`- **${s.label}** — ${s.evidence}`);
    }
    lines.push('');
  }

  const earliestTeam = teamEvents[teamEvents.length - 1];
  const latestTeam = teamEvents[0];
  if (earliestTeam && latestTeam) {
    lines.push(
      `Zoca's first recorded outbound contact in this window: ${new Date(earliestTeam.createdAt).toISOString().slice(0, 10)} (${earliestTeam.channel}). Most recent: ${new Date(latestTeam.createdAt).toISOString().slice(0, 10)} (${latestTeam.channel}).`,
    );
    lines.push('');
  }

  lines.push('## 4. Communications timeline (last 20 events)');
  lines.push('');
  lines.push('| Date | Channel | From | Excerpt |');
  lines.push('| --- | --- | --- | --- |');
  for (const e of events.slice(0, 20)) {
    const date = new Date(e.createdAt).toISOString().slice(0, 10);
    const from = e.side === 'team' ? 'Zoca' : e.side === 'client' ? 'Customer' : '—';
    const excerpt = (e.body || '').replace(/\s+/g, ' ').trim().slice(0, 80) || '_(no text)_';
    lines.push(`| ${date} | ${e.channel} | ${from} | ${excerpt.replace(/\|/g, '\\|')} |`);
  }
  lines.push('');

  lines.push('## 5. Recommended Stripe evidence bundle');
  lines.push('');
  lines.push('Attach the following when submitting evidence to Stripe:');
  lines.push('');
  lines.push('1. **Customer signed agreement / Terms of Service acceptance** — proving the cardholder agreed to subscription terms.');
  lines.push('2. **Service-delivery records** — exported communications timeline (this document) plus screenshots of in-app activity and live products (e.g., Discovery Agent rankings, GBP optimization).');
  lines.push('3. **Communications log** — App Chat, Email, SMS, Phone, and Video records demonstrating active engagement.');
  if (firedSignals.find((s) => s.id === 'training_delivered')) {
    lines.push('4. **Training/onboarding artifacts** — recording link, attendance, and topic agenda from the kickoff/onboarding session.');
  }
  lines.push(`${firedSignals.find((s) => s.id === 'training_delivered') ? '5' : '4'}. **Refund / cancellation policy** — Zoca\'s published policy as agreed at signup.`);
  lines.push(`${firedSignals.find((s) => s.id === 'training_delivered') ? '6' : '5'}. **Customer success metrics** — booking uplift, search-rank delta, or other measurable outcomes during the disputed period.`);
  lines.push('');

  lines.push('## 6. Recommended response');
  lines.push('');
  lines.push(`**${report.recommendation}** — ${report.rationale}`);
  lines.push('');

  if (report.recommendation === 'FIGHT') {
    lines.push('Submit a counter-evidence response to Stripe before the evidence-due date. Use the bundle above and the timeline as the core narrative.');
  } else if (report.recommendation === 'REFUND') {
    lines.push('Issue a goodwill refund and accept the dispute. The signal trail will not support a successful contest.');
  } else {
    lines.push('Schedule a 15-minute call with the AM and the customer before submitting evidence. Capture the customer\'s reasoning, then re-classify.');
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(`_Generated on ${new Date().toISOString().slice(0, 10)} by the Zoca Dispute Analyser. Review by an account manager before submitting to Stripe._`);

  return lines.join('\n');
}
