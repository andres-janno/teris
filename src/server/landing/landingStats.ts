// src/server/landing/landingStats.ts — landing'u statistika admin-vaatele (Tallinna päevade kaupa).
// Unikaalne külastaja = päevane visitorHash; perioodi lehter liidab päevad (sama inimene eri päevadel loetakse eraldi).
import { Prisma } from '@prisma/client';
import { authDb } from '../db.ts';

export type LandingStats = {
  from: string;
  to: string;
  daily: { day: string; visitors: number; views: number }[];
  sources: { source: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  bots: { visitorClass: string; botName: string; hits: number; llmsTxtHits: number; lastSeen: string }[];
  funnel: { viewed: number; clicked: number; submitted: number };
};

export function parseDay(s: string | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

const n = (v: unknown) => Number(v ?? 0);

export async function landingStats(from: string, to: string): Promise<LandingStats> {
  const db = authDb();
  const day = Prisma.sql`("ts" AT TIME ZONE 'Europe/Tallinn')::date`;
  const inRange = Prisma.sql`${day} BETWEEN ${from}::date AND ${to}::date`;
  const humanViews = Prisma.sql`"source" = 'beacon' AND "visitorClass" = 'human' AND ${inRange}`;

  const [daily, sources, devices, bots, funnel] = await Promise.all([
    db.$queryRaw<{ day: string; visitors: bigint; views: bigint }[]>`
      SELECT to_char(${day}, 'YYYY-MM-DD') AS day, count(DISTINCT "visitorHash") AS visitors, count(*) AS views
      FROM landing_events WHERE "event" = 'view' AND ${humanViews} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ source: string; visitors: bigint }[]>`
      SELECT coalesce("utmSource", "referrerHost", 'otse') AS source, count(DISTINCT ("visitorHash", ${day})) AS visitors
      FROM landing_events WHERE "event" = 'view' AND ${humanViews} GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
    db.$queryRaw<{ device: string; visitors: bigint }[]>`
      SELECT "device", count(DISTINCT ("visitorHash", ${day})) AS visitors
      FROM landing_events WHERE "event" = 'view' AND ${humanViews} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ visitorClass: string; botName: string; hits: bigint; llmsTxtHits: bigint; lastSeen: Date }[]>`
      SELECT "visitorClass", coalesce("botName", 'muu') AS "botName", count(*) AS hits,
             count(*) FILTER (WHERE "path" = '/llms.txt') AS "llmsTxtHits", max("ts") AS "lastSeen"
      FROM landing_events WHERE "source" = 'server' AND "visitorClass" <> 'human' AND ${inRange}
      GROUP BY 1, 2 ORDER BY 3 DESC`,
    db.$queryRaw<{ viewed: bigint; clicked: bigint; submitted: bigint }[]>`
      SELECT count(DISTINCT ("visitorHash", ${day})) FILTER (WHERE "event" = 'view') AS viewed,
             count(DISTINCT ("visitorHash", ${day})) FILTER (WHERE "event" = 'cta_click') AS clicked,
             count(DISTINCT ("visitorHash", ${day})) FILTER (WHERE "event" = 'form_submit') AS submitted
      FROM landing_events WHERE ${humanViews}`
  ]);

  return {
    from,
    to,
    daily: daily.map((r) => ({ day: r.day, visitors: n(r.visitors), views: n(r.views) })),
    sources: sources.map((r) => ({ source: r.source, visitors: n(r.visitors) })),
    devices: devices.map((r) => ({ device: r.device, visitors: n(r.visitors) })),
    bots: bots.map((r) => ({ visitorClass: r.visitorClass, botName: r.botName, hits: n(r.hits), llmsTxtHits: n(r.llmsTxtHits), lastSeen: r.lastSeen.toISOString() })),
    funnel: { viewed: n(funnel[0]?.viewed), clicked: n(funnel[0]?.clicked), submitted: n(funnel[0]?.submitted) }
  };
}
