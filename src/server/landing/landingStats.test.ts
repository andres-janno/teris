// src/server/landing/landingStats.test.ts — live-andmebaas; testiread kaugel tulevikus (2099), et päris andmeid mitte segada.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authDb } from '../db.ts';
import { landingStats, parseDay } from './landingStats.ts';

const TAG = `test-ls-${process.pid}`;
const base = { path: '/', device: 'desktop', utmCampaign: TAG };
const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  await authDb().landingEvent.createMany({
    data: [
      // päev 1: kaks inimest vaatavad, üks klõpsab ja saadab
      { ...base, ts: at('2099-01-01T08:00:00Z'), source: 'beacon', event: 'view', visitorClass: 'human', visitorHash: 'a000000000000001', referrerHost: 'google.com' },
      { ...base, ts: at('2099-01-01T08:01:00Z'), source: 'beacon', event: 'view', visitorClass: 'human', visitorHash: 'a000000000000001', referrerHost: 'google.com' },
      { ...base, ts: at('2099-01-01T09:00:00Z'), source: 'beacon', event: 'view', visitorClass: 'human', visitorHash: 'a000000000000002', device: 'mobile' },
      { ...base, ts: at('2099-01-01T09:01:00Z'), source: 'beacon', event: 'cta_click', target: 'hero', visitorClass: 'human', visitorHash: 'a000000000000002' },
      // „Logi sisse“ klõps ei ole huvi märk ega lähe lehtrisse
      { ...base, ts: at('2099-01-01T08:02:00Z'), source: 'beacon', event: 'cta_click', target: 'header-login', visitorClass: 'human', visitorHash: 'a000000000000001' },
      { ...base, ts: at('2099-01-01T09:02:00Z'), source: 'beacon', event: 'form_submit', visitorClass: 'human', visitorHash: 'a000000000000002' },
      // Tallinna päeva piir: 22:30 UTC = 00:30 Tallinnas (UTC+2) järgmisel päeval
      { ...base, ts: at('2099-01-01T22:30:00Z'), source: 'beacon', event: 'view', visitorClass: 'human', visitorHash: 'a000000000000003' },
      // robotid
      { ...base, ts: at('2099-01-01T10:00:00Z'), source: 'server', event: 'hit', visitorClass: 'ai_bot', botName: 'GPTBot', visitorHash: 'b000000000000001' },
      { ...base, path: '/llms.txt', ts: at('2099-01-01T10:01:00Z'), source: 'server', event: 'hit', visitorClass: 'ai_bot', botName: 'GPTBot', visitorHash: 'b000000000000001' },
      // väljaspool perioodi
      { ...base, ts: at('2099-03-01T08:00:00Z'), source: 'beacon', event: 'view', visitorClass: 'human', visitorHash: 'a000000000000009' }
    ].map((r) => ({ referrerHost: null, botName: null, target: null, ...r }))
  });
});
afterAll(async () => {
  await authDb().landingEvent.deleteMany({ where: { utmCampaign: TAG } });
});

describe('parseDay', () => {
  it('kehtib ainult YYYY-MM-DD', () => {
    expect(parseDay('2099-01-01')).toBe('2099-01-01');
    expect(parseDay('2099-02-30')).toBeNull();
    expect(parseDay('01.01.2099')).toBeNull();
    expect(parseDay(null)).toBeNull();
  });
});

describe('landingStats', () => {
  it('päevad, allikad, seadmed, robotid ja lehter', async () => {
    const s = await landingStats('2099-01-01', '2099-01-31');
    expect(s.daily).toEqual([{ day: '2099-01-01', visitors: 2, views: 3 }, { day: '2099-01-02', visitors: 1, views: 1 }]);
    expect(s.sources).toEqual(expect.arrayContaining([{ source: 'google.com', visitors: 1 }, { source: 'otse', visitors: 2 }]));
    expect(s.devices).toEqual(expect.arrayContaining([{ device: 'desktop', visitors: 2 }, { device: 'mobile', visitors: 1 }]));
    expect(s.bots).toEqual([{ visitorClass: 'ai_bot', botName: 'GPTBot', hits: 2, llmsTxtHits: 1, llmsTxtLastSeen: '2099-01-01T10:01:00.000Z', lastSeen: '2099-01-01T10:01:00.000Z' }]);
    expect(s.funnel).toEqual({ viewed: 3, clicked: 1, submitted: 1 });
  });
});
