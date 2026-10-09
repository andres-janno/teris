// src/services/fleet.ts
import type { Vehicle, Implement, TelemetryDevice, EnrichedVehicle } from '../types/fleet';

/**
 * Ühendab 3 eraldi registrit täielikuks kaardi ja simulatsiooni vaateks
 */
export function enrichVehicles(
  vehicles: Vehicle[],
  implementsList: Implement[],
  devices: TelemetryDevice[]
): EnrichedVehicle[] {
  return vehicles.map((v) => {
    // Leia paigaldatud telemeetriaseade
    const device = devices.find((d) => d.id === v.assignedDeviceId || d.assignedVehicleId === v.id);
    
    // Leia haagitud tööriist
    const implement = implementsList.find((imp) => imp.id === v.assignedImplementId || imp.assignedVehicleId === v.id);

    // Kui seade on hetkel küljes, kasuta seadme asukohta;
    // kui seade eemaldati, säilita masina viimane teadaolev asukoht enne eemaldamist
    const position = device?.position ?? v.lastKnownPosition;
    const heading = device?.heading ?? 0;
    const speedKmH = device?.speedKmH ?? 0;
    const status = device?.status ?? 'offline';
    const altitude = device?.altitude ?? 68;

    return {
      ...v,
      status,
      position,
      heading,
      speedKmH,
      altitude,
      telemetry: {
        deviceId: device
          ? `${device.model} (${device.connectivityType === 'eye_sensor' ? device.macAddress : device.imei?.slice(-4)})`
          : 'PAIGALDAMATA',
        batteryVoltage: device?.batteryVoltage ?? 0,
        fuelLevelPct: device?.fuelLevelPct ?? 0,
        fuelConsumptionLh: device?.fuelConsumptionLh ?? 0,
        engineRpm: device?.engineRpm ?? 0,
        engineTempC: device?.engineTempC ?? 0,
        engineHours: device?.engineHours ?? 0,
        ignition: device?.ignition ?? false,
        hydraulicActive: device?.hydraulicActive ?? false,
        satelliteCount: device?.satelliteCount ?? 0,
        hdop: device?.hdop ?? 9.9,
        lastUpdate: device?.lastUpdate || v.lastActiveAt || ''
      },
      implement: implement ? {
        id: implement.id,
        name: implement.name,
        type: implement.type,
        workingWidthM: implement.workingWidthM,
        offsetM: implement.offsetM,
        isActive: implement.isActive ?? (device ? device.hydraulicActive : false)
      } : undefined
    };
  });
}
