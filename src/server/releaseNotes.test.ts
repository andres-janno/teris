// src/server/releaseNotes.test.ts — väljalaske märkmete (release notes) testid päris andmebaasiga.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from './db';
import { hashToken } from './auth';
import {
  ReleaseNoteError,
  createReleaseNote,
  deleteReleaseNote,
  getPlatformReleaseNote,
  handleReleaseNoteUnsubscribe,
  handleReleaseNotesApi,
  parseReleaseNoteItems,
  publishReleaseNote,
  queueReleaseNoteEmails,
  sendTestReleaseNoteEmail,
  takePendingUnsubscribeToken,
  updateReleaseNote
} from './releaseNotes';
import { processReleaseNoteMailBatch } from './releaseNoteMailer';

process.env.MAIL_DISABLED = '1';

const PID = process.pid;
const TEST_PREFIX = `zz-rn-${PID}`;
const ACTIVE_TENANT = `${TEST_PREFIX}-t-active`;
const SUSPENDED_TENANT = `${TEST_PREFIX}-t-susp`;
const PU = { id: `${TEST_PREFIX}-pu`, username: `${TEST_PREFIX}-admin` };
const createdReleaseIds = new Set<string>();
const createdUserIds = new Set<string>();

function fakeReq(method: string, url: string, body?: unknown): IncomingMessage {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []) as any;
  req.method = method;
  req.url = url;
  req.headers = { 'content-type': 'application/json', ...(raw ? { 'content-length': String(raw.length) } : {}) };
  return req as IncomingMessage;
}

function fakeRes() {
  let body = '';
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = String(v);
    },
    end(chunk?: string) {
      if (chunk) body += chunk;
    }
  };
  return {
    res: res as ServerResponse,
    getStatus: () => res.statusCode as number,
    getBody: () => body,
    getJson: () => JSON.parse(body || '{}')
  };
}

describe('parseReleaseNoteItems', () => {
  it('valideerib kehtivad punktid ja lükkab vigased tagasi', () => {
    const items = parseReleaseNoteItems([
      { category: 'feature', area: ' Ladu ', text: ' Uus koguväärtus ' },
      { category: 'FIX', text: 'Parandus' }
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ category: 'FEATURE', area: 'Ladu', text: 'Uus koguväärtus' });
    expect(items[1]).toMatchObject({ category: 'FIX', text: 'Parandus' });

    expect(() => parseReleaseNoteItems('ei ole massiiv')).toThrow(ReleaseNoteError);
    expect(() => parseReleaseNoteItems([{ category: 'INVALID', text: 'x' }])).toThrow(ReleaseNoteError);
    expect(() => parseReleaseNoteItems([{ category: 'FIX', text: '   ' }])).toThrow(ReleaseNoteError);
  });
});

describe('releaseNotes DB voog', () => {
  let adminUserId = '';
  let regularUserId = '';
  let optOutUserId = '';
  let suspendedUserId = '';

  beforeAll(async () => {
    await authDb().platformUser.upsert({
      where: { id: PU.id },
      update: {},
      create: { id: PU.id, username: PU.username, passwordHash: 'x', totpSecretEnc: 'x' }
    });
    await authDb().tenant.upsert({
      where: { id: ACTIVE_TENANT },
      update: { status: 'ACTIVE' },
      create: { id: ACTIVE_TENANT, name: 'Test Active OÜ', status: 'ACTIVE' }
    });
    await authDb().tenant.upsert({
      where: { id: SUSPENDED_TENANT },
      update: { status: 'SUSPENDED' },
      create: { id: SUSPENDED_TENANT, name: 'Test Suspended OÜ', status: 'SUSPENDED' }
    });

    const mkUser = async (suffix: string, data: { tenantId: string; isAdmin?: boolean; receiveReleaseNotes?: boolean; email?: string | null }) => {
      const u = await authDb().user.create({
        data: {
          username: `${TEST_PREFIX}-${suffix}`,
          passwordHash: 'x',
          displayName: `Test ${suffix}`,
          email: data.email === undefined ? `${TEST_PREFIX}-${suffix}@example.com` : data.email,
          tenantId: data.tenantId,
          isAdmin: data.isAdmin ?? false,
          isActive: true,
          receiveReleaseNotes: data.receiveReleaseNotes ?? true
        }
      });
      createdUserIds.add(u.id);
      return u.id;
    };

    adminUserId = await mkUser('adm', { tenantId: ACTIVE_TENANT, isAdmin: true });
    regularUserId = await mkUser('usr', { tenantId: ACTIVE_TENANT, isAdmin: false });
    optOutUserId = await mkUser('optout', { tenantId: ACTIVE_TENANT, receiveReleaseNotes: false });
    suspendedUserId = await mkUser('susp', { tenantId: SUSPENDED_TENANT, isAdmin: true });
  });

  afterAll(async () => {
    if (createdReleaseIds.size) {
      await authDb().releaseNote.deleteMany({ where: { id: { in: [...createdReleaseIds] } } });
    }
    await authDb().platformAuditLog.deleteMany({ where: { platformUserId: PU.id } });
    if (createdUserIds.size) {
      await authDb().user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    }
    await authDb().tenant.deleteMany({ where: { id: { in: [ACTIVE_TENANT, SUSPENDED_TENANT] } } });
    await authDb().platformUser.deleteMany({ where: { id: PU.id } });
  });

  it('loob, muudab ja kustutab mustandi', async () => {
    const draft = await createReleaseNote(
      {
        version: `2099.01.${PID % 99}`,
        title: 'Mustandi test',
        summary: 'Esialgne',
        items: [{ category: 'FEATURE', area: 'Ladu', text: 'Esimene punkt' }]
      },
      PU
    );
    createdReleaseIds.add(draft.id);
    expect(draft.status).toBe('DRAFT');

    const updated = await updateReleaseNote(draft.id, { title: 'Uuendatud pealkiri' }, PU);
    expect(updated.title).toBe('Uuendatud pealkiri');

    await deleteReleaseNote(draft.id, PU);
    createdReleaseIds.delete(draft.id);
    await expect(getPlatformReleaseNote(draft.id)).rejects.toThrow(ReleaseNoteError);
  });

  it('avaldab, filtreerib sihtrühma, saadab taustal kirjad ja toetab kliendi API-t + loobumislinki', async () => {
    const draft = await createReleaseNote(
      {
        version: `2099.02.${PID % 99}`,
        title: 'Avaldatav versioon',
        summary: 'Kokkuvõte',
        items: [
          { category: 'FEATURE', area: 'Ladu', text: 'Koguväärtus artiklite vaates' },
          { category: 'FIX', text: 'Parandatud filtri viga' }
        ]
      },
      PU
    );
    createdReleaseIds.add(draft.id);

    // Testkiri töötab ka mustandil (MAIL_DISABLED=1)
    const testRes = await sendTestReleaseNoteEmail(draft.id, 'test@example.com', PU);
    expect(testRes).toEqual({ sent: true, to: 'test@example.com' });

    // Avaldame ainult adminitele
    const pub = await publishReleaseNote(draft.id, { sendEmail: true, audience: 'TENANT_ADMINS' }, PU);
    expect(pub.row.status).toBe('PUBLISHED');
    // Meie test-kasutajatest läheb järjekorda adminUserId (mitte regularUserId, optOutUserId ega suspendedUserId)
    const deliveries1 = await authDb().releaseNoteDelivery.findMany({
      where: { releaseNoteId: draft.id, userId: { in: [adminUserId, regularUserId, optOutUserId, suspendedUserId] } }
    });
    expect(deliveries1.map((d) => d.userId)).toEqual([adminUserId]);

    // Avaldatud kirjet ei saa kustutada
    await expect(deleteReleaseNote(draft.id, PU)).rejects.toThrow(ReleaseNoteError);

    // Lisame ülejäänud aktiivsed kasutajad (ALL_ACTIVE_USERS) — admin ei dubleeru, optOut ja suspended ei lisandu
    await queueReleaseNoteEmails(draft.id, 'ALL_ACTIVE_USERS', PU);
    const deliveries2 = await authDb().releaseNoteDelivery.findMany({
      where: { releaseNoteId: draft.id, userId: { in: [adminUserId, regularUserId, optOutUserId, suspendedUserId] } }
    });
    expect(deliveries2.map((d) => d.userId).sort()).toEqual([adminUserId, regularUserId].sort());

    // Võtame regularUserId toor-tokeni enne saatmist, et testida unsubscribe endpointi
    const regDelivery = deliveries2.find((d) => d.userId === regularUserId)!;
    const rawUnsubToken = takePendingUnsubscribeToken(regDelivery.id);
    expect(rawUnsubToken).toBeTruthy();
    // Paneme räsi kooskõlla (kuna takePending eemaldas mälust, aga saame testida otse)
    expect(regDelivery.unsubscribeTokenHash).toBe(hashToken(rawUnsubToken!));

    // Taustasaatja saadab PENDING read (MAIL_DISABLED=1)
    await processReleaseNoteMailBatch({ delayMs: 0 });
    const afterSend = await authDb().releaseNoteDelivery.findUnique({ where: { id: deliveries1[0].id } });
    expect(afterSend?.status).toBe('SENT');
    expect(afterSend?.sentAt).not.toBeNull();

    // Kliendi API: GET /api/release-notes näitab lugemata
    const sessionUser: any = {
      id: regularUserId,
      username: `${TEST_PREFIX}-usr`,
      displayName: 'Test usr',
      passwordHash: 'x',
      isActive: true,
      isAdmin: false,
      isFinanceManager: false,
      mustChangePassword: false,
      tenantId: ACTIVE_TENANT
    };

    const r1 = fakeRes();
    await handleReleaseNotesApi(fakeReq('GET', '/api/release-notes'), r1.res, '/api/release-notes', 'GET', sessionUser);
    expect(r1.getStatus()).toBe(200);
    expect(r1.getJson().hasUnread).toBe(true);
    expect(r1.getJson().receiveReleaseNotes).toBe(true);

    // POST /api/release-notes/seen kaotab lugemata märguande
    const r2 = fakeRes();
    await handleReleaseNotesApi(fakeReq('POST', '/api/release-notes/seen', {}), r2.res, '/api/release-notes/seen', 'POST', sessionUser);
    expect(r2.getStatus()).toBe(200);

    const r3 = fakeRes();
    await handleReleaseNotesApi(fakeReq('GET', '/api/release-notes'), r3.res, '/api/release-notes', 'GET', sessionUser);
    expect(r3.getJson().hasUnread).toBe(false);

    // Avalik unsubscribe link keelab e-kirjad
    // Kuna processReleaseNoteMailBatch võis regularUserId jaoks värske tokeni genereerida (sest me võtsime eelmise mälust),
    // loeme värske räsi jaoks uue tokeni või uuendame tokenHashi testiks:
    const testToken = `unsub-test-${PID}`;
    await authDb().releaseNoteDelivery.update({
      where: { id: regDelivery.id },
      data: { unsubscribeTokenHash: hashToken(testToken) }
    });
    const r4 = fakeRes();
    const unsubUrl = new URL(`https://teris.ee/api/release-notes/unsubscribe?token=${testToken}`);
    await handleReleaseNoteUnsubscribe(r4.res, '/api/release-notes/unsubscribe', 'GET', unsubUrl);
    expect(r4.getStatus()).toBe(200);
    expect(r4.getBody()).toContain('Uuenduste e-kirjadest loobutud');

    const regAfterUnsub = await authDb().user.findUnique({ where: { id: regularUserId }, select: { receiveReleaseNotes: true } });
    expect(regAfterUnsub?.receiveReleaseNotes).toBe(false);

    // PATCH /api/release-notes/preferences lubab uuesti sisse lülitada
    const r5 = fakeRes();
    await handleReleaseNotesApi(
      fakeReq('PATCH', '/api/release-notes/preferences', { receiveReleaseNotes: true }),
      r5.res,
      '/api/release-notes/preferences',
      'PATCH',
      sessionUser
    );
    expect(r5.getStatus()).toBe(200);
    expect(r5.getJson().receiveReleaseNotes).toBe(true);
  });
});
