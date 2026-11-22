// Kasutajajuhendid: päris andmebaas. Registri võtme olemasolev sisu salvestatakse enne ja taastatakse pärast.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from './db';
import { hashPassword, generateSessionToken, hashToken } from './auth';
import { encryptTotpSecret } from './totp';
import { handlePlatformRequest } from './platformApi';
import { HELP_VERSION_LIMIT, buildHelpPayload, handleHelpRead, isBlankHelp, setGuideLinkIfEmpty, writeHelpIfEmpty, writeHelpVersion } from './helpArticles';
import { HELP_MAX_LENGTH } from '../help/helpRegistry';

const KEY = 'c'.repeat(64);
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const PID = process.pid;
const USERNAME = `zz-help-${PID}`;
const OPTS = { allowedOrigins: [], platformAllowedOrigins: ['https://admin.teris.ee'] } as any;
const SPOT = 'fields.register.export-csv';
const ORPHAN = `zz-orphan-${PID}`;
const VERSION_KEY = `zz-versions-${PID}`;
const LOADER_KEY = `zz-loader-${PID}`;
const LOADER_AUTHOR = `zz-author-${PID}`;
let platformUserId = '';
let cookie = '';
let original: { html: string; updatedBy: string | null } | null = null;

function fakeRes() {
  const out = { status: 0, body: '', headers: {} as Record<string, string | string[]> };
  const res = {
    statusCode: 200,
    setHeader(k: string, v: string | string[]) { out.headers[k.toLowerCase()] = v; },
    appendHeader() {},
    writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; if (!out.status) out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  return { res, out };
}

async function call(method: string, path: string, body?: unknown) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []) as any;
  req.method = method;
  req.url = path;
  req.headers = {
    host: 'admin.teris.ee',
    origin: 'https://admin.teris.ee',
    'content-type': 'application/json',
    ...(raw ? { 'content-length': String(Buffer.byteLength(raw)) } : {}),
    cookie
  };
  req.socket = { remoteAddress: '127.0.0.9' };
  const { res, out } = fakeRes();
  await handlePlatformRequest(req as IncomingMessage, res, path, method, new URL(`http://x${path}`), OPTS);
  return { status: out.status, data: out.body ? JSON.parse(out.body) : null };
}

async function readTenantPayload() {
  const { res, out } = fakeRes();
  expect(await handleHelpRead(res, '/api/help', 'GET')).toBe(true);
  return JSON.parse(out.body) as { articles: Record<string, string>; chapters: Record<string, string>; guideLinks: Record<string, string> };
}

async function readTenantHelp() {
  return (await readTenantPayload()).articles;
}

const mineCount = async () => ((await call('GET', `/api/platform/help/${SPOT}/versions`)).data as { createdBy: string | null }[]).filter((v) => v.createdBy === USERNAME).length;

beforeAll(async () => {
  process.env.PLATFORM_TOTP_KEY = KEY;
  original = await authDb().helpArticle.findUnique({ where: { key: SPOT }, select: { html: true, updatedBy: true } });
  const u = await authDb().platformUser.create({
    data: { username: USERNAME, passwordHash: await hashPassword('x-parool-12345'), totpSecretEnc: encryptTotpSecret(SECRET, KEY) }
  });
  platformUserId = u.id;
  const token = generateSessionToken();
  await authDb().platformSession.create({ data: { platformUserId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
  cookie = `__Host-teris_platform_session=${token}`;
});

afterAll(async () => {
  const db = authDb();
  if (original) await db.helpArticle.upsert({ where: { key: SPOT }, create: { key: SPOT, ...original }, update: original });
  else await db.helpArticle.deleteMany({ where: { key: SPOT } });
  await db.helpArticle.deleteMany({ where: { key: ORPHAN } });
  await db.helpArticle.deleteMany({ where: { key: { in: [LOADER_KEY, VERSION_KEY] } } });
  await db.helpArticleVersion.deleteMany({ where: { OR: [{ key: { in: [VERSION_KEY, LOADER_KEY] } }, { key: SPOT, createdBy: USERNAME }] } });
  await db.platformAuditLog.deleteMany({ where: { platformUserId } });
  await db.platformSession.deleteMany({ where: { platformUserId } });
  await db.platformUser.deleteMany({ where: { id: platformUserId } });
});

describe('kasutajajuhendid', () => {
  it('tühjaks loetakse ainult siltidest ja tühikutest koosnev tekst', () => {
    expect(isBlankHelp('<p><br></p>')).toBe(true);
    expect(isBlankHelp('<p>&nbsp; </p>')).toBe(true);
    expect(isBlankHelp('<p>Tere</p>')).toBe(false);
  });

  it('salvestamine, lugemine ettevõtte poolelt ja kustutamine tühja tekstiga', async () => {
    const save = await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>Ekspordi <strong>tabel</strong></p>' });
    expect(save.status).toBe(200);
    expect(save.data).toEqual({ success: true, deleted: false });

    const list = await call('GET', '/api/platform/help');
    const row = list.data.find((r: { key: string }) => r.key === SPOT);
    expect(row.html).toBe('<p>Ekspordi <strong>tabel</strong></p>');
    expect(row.updatedBy).toBe(USERNAME);
    expect((await readTenantHelp())[SPOT]).toBe('<p>Ekspordi <strong>tabel</strong></p>');

    const audit = await authDb().platformAuditLog.findFirst({ where: { platformUserId, action: 'HELP_UPDATE' } });
    expect(audit?.details).toEqual({ key: SPOT, op: 'save' });

    const del = await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p><br></p>' });
    expect(del.data).toEqual({ success: true, deleted: true });
    expect(await authDb().helpArticle.findUnique({ where: { key: SPOT } })).toBeNull();
    expect((await readTenantHelp())[SPOT]).toBeUndefined();
  });

  it('registrist puuduv võti: salvestada ei saa, ettevõttele ei näidata, kustutada saab', async () => {
    const bad = await call('PUT', `/api/platform/help/${ORPHAN}`, { html: '<p>x</p>' });
    expect(bad.status).toBe(404);

    await authDb().helpArticle.create({ data: { key: ORPHAN, html: '<p>vana</p>' } });
    expect((await readTenantHelp())[ORPHAN]).toBeUndefined();
    const del = await call('PUT', `/api/platform/help/${ORPHAN}`, { html: '' });
    expect(del.data).toEqual({ success: true, deleted: true });
    expect(await authDb().helpArticle.findUnique({ where: { key: ORPHAN } })).toBeNull();
  });

  it('liiga pikk või puuduv tekst → 400', async () => {
    expect((await call('PUT', `/api/platform/help/${SPOT}`, { html: 'x'.repeat(HELP_MAX_LENGTH + 1) })).status).toBe(400);
    expect((await call('PUT', `/api/platform/help/${SPOT}`, {})).status).toBe(400);
  });
});

describe('peatükid, guide_link ja ettevõtte vaade', () => {
  it('buildHelpPayload jagab read kohtjuhenditeks, peatükkideks ja linkideks', () => {
    const p = buildHelpPayload([
      { key: SPOT, html: '<p>Tekst</p>', guideLink: 'guide.rotation#csv-eksport' },
      { key: 'fields.register.import-pria-zip', html: '<p><br></p>', guideLink: 'guide.fields' },
      { key: 'fields.register.import-field-book', html: '<p>x</p>', guideLink: 'guide.nope' },
      { key: 'guide.fields', html: '<h3>Import</h3>', guideLink: null },
      { key: 'guide.crops', html: '<p> </p>', guideLink: null },
      { key: 'guide.settings', html: '<p>x</p>', guideLink: 'guide.fields' },
      { key: ORPHAN, html: '<p>vana</p>', guideLink: null }
    ]);
    expect(p.articles).toEqual({ [SPOT]: '<p>Tekst</p>', 'fields.register.import-field-book': '<p>x</p>' });
    expect(p.chapters).toEqual({ 'guide.fields': '<h3>Import</h3>', 'guide.settings': '<p>x</p>' });
    // tühja tekstiga kohtjuhendil ja vigasel lingil linki ei anta; peatükil linki ei ole
    expect(p.guideLinks).toEqual({ [SPOT]: 'guide.rotation#csv-eksport' });
  });

  it('PUT guide_link: kehtiv link salvestub ja jõuab ettevõtte vaatesse, vigane → 400', async () => {
    const ok = await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>Link</p>', guideLink: 'guide.rotation#csv-eksport' });
    expect(ok.status).toBe(200);
    expect((await authDb().helpArticle.findUnique({ where: { key: SPOT } }))?.guideLink).toBe('guide.rotation#csv-eksport');
    expect((await readTenantPayload()).guideLinks[SPOT]).toBe('guide.rotation#csv-eksport');
    const list = await call('GET', '/api/platform/help');
    expect(list.data.find((r: { key: string }) => r.key === SPOT).guideLink).toBe('guide.rotation#csv-eksport');

    for (const bad of ['guide.nope', '#guide.rotation', 'https://x', 'guide', 5]) {
      expect((await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>x</p>', guideLink: bad })).status, String(bad)).toBe(400);
    }
    // PUT ilma guideLink-ita eemaldab lingi
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>Link</p>' });
    expect((await authDb().helpArticle.findUnique({ where: { key: SPOT } }))?.guideLink).toBeNull();
  });

  it('peatüki pikkuse piir on 100 000, kohtjuhendil 20 000', async () => {
    const big = await call('PUT', '/api/platform/help/guide.settings', { html: 'x'.repeat(100001) });
    expect(big.status).toBe(400);
    expect(big.data.error).toContain('100000');
    const mid = await call('PUT', `/api/platform/help/${SPOT}`, { html: 'x'.repeat(HELP_MAX_LENGTH + 1) });
    expect(mid.status).toBe(400);
  });

  it('peatükile linki panna ei saa', async () => {
    const r = await call('PUT', '/api/platform/help/guide.settings', { html: '<p>x</p>', guideLink: 'guide.fields' });
    expect(r.status).toBe(400);
    expect(await authDb().helpArticle.findUnique({ where: { key: 'guide.settings' } })).toBeNull();
  });
});

describe('versioonid', () => {
  it(`alles jääb ${HELP_VERSION_LIMIT} viimast versiooni võtme kohta, vanemad kustuvad salvestamisel`, async () => {
    const db = authDb();
    for (let i = 1; i <= HELP_VERSION_LIMIT + 5; i++) {
      await db.$transaction((tx) => writeHelpVersion(tx, VERSION_KEY, `<p>v${i}</p>`, null, 'zz'));
    }
    const rows = await db.helpArticleVersion.findMany({ where: { key: VERSION_KEY }, orderBy: { id: 'asc' } });
    expect(rows).toHaveLength(HELP_VERSION_LIMIT);
    expect(rows[0].html).toBe('<p>v6</p>');
    expect(rows[rows.length - 1].html).toBe(`<p>v${HELP_VERSION_LIMIT + 5}</p>`);
  });

  it('iga salvestus lisab rea, taastamine teeb uue versiooni vana sisuga', async () => {
    const before = await mineCount();
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>v1</p>', guideLink: 'guide.rotation#csv-eksport' });
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>v2</p>' });
    expect(await mineCount()).toBe(before + 2);

    const list = await call('GET', `/api/platform/help/${SPOT}/versions`);
    expect(list.status).toBe(200);
    const mine = list.data.filter((v: { createdBy: string | null }) => v.createdBy === USERNAME) as { id: number }[];
    expect(mine[0].id).toBeGreaterThan(mine[1].id); // uusim ees
    const v1 = mine[1];

    const detail = await call('GET', `/api/platform/help/${SPOT}/versions/${v1.id}`);
    expect(detail.data.html).toBe('<p>v1</p>');
    expect(detail.data.guideLink).toBe('guide.rotation#csv-eksport');

    const restored = await call('POST', `/api/platform/help/${SPOT}/versions/${v1.id}/restore`);
    expect(restored.data).toEqual({ success: true, deleted: false });
    const row = await authDb().helpArticle.findUnique({ where: { key: SPOT } });
    expect(row?.html).toBe('<p>v1</p>');
    expect(row?.guideLink).toBe('guide.rotation#csv-eksport');
    expect(await mineCount()).toBe(before + 3); // taastamine = uus versioon
    expect((await readTenantPayload()).guideLinks[SPOT]).toBe('guide.rotation#csv-eksport');
    const audit = await authDb().platformAuditLog.findFirst({ where: { platformUserId, action: 'HELP_UPDATE' }, orderBy: { createdAt: 'desc' } });
    expect(audit?.details).toEqual({ key: SPOT, op: 'restore' });
  });

  it('tundmatu versioon → 404, teise võtme versiooni ei saa taastada', async () => {
    expect((await call('POST', `/api/platform/help/${SPOT}/versions/999999999/restore`)).status).toBe(404);
    expect((await call('GET', `/api/platform/help/${SPOT}/versions/999999999`)).status).toBe(404);
    const other = await authDb().helpArticleVersion.create({ data: { key: VERSION_KEY, html: '<p>x</p>', createdBy: 'zz' } });
    expect((await call('POST', `/api/platform/help/${SPOT}/versions/${other.id}/restore`)).status).toBe(404);
  });

  it('eemaldamine (tühi tekst) lisab tühja versiooni ja selle saab taastada', async () => {
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>enne</p>' });
    await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p><br></p>' });
    expect(await authDb().helpArticle.findUnique({ where: { key: SPOT } })).toBeNull();
    const versions = (await call('GET', `/api/platform/help/${SPOT}/versions`)).data as { id: number; createdBy: string | null }[];
    const withText = (await Promise.all(versions.filter((v) => v.createdBy === USERNAME).map((v) => call('GET', `/api/platform/help/${SPOT}/versions/${v.id}`)))).find((d) => d.data.html === '<p>enne</p>');
    const r = await call('POST', `/api/platform/help/${SPOT}/versions/${withText!.data.id}/restore`);
    expect(r.data).toEqual({ success: true, deleted: false });
    expect((await authDb().helpArticle.findUnique({ where: { key: SPOT } }))?.html).toBe('<p>enne</p>');
  });
});

describe('writeHelpIfEmpty (mustandite laadimise alus)', () => {
  it('kirjutab tühja kohta ja teeb versioonirea autoriga; olemasolevale teksti ei kirjuta', async () => {
    expect(await writeHelpIfEmpty(LOADER_KEY, '<p>mustand</p>', LOADER_AUTHOR)).toBe(true);
    const row = await authDb().helpArticle.findUnique({ where: { key: LOADER_KEY } });
    expect(row?.html).toBe('<p>mustand</p>');
    expect(row?.updatedBy).toBe(LOADER_AUTHOR);
    const versions = await authDb().helpArticleVersion.findMany({ where: { key: LOADER_KEY } });
    expect(versions).toHaveLength(1);
    expect(versions[0].createdBy).toBe(LOADER_AUTHOR);

    expect(await writeHelpIfEmpty(LOADER_KEY, '<p>teine</p>', LOADER_AUTHOR)).toBe(false);
    expect((await authDb().helpArticle.findUnique({ where: { key: LOADER_KEY } }))?.html).toBe('<p>mustand</p>');
    expect(await authDb().helpArticleVersion.count({ where: { key: LOADER_KEY } })).toBe(1);
  });

  it('nähtava tekstita rida (ainult <p><br></p>) loetakse tühjaks', async () => {
    await authDb().helpArticle.update({ where: { key: LOADER_KEY }, data: { html: '<p><br></p>' } });
    expect(await writeHelpIfEmpty(LOADER_KEY, '<p>uus</p>', LOADER_AUTHOR)).toBe(true);
    expect((await authDb().helpArticle.findUnique({ where: { key: LOADER_KEY } }))?.html).toBe('<p>uus</p>');
  });

  it('seab vaikimisi seotud peatüki ainult tühjale reale; vigane link või peatüki võti viskab', async () => {
    const key = `${LOADER_KEY}-link`;
    try {
      expect(await writeHelpIfEmpty(key, '<p>a</p>', LOADER_AUTHOR, 'guide.fields')).toBe(true);
      expect((await authDb().helpArticle.findUnique({ where: { key } }))?.guideLink).toBe('guide.fields');
      expect(await writeHelpIfEmpty(key, '<p>b</p>', LOADER_AUTHOR, 'guide.crops')).toBe(false); // olemasolevat ei puudutata
      expect((await authDb().helpArticle.findUnique({ where: { key } }))?.guideLink).toBe('guide.fields');
      await expect(writeHelpIfEmpty(`${key}-x`, '<p>x</p>', LOADER_AUTHOR, 'guide.nope')).rejects.toThrow();
      await expect(writeHelpIfEmpty('guide.settings', '<p>x</p>', LOADER_AUTHOR, 'guide.fields')).rejects.toThrow();
      expect(await authDb().helpArticle.findUnique({ where: { key: 'guide.settings' } })).toBeNull();
    } finally {
      await authDb().helpArticle.deleteMany({ where: { key: { startsWith: `${LOADER_KEY}-` } } });
      await authDb().helpArticleVersion.deleteMany({ where: { key: { startsWith: `${LOADER_KEY}-` } } });
    }
  });
});

describe('setGuideLinkIfEmpty (olemasoleva kohtjuhendi link)', () => {
  const key = `${LOADER_KEY}-setlink`;
  afterAll(async () => {
    await authDb().helpArticle.deleteMany({ where: { key } });
    await authDb().helpArticleVersion.deleteMany({ where: { key } });
  });

  it('paneb lingi ainult kui tekst on olemas ja link tühi; teksti ei muuda, autor jääb', async () => {
    expect(await setGuideLinkIfEmpty(key, 'guide.fields', LOADER_AUTHOR)).toBe(false); // rida puudub
    await authDb().helpArticle.create({ data: { key, html: '<p>kasutaja tekst</p>', updatedBy: 'kasutaja' } });
    expect(await setGuideLinkIfEmpty(key, 'guide.fields', LOADER_AUTHOR)).toBe(true);
    const row = await authDb().helpArticle.findUnique({ where: { key } });
    expect(row?.html).toBe('<p>kasutaja tekst</p>');
    expect(row?.guideLink).toBe('guide.fields');
    expect(row?.updatedBy).toBe('kasutaja');
    const versions = await authDb().helpArticleVersion.findMany({ where: { key } });
    expect(versions).toHaveLength(1);
    expect(versions[0].createdBy).toBe(LOADER_AUTHOR);
    expect(versions[0].html).toBe('<p>kasutaja tekst</p>');

    expect(await setGuideLinkIfEmpty(key, 'guide.crops', LOADER_AUTHOR)).toBe(false); // olemasolev link jääb
    expect((await authDb().helpArticle.findUnique({ where: { key } }))?.guideLink).toBe('guide.fields');
    await expect(setGuideLinkIfEmpty(key, 'guide.nope', LOADER_AUTHOR)).rejects.toThrow();
  });

  it('tühja tekstiga real linki ei panda', async () => {
    await authDb().helpArticle.update({ where: { key }, data: { html: '<p><br></p>', guideLink: null } });
    expect(await setGuideLinkIfEmpty(key, 'guide.fields', LOADER_AUTHOR)).toBe(false);
  });
});
