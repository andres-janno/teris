// src/types/fleet.ts
export type VehicleType = 'tractor' | 'combine' | 'sprayer' | 'spreader' | 'truck' | 'atv' | 'loader';
export type VehicleStatus = 'working' | 'moving' | 'idling' | 'stopped' | 'offline';
export type ImplementType = 
  | 'seeder' 
  | 'cultivator' 
  | 'sprayer' 
  | 'header' 
  | 'plow' 
  | 'mower' 
  | 'fertilizer_spreader' 
  | 'disc_harrow'
  | 'trailer'
  | 'roller'
  | 'other';

/**
 * Sõiduki / Masina register
 */
/** Amortisatsioonimeetod: lineaarne (soetusmaksumusest) või degressiivne (jääkväärtusest). */
export type DepreciationMethod = 'linear' | 'declining';

export interface Vehicle {
  id: string;
  name: string;
  manufacturer?: string;          // Tootja
  model: string;
  type: VehicleType;
  category?: string;              // Masina liik (vabatekst)
  powerKw?: number;               // Mootorivõimsus kW
  acquisitionCost?: number;       // Soetusmaksumus (€)
  acquisitionDate?: string;       // Soetamise kuupäev (YYYY-MM-DD)
  depreciationRate?: number;      // Amortisatsioonimäär (% aastas)
  depreciationMethod?: DepreciationMethod;
  registrationPlate?: string;
  serialNumber?: string;          // VIN / seerianumber
  driverName?: string;
  color: string;
  year?: number;
  assignedDeviceId?: string;      // Seotud telemeetriaseadme ID (seoste registrist)
  assignedImplementId?: string;   // Seotud Haakeriista ID
  lastKnownPosition?: [number, number]; // Viimane teadaolev asukoht enne seadme eemaldamist
  lastActiveAt?: string;                // Viimane liikumise / telemeetria aeg
  notes?: string;
}

/** Telemeetriaseadmete seoste registri kirje: seade on seotud masina VÕI haakeriistaga. */
export interface DeviceAssignment {
  id: string;
  deviceId: string;
  deviceModel?: string;
  deviceIdentifier?: string;      // IMEI (mobiilne seade) või MAC (Eye sensor)
  deviceConnectivity?: DeviceConnectivity;
  vehicleId?: string;
  vehicleName?: string;
  implementId?: string;
  implementName?: string;
  startedAt: string;
  endedAt?: string;
  notes?: string;
  createdAt?: string;
}

export interface DeviceAssignmentInput {
  deviceId: string;
  vehicleId?: string;
  implementId?: string;
  startedAt: string;
  endedAt: string | null;
  notes?: string;
}

export interface ImplementAssignment {
  id: string;
  vehicleId: string;
  implementId: string;
  vehicleName?: string;
  vehicleType?: string;
  implementName?: string;
  implementCategory?: string;
  startedAt: string;
  endedAt?: string;
  notes?: string;
  createdAt?: string;
}

/**
 * Haakeriistade register
 */
export interface Implement {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  type: ImplementType;
  category?: string;              // Haakeriista liik (vabatekst, eraldi masinate liikidest)
  acquisitionCost?: number;       // Soetusmaksumus (€)
  acquisitionDate?: string;       // Soetamise kuupäev (YYYY-MM-DD)
  depreciationRate?: number;      // Amortisatsioonimäär (% aastas)
  depreciationMethod?: DepreciationMethod;
  workingWidthM: number;          // Töölaius meetrites (nt 12m)
  offsetM?: number;              // Külgnihe
  year?: number;
  serialNumber?: string;
  assignedVehicleId?: string;    // Millise masina küljes (kui on haagitud)
  assignedDeviceId?: string;     // Külge paigaldatud seade (nt Eye sensor otsikul)
  isActive?: boolean;            // Kas tööasendis (maas)
  notes?: string;
}

export type DeviceConnectivity = 'cellular' | 'eye_sensor';

/**
 * Telemeetriaseadmete (GPS-jälgurid ja andurid) register.
 * Kaks sidususe tüüpi: 'cellular' (IMEI + SIM, paigaldatakse masinasse)
 * ja 'eye_sensor' (MAC-aadress, BLE-andur haakeriista küljes).
 */
export interface TelemetryDevice {
  id: string;
  connectivityType: DeviceConnectivity;
  imei?: string;                 // Kohustuslik ainult 'cellular' tüübil
  simNumber?: string;             // Ainult 'cellular' tüübil
  macAddress?: string;            // Kohustuslik ainult 'eye_sensor' tüübil
  model: string;                 // nt FMB640, FMC650 või vabatekst Eye sensori mudel
  firmwareVersion?: string;
  acquisitionDate?: string;       // Soetamise kuupäev (YYYY-MM-DD)
  assignedVehicleId?: string;    // Millisesse masinasse paigaldatud (kui on paigaldatud)
  assignedImplementId?: string;  // Millise haakeriista külge paigaldatud (kui on paigaldatud)
  notes?: string;

  // Reaalaja telemeetria
  // 'eye_sensor' seadmetel hoiab batteryVoltage aku TASET %-des (mitte V),
  // kuna Eye sensor ei raporteeri pinget, vaid protsenti — tsdb ainuke
  // saadaolev aku-mõõdik selle seadmetüübi jaoks.
  batteryVoltage: number;        // V (cellular) või % (eye_sensor)
  eyeTemperatureC?: number;      // °C — ainult 'eye_sensor'
  eyeHumidityPercent?: number;   // % — ainult 'eye_sensor'
  eyeMagnetClosed?: boolean;     // Magnetkontakt suletud — ainult 'eye_sensor'
  fuelLevelPct: number;          // % (nt 74%)
  fuelConsumptionLh?: number;    // L/h (nt 23.8 L/h)
  engineRpm?: number;            // p/min
  engineTempC?: number;          // °C
  engineHours?: number;          // töötunnid
  ignition: boolean;             // Süüde sees
  hydraulicActive: boolean;      // Hüdraulika / rippsüsteem
  satelliteCount: number;        // Satelliite
  hdop: number;                  // Täpsusfaktor
  
  // GPS Asukoht
  position?: [number, number];   // [lat, lng]
  altitude?: number;             // m
  heading: number;               // 0 - 360 kraadi
  speedKmH: number;              // km/h
  status: VehicleStatus;
  lastUpdate: string;            // ISO timestamp
}

/**
 * Liitandmetega sõiduk kaardi ja vaadete jaoks (Vehicle + Device Telemetry + Implement)
 */
export interface EnrichedVehicle extends Vehicle {
  status: VehicleStatus;
  position?: [number, number];
  heading: number;
  speedKmH: number;
  altitude?: number;
  telemetry: {
    deviceId: string;
    batteryVoltage: number;
    fuelLevelPct: number;
    fuelConsumptionLh?: number;
    engineRpm?: number;
    engineTempC?: number;
    engineHours?: number;
    ignition: boolean;
    hydraulicActive: boolean;
    satelliteCount: number;
    hdop: number;
    lastUpdate: string;
  };
  implement?: {
    id: string;
    name: string;
    type: ImplementType;
    workingWidthM: number;
    offsetM?: number;
    isActive: boolean;
  };
}
