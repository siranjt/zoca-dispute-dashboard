import 'server-only';
import Papa from 'papaparse';

export type BaseSheetRow = {
  entity_id: string;
  bizname: string;
  customer_id: string; // Chargebee handle
  app_email: string;
  gbp_email: string;
  dct_email: string;
  sp_name: string;
  ae_name: string;
  am_name: string;
  phone_number: string;
  chrone_zoca_status: string;
  churn_date: string;
  total_monthly_revenue: string;
  [k: string]: string;
};

const TTL_MS = 5 * 60 * 1000;
let cache: { rows: BaseSheetRow[]; ts: number } | null = null;

async function fetchBaseSheet(): Promise<BaseSheetRow[]> {
  const url = process.env.METABASE_BASESHEET_URL;
  if (!url) throw new Error('METABASE_BASESHEET_URL is not set');

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`BaseSheet fetch failed: ${res.status} ${res.statusText}`);
  const csv = await res.text();
  const parsed = Papa.parse<BaseSheetRow>(csv, { header: true, skipEmptyLines: true });
  return parsed.data.filter((r) => r.entity_id);
}

export async function getBaseSheet(): Promise<BaseSheetRow[]> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.rows;
  const rows = await fetchBaseSheet();
  cache = { rows, ts: Date.now() };
  return rows;
}

/**
 * Find a BaseSheet row that matches a Stripe customer. We try in order:
 *   1. Chargebee customer handle (passed as customerId)
 *   2. Any of app_email / gbp_email / dct_email matches the Stripe email (case-insensitive)
 * Returns null if no match.
 */
export async function matchCustomer(opts: {
  customerId?: string | null;
  email?: string | null;
}): Promise<BaseSheetRow | null> {
  const rows = await getBaseSheet();

  if (opts.customerId) {
    const handle = opts.customerId.trim();
    const byHandle = rows.find((r) => r.customer_id?.trim() === handle);
    if (byHandle) return byHandle;
  }

  if (opts.email) {
    const email = opts.email.trim().toLowerCase();
    const byEmail = rows.find((r) =>
      [r.app_email, r.gbp_email, r.dct_email]
        .filter(Boolean)
        .some((e) => e.trim().toLowerCase() === email),
    );
    if (byEmail) return byEmail;
  }

  return null;
}
