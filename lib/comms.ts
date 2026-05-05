import 'server-only';
import Papa from 'papaparse';

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

const TTL_MS = 5 * 60 * 1000;
const cache: Record<CommsChannel, { rows: any[]; ts: number } | null> = {
  app_chat: null,
  email: null,
  phone: null,
  video: null,
  sms: null,
};

const URLS: Record<CommsChannel, string | undefined> = {
  app_chat: process.env.METABASE_APPCHAT_URL,
  email: process.env.METABASE_EMAIL_URL,
  phone: process.env.METABASE_PHONE_URL,
  video: process.env.METABASE_VIDEO_URL,
  sms: process.env.METABASE_SMS_URL,
};

async function fetchChannel(channel: CommsChannel): Promise<any[]> {
  const c = cache[channel];
  if (c && Date.now() - c.ts < TTL_MS) return c.rows;
  const url = URLS[channel];
  if (!url) throw new Error(`Missing env var for ${channel}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${channel} fetch failed: ${res.status}`);
  const csv = await res.text();
  const parsed = Papa.parse<any>(csv, { header: true, skipEmptyLines: true });
  cache[channel] = { rows: parsed.data, ts: Date.now() };
  return parsed.data;
}

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
  if (memberType === 'team member' || memberType === 'team_member' || sender === 'team member' || sender === 'team_member') return 'team';

  return 'unknown';
}

/**
 * Get all comms for a given entity_id within `days` days back from now.
 * Combines all 5 channels into a unified, time-sorted timeline.
 */
export async function getCommsForEntity(entityId: string, days = 90): Promise<CommsEvent[]> {
  if (!entityId) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const channels: CommsChannel[] = ['app_chat', 'email', 'phone', 'video', 'sms'];
  const results = await Promise.allSettled(channels.map((c) => fetchChannel(c)));

  const events: CommsEvent[] = [];
  results.forEach((r, idx) => {
    if (r.status !== 'fulfilled') return;
    const channel = channels[idx];
    for (const row of r.value) {
      const eid = row['Entity ID'] || row.entity_id;
      if (eid !== entityId) continue;
      const createdAt = parseDate(row['Created At'] || row.created_at);
      if (!createdAt || createdAt < cutoff) continue;

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
    }
  });

  events.sort((a, b) => b.createdAt - a.createdAt);
  return events;
}

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
