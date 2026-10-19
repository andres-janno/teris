// src/server/landing/interest.ts — „Tunnen huvi“ vorm: valideerimine, spämmikaitse, salvestus ja teavitus.
// Kahtlane päring saab sama „Aitäh“ vastuse, et robot ei õpiks reegleid tundma. IP-d ei salvestata.
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from '../db.ts';
import { json, parseBody } from '../http.ts';
import { createLoginLimiter } from '../auth.ts';
import { normalizeEmail, sendMail, MAIL_FROM } from '../mail.ts';
import { requestMeta, referrerHostOf, clip } from './requestMeta.ts';

export const INTEREST_OK_MESSAGE = 'Aitäh! Võtame peagi ühendust.';
const MAX_INTEREST_BYTES = 8 * 1024;
const MIN_ELAPSED_MS = 3000;
const ADMIN_URL = `https://${process.env.PLATFORM_HOST ?? 'admin.teris.ee'}`;
const interestLimiter = createLoginLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

export type InterestData = {
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  areaHa: number | null;
  message: string | null;
  utmSource: string | null;
  referrerHost: string | null;
};

// Pikem kui lubatud → viga (mitte vaikne lõikamine), tühi → null
function optional(v: unknown, max: number): string | null | undefined {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? undefined : s;
}

export function validateInterest(body: any): { ok: true; data: InterestData } | { ok: false; error: string } {
  const name = optional(body?.name, 100);
  if (!name) return { ok: false, error: 'Nimi on kohustuslik (kuni 100 märki)' };
  const email = normalizeEmail(body?.email);
  if (!email) return { ok: false, error: 'Kontrolli e-posti aadressi' };
  const company = optional(body?.company, 100);
  if (company === undefined) return { ok: false, error: 'Ettevõtte nimi on liiga pikk (kuni 100 märki)' };
  const phone = optional(body?.phone, 30);
  if (phone === undefined) return { ok: false, error: 'Telefon on liiga pikk (kuni 30 märki)' };
  const message = optional(body?.message, 2000);
  if (message === undefined) return { ok: false, error: 'Sõnum on liiga pikk (kuni 2000 märki)' };
  const areaRaw = optional(body?.areaHa, 12);
  let areaHa: number | null = null;
  if (areaRaw !== null) {
    areaHa = areaRaw === undefined ? NaN : Number(String(areaRaw).replace(',', '.').replace(/\s/g, ''));
    if (!Number.isFinite(areaHa) || areaHa < 0 || areaHa > 100_000) return { ok: false, error: 'Põllupind peab olema 0–100 000 ha' };
  }
  return {
    ok: true,
    data: {
      name, email, company, phone, areaHa, message,
      utmSource: clip(body?.utmSource, 100),
      referrerHost: referrerHostOf(typeof body?.referrer === 'string' ? body.referrer : null)
    }
  };
}

export function isSuspicious(body: any): boolean {
  if (typeof body?.website === 'string' && body.website.trim() !== '') return true;
  const elapsed = body?.elapsedMs;
  return typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < MIN_ELAPSED_MS;
}

const encodeHeader = (text: string) => `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
const headerSafe = (v: string) => {
  if (/[\r\n]/.test(v)) throw new Error('Päise väärtus sisaldab reavahetust');
  return v;
};

export function buildInterestMail(d: InterestData, o: { to: string; from: string; adminUrl: string }): string {
  const lines = [
    'Landing-lehelt tuli uus huvi:',
    '',
    `Nimi: ${d.name}`,
    `E-post: ${d.email}`,
    `Ettevõte: ${d.company ?? '–'}`,
    `Telefon: ${d.phone ?? '–'}`,
    `Põllupind: ${d.areaHa != null ? `${d.areaHa} ha` : '–'}`,
    `Allikas: ${d.utmSource ?? d.referrerHost ?? 'otse'}`,
    '',
    d.message ?? '',
    '',
    `Halda: ${o.adminUrl} → Huvilised`
  ];
  const headers = [
    `From: TERIS <${headerSafe(o.from)}>`,
    `To: ${headerSafe(o.to)}`,
    `Subject: ${encodeHeader(`Teris: uus huviline — ${d.name}`)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit'
  ];
  return `${headers.join('\n')}\n\n${lines.join('\n')}\n`;
}

export async function handleInterest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { send?: (msg: string, to: string) => Promise<void>; notifyTo?: string | undefined } = {}
): Promise<void> {
  const send = deps.send ?? sendMail;
  const notifyTo = 'notifyTo' in deps ? deps.notifyTo : process.env.LANDING_NOTIFY_EMAIL;
  let body: any;
  try {
    body = await parseBody(req, MAX_INTEREST_BYTES);
  } catch {
    return json(res, { error: 'Vigane päring' }, 400);
  }

  const key = `interest:${requestMeta(req).ip}`;
  if (interestLimiter.isBlocked(key) || isSuspicious(body)) return json(res, { message: INTEREST_OK_MESSAGE });
  const v = validateInterest(body);
  if (!v.ok) return json(res, { error: v.error }, 400);
  interestLimiter.registerFailure(key); // loendur, mitte viga

  try {
    await authDb().interestRequest.create({ data: v.data });
  } catch (err) {
    console.error('[landing] huvilise salvestamine ebaõnnestus', err);
    return json(res, { error: 'Saatmine ebaõnnestus, proovi hiljem uuesti' }, 500);
  }

  if (!notifyTo) {
    console.warn('[landing] LANDING_NOTIFY_EMAIL puudub — teavituskirja ei saadetud');
  } else {
    try {
      await send(buildInterestMail(v.data, { to: notifyTo, from: MAIL_FROM, adminUrl: ADMIN_URL }), notifyTo);
    } catch (err) {
      console.error('[landing] teavituskirja saatmine ebaõnnestus', err);
    }
  }
  json(res, { message: INTEREST_OK_MESSAGE });
}
