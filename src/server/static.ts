// src/server/static.ts — dist/ failide serveerimine toodanguserveris.
import type { IncomingMessage, ServerResponse } from 'http';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

export function resolveStaticPath(distDir: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const root = path.resolve(distDir);
  const target = path.resolve(root, '.' + (decoded.startsWith('/') ? decoded : `/${decoded}`));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

export function cacheControlFor(relPath: string): string {
  return relPath.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

export interface StaticOptions {
  /** SPA tagavarafail (vaikimisi index.html). */
  spaEntry?: string;
  /** Failid (distDir-i suhtes), mida otse ei serveerita (404) ega SPA-tagavarana ei kasutata. */
  blocked?: string[];
}

export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  distDir: string,
  options: StaticOptions = {}
): Promise<void> {
  const method = req.method?.toUpperCase() || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.end();
    return;
  }

  const spaEntry = options.spaEntry ?? 'index.html';
  const blocked = new Set((options.blocked ?? []).map((n) => n.toLowerCase()));

  const target = resolveStaticPath(distDir, req.url || '/');
  if (!target) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const targetRel = path.relative(path.resolve(distDir), target).split(path.sep).join('/');
  if (blocked.has(targetRel.toLowerCase())) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  let file = target;
  if (!(await isFile(file))) {
    // Puuduv räsiga fail on päris 404; muu tee → SPA sisenemispunkt.
    if (targetRel.startsWith('assets/')) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    file = path.join(distDir, spaEntry);
  }

  const body = await readFile(file);
  const rel = path.relative(path.resolve(distDir), file).split(path.sep).join('/');
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControlFor(rel));
  res.setHeader('Content-Length', body.length);
  res.end(method === 'HEAD' ? undefined : body);
}
