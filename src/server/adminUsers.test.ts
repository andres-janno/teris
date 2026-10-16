// Päris käsitleja test: GET /api/admin/users ettevõtte kontekstis (teris_app roll ei näe sessioonide tabelit).
import { describe, it, expect } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';
import { runAsTenant } from './db';
import { handleAdminUsers } from './adminUsers';
import { setSessionUserForTest } from './authGate';

function fakeRes() {
  const out = { status: 0, body: '' };
  const res = {
    statusCode: 200,
    setHeader() {},
    writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; if (!out.status) out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  return { res, out };
}

describe('GET /api/admin/users', () => {
  it('tagastab 200 ja igal kasutajal on lastSeenAt väli', async () => {
    const req = { headers: {}, socket: {} } as unknown as IncomingMessage;
    setSessionUserForTest(req, {
      id: 'test-admin', tenantId: 'tenant-loisu-agro', username: 'test-admin', displayName: null,
      isAdmin: true, isFinanceManager: false, mustChangePassword: false
    } as any);
    const { res, out } = fakeRes();
    const handled = await runAsTenant('tenant-loisu-agro', () => handleAdminUsers(req, res, '/api/admin/users', 'GET'));
    expect(handled).toBe(true);
    expect(out.status).toBe(200);
    const { users } = JSON.parse(out.body);
    expect(users.length).toBeGreaterThan(0);
    for (const u of users) {
      expect(u).toHaveProperty('lastSeenAt');
      expect(u).not.toHaveProperty('passwordHash');
    }
  });
});
