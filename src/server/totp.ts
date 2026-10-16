// src/server/totp.ts — TOTP (RFC 6238: SHA-1, 6 numbrit, 30 s) teenusepakkuja sisselogimiseks.
import { createHmac, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Vigane base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateTotpSecret = (): string => base32Encode(randomBytes(20));
export const totpStep = (now: Date): number => Math.floor(now.getTime() / 1000 / STEP_SECONDS);

export function totpCode(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** Aktsepteeritud samm või null. Sammud <= lastStep on juba kasutatud (korduskasutuse vastu). */
export function verifyTotp(secretBase32: string, code: string, now: Date, lastStep: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = totpStep(now);
  for (let s = current - WINDOW; s <= current + WINDOW; s++) {
    if (s <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secretBase32, s)), Buffer.from(code))) return s;
  }
  return null;
}

export function otpauthUri(account: string, secretBase32: string): string {
  return `otpauth://totp/Teris:${encodeURIComponent(account)}?secret=${secretBase32}&issuer=Teris&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

function keyOf(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('PLATFORM_TOTP_KEY peab olema 32 baiti (64 hex-märki)');
  return key;
}

export function encryptTotpSecret(secret: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(keyHex), iv);
  const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}

export function decryptTotpSecret(enc: string, keyHex: string): string {
  const [iv, tag, ct] = enc.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', keyOf(keyHex), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
