// src/server/secretBox.ts — saladuste krüpteerimine andmebaasis hoidmiseks (AES-256-GCM).
// Vorming: iv.tag.ciphertext (base64url). Võti on 32 baiti (64 hex-märki), eraldi võti iga kasutuse kohta (nt SECRETS_KEY).
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

function keyOf(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32 || keyHex.length !== 64) throw new Error('Krüpteerimisvõti peab olema 32 baiti (64 hex-märki)');
  return key;
}

export function encryptSecret(plain: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(keyHex), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}

export function decryptSecret(enc: string, keyHex: string): string {
  const parts = enc.split('.');
  if (parts.length !== 3) throw new Error('Vigane krüpteeritud saladus');
  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, 'base64url'));
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Vigane krüpteeritud saladus');
  const decipher = createDecipheriv('aes-256-gcm', keyOf(keyHex), iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
