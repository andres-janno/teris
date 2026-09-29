// src/services/api.ts
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import type { Vehicle, Implement, TeltonikaDevice } from '../types/fleet';
import type { PointOfInterest } from '../types/poi';
import type { RelatedParty } from '../types/party';
import type { Crop } from '../types/crop';
import type { SoilSample } from '../types/soilSample';
import type { FieldBookImportPayload, FieldBookImportResult, FieldOperationsResponse } from '../types/fieldOperation';
import type { AuthUser, AdminUser } from '../types/auth';
import type { WorkType, Material, WorkTemplate, WorkTemplateItem, FieldWork, WorkEntry, WorkEntryInput, FinanceEntry, FieldResult, FinanceStatus } from '../types/fieldWork';

let unauthorizedHandler: (() => void) | null = null;

// Kutsutakse, kui mõni andmepäring saab vastuseks 401 (sessioon aegus).
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: 'same-origin', ...init });
  if (res.status === 401 && !input.startsWith('/api/auth/')) unauthorizedHandler?.();
  return res;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : fallback;
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
    if (!res.ok) throw new Error(`Failed to delete field ${id}`);
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

  async getFleet(): Promise<{ vehicles: Vehicle[]; implements: Implement[]; devices: TeltonikaDevice[] }> {
    const res = await apiFetch('/api/fleet');
    if (!res.ok) throw new Error('Failed to fetch fleet');
    return res.json();
  },

  async getTelemetryHistory(imei: string, hours = 6): Promise<{
    points: { timestamp: string; lat: number; lng: number; altitude?: number; speedKmH: number; heading: number }[]
  }> {
    const res = await apiFetch(`/api/telemetry/history?imei=${encodeURIComponent(imei)}&hours=${hours}`);
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
    if (!res.ok) throw new Error('Failed to delete vehicle');
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
    if (!res.ok) throw new Error('Failed to delete implement');
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

  async saveDevice(device: TeltonikaDevice): Promise<any> {
    const res = await apiFetch('/api/fleet/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device)
    });
    if (!res.ok) throw new Error('Failed to save device');
    return res.json();
  },

  async deleteDevice(id: string): Promise<any> {
    const res = await apiFetch(`/api/fleet/devices/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete device');
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
    if (!res.ok) throw new Error('Failed to delete POI');
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
    if (!res.ok) throw new Error('Failed to delete party');
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
    if (!res.ok) throw new Error('Failed to delete crop');
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
    const res = await apiFetch('/api/field-operations/import', {
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

  async saveWorkTemplate(cropId: string | null, items: WorkTemplateItem[]): Promise<void> {
    await jsonOrThrow(await apiFetch('/api/work-templates', jsonInit('PUT', { cropId, items })), 'Malli salvestamine ebaõnnestus');
  },

  async deleteWorkTemplate(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/work-templates/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Malli kustutamine ebaõnnestus');
  },

  async getFieldWorks(year: number): Promise<FieldWork[]> {
    return jsonOrThrow(await apiFetch(`/api/field-works?year=${year}`), 'Põllutööde laadimine ebaõnnestus');
  },

  async addFieldWork(data: { fieldSeasonId: number; workTypeId: string; plannedText?: string | null; plannedCount?: number | null }): Promise<void> {
    await jsonOrThrow(await apiFetch('/api/field-works', jsonInit('POST', data)), 'Töö lisamine ebaõnnestus');
  },

  async applyWorkTemplate(fieldSeasonIds: number[]): Promise<void> {
    await jsonOrThrow(await apiFetch('/api/field-works/apply-template', jsonInit('POST', { fieldSeasonIds })), 'Malli lisamine ebaõnnestus');
  },

  async updateFieldWork(id: string, data: { plannedText?: string | null; plannedCount?: number; notes?: string | null; status?: 'DONE' | 'REOPEN' }): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/field-works/${encodeURIComponent(id)}`, jsonInit('PATCH', data)), 'Töö muutmine ebaõnnestus');
  },

  async deleteFieldWork(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/field-works/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Töö eemaldamine ebaõnnestus');
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
