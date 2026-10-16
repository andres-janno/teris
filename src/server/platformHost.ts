// src/server/platformHost.ts — kas päring on teenusepakkuja keskkonda (admin.teris.ee)
import type { IncomingMessage } from 'http';

export function isPlatformHost(req: IncomingMessage): boolean {
  const host = String(req.headers.host ?? '').toLowerCase().replace(/:\d+$/, '');
  return host === (process.env.PLATFORM_HOST ?? 'admin.teris.ee').toLowerCase();
}
