// unikaalsete külastajate loendamine ilma IP-d salvestamata.
// Sool on ainult mälus ja vahetub Tallinna kesköö ületamisel: eri päevade külastusi ei saa siduda.
import { createHash, randomBytes } from 'node:crypto';
import { tallinnToday } from '../license.ts';

export function createVisitorHasher(now: () => Date = () => new Date(), random: () => Buffer = () => randomBytes(32)) {
  let day = '';
  let salt: Buffer = Buffer.alloc(0);
  return (ip: string, ua: string): string => {
    const today = tallinnToday(now());
    if (today !== day) {
      day = today;
      salt = random();
    }
    return createHash('sha256').update(salt).update(ip).update('\n').update(ua).digest('hex').slice(0, 16);
  };
}

const shared = createVisitorHasher();
export const visitorHashOf = (ip: string, ua: string): string => shared(ip, ua);
