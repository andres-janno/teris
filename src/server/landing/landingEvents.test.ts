// src/server/landing/landingEvents.test.ts — live-andmebaas; testiread tunneb ära utmCampaign järgi.
import { describe, it, expect, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from '../db.ts';
import { recordHit, handleLandingEvent, purgeOldLandingData } from './landingEvents.ts';

const TAG = `test-le-${process.pid}`;
const CHROME = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/129.0 Safari/537.36';

function fakeReq(body: unknown, headers: Record<string, string> = {}, url = '/api/landing/event') {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return Object.assign(Readable.from([Buffer.from(raw)]), {
    method: 'POST', url,
    headers: { 'user-agent': CHROME, 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(raw)), ...headers },
    socket: { remoteAddress: '203.0.113.7' }
  }) as unknown as IncomingMessage;
}
function fakeRes() {
  const out = { status: 0, body: '' };
  const res = { statusCode: 200, setHeader() {}, end(c?: string) { out.body += c ?? ''; out.status = (res as any).statusCode; } } as unknown as ServerResponse;
  return { res, out };
}
const rows = () => authDb().landingEvent.findMany({ where: { utmCampaign: TAG }, orderBy: { id: 'asc' } });
const waitFor = async (n: number) => { for (let i = 0; i < 50 && (await rows()).length < n; i++) await new Promise((r) => setTimeout(r, 20)); };

afterAll(async () => {
  await authDb().landingEvent.deleteMany({ where: { utmCampaign: TAG } });
});

describe('recordHit', () => {
  it('salvestab serveri hit-i roboti klassi ja UTM-iga, ilma IP-ta', async () => {
    const req = { url: `/?utm_campaign=${TAG}&utm_source=x`, headers: { 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2)' }, socket: { remoteAddress: '203.0.113.7' } } as unknown as IncomingMessage;
    recordHit(req, '/');
    await waitFor(1);
    const [r] = await rows();
    expect(r).toMatchObject({ source: 'server', event: 'hit', path: '/', visitorClass: 'ai_bot', botName: 'GPTBot', utmSource: 'x', device: 'desktop' });
    expect(JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).not.toContain('203.0.113.7');
  });
});

describe('handleLandingEvent', () => {
  it('lubatud sündmus → 204 ja rida', async () => {
    const { res, out } = fakeRes();
    await handleLandingEvent(fakeReq({ event: 'cta_click', target: 'hero', path: '/', referrer: 'https://www.google.com/', utmCampaign: TAG }), res);
    expect(out.status).toBe(204);
    await waitFor(2);
    const r = (await rows()).at(-1)!;
    expect(r).toMatchObject({ source: 'beacon', event: 'cta_click', target: 'hero', referrerHost: 'google.com', visitorClass: 'human' });
  });
  it('tundmatu sündmus, tundmatu target, vale path → 400', async () => {
    for (const body of [{ event: 'hack', path: '/' }, { event: 'cta_click', target: 'x', path: '/' }, { event: 'view', path: '/admin' }]) {
      const { res, out } = fakeRes();
      await handleLandingEvent(fakeReq({ ...body, utmCampaign: TAG }), res);
      expect(out.status).toBe(400);
    }
  });
  it('liiga suur keha → 400', async () => {
    const { res, out } = fakeRes();
    await handleLandingEvent(fakeReq({ event: 'view', path: '/', utmCampaign: TAG, pad: 'x'.repeat(3000) }), res);
    expect(out.status).toBe(400);
  });
});

describe('purgeOldLandingData', () => {
  it('kustutab üle 13 kuu vanad sündmused', async () => {
    await authDb().landingEvent.create({
      data: { ts: new Date('2020-01-01T00:00:00Z'), source: 'server', event: 'hit', path: '/', visitorClass: 'human', device: 'desktop', visitorHash: '0000000000000000', utmCampaign: TAG }
    });
    const before = (await rows()).length;
    const result = await purgeOldLandingData(new Date('2026-10-19T00:00:00Z'));
    expect(result.events).toBeGreaterThanOrEqual(1);
    expect((await rows()).length).toBe(before - 1);
  });

  it('kustutab üle 24 kuu käsitlemata ja suletud huvilised, värsked jäävad alles', async () => {
    const email = (s: string) => `${TAG}-${s}@example.com`;
    const old = new Date('2020-01-01T00:00:00Z');
    const fresh = new Date('2026-09-01T00:00:00Z');
    const db = authDb().interestRequest;
    await db.createMany({
      data: [
        { name: 'A', email: email('new-old'), status: 'NEW', createdAt: old, updatedAt: old },
        { name: 'B', email: email('contacted-old'), status: 'CONTACTED', createdAt: old, updatedAt: old },
        { name: 'C', email: email('closed-old'), status: 'CLOSED', createdAt: old, updatedAt: fresh, closedAt: old },
        { name: 'D', email: email('new-fresh'), status: 'NEW', createdAt: old, updatedAt: fresh },
        { name: 'E', email: email('closed-fresh'), status: 'CLOSED', createdAt: old, updatedAt: old, closedAt: fresh }
      ]
    });
    try {
      await purgeOldLandingData(new Date('2026-10-19T00:00:00Z'));
      const left = (await db.findMany({ where: { email: { startsWith: TAG } } })).map((r) => r.name).sort();
      expect(left).toEqual(['D', 'E']);
    } finally {
      await db.deleteMany({ where: { email: { startsWith: TAG } } });
    }
  });
});
