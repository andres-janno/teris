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

export async function serveStatic(req: IncomingMessage, res: ServerResponse, distDir: string): Promise<void> {
  const method = req.method?.toUpperCase() || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.end();
    return;
  }

  const target = resolveStaticPath(distDir, req.url || '/');
  if (!target) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  let file = target;
  if (!(await isFile(file))) {
    const rel = path.relative(path.resolve(distDir), target).split(path.sep).join('/');
    // Puuduv räsiga fail on päris 404; muu tee → SPA index.html.
    if (rel.startsWith('assets/')) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    file = path.join(distDir, 'index.html');
  }

  const body = await readFile(file);
  const rel = path.relative(path.resolve(distDir), file).split(path.sep).join('/');
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControlFor(rel));
  res.setHeader('Content-Length', body.length);
  res.end(method === 'HEAD' ? undefined : body);
}
