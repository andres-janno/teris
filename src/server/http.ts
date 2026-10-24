// src/server/http.ts
import type { IncomingMessage, ServerResponse } from 'http';
import { gzipSync } from 'zlib';

// Alla selle suuruse (baitides) ei tasu vastust pakkida
export const GZIP_MIN_BYTES = 1024;

// Kas JSON-vastus pakitakse gzip-iga: klient lubab gzip-i (q=0 keelab) ja keha on piisavalt suur
export function shouldGzip(acceptEncoding: string | string[] | undefined, byteLength: number): boolean {
  if (byteLength <= GZIP_MIN_BYTES || !acceptEncoding) return false;
  const header = Array.isArray(acceptEncoding) ? acceptEncoding.join(',') : acceptEncoding;
  return header.split(',').some((part) => {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    if (name.trim() !== 'gzip' && name.trim() !== '*') return false;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    return q === undefined || Number(q.slice(2)) > 0;
  });
}

export function json(res: ServerResponse, data: any, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const body = JSON.stringify(data);
  const byteLength = Buffer.byteLength(body, 'utf8');
  // res.req on Node >= 15 olemas; kui päist pole või kodeering on juba määratud, saadame pakkimata
  const acceptEncoding = res.req?.headers?.['accept-encoding'];
  // Suure vastuse sisu sõltub Accept-Encoding päisest — vahemälud peavad seda arvestama
  if (byteLength > GZIP_MIN_BYTES) res.setHeader('Vary', 'Accept-Encoding');
  if (!res.getHeader?.('Content-Encoding') && shouldGzip(acceptEncoding, byteLength)) {
    const gz = gzipSync(body, { level: 6 });
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', gz.length);
    res.end(gz);
    return;
  }
  res.setHeader('Content-Length', byteLength);
  res.end(body);
}

export function parseBody(req: IncomingMessage, maxBytes?: number): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      bytes += chunk.length;
      if (maxBytes !== undefined && bytes > maxBytes) {
        // Ei kutsu req.destroy() — see kustutaks jagatud pistiku ka vastuse (res)
        // alt, nii et helistaja ei saaks enam JSON-veateadet saata. Ülejäänud
        // kehaosad loetakse ja visatakse ära (body ei kasva), pistik jääb kehtima.
        tooLarge = true;
        reject(new Error('Päringu keha on liiga suur'));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) return;
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => {
      if (!tooLarge) reject(err);
    });
  });
}

export function hasRequestBody(req: IncomingMessage): boolean {
  return Number(req.headers['content-length'] || 0) > 0 || Boolean(req.headers['transfer-encoding']);
}
