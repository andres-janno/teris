// src/server/landing/landingRoute.ts — avalikud teed: kas serveerida rakendus, landing või suunata.
export type LandingDecision = { kind: 'static' } | { kind: 'file'; file: string; hit: boolean } | { kind: 'redirect'; location: string };

const MACHINE_FILES = ['llms.txt', 'robots.txt', 'sitemap.xml'];
// Neid faile ei serveerita otse oma nime all (ainult decideLandingRoute kaudu); platvormi hostil üldse mitte.
export const PUBLIC_ONLY_FILES = ['landing.html', 'privacy.html', ...MACHINE_FILES];

export const needsSessionCheck = (pathname: string): boolean => pathname === '/' || pathname === '/login';

export function decideLandingRoute(pathname: string, hasSession: boolean): LandingDecision {
  if (pathname === '/') return hasSession ? { kind: 'file', file: 'index.html', hit: false } : { kind: 'file', file: 'landing.html', hit: true };
  if (pathname === '/login') return hasSession ? { kind: 'redirect', location: '/' } : { kind: 'static' };
  if (pathname === '/privacy') return { kind: 'file', file: 'privacy.html', hit: true };
  const name = pathname.slice(1);
  if (MACHINE_FILES.includes(name)) return { kind: 'file', file: name, hit: true };
  return { kind: 'static' };
}
