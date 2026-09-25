// src/services/fleet.ts
import type { Vehicle, Implement, TeltonikaDevice, EnrichedVehicle } from '../types/fleet';

/**
 * Ühendab 3 eraldi registrit täielikuks kaardi ja simulatsiooni vaateks
 */
export function enrichVehicles(
  vehicles: Vehicle[],
  implementsList: Implement[],
  devices: TeltonikaDevice[]
): EnrichedVehicle[] {
  return vehicles.map((v) => {
    // Leia paigaldatud Teltonika seade
    const device = devices.find((d) => d.id === v.assignedDeviceId || d.assignedVehicleId === v.id);
    
    // Leia haagitud tööriist
    const implement = implementsList.find((imp) => imp.id === v.assignedImplementId || imp.assignedVehicleId === v.id);

    // `??` (mitte `device ? device.X : ...`), sest seade võib eksisteerida, aga
    // mõni telemeetriaväli olla puudu (nt registrist laaditud seade, millel
    // pole veel elavat GPS-voogu) —
    // sel juhul annab ternary otse `device.X` ehk undefined, mis lõhub UI-s
    // `.toFixed()` jms kutsed.
    const position = device?.position ?? ([58.1385, 25.8835] as [number, number]);
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
        lastUpdate: device?.lastUpdate ?? new Date().toISOString()
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
