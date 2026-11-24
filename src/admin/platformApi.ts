// src/admin/platformApi.ts — teenusepakkuja API klient (/api/platform/*).
import type {
  PlatformReleaseNoteRow,
  ReleaseNoteAudience,
  ReleaseNoteItem
} from '../types/releaseNotes.ts';
export type { PlatformReleaseNoteRow, ReleaseNoteAudience, ReleaseNoteItem };

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
  supportGrant: { validUntil: string } | null; // ettevõtte admini antud kehtiv kasutajatoe luba
}

export interface AuditEntry {
  id: string;
  action: string;
  targetTenantId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  platformUsername: string | null;
}

export interface DeviceRow {
  id: string;
  tenantId: string;
  tenantName: string;
  connectivityType: 'CELLULAR' | 'EYE_SENSOR' | string;
  imei: string | null;
  macAddress: string | null;
  model: string;
  createdAt: string;
  ownership: { validFrom: string } | null;
}

export interface DeviceRegistration {
  tenantName: string;
  kind: 'IMEI' | 'MAC';
  identifier: string;
  validFrom: string;
  validTo: string | null;
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

export type CropGroup = 'CEREAL' | 'OILSEED' | 'LEGUME' | 'FORAGE_GRASS' | 'FALLOW' | 'OTHER';
export type WorkPhase = 'PREPARATION' | 'SOWING' | 'CARE' | 'HARVEST';
export type WorkRepeatMode = 'ONCE' | 'UP_TO' | 'INTERVAL';

export interface CatalogCounts {
  crops: number;
  varieties: number;
  workTypes: number;
}

export interface CatalogVariety {
  id: string;
  catalogCropId: string;
  name: string;
  breeder: string | null;
  maturityDays: string | null;
  winterHardiness: string | null;
  recommendedSeedRateKgHa: number | null;
  potentialYieldTonsHa: number | null;
  qualityClass: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface CatalogCrop {
  id: string;
  name: string;
  scientificName: string | null;
  group: CropGroup;
  color: string;
  icon: string | null;
  priaCode: string | null;
  defaultSeedRateKgHa: number | null;
  defaultYieldTonsHa: number | null;
  description: string | null;
  isWinterCrop: boolean;
  gddBaseC: number;
  priaName: string | null;
  priaUndersowing: boolean;
  varieties: CatalogVariety[];
}

export interface CatalogWorkType {
  id: string;
  name: string;
  phase: WorkPhase;
  repeatMode: WorkRepeatMode;
  maxRepeats: number | null;
  intervalDays: number | null;
  usesMaterials: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogData {
  crops: CatalogCrop[];
  workTypes: CatalogWorkType[];
}

export type CropInput = Omit<CatalogCrop, 'id' | 'varieties'>;
export type VarietyInput = Omit<CatalogVariety, 'id' | 'catalogCropId'>;
// kordumist ei sisestata: iga töö on üks kord
export type WorkTypeInput = Omit<CatalogWorkType, 'id' | 'repeatMode' | 'maxRepeats' | 'intervalDays'>;

export const CROP_GROUP_LABELS: Record<CropGroup, string> = {
  CEREAL: 'Teravili',
  OILSEED: 'Õlikultuur',
  LEGUME: 'Kaunvili',
  FORAGE_GRASS: 'Söödakultuur / rohumaa',
  FALLOW: 'Kesa',
  OTHER: 'Muu'
};
export const PHASE_LABELS: Record<WorkPhase, string> = {
  PREPARATION: 'Ettevalmistus',
  SOWING: 'Külv',
  CARE: 'Hooldus',
  HARVEST: 'Koristus'
};
export const REPEAT_LABELS: Record<WorkRepeatMode, string> = {
  ONCE: 'Üks kord',
  UP_TO: 'Kuni N korda',
  INTERVAL: 'Intervalliga'
};

let unauthorizedHandler: (() => void) | null = null;

// Kutsutakse, kui mõni päring saab vastuseks 401 (sessioon aegus).
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : fallback;
}

export type HelpArticleRow = { key: string; html: string; guideLink: string | null; updatedAt: string; updatedBy: string | null };
export type HelpVersionRow = { id: number; createdAt: string; createdBy: string | null; guideLink: string | null };
export type HelpVersionDetail = HelpVersionRow & { html: string };
export type McpInstructions = { value: string; isDefault: boolean; defaultValue: string; updatedBy: string | null; updatedAt: string | null; maxLength: number };

export interface LandingStats {
  from: string;
  to: string;
  daily: { day: string; visitors: number; views: number }[];
  sources: { source: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  bots: { visitorClass: string; botName: string; hits: number; llmsTxtHits: number; llmsTxtLastSeen: string | null; lastSeen: string }[];
  funnel: { viewed: number; clicked: number; submitted: number };
}

export type InterestStatus = 'NEW' | 'CONTACTED' | 'CLOSED';
export const INTEREST_STATUS_LABELS: Record<InterestStatus, string> = { NEW: 'Uus', CONTACTED: 'Võetud ühendust', CLOSED: 'Suletud' };

export interface InterestRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  areaHa: number | null;
  message: string | null;
  status: InterestStatus;
  notes: string | null;
  closedAt: string | null;
  utmSource: string | null;
  referrerHost: string | null;
}

export interface WeatherPointRow { id: number; lat: number; lon: number; hasData: boolean | null; loadedFrom: string | null; loadedUntil: string | null; lastSuccessAt: string | null; lastError: string | null; failCount: number; fieldSeasonCount: number; keyTenant: string | null }

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
  weatherStatus: () => request<{ points: WeatherPointRow[]; failWarn: number; tenantsWithKey: number }>('GET', '/weather'),
  reloadWeatherPoint: (id: number) => request<{ started: boolean }>('POST', `/weather/${id}/reload`, {}),
  listTenants: () => request<TenantSummary[]>('GET', '/tenants'),
  createTenant: (input: NewTenantInput) => request<{ id: string; inviteSent: boolean; catalog?: CatalogCounts }>('POST', '/tenants', input),
  getTenant: (id: string) => request<TenantDetailData>('GET', `/tenants/${enc(id)}`),
  updateLicense: (id: string, validUntil: string, modules: LicenseModule[]) =>
    request<{ license: LicenseInfo }>('PATCH', `/tenants/${enc(id)}/license`, { validUntil, modules }),
  suspend: (id: string) => request<unknown>('POST', `/tenants/${enc(id)}/suspend`, {}),
  deleteTenant: (id: string, confirmName: string) => request<unknown>('DELETE', `/tenants/${enc(id)}`, { confirmName }),
  activate: (id: string) => request<unknown>('POST', `/tenants/${enc(id)}/activate`, {}),
  resendInvite: (id: string, username: string) =>
    request<{ inviteSent: boolean }>('POST', `/tenants/${enc(id)}/resend-invite`, { username }),
  openSupportSession: (id: string) => request<{ url: string }>('POST', `/tenants/${enc(id)}/support-session`, {}),
  getCatalog: () => request<CatalogData>('GET', '/catalog'),
  createCrop: (input: CropInput) => request<CatalogCrop>('POST', '/catalog/crops', input),
  updateCrop: (id: string, input: Partial<CropInput>) => request<CatalogCrop>('PATCH', `/catalog/crops/${enc(id)}`, input),
  deleteCrop: (id: string) => request<unknown>('DELETE', `/catalog/crops/${enc(id)}`),
  createVariety: (cropId: string, input: VarietyInput) =>
    request<CatalogVariety>('POST', `/catalog/crops/${enc(cropId)}/varieties`, input),
  updateVariety: (cropId: string, id: string, input: Partial<VarietyInput>) =>
    request<CatalogVariety>('PATCH', `/catalog/crops/${enc(cropId)}/varieties/${enc(id)}`, input),
  deleteVariety: (cropId: string, id: string) => request<unknown>('DELETE', `/catalog/crops/${enc(cropId)}/varieties/${enc(id)}`),
  createWorkType: (input: WorkTypeInput) => request<CatalogWorkType>('POST', '/catalog/work-types', input),
  updateWorkType: (id: string, input: Partial<WorkTypeInput>) => request<CatalogWorkType>('PATCH', `/catalog/work-types/${enc(id)}`, input),
  deleteWorkType: (id: string) => request<unknown>('DELETE', `/catalog/work-types/${enc(id)}`),
  listDevices: () => request<DeviceRow[]>('GET', '/devices'),
  listDeviceRegistrations: (limit = 50) => request<DeviceRegistration[]>('GET', `/devices/registrations?limit=${limit}`),
  releaseDevice: (id: string) => request<unknown>('POST', `/devices/${enc(id)}/release`, {}),
  listHelp: () => request<HelpArticleRow[]>('GET', '/help'),
  saveHelp: (key: string, html: string, guideLink: string | null = null) =>
    request<{ success: true; deleted: boolean }>('PUT', `/help/${enc(key)}`, { html, guideLink }, 'Juhendi salvestamine ebaõnnestus'),
  listHelpVersions: (key: string) => request<HelpVersionRow[]>('GET', `/help/${enc(key)}/versions`, undefined, 'Ajaloo laadimine ebaõnnestus'),
  getHelpVersion: (key: string, id: number) => request<HelpVersionDetail>('GET', `/help/${enc(key)}/versions/${id}`, undefined, 'Versiooni laadimine ebaõnnestus'),
  restoreHelpVersion: (key: string, id: number) =>
    request<{ success: true; deleted: boolean }>('POST', `/help/${enc(key)}/versions/${id}/restore`, {}, 'Versiooni taastamine ebaõnnestus'),
  getMcpInstructions: () => request<McpInstructions>('GET', '/mcp-instructions'),
  saveMcpInstructions: (value: string) => request<McpInstructions>('PUT', '/mcp-instructions', { value }, 'Juhise salvestamine ebaõnnestus'),
  resetMcpInstructions: () => request<McpInstructions>('DELETE', '/mcp-instructions', undefined, 'Vaikejuhise taastamine ebaõnnestus'),
  listAudit: (tenantId?: string, limit = 100) =>
    request<AuditEntry[]>('GET', `/audit?limit=${limit}${tenantId ? `&tenantId=${enc(tenantId)}` : ''}`),
  landingStats: (from: string, to: string) => request<LandingStats>('GET', `/landing/stats?from=${enc(from)}&to=${enc(to)}`),
  listInterest: (status?: InterestStatus) => request<InterestRow[]>('GET', `/interest${status ? `?status=${status}` : ''}`),
  updateInterest: (id: string, patch: { status?: InterestStatus; notes?: string | null }) => request<InterestRow>('PATCH', `/interest/${enc(id)}`, patch),
  deleteInterest: (id: string) => request<unknown>('DELETE', `/interest/${enc(id)}`),
  listReleaseNotes: () => request<PlatformReleaseNoteRow[]>('GET', '/release-notes'),
  createReleaseNote: (input: { version: string; title: string; summary?: string | null; items: ReleaseNoteItem[] }) =>
    request<PlatformReleaseNoteRow>('POST', '/release-notes', input, 'Mustandi loomine ebaõnnestus'),
  updateReleaseNote: (id: string, input: { version?: string; title?: string; summary?: string | null; items?: ReleaseNoteItem[] }) =>
    request<PlatformReleaseNoteRow>('PUT', `/release-notes/${enc(id)}`, input, 'Salvestamine ebaõnnestus'),
  deleteReleaseNote: (id: string) => request<unknown>('DELETE', `/release-notes/${enc(id)}`, undefined, 'Kustutamine ebaõnnestus'),
  publishReleaseNote: (id: string, input: { sendEmail: boolean; audience: ReleaseNoteAudience }) =>
    request<{ row: PlatformReleaseNoteRow; queued: number }>('POST', `/release-notes/${enc(id)}/publish`, input, 'Avaldamine ebaõnnestus'),
  sendReleaseNoteEmail: (id: string, audience: ReleaseNoteAudience) =>
    request<{ row: PlatformReleaseNoteRow; queued: number }>('POST', `/release-notes/${enc(id)}/send-email`, { audience }, 'E-kirjade saatmine ebaõnnestus'),
  retryFailedReleaseNoteEmails: (id: string) =>
    request<{ row: PlatformReleaseNoteRow; retried: number }>('POST', `/release-notes/${enc(id)}/retry-failed`, {}, 'Uuesti saatmine ebaõnnestus'),
  sendTestReleaseNoteEmail: (id: string, email: string) =>
    request<{ sent: boolean; to: string }>('POST', `/release-notes/${enc(id)}/test-email`, { email }, 'Testkirja saatmine ebaõnnestus')
};
