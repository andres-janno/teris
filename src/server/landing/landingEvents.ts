// src/server/landing/landingEvents.ts — landing'u külastuste salvestus (serveri hit + brauseri beacon) ja säilitamine.
// Mõõtmise viga ei tohi kunagi takistada lehe serveerimist: kõik vead logitakse ja neelatakse.
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from '../db.ts';
import { parseBody } from '../http.ts';
import { createLoginLimiter } from '../auth.ts';
import { CTA_TARGETS } from '../../landing/content.et.ts';
import { classifyUserAgent, detectDevice } from './botDetect.ts';
import { visitorHashOf } from './visitorHash.ts';
import { requestMeta, referrerHostOf, clip } from './requestMeta.ts';

export const LANDING_PATHS = ['/', '/privacy'];
const BEACON_EVENTS = ['view', 'cta_click', 'form_submit'];
const MAX_BEACON_BYTES = 2 * 1024;
const EVENT_RETENTION_MONTHS = 13;
const INTEREST_RETENTION_MONTHS = 24;
const DAY_MS = 24 * 60 * 60 * 1000;
const beaconLimiter = createLoginLimiter({ max: 60, windowMs: 15 * 60 * 1000 });

type EventInput = {
  source: 'server' | 'beacon';
  event: string;
  target?: string | null;
  path: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

function save(req: IncomingMessage, e: EventInput): Promise<unknown> {
  const meta = requestMeta(req);
  const { visitorClass, botName } = classifyUserAgent(meta.ua);
  return authDb().landingEvent.create({
    data: { ...e, target: e.target ?? null, visitorClass, botName, device: detectDevice(meta.ua), visitorHash: visitorHashOf(meta.ip, meta.ua) }
  });
}

export function recordHit(req: IncomingMessage, path: string): void {
  try {
    const meta = requestMeta(req);
    save(req, { source: 'server', event: 'hit', path, referrerHost: meta.referrerHost, utmSource: meta.utmSource, utmMedium: meta.utmMedium, utmCampaign: meta.utmCampaign }).catch((err) =>
      console.error('[landing] hit-i salvestamine ebaõnnestus', err)
    );
  } catch (err) {
    console.error('[landing] hit-i salvestamine ebaõnnestus', err);
  }
}

function noContent(res: ServerResponse, status = 204): void {
  res.statusCode = status;
  res.end();
}

export async function handleLandingEvent(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: any;
  try {
    body = await parseBody(req, MAX_BEACON_BYTES);
  } catch {
    return noContent(res, 400);
  }
  const event = typeof body?.event === 'string' ? body.event : '';
  const path = typeof body?.path === 'string' ? body.path : '';
  const target = body?.target == null ? null : String(body.target);
  if (!BEACON_EVENTS.includes(event) || !LANDING_PATHS.includes(path)) return noContent(res, 400);
  if (event === 'cta_click' ? !CTA_TARGETS.includes(target as never) : target !== null) return noContent(res, 400);

  const key = `beacon:${requestMeta(req).ip}`;
  if (beaconLimiter.isBlocked(key)) return noContent(res);
  beaconLimiter.registerFailure(key); // loendur, mitte viga

  try {
    await save(req, {
      source: 'beacon',
      event,
      target,
      path,
      referrerHost: referrerHostOf(typeof body.referrer === 'string' ? body.referrer : null),
      utmSource: clip(body.utmSource, 100),
      utmMedium: clip(body.utmMedium, 100),
      utmCampaign: clip(body.utmCampaign, 100)
    });
  } catch (err) {
    console.error('[landing] beaconi salvestamine ebaõnnestus', err);
  }
  noContent(res);
}

const monthsBefore = (now: Date, months: number) => {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
};

export async function purgeOldLandingData(now: Date = new Date()): Promise<{ events: number; interest: number }> {
  const db = authDb();
  const [events, interest] = await Promise.all([
    db.landingEvent.deleteMany({ where: { ts: { lt: monthsBefore(now, EVENT_RETENTION_MONTHS) } } }),
    db.interestRequest.deleteMany({ where: { status: 'CLOSED', closedAt: { lt: monthsBefore(now, INTEREST_RETENTION_MONTHS) } } })
  ]);
  return { events: events.count, interest: interest.count };
}

export function startLandingRetention(): void {
  const run = () =>
    purgeOldLandingData()
      .then((r) => (r.events || r.interest) && console.log(`[landing] puhastus: ${r.events} sündmust, ${r.interest} huvilist`))
      .catch((err) => console.error('[landing] puhastus ebaõnnestus', err));
  void run();
  setInterval(run, DAY_MS).unref();
}
