// src/server/http.ts
import type { IncomingMessage, ServerResponse } from 'http';

export function json(res: ServerResponse, data: any, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
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
