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

async function fetchBaseSheet(): Promise<BaseSheetRow[]> {
  const url = process.env.METABASE_BASESHEET_URL;
  if (!url) throw new Error('METABASE_BASESHEET_URL is not set');

  // Cache through Next.js's built-in fetch cache so it plays nicely with ISR.
  // 5-minute revalidate; tag-invalidatable via revalidateTag('basesheet').
  const res = await fetch(url, {
    next: { revalidate: 300, tags: ['basesheet'] },
  });
  if (!res.ok) throw new Error(`BaseSheet fetch failed: ${res.status} ${res.statusText}`);
  const csv = await res.text();
  const parsed = Papa.parse<BaseSheetRow>(csv, { header: true, skipEmptyLines: true });
  return parsed.data.filter((r) => r.entity_id);
}

/**
 * BaseSheet rows. Caching is handled via Next.js fetch cache (5 min, tag
 * `basesheet`). Survives across Vercel serverless invocations.
 */
export const getBaseSheet = fetchBaseSheet;

// Generic email providers that should NEVER be used to fingerprint a business
// — too many unrelated customers share these.
const GENERIC_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'gmx.com',
  'mail.com',
  'comcast.net',
  'sbcglobal.net',
  'verizon.net',
  'att.net',
  'cox.net',
  'charter.net',
]);

function emailDomain(email: string): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 0) return null;
  const domain = trimmed.slice(at + 1);
  return domain || null;
}

function isCustomDomain(domain: string): boolean {
  return !GENERIC_DOMAINS.has(domain);
}

function lastTenDigits(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/**
 * Find a BaseSheet row that matches a Stripe customer. We try in order:
 *   1. Chargebee customer handle (only if Stripe stored it; usually fails — different ID space)
 *   2. Exact email match against any of app_email / gbp_email / dct_email
 *   3. Custom-domain uniqueness match — same business email domain, generic providers excluded,
 *      and only when exactly one BaseSheet row owns that domain (so we never silently mismatch)
 *   4. Phone-number match on last 10 digits (BaseSheet.phone_number can hold multiple)
 * Returns null if no match.
 */
export async function matchCustomer(opts: {
  customerId?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<BaseSheetRow | null> {
  const rows = await getBaseSheet();

  // 1. Chargebee handle direct match
  if (opts.customerId) {
    const handle = opts.customerId.trim();
    const byHandle = rows.find((r) => r.customer_id?.trim() === handle);
    if (byHandle) return byHandle;
  }

  // 2. Exact email match
  if (opts.email) {
    const email = opts.email.trim().toLowerCase();
    if (email) {
      const byEmail = rows.find((r) =>
        [r.app_email, r.gbp_email, r.dct_email]
          .filter(Boolean)
          .some((e) => e.trim().toLowerCase() === email),
      );
      if (byEmail) return byEmail;

      // 3. Custom-domain uniqueness match
      const domain = emailDomain(email);
      if (domain && isCustomDomain(domain)) {
        const candidates = rows.filter((r) =>
          [r.app_email, r.gbp_email, r.dct_email]
            .filter(Boolean)
            .some((e) => emailDomain(e) === domain),
        );
        if (candidates.length === 1) return candidates[0];
      }
    }
  }

  // 4. Phone-number match
  if (opts.phone) {
    const target = lastTenDigits(opts.phone);
    if (target) {
      const byPhone = rows.find((r) => {
        if (!r.phone_number) return false;
        return r.phone_number
          .split(/[,;]/)
          .some((p) => lastTenDigits(p) === target);
      });
      if (byPhone) return byPhone;
    }
  }

  return null;
}
