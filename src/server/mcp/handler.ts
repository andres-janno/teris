// src/server/mcp/handler.ts — /mcp/<võti> (või /mcp + Authorization: Bearer <võti>).
// Võti → kasutaja ja ettevõte; päring käib ettevõtte kontekstis; olekuta Streamable HTTP, JSON-vastused.
// URL sisaldab võtit: seda ei logita (ka mitte vealogis).
import type { IncomingMessage, ServerResponse } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authDb, runInRequestContext, setRequestUser } from '../db.ts';
import { json, parseBody } from '../http.ts';
import { createLoginLimiter, clientIpFrom } from '../auth.ts';
import { loadLicenseState } from '../license.ts';
import { findActiveApiKey, touchApiKey, INVALID_KEY_MESSAGE } from '../apiKeys.ts';
import { createMcpServer } from './server.ts';
import { loadMcpInstructions } from './instructions.ts';

const MCP_ROUTE = /^\/mcp(?:\/([^/]+))?\/?$/;
const MAX_BODY_BYTES = 1024 * 1024;
const limiter = createLoginLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

export const isMcpPath = (pathname: string): boolean => MCP_ROUTE.test(pathname);

function keyFrom(req: IncomingMessage, pathname: string): string {
  const fromPath = MCP_ROUTE.exec(pathname)?.[1];
  if (fromPath) {
    try {
      return decodeURIComponent(fromPath);
    } catch {
      return ''; // vigane %-jada → sama 401 mis vale võtme korral
    }
  }
  const auth = req.headers.authorization ?? '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  const ip = clientIpFrom(req.headers['x-forwarded-for'], req.socket.remoteAddress);
  const limitKey = `mcp:${ip}`;
  if (limiter.isBlocked(limitKey)) return json(res, { error: 'Liiga palju katseid, proovi 15 minuti pärast' }, 429);

  const found = await findActiveApiKey(keyFrom(req, pathname));
  if (!found) {
    limiter.registerFailure(limitKey);
    return json(res, { error: INVALID_KEY_MESSAGE }, 401);
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, { error: 'Ainult POST' }, 405);
  }

  let body: unknown;
  try {
    body = await parseBody(req, MAX_BODY_BYTES);
  } catch (err) {
    return json(res, { error: err instanceof Error && err.message === 'Päringu keha on liiga suur' ? err.message : 'Vigane JSON' }, 400);
  }

  const { user, keyId } = found;
  await runInRequestContext(async () => {
    setRequestUser({ username: user.username, tenantId: user.tenantId });
    const [license, tenant, instructions] = await Promise.all([
      loadLicenseState(user.tenantId),
      authDb().tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
      loadMcpInstructions()
    ]);
    const server = createMcpServer({ user, tenantName: tenant?.name ?? '', license }, instructions);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error('[mcp] võti', keyId, err instanceof Error ? err.message : err);
      if (!res.headersSent) json(res, { error: 'Serveri viga' }, 500);
    }
  });
  await touchApiKey(keyId, found.lastUsedAt).catch((err) => console.error('[mcp] lastUsedAt', keyId, err instanceof Error ? err.message : err));
}
