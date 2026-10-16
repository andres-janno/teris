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
  templates: number;
  items: number;
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

export interface CatalogTemplateItem {
  id: string;
  catalogWorkTypeId: string;
  workTypeName: string;
  sortOrder: number;
  typicalTiming: string | null;
  plannedCount: number | null;
}

export interface CatalogTemplate {
  id: string;
  catalogCropId: string | null;
  cropName: string | null;
  isWinter: boolean;
  items: CatalogTemplateItem[];
}

export interface CatalogData {
  crops: CatalogCrop[];
  workTypes: CatalogWorkType[];
  templates: CatalogTemplate[];
}

export type CropInput = Omit<CatalogCrop, 'id' | 'varieties'>;
export type VarietyInput = Omit<CatalogVariety, 'id' | 'catalogCropId'>;
export type WorkTypeInput = Omit<CatalogWorkType, 'id'>;
export interface TemplateItemInput {
  catalogWorkTypeId: string;
  typicalTiming: string | null;
  plannedCount: number | null;
}

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
  createTenant: (input: NewTenantInput) => request<{ id: string; inviteSent: boolean; catalog?: CatalogCounts }>('POST', '/tenants', input),
  getTenant: (id: string) => request<TenantDetailData>('GET', `/tenants/${enc(id)}`),
  updateLicense: (id: string, validUntil: string, modules: LicenseModule[]) =>
    request<{ license: LicenseInfo }>('PATCH', `/tenants/${enc(id)}/license`, { validUntil, modules }),
  suspend: (id: string) => request<unknown>('POST', `/tenants/${enc(id)}/suspend`, {}),
  activate: (id: string) => request<unknown>('POST', `/tenants/${enc(id)}/activate`, {}),
  resendInvite: (id: string, username: string) =>
    request<{ inviteSent: boolean }>('POST', `/tenants/${enc(id)}/resend-invite`, { username }),
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
  saveTemplate: (catalogCropId: string | null, isWinter: boolean, items: TemplateItemInput[]) =>
    request<unknown>('PUT', '/catalog/templates', { catalogCropId, isWinter, items }),
  listDevices: () => request<DeviceRow[]>('GET', '/devices'),
  listDeviceRegistrations: (limit = 50) => request<DeviceRegistration[]>('GET', `/devices/registrations?limit=${limit}`),
  releaseDevice: (id: string) => request<unknown>('POST', `/devices/${enc(id)}/release`, {}),
  listAudit: (tenantId?: string, limit = 100) =>
    request<AuditEntry[]>('GET', `/audit?limit=${limit}${tenantId ? `&tenantId=${enc(tenantId)}` : ''}`)
};
