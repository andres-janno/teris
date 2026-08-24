// src/data/sampleFleet.ts
import type { Vehicle, Implement, TeltonikaDevice, EnrichedVehicle } from '../types/fleet';

/**
 * 1. SÕIDUKITE / MASINATE REGISTER (Fleet Register)
 */
export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'veh-01',
    name: 'John Deere 8R 410',
    model: '8R 410 AutoPowr IVT (410 hj)',
    type: 'tractor',
    registrationPlate: '4821 TH',
    driverName: 'Rein Janno',
    color: '#22c55e',
    year: 2023,
    assignedDeviceId: 'tel-01',
    assignedImplementId: 'imp-01',
    notes: 'Põhitraktor külviks ja randaalimiseks, ISOBUS valmidus'
  },
  {
    id: 'veh-02',
    name: 'Fendt 942 Vario',
    model: '942 Vario Gen6 ProfiPlus (415 hj)',
    type: 'tractor',
    registrationPlate: '7712 EK',
    driverName: 'Jaan Tamm',
    color: '#10b981',
    year: 2022,
    assignedDeviceId: 'tel-02',
    assignedImplementId: 'imp-02',
    notes: 'Mullaharimistraktor, GPS automaatrool'
  },
  {
    id: 'veh-03',
    name: 'Horsch Leeb 8.300 PT',
    model: 'Leeb 8.300 PT Isocan (300 hj, 8000L)',
    type: 'sprayer',
    registrationPlate: '1190 TP',
    driverName: 'Priit Kuusk',
    color: '#06b6d4',
    year: 2024,
    assignedDeviceId: 'tel-03',
    assignedImplementId: 'imp-03',
    notes: 'Iseliikuv taimekaitseprits 24m poomiga'
  },
  {
    id: 'veh-04',
    name: 'Claas Lexion 8800 TT',
    model: 'Lexion 8800 Terra Trac (700 hj)',
    type: 'combine',
    registrationPlate: '3349 CL',
    driverName: 'Toomas Sepp',
    color: '#eab308',
    year: 2023,
    assignedDeviceId: 'tel-04',
    assignedImplementId: 'imp-04',
    notes: 'Viljakombain lintidega, 18 000L punkriga'
  },
  {
    id: 'veh-05',
    name: 'Scania R500 Viljaveok',
    model: 'R500 V8 6x4 Kallur (500 hj)',
    type: 'truck',
    registrationPlate: '900 VIL',
    driverName: 'Andres Lepp',
    color: '#f97316',
    year: 2021,
    assignedDeviceId: 'tel-05',
    notes: 'Vilja ja väetise vedu kuivatisse'
  },
  {
    id: 'veh-06',
    name: 'Valtra T234 Versu',
    model: 'T234 SmartTouch (250 hj)',
    type: 'tractor',
    registrationPlate: '5514 VA',
    driverName: 'Marek Pärn',
    color: '#8b5cf6',
    year: 2020,
    assignedDeviceId: undefined, // Hetkel ilma GPS seadmeta
    assignedImplementId: 'imp-05',
    notes: 'Universaaltraktor esilaaduriga'
  }
];

/**
 * 2. HAAKERIISTADE REGISTER (Implements Register)
 */
export const INITIAL_IMPLEMENTS: Implement[] = [
  {
    id: 'imp-01',
    name: 'Väderstad Tempo L 16 (12m külvik)',
    manufacturer: 'Väderstad',
    model: 'Tempo L 16 Row-Clean',
    type: 'seeder',
    workingWidthM: 12.0,
    year: 2023,
    serialNumber: 'TPL16-88902',
    assignedVehicleId: 'veh-01',
    isActive: true,
    notes: '16-reline täppiskülvik, ISOBUS sektsioonijuhtimisega'
  },
  {
    id: 'imp-02',
    name: 'Horsch Joker 8 HD (8m randaal)',
    manufacturer: 'Horsch',
    model: 'Joker 8 HD Heavy Disc',
    type: 'cultivator',
    workingWidthM: 8.0,
    year: 2022,
    serialNumber: 'JK8-33419',
    assignedVehicleId: 'veh-02',
    isActive: true,
    notes: 'Raskerandaal rulliga, sügavus kuni 15cm'
  },
  {
    id: 'imp-03',
    name: 'Poom 24m (BoomControl Pro)',
    manufacturer: 'Horsch Leeb',
    model: 'BoomControl Pro 24/12m',
    type: 'sprayer',
    workingWidthM: 24.0,
    year: 2024,
    serialNumber: 'BC24-99120',
    assignedVehicleId: 'veh-03',
    isActive: false,
    notes: 'Ultrahelisensoritega automaatne kõrgusehoidja'
  },
  {
    id: 'imp-04',
    name: 'Convio Flex 1380 (13.8m heeder)',
    manufacturer: 'Claas',
    model: 'Convio Flex 1380 Draper',
    type: 'header',
    workingWidthM: 13.8,
    year: 2023,
    serialNumber: 'CF1380-4491',
    assignedVehicleId: 'veh-04',
    isActive: false,
    notes: 'Lintheeder lamandunud vilja ja soja koristuseks'
  },
  {
    id: 'imp-05',
    name: 'Lemken Diamant 16 (7-hõlmaline ader)',
    manufacturer: 'Lemken',
    model: 'Diamant 16 V L100',
    type: 'plow',
    workingWidthM: 3.5,
    year: 2021,
    serialNumber: 'LMK16-7782',
    assignedVehicleId: 'veh-06',
    isActive: false,
    notes: 'Poolrippes pöördader kivikaitsega'
  },
  {
    id: 'imp-06',
    name: 'Amazone ZA-TS 4200 (36m väetiselaotur)',
    manufacturer: 'Amazone',
    model: 'ZA-TS 4200 Profis Hydro',
    type: 'fertilizer_spreader',
    workingWidthM: 36.0,
    year: 2023,
    serialNumber: 'AMZ-4200-112',
    assignedVehicleId: undefined, // Vaba laos
    isActive: false,
    notes: 'Kaaludega täppisväetise laotur, tuulesensoriga'
  },
  {
    id: 'imp-07',
    name: 'Väderstad Carrier 650 (6.5m ketasäke)',
    manufacturer: 'Väderstad',
    model: 'Carrier CR 650 CrossCutter',
    type: 'disc_harrow',
    workingWidthM: 6.5,
    year: 2020,
    serialNumber: 'CR650-5512',
    assignedVehicleId: undefined, // Vaba laos
    isActive: false,
    notes: 'Kõrrekoorija madalharimiseks'
  },
  {
    id: 'imp-08',
    name: 'Joskin Trans-KTP 27/65 (27t viljahaagis)',
    manufacturer: 'Joskin',
    model: 'Trans-KTP 27/65 Silo-SPACE',
    type: 'trailer',
    workingWidthM: 2.8,
    year: 2022,
    serialNumber: 'JSK-2765-88',
    assignedVehicleId: undefined, // Vaba laos
    isActive: false,
    notes: 'Kolmeteljeline hüdrauliline kallurhaagis'
  }
];

/**
 * 3. TELTONIKA TELEMEETRIA SEADMETE REGISTER (GPS Devices Register)
 */
export const INITIAL_TELTONIKA_DEVICES: TeltonikaDevice[] = [
  {
    id: 'tel-01',
    imei: '861234058812001',
    model: 'FMB640 PRO',
    simNumber: '+372 5311 8812',
    firmwareVersion: '03.28.02.Rev.14',
    assignedVehicleId: 'veh-01',
    batteryVoltage: 27.8,
    fuelLevelPct: 74,
    fuelConsumptionLh: 23.8,
    engineRpm: 1680,
    engineTempC: 85,
    engineHours: 1420.5,
    ignition: true,
    hydraulicActive: true,
    satelliteCount: 19,
    hdop: 0.7,
    position: [58.1385, 25.8835],
    altitude: 68,
    heading: 85,
    speedKmH: 11.2,
    status: 'working',
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'tel-02',
    imei: '864552043341002',
    model: 'FMC650 4G LTE',
    simNumber: '+372 5322 3341',
    firmwareVersion: '01.02.09.Rev.04',
    assignedVehicleId: 'veh-02',
    batteryVoltage: 28.1,
    fuelLevelPct: 82,
    fuelConsumptionLh: 29.5,
    engineRpm: 1550,
    engineTempC: 84,
    engineHours: 890.0,
    ignition: true,
    hydraulicActive: true,
    satelliteCount: 22,
    hdop: 0.6,
    position: [58.1438, 25.8640],
    altitude: 65,
    heading: 260,
    speedKmH: 12.5,
    status: 'working',
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'tel-03',
    imei: '861234055590003',
    model: 'FMB640 PRO',
    simNumber: '+372 5333 5590',
    firmwareVersion: '03.28.02.Rev.14',
    assignedVehicleId: 'veh-03',
    batteryVoltage: 27.6,
    fuelLevelPct: 62,
    fuelConsumptionLh: 16.5,
    engineRpm: 1450,
    engineTempC: 82,
    engineHours: 640.2,
    ignition: true,
    hydraulicActive: false,
    satelliteCount: 18,
    hdop: 0.8,
    position: [58.1360, 25.8805],
    altitude: 67,
    heading: 175,
    speedKmH: 24.0,
    status: 'moving',
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'tel-04',
    imei: '864552049901004',
    model: 'FMC650 4G LTE',
    simNumber: '+372 5344 9901',
    firmwareVersion: '01.02.09.Rev.04',
    assignedVehicleId: 'veh-04',
    batteryVoltage: 25.9,
    fuelLevelPct: 95,
    fuelConsumptionLh: 0.0,
    engineRpm: 0,
    engineTempC: 24,
    engineHours: 520.1,
    ignition: false,
    hydraulicActive: false,
    satelliteCount: 15,
    hdop: 0.9,
    position: [58.1352, 25.8790],
    altitude: 66,
    heading: 0,
    speedKmH: 0.0,
    status: 'stopped',
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'tel-05',
    imei: '869920011102005',
    model: 'FMB920 Compact',
    simNumber: '+372 5355 1102',
    firmwareVersion: '03.25.15.Rev.01',
    assignedVehicleId: 'veh-05',
    batteryVoltage: 27.2,
    fuelLevelPct: 78,
    fuelConsumptionLh: 2.1,
    engineRpm: 600,
    engineTempC: 80,
    engineHours: 4200.8,
    ignition: true,
    hydraulicActive: false,
    satelliteCount: 16,
    hdop: 0.8,
    position: [58.1355, 25.8798],
    altitude: 66,
    heading: 45,
    speedKmH: 0.0,
    status: 'idling',
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'tel-06',
    imei: '867740027740006',
    model: 'FMM640 CAT-M1',
    simNumber: '+372 5366 7740',
    firmwareVersion: '02.01.04.Rev.02',
    assignedVehicleId: undefined, // Vaba riiulis
    batteryVoltage: 12.8,
    fuelLevelPct: 100,
    fuelConsumptionLh: 0.0,
    engineRpm: 0,
    engineTempC: 20,
    engineHours: 0.0,
    ignition: false,
    hydraulicActive: false,
    satelliteCount: 14,
    hdop: 1.0,
    position: [58.1402, 25.8030], // Töökojas Kärstna farm
    altitude: 65,
    heading: 0,
    speedKmH: 0.0,
    status: 'offline',
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'tel-07',
    imei: '861400014419007',
    model: 'FMB140 CAN/BLE',
    simNumber: '+372 5377 4419',
    firmwareVersion: '03.27.08.Rev.08',
    assignedVehicleId: undefined, // Vaba varuseade
    batteryVoltage: 12.6,
    fuelLevelPct: 100,
    fuelConsumptionLh: 0.0,
    engineRpm: 0,
    engineTempC: 21,
    engineHours: 120.0,
    ignition: false,
    hydraulicActive: false,
    satelliteCount: 12,
    hdop: 1.1,
    position: [58.1402, 25.8030], // Töökojas Kärstna farm
    altitude: 65,
    heading: 0,
    speedKmH: 0.0,
    status: 'offline',
    lastUpdate: new Date().toISOString()
  }
];

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

    const position = device ? device.position : [58.1385, 25.8835] as [number, number];
    const heading = device ? device.heading : 0;
    const speedKmH = device ? device.speedKmH : 0;
    const status = device ? device.status : 'offline';
    const altitude = device ? device.altitude : 68;

    return {
      ...v,
      status,
      position,
      heading,
      speedKmH,
      altitude,
      telemetry: {
        deviceId: device ? `${device.model} (${device.imei.slice(-4)})` : 'PAIGALDAMATA',
        batteryVoltage: device ? device.batteryVoltage : 0,
        fuelLevelPct: device ? device.fuelLevelPct : 0,
        fuelConsumptionLh: device ? device.fuelConsumptionLh : 0,
        engineRpm: device ? device.engineRpm : 0,
        engineTempC: device ? device.engineTempC : 0,
        engineHours: device ? device.engineHours : 0,
        ignition: device ? device.ignition : false,
        hydraulicActive: device ? device.hydraulicActive : false,
        satelliteCount: device ? device.satelliteCount : 0,
        hdop: device ? device.hdop : 9.9,
        lastUpdate: device ? device.lastUpdate : new Date().toISOString()
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
