// src/server/http.ts
import type { IncomingMessage, ServerResponse } from 'http';

export function json(res: ServerResponse, data: any, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
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
    req.on('error', reject);
  });
}

export function hasRequestBody(req: IncomingMessage): boolean {
  return Number(req.headers['content-length'] || 0) > 0 || Boolean(req.headers['transfer-encoding']);
}
