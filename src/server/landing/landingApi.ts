// src/server/landing/landingApi.ts — avalikud /api/landing/* otspunktid (sessiooni ei nõua, Origin kontrollitakse).
import type { IncomingMessage, ServerResponse } from 'http';
import { json, hasRequestBody } from '../http.ts';
import { checkMutationRequest } from '../auth.ts';
import { handleLandingEvent } from './landingEvents.ts';
import { handleInterest } from './interest.ts';

export async function handleLandingApi(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, allowedOrigins: string[]): Promise<boolean> {
  if (pathname !== '/api/landing/event' && pathname !== '/api/landing/interest') return false;
  if (method !== 'POST') {
    json(res, { error: 'Not found' }, 404);
    return true;
  }
  const csrf = checkMutationRequest(
    {
      method,
      origin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      contentType: typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : undefined,
      hasBody: hasRequestBody(req)
    },
    allowedOrigins
  );
  if (csrf !== 'ok') {
    json(res, { error: 'Keelatud päring' }, 403);
    return true;
  }
  if (pathname === '/api/landing/event') await handleLandingEvent(req, res);
  else await handleInterest(req, res);
  return true;
}
