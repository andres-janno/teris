import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveStaticPath, cacheControlFor } from './static';

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
