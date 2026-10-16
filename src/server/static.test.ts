import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'http';
import { resolveStaticPath, cacheControlFor, serveStatic } from './static';

const DIST = path.resolve('/srv/app/dist');

describe('resolveStaticPath', () => {
  it('lahendab tavalise faili', () => {
    expect(resolveStaticPath(DIST, '/assets/index-abc.js')).toBe(path.join(DIST, 'assets/index-abc.js'));
    expect(resolveStaticPath(DIST, '/favicon.svg?v=2')).toBe(path.join(DIST, 'favicon.svg'));
    expect(resolveStaticPath(DIST, '/')).toBe(DIST);
  });
  it('keelab kataloogist väljumise', () => {
    expect(resolveStaticPath(DIST, '/../.env')).toBeNull();
    expect(resolveStaticPath(DIST, '/..%2f.env')).toBeNull();
    expect(resolveStaticPath(DIST, '/assets/../../.env')).toBeNull();
    expect(resolveStaticPath(DIST, '/%E0%A4%A')).toBeNull();
  });
});

describe('cacheControlFor', () => {
  it('räsiga failid pikalt vahemällu, muu no-cache', () => {
    expect(cacheControlFor('assets/index-abc.js')).toBe('public, max-age=31536000, immutable');
    expect(cacheControlFor('index.html')).toBe('no-cache');
    expect(cacheControlFor('favicon.svg')).toBe('no-cache');
  });
});

describe('serveStatic hosti järgi', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'teris-static-'));
    await writeFile(path.join(dir, 'index.html'), 'TENANT-APP');
    await writeFile(path.join(dir, 'admin.html'), 'ADMIN-APP');
    await mkdir(path.join(dir, 'assets'));
    await writeFile(path.join(dir, 'assets', 'app-abc.js'), 'console.log(1)');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function fakeReq(url: string, host: string): IncomingMessage {
    return { method: 'GET', url, headers: { host } } as unknown as IncomingMessage;
  }

  function fakeRes() {
    const out: { status: number; body: string } = { status: 0, body: '' };
    const res = {
      statusCode: 200,
      setHeader() {},
      end(chunk?: Buffer | string) {
        out.status = res.statusCode;
        out.body = chunk === undefined ? '' : chunk.toString();
      }
    };
    return { res: res as unknown as ServerResponse, out };
  }

  const PLATFORM = { spaEntry: 'admin.html', blocked: ['index.html'] };
  const TENANT = { spaEntry: 'index.html', blocked: ['admin.html'] };

  async function get(url: string, host: string, opts: { spaEntry: string; blocked: string[] }) {
    const { res, out } = fakeRes();
    await serveStatic(fakeReq(url, host), res, dir, opts);
    return out;
  }

  it('platvormi host: / ja SPA-teed → admin.html', async () => {
    expect(await get('/', 'admin.teris.ee', PLATFORM)).toEqual({ status: 200, body: 'ADMIN-APP' });
    expect(await get('/ettevotted', 'admin.teris.ee', PLATFORM)).toEqual({ status: 200, body: 'ADMIN-APP' });
  });

  it('platvormi host: /index.html ja /index.html/ → 404 (ettevõtte rakendust ei serveerita)', async () => {
    expect((await get('/index.html', 'admin.teris.ee', PLATFORM)).status).toBe(404);
    expect((await get('/index.html/', 'admin.teris.ee', PLATFORM)).status).toBe(404);
    expect((await get('/index.html', 'admin.teris.ee', PLATFORM)).body).not.toContain('TENANT-APP');
  });

  it('tavaline host: / ja SPA-teed → index.html', async () => {
    expect(await get('/', 'teris.ee', TENANT)).toEqual({ status: 200, body: 'TENANT-APP' });
    expect(await get('/anything/here', 'teris.ee', TENANT)).toEqual({ status: 200, body: 'TENANT-APP' });
  });

  it('tavaline host: /admin.html → 404', async () => {
    expect((await get('/admin.html', 'teris.ee', TENANT)).status).toBe(404);
  });

  it('assetid on mõlemal hostil lubatud', async () => {
    expect((await get('/assets/app-abc.js', 'admin.teris.ee', PLATFORM)).status).toBe(200);
    expect((await get('/assets/app-abc.js', 'teris.ee', TENANT)).status).toBe(200);
  });
});
