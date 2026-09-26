// src/services/api.ts
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import type { Vehicle, Implement, TeltonikaDevice } from '../types/fleet';
import type { PointOfInterest } from '../types/poi';
import type { RelatedParty } from '../types/party';
import type { Crop } from '../types/crop';
import type { SoilSample } from '../types/soilSample';
import type { FieldBookImportPayload, FieldBookImportResult, FieldOperationsResponse } from '../types/fieldOperation';
import type { AuthUser } from '../types/auth';

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
    if (!res.ok) throw new Error(await errorMessage(res, 'Parooli muutmine ebaõnnestus'));
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
  }
};
