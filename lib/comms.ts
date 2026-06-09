import 'server-only';
import Papa from 'papaparse';
import { Readable } from 'node:stream';
import { unstable_cache } from 'next/cache';

export type CommsChannel = 'app_chat' | 'email' | 'phone' | 'video' | 'sms';

export type CommsEvent = {
  channel: CommsChannel;
  createdAt: number; // unix ms
  sender: string;
  /** "client" | "team" | "unknown" — normalized across channels */
  side: 'client' | 'team' | 'unknown';
  body: string;
  /** Channel-specific extras (call duration, etc.) */
  extras?: Record<string, string>;
};

const URLS: Record<CommsChannel, string | undefined> = {
  app_chat: process.env.METABASE_APPCHAT_URL,
  email: process.env.METABASE_EMAIL_URL,
  phone: process.env.METABASE_PHONE_URL,
  video: process.env.METABASE_VIDEO_URL,
  sms: process.env.METABASE_SMS_URL,
};

function parseDate(v: string): number {
  if (!v) return 0;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function normalizeSide(channel: CommsChannel, raw: any): 'client' | 'team' | 'unknown' {
  const memberType = (raw['Member Type'] || raw.member_type || '').toString().toLowerCase();
  const sender = (raw.Sender || raw.sender || '').toString().toLowerCase();
  const messageType = (raw['Message Type'] || raw.message_type || '').toString().toLowerCase();

  // Email uses dedicated message types
  if (channel === 'email') {
    if (messageType.includes('received_by_client') || messageType.includes('sent_to_client')) return 'team';
    if (messageType.includes('sent_by_client') || messageType.includes('received_from_client')) return 'client';
  }

  if (memberType === 'user' || sender === 'user') return 'client';
  if (
    memberType === 'team member' ||
    memberType === 'team_member' ||
    sender === 'team member' ||
    sender === 'team_member'
  )
    return 'team';

  return 'unknown';
}

/**
 * Stream-parse a CSV from `url`, yielding only rows matching `entityId`.
 * Memory stays bounded — non-matching rows are dropped during parse.
 *
 * IMPORTANT: we use `cache: 'no-store'` deliberately. Caching these 50MB+ CSV
 * bodies in Next.js's fetch cache double-buffers them in memory and triggers
 * Vercel OOM kills (manifests as "Connection closed" on the client). Instead
 * we cache the small *filtered* per-entity result in unstable_cache below.
 */
async function streamFilterByEntity(
  url: string,
  channel: CommsChannel,
  entityId: string,
  cutoff: number,
): Promise<CommsEvent[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok || !res.body) {
    throw new Error(`${channel} fetch failed: ${res.status}`);
  }

  const events: CommsEvent[] = [];
  const nodeStream = Readable.fromWeb(res.body as any);

  await new Promise<void>((resolve, reject) => {
    Papa.parse<any>(nodeStream as any, {
      header: true,
      skipEmptyLines: true,
      step: (results) => {
        const row = results.data;
        const eid = row['Entity ID'] || row.entity_id;
        if (eid !== entityId) return;

        const createdAt = parseDate(row['Created At'] || row.created_at);
        if (!createdAt || createdAt < cutoff) return;

        const body = (row['Message Body'] || row.message_body || '').toString();
        const extras: Record<string, string> = {};
        if (channel === 'phone') {
          if (row['Call Duration']) extras.duration = row['Call Duration'].toString();
          if (row['Call Sid']) extras.callSid = row['Call Sid'].toString();
        }
        if (channel === 'video') {
          if (row.Duration) extras.duration = row.Duration.toString();
          if (row['Organizer Email']) extras.organizer = row['Organizer Email'].toString();
          if (row.Source) extras.source = row.Source.toString();
        }

        events.push({
          channel,
          createdAt,
          sender: (row.Sender || row.sender || '').toString(),
          side: normalizeSide(channel, row),
          body,
          extras: Object.keys(extras).length ? extras : undefined,
        });
      },
      complete: () => resolve(),
      error: (err) => reject(err),
    });
  });

  return events;
}

/**
 * Get all comms for a given entity_id within `days` days back from now.
 *
 * Strategy:
 *  - Channels processed SEQUENTIALLY to keep peak memory low (one 50MB stream
 *    at a time instead of 5×50MB concurrent). Trade-off: longer wall-clock
 *    (~5x channel time), but no OOM kill.
 *  - Filtered result is cached PER ENTITY via unstable_cache (10-min TTL).
 *    Hot cache: ~50ms. Cold cache: ~20-40s but completes within Pro maxDuration.
 *  - Each channel fetch uses `cache: 'no-store'` so the huge CSV bodies are
 *    never buffered into the data cache.
 */
async function fetchCommsForEntityRaw(entityId: string, days: number): Promise<CommsEvent[]> {
  if (!entityId) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const channels: CommsChannel[] = ['app_chat', 'email', 'phone', 'video', 'sms'];
  const events: CommsEvent[] = [];

  for (const c of channels) {
    const url = URLS[c];
    if (!url) continue;
    try {
      const channelEvents = await streamFilterByEntity(url, c, entityId, cutoff);
      events.push(...channelEvents);
    } catch (err) {
      // Per-channel failure is tolerable — other channels keep contributing.
      // eslint-disable-next-line no-console
      console.warn(`[comms] ${c} fetch failed for entity ${entityId}:`, err);
    }
  }

  events.sort((a, b) => b.createdAt - a.createdAt);
  return events;
}

/**
 * Public entrypoint. Cached per (entityId, days) for 10 minutes.
 * Different entities have their own cache entries — cache key is automatic.
 */
export const getCommsForEntity = unstable_cache(
  fetchCommsForEntityRaw,
  ['comms-by-entity'],
  { revalidate: 600, tags: ['comms'] },
);

export function commsCounts(events: CommsEvent[]) {
  const byChannel = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.channel] = (acc[e.channel] ?? 0) + 1;
    return acc;
  }, {});
  const bySide = events.reduce(
    (acc, e) => {
      acc[e.side] += 1;
      return acc;
    },
    { client: 0, team: 0, unknown: 0 },
  );
  return { total: events.length, byChannel, bySide };
}
