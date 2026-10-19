// landing'u päringu metaandmed (IP ainult räsi jaoks, mitte salvestamiseks).
import type { IncomingMessage } from 'http';
import { clientIpFrom } from '../auth.ts';

export const OWN_HOSTS = ['teris.ee', 'admin.teris.ee', 'localhost', '127.0.0.1'];

export function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s || null;
}

export function referrerHostOf(raw: string | null | undefined, ownHosts: string[] = OWN_HOSTS): string | null {
  if (!raw) return null;
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  return !host || ownHosts.includes(host) ? null : host.slice(0, 100);
}

export function requestMeta(req: IncomingMessage) {
  const url = new URL(req.url || '/', 'http://localhost');
  const referer = req.headers.referer;
  return {
    ip: clientIpFrom(req.headers['x-forwarded-for'], req.socket?.remoteAddress),
    ua: String(req.headers['user-agent'] ?? '').slice(0, 512),
    referrerHost: referrerHostOf(typeof referer === 'string' ? referer : null),
    utmSource: clip(url.searchParams.get('utm_source'), 100),
    utmMedium: clip(url.searchParams.get('utm_medium'), 100),
    utmCampaign: clip(url.searchParams.get('utm_campaign'), 100)
  };
}
