// src/server/landing/interest.test.ts — valideerimine (puhas) + otspunkt live-andmebaasiga.
import { describe, it, expect, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from '../db.ts';
import { validateInterest, isSuspicious, buildInterestMail, handleInterest } from './interest.ts';

const EMAIL = `test-int-${process.pid}@example.com`;
const valid = { name: 'Mari Maasikas', email: EMAIL, company: 'Talu OÜ', phone: '+372 5555 5555', areaHa: '120,5', message: 'Huvitab telemeetria', website: '', elapsedMs: 8000 };

let ipSeq = 0;
function fakeReq(body: unknown) {
  const raw = JSON.stringify(body);
  return Object.assign(Readable.from([Buffer.from(raw)]), {
    method: 'POST', url: '/api/landing/interest',
    headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(raw)), 'user-agent': 'UA' },
    socket: { remoteAddress: `198.51.100.${++ipSeq}` }
  }) as unknown as IncomingMessage;
}
function fakeRes() {
  const out = { status: 0, body: '' };
  const res = { statusCode: 200, setHeader() {}, end(c?: string) { out.body += c ?? ''; out.status = (res as any).statusCode; } } as unknown as ServerResponse;
  return { res, out };
}

afterAll(async () => {
  await authDb().interestRequest.deleteMany({ where: { email: { startsWith: `test-int-${process.pid}` } } });
});

describe('validateInterest', () => {
  it('kehtiv sisend → normaliseeritud andmed', () => {
    const r = validateInterest({ ...valid, email: ` ${EMAIL.toUpperCase()} `, referrer: 'https://www.google.com/x', utmSource: 'fb' });
    expect(r).toEqual({ ok: true, data: { name: 'Mari Maasikas', email: EMAIL, company: 'Talu OÜ', phone: '+372 5555 5555', areaHa: 120.5, message: 'Huvitab telemeetria', utmSource: 'fb', referrerHost: 'google.com' } });
  });
  it('vigased väljad', () => {
    expect(validateInterest({ ...valid, name: '' })).toEqual({ ok: false, error: 'Nimi on kohustuslik (kuni 100 märki)' });
    expect(validateInterest({ ...valid, name: 'x'.repeat(101) }).ok).toBe(false);
    expect(validateInterest({ ...valid, email: 'pole-epost' })).toEqual({ ok: false, error: 'Kontrolli e-posti aadressi' });
    expect(validateInterest({ ...valid, areaHa: '-5' })).toEqual({ ok: false, error: 'Põllupind peab olema 0–100 000 ha' });
    expect(validateInterest({ ...valid, message: 'x'.repeat(2001) }).ok).toBe(false);
  });
  it('tühjad valikulised väljad → null', () => {
    const r = validateInterest({ name: 'A', email: EMAIL });
    expect(r.ok && r.data).toMatchObject({ company: null, phone: null, areaHa: null, message: null });
  });
});

describe('isSuspicious', () => {
  it('honeypot või liiga kiire saatmine', () => {
    expect(isSuspicious(valid)).toBe(false);
    expect(isSuspicious({ ...valid, website: 'http://spam' })).toBe(true);
    expect(isSuspicious({ ...valid, elapsedMs: 1200 })).toBe(true);
    expect(isSuspicious({ ...valid, elapsedMs: 'x' })).toBe(true);
  });
});

describe('buildInterestMail', () => {
  it('sisaldab välju ja admin-linki, päis on turvaline', () => {
    const m = buildInterestMail({ name: 'Mari', email: EMAIL, company: null, phone: null, areaHa: 50, message: 'Tere', utmSource: null, referrerHost: null }, { to: 'admin@x.ee', from: 'noreply@teris.ee', adminUrl: 'https://admin.teris.ee' });
    expect(m).toContain('To: admin@x.ee');
    expect(m).toContain('Mari');
    expect(m).toContain('50 ha');
    expect(m).toContain('https://admin.teris.ee');
  });
});

describe('handleInterest', () => {
  it('kehtiv → 200, rida ja e-kiri', async () => {
    const sent: string[] = [];
    const { res, out } = fakeRes();
    await handleInterest(fakeReq(valid), res, { send: async (msg) => void sent.push(msg), notifyTo: 'admin@x.ee' });
    expect(out.status).toBe(200);
    expect(await authDb().interestRequest.count({ where: { email: EMAIL } })).toBe(1);
    expect(sent).toHaveLength(1);
  });
  it('kahtlane → 200, aga ei salvestata ega saadeta', async () => {
    const sent: string[] = [];
    const email = `test-int-${process.pid}-spam@example.com`;
    const { res, out } = fakeRes();
    await handleInterest(fakeReq({ ...valid, email, website: 'x' }), res, { send: async (m) => void sent.push(m), notifyTo: 'admin@x.ee' });
    expect(out.status).toBe(200);
    expect(await authDb().interestRequest.count({ where: { email } })).toBe(0);
    expect(sent).toHaveLength(0);
  });
  it('vigane → 400 eestikeelse veaga', async () => {
    const { res, out } = fakeRes();
    await handleInterest(fakeReq({ ...valid, email: 'x' }), res, { send: async () => {}, notifyTo: undefined });
    expect(out.status).toBe(400);
    expect(JSON.parse(out.body).error).toBe('Kontrolli e-posti aadressi');
  });
  it('e-kirja viga ei nurja päringut; notifyTo puudumisel kirja ei saadeta', async () => {
    const email = `test-int-${process.pid}-mailfail@example.com`;
    const { res, out } = fakeRes();
    await handleInterest(fakeReq({ ...valid, email }), res, { send: async () => { throw new Error('sendmail maas'); }, notifyTo: 'admin@x.ee' });
    expect(out.status).toBe(200);
    expect(await authDb().interestRequest.count({ where: { email } })).toBe(1);
  });
});
