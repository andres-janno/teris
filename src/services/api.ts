// src/services/api.ts
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import type { Vehicle, Implement, TelemetryDevice, ImplementAssignment, DeviceAssignment, DeviceAssignmentInput } from '../types/fleet';
import type { PointOfInterest } from '../types/poi';
import type { RelatedParty } from '../types/party';
import type { Crop } from '../types/crop';
import type { SoilSample } from '../types/soilSample';
import type { FieldBookImportPayload, FieldBookImportResult, FieldOperationsResponse } from '../types/fieldOperation';
import type { AuthUser, AdminUser, SupportGrant, SupportAccessEntry } from '../types/auth';
import type { WorkType, Material, WorkTemplate, WorkTemplateItem, FieldWork, WorkEntry, WorkEntryInput, FinanceEntry, FieldResult, FinanceStatus, TelemetrySuggestion, FieldWorkPlanInput, FieldSeasonWorks } from '../types/fieldWork';

let unauthorizedHandler: (() => void) | null = null;

// Kutsutakse, kui mõni andmepäring saab vastuseks 401 (sessioon aegus).
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

let licenseErrorHandler: ((message: string) => void) | null = null;

// Kutsutakse, kui server keeldub litsentsi tõttu (aegunud litsents või litsentsita moodul).
export function setLicenseErrorHandler(fn: ((message: string) => void) | null): void {
  licenseErrorHandler = fn;
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: 'same-origin', ...init });
  if (res.status === 401 && !input.startsWith('/api/auth/')) unauthorizedHandler?.();
  if (res.status === 403 && licenseErrorHandler) {
    const data = await res.clone().json().catch(() => null);
    if (data?.code === 'LICENSE_READ_ONLY' || data?.code === 'MODULE_NOT_LICENSED' || data?.code === 'SUPPORT_READ_ONLY') licenseErrorHandler(String(data.error));
  }
  return res;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : fallback;
}

// Viga koos HTTP staatuse ja serveri veakoodiga (nt LICENSE_READ_ONLY).
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Litsentsi- või tugivaate vea dialoogi näitab juba apiFetch; kutsuja ei tohi sama teadet uuesti näidata.
export function isLicenseError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'LICENSE_READ_ONLY' || err.code === 'MODULE_NOT_LICENSED' || err.code === 'SUPPORT_READ_ONLY');
}

export const api = {
  async getMe(): Promise<AuthUser> {
    const res = await apiFetch('/api/auth/me');
    if (!res.ok) throw new Error(await errorMessage(res, 'Pole sisse logitud'));
    return (await res.json()).user;
  },

  async login(username: string, password: string): Promise<AuthUser> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Sisselogimine ebaõnnestus'));
    return (await res.json()).user;
  },

  async supportLogin(token: string): Promise<AuthUser> {
    const res = await apiFetch('/api/auth/support-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!res.ok) throw new ApiError(await errorMessage(res, 'Tugivaate link on aegunud või juba kasutatud'), res.status);
    return (await res.json()).user;
  },

  async logout(): Promise<void> {
    const res = await apiFetch('/api/auth/logout', { method: 'POST' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Väljalogimine ebaõnnestus'));
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await apiFetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (!res.ok) throw Object.assign(new Error(await errorMessage(res, 'Parooli muutmine ebaõnnestus')), { status: res.status });
  },

  async listUsers(): Promise<AdminUser[]> {
    const res = await apiFetch('/api/admin/users');
    if (!res.ok) throw new Error(await errorMessage(res, 'Kasutajate laadimine ebaõnnestus'));
    return (await res.json()).users;
  },

  async createUser(data: { username: string; displayName: string; email: string; isAdmin: boolean; isFinanceManager: boolean; password?: string }): Promise<{ user: AdminUser; emailSent: boolean }> {
    const res = await apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Kasutaja lisamine ebaõnnestus'));
    return res.json();
  },

  async updateUser(id: string, data: { displayName?: string; email?: string; isActive?: boolean; isAdmin?: boolean; isFinanceManager?: boolean }): Promise<AdminUser> {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Kasutaja muutmine ebaõnnestus'));
    return (await res.json()).user;
  },

  async resetUserPassword(id: string, password: string): Promise<void> {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Parooli lähtestamine ebaõnnestus'));
  },

  async sendUserLink(id: string): Promise<{ emailSent: boolean }> {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}/send-link`, { method: 'POST' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Lingi saatmine ebaõnnestus'));
    return res.json();
  },

  async forgotPassword(login: string): Promise<void> {
    const res = await apiFetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Päring ebaõnnestus'));
  },

  async checkPasswordToken(token: string): Promise<{ purpose: 'INVITE' | 'RESET'; username: string }> {
    const res = await apiFetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Link on aegunud või juba kasutatud'));
    return res.json();
  },

  async setPasswordWithToken(token: string, password: string): Promise<{ username: string }> {
    const res = await apiFetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Parooli määramine ebaõnnestus'));
    return res.json();
  },

  async listSupportGrants(): Promise<SupportGrant[]> {
    const res = await apiFetch('/api/support-grants');
    if (!res.ok) throw new Error(await errorMessage(res, 'Kasutajatoe lubade laadimine ebaõnnestus'));
    return res.json();
  },

  async createSupportGrant(duration: '1h' | '24h' | '7d'): Promise<SupportGrant> {
    const res = await apiFetch('/api/support-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Ligipääsu andmine ebaõnnestus'));
    return res.json();
  },

  async revokeSupportGrant(id: string): Promise<SupportGrant> {
    const res = await apiFetch(`/api/support-grants/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Ligipääsu tühistamine ebaõnnestus'));
    return res.json();
  },

  async listSupportAccessLog(): Promise<SupportAccessEntry[]> {
    const res = await apiFetch('/api/support-access-log');
    if (!res.ok) throw new Error(await errorMessage(res, 'Sisenemiste logi laadimine ebaõnnestus'));
    return res.json();
  },

  async deleteUser(id: string): Promise<void> {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Kasutaja kustutamine ebaõnnestus'));
  },

  async getStatus(): Promise<{ status: string; database: string; counts: Record<string, number> }> {
    const res = await apiFetch('/api/status');
    if (!res.ok) throw new Error('API status check failed');
    return res.json();
  },

  async getMasterFields(): Promise<MasterField[]> {
    const res = await apiFetch('/api/master-fields');
    if (!res.ok) throw new Error('Failed to fetch master fields');
    return res.json();
  },

  async saveMasterFields(fields: MasterField | MasterField[]): Promise<{ success: boolean; count: number }> {
    const res = await apiFetch('/api/master-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    if (!res.ok) throw new Error('Failed to save master fields');
    return res.json();
  },

  async deleteMasterField(id: number | string): Promise<{ success: boolean }> {
    const res = await apiFetch(`/api/master-fields/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Põllu kustutamine ebaõnnestus'));
    return res.json();
  },

  async getSeasons(): Promise<FarmingSeason[]> {
    const res = await apiFetch('/api/seasons');
    if (!res.ok) throw new Error('Failed to fetch seasons');
    return res.json();
  },

  async saveSeason(season: FarmingSeason): Promise<any> {
    const res = await apiFetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(season)
    });
    if (!res.ok) throw new Error('Failed to save season');
    return res.json();
  },

  async getFleet(): Promise<{ vehicles: Vehicle[]; implements: Implement[]; devices: TelemetryDevice[] }> {
    const res = await apiFetch('/api/fleet');
    if (!res.ok) throw new Error('Failed to fetch fleet');
    const data = await res.json();
    // Ilma telemeetria moodulita saadab server asukoha ja viimase aktiivsuse null-ina; klient kasutab undefined
    return {
      ...data,
      vehicles: (data.vehicles ?? []).map((v: Vehicle) => ({
        ...v,
        lastKnownPosition: v.lastKnownPosition ?? undefined,
        lastActiveAt: v.lastActiveAt ?? undefined
      }))
    };
  },

  async getWeatherRadar(): Promise<{ bounds: [[number, number], [number, number]]; frames: { time: string; imageUrl: string }[] }> {
    const res = await apiFetch('/api/weather/radar');
    if (!res.ok) throw new Error(await errorMessage(res, 'Radari andmed pole saadaval'));
    return res.json();
  },

  /** Satiladu Sentinel-2 päevapiltide kuupäevad (AAAA-KK-PP, uusim ees) */
  async getSatelliteDates(from: string, to: string): Promise<string[]> {
    const res = await apiFetch(`/api/satellite/dates?${new URLSearchParams({ from, to })}`);
    if (!res.ok) throw new Error(await errorMessage(res, 'Satelliidipiltide loend pole saadaval'));
    return (await res.json()).dates;
  },

  /**
   * Pilvisus antud põldude kohal perioodi päevadel (uusim ees). Server kontrollib piiratud aja jooksul
   * osa päevi; kui stats.length < total, korda päringut (kontrollitud päevad on vahemälus).
   */
  async checkSatelliteClouds(
    from: string,
    to: string,
    polygons: number[][][][]
  ): Promise<{ stats: { date: string; coverage: number; cloud: number }[]; total: number }> {
    const res = await apiFetch('/api/satellite/cloud-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, polygons })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Pilvisuse kontroll ebaõnnestus'));
    return res.json();
  },

  async getTelemetryHistory(
    target: string | { imei?: string; vehicleId?: string; hours?: number; from?: string; to?: string },
    hours = 6,
    from?: string,
    to?: string
  ): Promise<{
    points: { timestamp: string; lat: number; lng: number; altitude?: number; speedKmH: number; heading: number }[];
    implement?: { id: string; name: string; workingWidthM: number; type?: string } | null;
  }> {
    const q = new URLSearchParams();
    if (typeof target === 'string') {
      q.set('imei', target);
      if (from) q.set('from', from);
      else q.set('hours', String(hours));
      if (to) q.set('to', to);
    } else {
      if (target.imei) q.set('imei', target.imei);
      if (target.vehicleId) q.set('vehicleId', target.vehicleId);
      if (target.from) q.set('from', target.from);
      else if (target.hours) q.set('hours', String(target.hours));
      if (target.to) q.set('to', target.to);
    }
    const res = await apiFetch(`/api/telemetry/history?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch telemetry history');
    return res.json();
  },

  async saveVehicle(vehicle: Vehicle): Promise<any> {
    const res = await apiFetch('/api/fleet/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicle)
    });
    if (!res.ok) throw new Error('Failed to save vehicle');
    return res.json();
  },

  async deleteVehicle(id: string): Promise<any> {
    const res = await apiFetch(`/api/fleet/vehicles/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Masina kustutamine ebaõnnestus'));
    return res.json();
  },

  async saveImplement(implement: Implement): Promise<any> {
    const res = await apiFetch('/api/fleet/implements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(implement)
    });
    if (!res.ok) throw new Error('Failed to save implement');
    return res.json();
  },

  async deleteImplement(id: string): Promise<any> {
    const res = await apiFetch(`/api/fleet/implements/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Haakeriista kustutamine ebaõnnestus'));
    return res.json();
  },

  async assignImplement(implementId: string, vehicleId?: string): Promise<any> {
    const res = await apiFetch('/api/fleet/implements/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ implementId, vehicleId })
    });
    if (!res.ok) throw new Error('Failed to assign implement');
    return res.json();
  },

  async getImplementAssignments(params?: { vehicleId?: string; implementId?: string }): Promise<ImplementAssignment[]> {
    const query = new URLSearchParams();
    if (params?.vehicleId) query.set('vehicleId', params.vehicleId);
    if (params?.implementId) query.set('implementId', params.implementId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiFetch(`/api/fleet/implement-assignments${qs}`);
    if (!res.ok) throw new Error('Failed to fetch implement assignments');
    return res.json();
  },

  async createImplementAssignment(data: {
    vehicleId: string;
    implementId: string;
    startedAt?: string;
    endedAt?: string | null;
    notes?: string;
  }): Promise<ImplementAssignment> {
    const res = await apiFetch('/api/fleet/implement-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create implement assignment');
    }
    return res.json();
  },

  async updateImplementAssignment(
    id: string,
    data: {
      vehicleId?: string;
      implementId?: string;
      startedAt?: string;
      endedAt?: string | null;
      notes?: string;
    }
  ): Promise<ImplementAssignment> {
    const res = await apiFetch(`/api/fleet/implement-assignments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update implement assignment');
    }
    return res.json();
  },

  async deleteImplementAssignment(id: string): Promise<any> {
    const res = await apiFetch(`/api/fleet/implement-assignments/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Haakimise kirje kustutamine ebaõnnestus'));
    return res.json();
  },

  async getDeviceAssignments(): Promise<DeviceAssignment[]> {
    const res = await apiFetch('/api/fleet/device-assignments');
    if (!res.ok) throw new Error(await errorMessage(res, 'Seadmete seoste registri laadimine ebaõnnestus'));
    return res.json();
  },

  async createDeviceAssignment(data: DeviceAssignmentInput): Promise<DeviceAssignment> {
    const res = await apiFetch('/api/fleet/device-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Seose kirje salvestamine ebaõnnestus'));
    return res.json();
  },

  async updateDeviceAssignment(id: string, data: DeviceAssignmentInput): Promise<DeviceAssignment> {
    const res = await apiFetch(`/api/fleet/device-assignments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Seose kirje salvestamine ebaõnnestus'));
    return res.json();
  },

  async deleteDeviceAssignment(id: string): Promise<any> {
    const res = await apiFetch(`/api/fleet/device-assignments/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Seose kirje kustutamine ebaõnnestus'));
    return res.json();
  },

  async saveDevice(device: TelemetryDevice): Promise<any> {
    const res = await apiFetch('/api/fleet/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(typeof data?.error === 'string' ? data.error : 'Seadme salvestamine ebaõnnestus', res.status, typeof data?.code === 'string' ? data.code : undefined);
    }
    return res.json();
  },

  async deleteDevice(id: string): Promise<any> {
    const res = await apiFetch(`/api/fleet/devices/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Seadme kustutamine ebaõnnestus'));
    return res.json();
  },

  async assignDevice(deviceId: string, vehicleId?: string, implementId?: string): Promise<any> {
    const res = await apiFetch('/api/fleet/devices/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, vehicleId, implementId })
    });
    if (!res.ok) throw new Error('Failed to assign device');
    return res.json();
  },

  async getPois(): Promise<PointOfInterest[]> {
    const res = await apiFetch('/api/poi');
    if (!res.ok) throw new Error('Failed to fetch POIs');
    return res.json();
  },

  async savePoi(poi: Partial<PointOfInterest>): Promise<any> {
    const res = await apiFetch('/api/poi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(poi)
    });
    if (!res.ok) throw new Error('Failed to save POI');
    return res.json();
  },

  async deletePoi(id: string): Promise<any> {
    const res = await apiFetch(`/api/poi/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Asukoha kustutamine ebaõnnestus'));
    return res.json();
  },

  async getParties(): Promise<RelatedParty[]> {
    const res = await apiFetch('/api/parties');
    if (!res.ok) throw new Error('Failed to fetch parties');
    return res.json();
  },

  async saveParty(party: RelatedParty): Promise<any> {
    const res = await apiFetch('/api/parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(party)
    });
    if (!res.ok) throw new Error('Failed to save party');
    return res.json();
  },

  async deleteParty(id: string): Promise<any> {
    const res = await apiFetch(`/api/parties/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Isiku kustutamine ebaõnnestus'));
    return res.json();
  },

  async getCrops(): Promise<Crop[]> {
    const res = await apiFetch('/api/crops');
    if (!res.ok) throw new Error('Failed to fetch crops');
    return res.json();
  },

  async saveCrop(crop: Crop): Promise<any> {
    const res = await apiFetch('/api/crops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crop)
    });
    if (!res.ok) throw new Error('Failed to save crop');
    return res.json();
  },

  async deleteCrop(id: string): Promise<any> {
    const res = await apiFetch(`/api/crops/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Kultuuri kustutamine ebaõnnestus'));
    return res.json();
  },

  async getSoilSamples(): Promise<SoilSample[]> {
    const res = await apiFetch('/api/soil-samples');
    if (!res.ok) throw new Error('Failed to fetch soil samples');
    return res.json();
  },

  async importSoilSamples(samples: SoilSample[]): Promise<{ success: boolean; count: number }> {
    const res = await apiFetch('/api/soil-samples/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samples)
    });
    if (!res.ok) throw new Error('Failed to import soil samples');
    return res.json();
  },

  async importFieldBook(payload: FieldBookImportPayload): Promise<FieldBookImportResult> {
    const res = await apiFetch('/api/field-book/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Põlluraamatu import ebaõnnestus');
    }
    return res.json();
  },

  async getFieldOperations(fieldId: number | string, year: number): Promise<FieldOperationsResponse> {
    const res = await apiFetch(`/api/field-operations?fieldId=${encodeURIComponent(String(fieldId))}&year=${year}`);
    if (!res.ok) throw new Error('Põllutööde laadimine ebaõnnestus');
    return res.json();
  },

  // --- Põllutööde register (PRIA põlluraamatust lahus) ---
  async getWorkTypes(): Promise<WorkType[]> {
    return jsonOrThrow(await apiFetch('/api/work-types'), 'Tööde registri laadimine ebaõnnestus');
  },

  async saveWorkType(w: Partial<WorkType>): Promise<WorkType> {
    return jsonOrThrow(await apiFetch('/api/work-types', jsonInit('POST', w)), 'Töö salvestamine ebaõnnestus');
  },

  async deleteWorkType(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/work-types/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Töö kustutamine ebaõnnestus');
  },

  async getMaterials(): Promise<Material[]> {
    return jsonOrThrow(await apiFetch('/api/materials'), 'Materjalide laadimine ebaõnnestus');
  },

  async saveMaterial(m: Partial<Material>): Promise<Material> {
    return jsonOrThrow(await apiFetch('/api/materials', jsonInit('POST', m)), 'Materjali salvestamine ebaõnnestus');
  },

  async deleteMaterial(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/materials/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Materjali kustutamine ebaõnnestus');
  },

  async getWorkTemplates(): Promise<WorkTemplate[]> {
    return jsonOrThrow(await apiFetch('/api/work-templates'), 'Mallide laadimine ebaõnnestus');
  },

  async saveWorkTemplate(
    targetOrCropId: string | null | { cropId?: string | null; isWinter?: boolean },
    items: WorkTemplateItem[],
    isWinter?: boolean
  ): Promise<void> {
    const payload =
      typeof targetOrCropId === 'object' && targetOrCropId !== null
        ? { ...targetOrCropId, items }
        : { cropId: targetOrCropId, items, isWinter };
    await jsonOrThrow(await apiFetch('/api/work-templates', jsonInit('PUT', payload)), 'Malli salvestamine ebaõnnestus');
  },

  async deleteWorkTemplate(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/work-templates/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Malli kustutamine ebaõnnestus');
  },

  async getFieldSeasonWorks(fieldId: number | string, year: number): Promise<FieldSeasonWorks> {
    return jsonOrThrow(await apiFetch(`/api/field-season-works?fieldId=${encodeURIComponent(String(fieldId))}&year=${year}`), 'Põllu tööde laadimine ebaõnnestus');
  },
  async getFieldWorks(year: number): Promise<FieldWork[]> {
    return jsonOrThrow(await apiFetch(`/api/field-works?year=${year}`), 'Põllutööde laadimine ebaõnnestus');
  },

  async addFieldWork(data: { fieldSeasonId: number; workTypeId: string; sortOrder?: number | null } & FieldWorkPlanInput): Promise<FieldWork> {
    return jsonOrThrow(await apiFetch('/api/field-works', jsonInit('POST', data)), 'Töö lisamine ebaõnnestus');
  },

  async applyWorkTemplate(fieldSeasonIds: number[], mode: 'CURRENT' | 'AUTUMN' = 'CURRENT'): Promise<void> {
    await jsonOrThrow(await apiFetch('/api/field-works/apply-template', jsonInit('POST', { fieldSeasonIds, mode })), 'Malli lisamine ebaõnnestus');
  },

  async updateFieldWork(id: string, data: FieldWorkPlanInput & { status?: 'DONE' | 'REOPEN' }): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/field-works/${encodeURIComponent(id)}`, jsonInit('PATCH', data)), 'Töö muutmine ebaõnnestus');
  },

  async deleteFieldWork(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/field-works/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Töö eemaldamine ebaõnnestus');
  },

  async clearFieldWorks(fieldSeasonId: number, nextSeasonId?: number | null, mode?: 'ALL' | 'AUTUMN'): Promise<{ success: boolean; count: number }> {
    return jsonOrThrow(
      await apiFetch('/api/field-works/clear', jsonInit('POST', { fieldSeasonId, nextSeasonId: nextSeasonId ?? undefined, mode })),
      'Põllu tööde eemaldamine ebaõnnestus'
    );
  },

  async saveWorkEntry(input: WorkEntryInput, id?: string): Promise<WorkEntry> {
    return jsonOrThrow(
      await apiFetch(id ? `/api/work-entries/${encodeURIComponent(id)}` : '/api/work-entries', jsonInit(id ? 'PUT' : 'POST', input)),
      'Kande salvestamine ebaõnnestus'
    );
  },

  async deleteWorkEntry(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/work-entries/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Kande kustutamine ebaõnnestus');
  },

  async getTelemetrySuggestions(fieldSeasonId: number, date: string, excludeEntryId?: string): Promise<TelemetrySuggestion[]> {
    const q = new URLSearchParams({
      fieldSeasonId: String(fieldSeasonId),
      date,
      ...(excludeEntryId ? { excludeEntryId } : {})
    });
    return jsonOrThrow(await apiFetch(`/api/field-works/telemetry-suggestions?${q.toString()}`), 'Telemeetria soovituste laadimine ebaõnnestus');
  },

  async getFinanceEntries(year: number, status?: FinanceStatus): Promise<FinanceEntry[]> {
    const q = `year=${year}${status ? `&status=${status}` : ''}`;
    return jsonOrThrow(await apiFetch(`/api/finance/entries?${q}`), 'Kannete laadimine ebaõnnestus');
  },

  async saveFinanceEntry(id: string, data: { prices: Record<string, number | null>; financeNotes?: string | null; confirm?: boolean }): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/finance/entries/${encodeURIComponent(id)}`, jsonInit('PATCH', data)), 'Finantsi salvestamine ebaõnnestus');
  },

  async getFieldResults(year: number): Promise<FieldResult[]> {
    return jsonOrThrow(await apiFetch(`/api/finance/field-results?year=${year}`), 'Põldude tulemuse laadimine ebaõnnestus');
  }
};

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Veateade serverist (eesti keeles) visatakse edasi, et selle saaks kasutajale näidata.
async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return res.json();
}
