import 'server-only';
import Stripe from 'stripe';
import { unstable_cache } from 'next/cache';

if (!process.env.STRIPE_SECRET_KEY) {
  // We don't throw at module load so `next build` can statically analyze
  // pages without the key being present. Routes that actually call Stripe
  // will throw a clear error at request time.
  console.warn('[stripe] STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'missing_key', {
  apiVersion: '2024-06-20',
  typescript: true,
  appInfo: {
    name: 'zoca-dispute-dashboard',
    version: '0.1.0',
  },
});

export type DisputeListItem = {
  id: string;
  amount: number;
  currency: string;
  status: Stripe.Dispute.Status;
  reason: string;
  /** Unix seconds when the dispute was opened by the cardholder. */
  created: number;
  /** Unix seconds when the underlying charge was created (i.e. when money was charged). */
  chargeCreated: number | null;
  evidenceDueBy: number | null;
  hasEvidence: boolean;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  chargeId: string;
  paymentIntentId: string | null;
};

const NEEDS_RESPONSE: Stripe.Dispute.Status[] = [
  'warning_needs_response',
  'needs_response',
];

async function fetchDisputesUncached(limit: number): Promise<DisputeListItem[]> {
  const res = await stripe.disputes.list({
    limit,
    expand: ['data.charge', 'data.charge.customer', 'data.payment_intent'],
  });
  return res.data.map(toListItem);
}

/**
 * Cached version, default-100 case only. Cache window: 60s.
 * After 60s the next request triggers a background revalidation while the
 * stale data is still served — so users never wait on Stripe.
 */
const _listDisputes100Cached = unstable_cache(
  async () => fetchDisputesUncached(100),
  ['stripe-disputes-list-100'],
  { revalidate: 60, tags: ['disputes'] },
);

/**
 * Fetch up to `limit` recent disputes (default 100). The default 100 case is
 * cached for 60s; non-default limits bypass cache.
 */
export async function listDisputes(opts: { limit?: number } = {}): Promise<DisputeListItem[]> {
  const limit = Math.min(opts.limit ?? 100, 100);
  if (limit === 100) return _listDisputes100Cached();
  return fetchDisputesUncached(limit);
}

export async function getDispute(id: string): Promise<{
  dispute: Stripe.Dispute;
  charge: Stripe.Charge | null;
  customer: Stripe.Customer | null;
  paymentIntent: Stripe.PaymentIntent | null;
}> {
  const dispute = await stripe.disputes.retrieve(id, {
    expand: ['charge', 'charge.customer', 'payment_intent'],
  });

  const charge = (dispute.charge as Stripe.Charge | null) ?? null;
  let customer: Stripe.Customer | null = null;
  if (charge && charge.customer) {
    if (typeof charge.customer === 'string') {
      const c = await stripe.customers.retrieve(charge.customer);
      if (!('deleted' in c) || !c.deleted) customer = c as Stripe.Customer;
    } else if (!('deleted' in charge.customer) || !charge.customer.deleted) {
      customer = charge.customer as Stripe.Customer;
    }
  }

  const paymentIntent = (dispute.payment_intent as Stripe.PaymentIntent | null) ?? null;

  return { dispute, charge, customer, paymentIntent };
}

export function isNeedsResponse(d: { status: Stripe.Dispute.Status }): boolean {
  return NEEDS_RESPONSE.includes(d.status);
}

function toListItem(d: Stripe.Dispute): DisputeListItem {
  const charge = d.charge as Stripe.Charge | null;
  const customer =
    charge && charge.customer && typeof charge.customer !== 'string' && !('deleted' in charge.customer && charge.customer.deleted)
      ? (charge.customer as Stripe.Customer)
      : null;

  return {
    id: d.id,
    amount: d.amount,
    currency: d.currency,
    status: d.status,
    reason: d.reason,
    created: d.created,
    chargeCreated: charge?.created ?? null,
    evidenceDueBy: d.evidence_details?.due_by ?? null,
    hasEvidence: d.evidence_details?.has_evidence ?? false,
    customerId: customer?.id ?? (charge && typeof charge.customer === 'string' ? charge.customer : null),
    customerEmail: customer?.email ?? charge?.billing_details?.email ?? null,
    customerName: customer?.name ?? charge?.billing_details?.name ?? null,
    chargeId: typeof d.charge === 'string' ? d.charge : (d.charge as Stripe.Charge).id,
    paymentIntentId:
      typeof d.payment_intent === 'string'
        ? d.payment_intent
        : (d.payment_intent as Stripe.PaymentIntent | null)?.id ?? null,
  };
}

export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
