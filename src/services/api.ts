// src/services/api.ts
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import type { Vehicle, Implement, TeltonikaDevice } from '../types/fleet';
import type { PointOfInterest } from '../types/poi';
import type { RelatedParty } from '../types/party';
import type { Crop } from '../types/crop';

export const api = {
  async getStatus(): Promise<{ status: string; database: string; counts: Record<string, number> }> {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('API status check failed');
    return res.json();
  },

  async getMasterFields(): Promise<MasterField[]> {
    const res = await fetch('/api/master-fields');
    if (!res.ok) throw new Error('Failed to fetch master fields');
    return res.json();
  },

  async saveMasterFields(fields: MasterField | MasterField[]): Promise<{ success: boolean; count: number }> {
    const res = await fetch('/api/master-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    if (!res.ok) throw new Error('Failed to save master fields');
    return res.json();
  },

  async deleteMasterField(id: number | string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/master-fields/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`Failed to delete field ${id}`);
    return res.json();
  },

  async getSeasons(): Promise<FarmingSeason[]> {
    const res = await fetch('/api/seasons');
    if (!res.ok) throw new Error('Failed to fetch seasons');
    return res.json();
  },

  async saveSeason(season: FarmingSeason): Promise<any> {
    const res = await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(season)
    });
    if (!res.ok) throw new Error('Failed to save season');
    return res.json();
  },

  async getFleet(): Promise<{ vehicles: Vehicle[]; implements: Implement[]; devices: TeltonikaDevice[] }> {
    const res = await fetch('/api/fleet');
    if (!res.ok) throw new Error('Failed to fetch fleet');
    return res.json();
  },

  async saveVehicle(vehicle: Vehicle): Promise<any> {
    const res = await fetch('/api/fleet/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicle)
    });
    if (!res.ok) throw new Error('Failed to save vehicle');
    return res.json();
  },

  async deleteVehicle(id: string): Promise<any> {
    const res = await fetch(`/api/fleet/vehicles/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete vehicle');
    return res.json();
  },

  async saveImplement(implement: Implement): Promise<any> {
    const res = await fetch('/api/fleet/implements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(implement)
    });
    if (!res.ok) throw new Error('Failed to save implement');
    return res.json();
  },

  async deleteImplement(id: string): Promise<any> {
    const res = await fetch(`/api/fleet/implements/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete implement');
    return res.json();
  },

  async assignImplement(implementId: string, vehicleId?: string): Promise<any> {
    const res = await fetch('/api/fleet/implements/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ implementId, vehicleId })
    });
    if (!res.ok) throw new Error('Failed to assign implement');
    return res.json();
  },

  async saveDevice(device: TeltonikaDevice): Promise<any> {
    const res = await fetch('/api/fleet/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device)
    });
    if (!res.ok) throw new Error('Failed to save device');
    return res.json();
  },

  async deleteDevice(id: string): Promise<any> {
    const res = await fetch(`/api/fleet/devices/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete device');
    return res.json();
  },

  async assignDevice(deviceId: string, vehicleId?: string, implementId?: string): Promise<any> {
    const res = await fetch('/api/fleet/devices/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, vehicleId, implementId })
    });
    if (!res.ok) throw new Error('Failed to assign device');
    return res.json();
  },

  async getPois(): Promise<PointOfInterest[]> {
    const res = await fetch('/api/poi');
    if (!res.ok) throw new Error('Failed to fetch POIs');
    return res.json();
  },

  async savePoi(poi: Partial<PointOfInterest>): Promise<any> {
    const res = await fetch('/api/poi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(poi)
    });
    if (!res.ok) throw new Error('Failed to save POI');
    return res.json();
  },

  async deletePoi(id: string): Promise<any> {
    const res = await fetch(`/api/poi/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete POI');
    return res.json();
  },

  async getParties(): Promise<RelatedParty[]> {
    const res = await fetch('/api/parties');
    if (!res.ok) throw new Error('Failed to fetch parties');
    return res.json();
  },

  async saveParty(party: RelatedParty): Promise<any> {
    const res = await fetch('/api/parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(party)
    });
    if (!res.ok) throw new Error('Failed to save party');
    return res.json();
  },

  async deleteParty(id: string): Promise<any> {
    const res = await fetch(`/api/parties/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete party');
    return res.json();
  },

  async getCrops(): Promise<Crop[]> {
    const res = await fetch('/api/crops');
    if (!res.ok) throw new Error('Failed to fetch crops');
    return res.json();
  },

  async saveCrop(crop: Crop): Promise<any> {
    const res = await fetch('/api/crops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crop)
    });
    if (!res.ok) throw new Error('Failed to save crop');
    return res.json();
  },

  async deleteCrop(id: string): Promise<any> {
    const res = await fetch(`/api/crops/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete crop');
    return res.json();
  }
};
