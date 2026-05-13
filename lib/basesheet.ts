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

  // Cache through Next.js's built-in fetch cache. 60-second revalidate +
  // `basesheet` tag means the Refresh button still forces a fresh pull, and
  // new BaseSheet rows show up within a minute on any deploy.
  const res = await fetch(url, {
    next: { revalidate: 60, tags: ['basesheet'] },
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

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/** Levenshtein distance, capped — bails out early if >maxDist. */
function levenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Find a BaseSheet row that matches a Stripe customer. Strategies in priority order:
 *   1. Chargebee customer handle (rarely matches — Stripe + Chargebee use different ID spaces)
 *   2. Exact email against app_email / gbp_email / dct_email
 *   3. Custom-domain uniqueness — same business domain, generic providers excluded,
 *      only when exactly one BaseSheet row owns the domain
 *   4. Fuzzy email — Levenshtein ≤2 on local-part, same domain root (catches ".con" typos and
 *      one-letter spellings); only fires when exactly one BaseSheet row matches
 *   5. Phone-number match on last 10 digits
 *   6. Customer name → sp_name (exact normalised), only when uniquely owned
 */
export async function matchCustomer(opts: {
  customerId?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
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

      // 4. Fuzzy email — handle BaseSheet typos like ".con" or single-character spelling drift
      const localPart = email.slice(0, email.lastIndexOf('@'));
      if (localPart.length >= 5 && domain) {
        // Strip TLD-tier difference: gmail.com ≈ gmail.con
        const domainRoot = domain.split('.')[0];
        const fuzzyCandidates = rows.filter((r) =>
          [r.app_email, r.gbp_email, r.dct_email]
            .filter(Boolean)
            .some((e) => {
              const eLow = e.trim().toLowerCase();
              const eAt = eLow.lastIndexOf('@');
              if (eAt < 0) return false;
              const eLocal = eLow.slice(0, eAt);
              const eDomain = eLow.slice(eAt + 1);
              const eDomainRoot = eDomain.split('.')[0];
              if (eDomainRoot !== domainRoot) return false;
              const localDist = levenshtein(localPart, eLocal, 2);
              return localDist <= 2;
            }),
        );
        if (fuzzyCandidates.length === 1) return fuzzyCandidates[0];
      }
    }
  }

  // 5. Phone-number match
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

  // 6. Customer name → sp_name match
  if (opts.name) {
    const target = normalizeName(opts.name);
    if (target.length >= 4) {
      const candidates = rows.filter((r) => {
        const sp = (r.sp_name || '').trim();
        if (!sp) return false;
        return normalizeName(sp) === target;
      });
      if (candidates.length === 1) return candidates[0];
    }
  }

  return null;
}
