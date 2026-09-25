// src/server/auth.ts
// Autentimise puhtad funktsioonid (ilma andmebaasita, testitavad).
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const SESSION_COOKIE = 'agro_session';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  if (expected.length === 0 || !saltB64) return false;
  try {
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p)
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

export function validateNewPassword(password: string): string | null {
  return password.length >= 10 ? null : 'Parool peab olema vähemalt 10 märki';
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // vigase kodeeringuga küpsis jäetakse vahele
    }
  }
  return out;
}

export function sessionCookie(token: string, maxAgeSec: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(maxAgeSec)}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function createLoginLimiter(opts: { max: number; windowMs: number }, now: () => number = () => Date.now()) {
  const failures = new Map<string, number[]>();
  const recent = (key: string) => (failures.get(key) ?? []).filter((t) => now() - t < opts.windowMs);
  return {
    isBlocked(key: string): boolean {
      const list = recent(key);
      failures.set(key, list);
      return list.length >= opts.max;
    },
    registerFailure(key: string): void {
      const list = recent(key);
      list.push(now());
      failures.set(key, list);
    },
    reset(key: string): void {
      failures.delete(key);
    }
  };
}

export function checkMutationRequest(
  r: { method: string; origin?: string; contentType?: string; hasBody: boolean },
  allowedOrigins: string[]
): 'ok' | 'bad-origin' | 'bad-content-type' {
  const method = r.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'ok';
  if (!r.origin || !allowedOrigins.includes(r.origin)) return 'bad-origin';
  if (r.hasBody && !(r.contentType ?? '').toLowerCase().startsWith('application/json')) return 'bad-content-type';
  return 'ok';
}
