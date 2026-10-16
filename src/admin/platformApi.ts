// src/admin/platformApi.ts — teenusepakkuja API klient (/api/platform/*).
export type LicenseModule = 'TELEMETRY' | 'SATELLITE' | 'WEATHER';
export const MODULES: { id: LicenseModule; label: string }[] = [
  { id: 'TELEMETRY', label: 'Telemeetria' },
  { id: 'SATELLITE', label: 'Satelliit' },
  { id: 'WEATHER', label: 'Ilm' }
];

export interface LicenseInfo {
  readOnly: boolean;
  validUntil: string | null;
  expiresSoon: boolean;
  modules: LicenseModule[];
}

export interface TenantSummary {
  id: string;
  name: string;
  registryCode: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  license: LicenseInfo;
  userCount: number;
  activeUserCount: number;
  fieldCount: number;
  areaHa: number;
  lastLoginAt: string | null;
}

export interface TenantUser {
  username: string;
  displayName: string | null;
  email: string | null;
  isAdmin: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  hasPassword: boolean;
}

export interface TenantDetailData extends TenantSummary {
  users: TenantUser[];
}

export interface AuditEntry {
  id: string;
  action: string;
  targetTenantId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  platformUsername: string | null;
}

export interface NewTenantInput {
  name: string;
  registryCode?: string;
  adminUsername: string;
  adminDisplayName?: string;
  adminEmail: string;
  validUntil: string;
  modules: LicenseModule[];
}

let unauthorizedHandler: (() => void) | null = null;

// Kutsutakse, kui mõni päring saab vastuseks 401 (sessioon aegus).
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : fallback;
}

async function request<T>(method: string, path: string, body?: unknown, fallback = 'Päring ebaõnnestus'): Promise<T> {
  const res = await fetch(`/api/platform${path}`, {
    method,
    credentials: 'same-origin',
    // Content-Type on nõutud ka ilma kehata (serveri CSRF-kontroll)
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) unauthorizedHandler?.();
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return (await res.json().catch(() => ({}))) as T;
}

const enc = encodeURIComponent;

export const platformApi = {
  async me(): Promise<{ username: string }> {
    return (await request<{ user: { username: string } }>('GET', '/auth/me', undefined, 'Pole sisse logitud')).user;
  },
  async login(username: string, password: string, code: string): Promise<{ username: string }> {
    return (await request<{ user: { username: string } }>('POST', '/auth/login', { username, password, code }, 'Vale kasutajanimi, parool või kood')).user;
  },
  logout: () => request<unknown>('POST', '/auth/logout', {}),
  listTenants: () => request<TenantSummary[]>('GET', '/tenants'),
  createTenant: (input: NewTenantInput) => request<{ id: string; inviteSent: boolean }>('POST', '/tenants', input),
  getTenant: (id: string) => request<TenantDetailData>('GET', `/tenants/${enc(id)}`),
  updateLicense: (id: string, validUntil: string, modules: LicenseModule[]) =>
    request<{ license: LicenseInfo }>('PATCH', `/tenants/${enc(id)}/license`, { validUntil, modules }),
  suspend: (id: string) => request<unknown>('POST', `/tenants/${enc(id)}/suspend`, {}),
  activate: (id: string) => request<unknown>('POST', `/tenants/${enc(id)}/activate`, {}),
  resendInvite: (id: string, username: string) =>
    request<{ inviteSent: boolean }>('POST', `/tenants/${enc(id)}/resend-invite`, { username }),
  listAudit: (tenantId?: string, limit = 100) =>
    request<AuditEntry[]>('GET', `/audit?limit=${limit}${tenantId ? `&tenantId=${enc(tenantId)}` : ''}`)
};
