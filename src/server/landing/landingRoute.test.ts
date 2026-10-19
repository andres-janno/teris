import { describe, it, expect } from 'vitest';
import { decideLandingRoute, needsSessionCheck } from './landingRoute.ts';

describe('decideLandingRoute', () => {
  it('/ sessiooni järgi', () => {
    expect(decideLandingRoute('/', true)).toEqual({ kind: 'file', file: 'index.html', hit: false });
    expect(decideLandingRoute('/', false)).toEqual({ kind: 'file', file: 'landing.html', hit: true });
  });
  it('/login: sessiooniga suunamine, muidu SPA', () => {
    expect(decideLandingRoute('/login', true)).toEqual({ kind: 'redirect', location: '/' });
    expect(decideLandingRoute('/login', false)).toEqual({ kind: 'static' });
  });
  it('avalikud failid logitakse', () => {
    expect(decideLandingRoute('/privacy', true)).toEqual({ kind: 'file', file: 'privacy.html', hit: true });
    for (const f of ['llms.txt', 'robots.txt', 'sitemap.xml']) expect(decideLandingRoute(`/${f}`, false)).toEqual({ kind: 'file', file: f, hit: true });
  });
  it('muu → tavaline staatiline/SPA', () => {
    expect(decideLandingRoute('/support', false)).toEqual({ kind: 'static' });
    expect(decideLandingRoute('/assets/x.js', false)).toEqual({ kind: 'static' });
  });
  it('sessiooni kontroll ainult / ja /login puhul', () => {
    expect(needsSessionCheck('/')).toBe(true);
    expect(needsSessionCheck('/login')).toBe(true);
    expect(needsSessionCheck('/privacy')).toBe(false);
    expect(needsSessionCheck('/assets/x.js')).toBe(false);
  });
});
