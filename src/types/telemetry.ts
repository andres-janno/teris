// src/types/telemetry.ts
import type { Feature, Polygon, MultiPolygon, LineString } from 'geojson';

export interface TelemetryPoint {
  timestamp: string;          // ISO string
  lat: number;
  lng: number;
  altitude?: number;
  speedKmH: number;
  heading: number;
  isWorking: boolean;         // DIN1 või CAN signaal: haakeriist tööasendis
  workingWidthM: number;      // Töölaius antud hetkel
  fuelRateLh?: number;
  engineRpm?: number;
}

export interface CultivationPass {
  id: string;
  fieldId?: string;
  vehicleId: string;
  vehicleName: string;
  operationType: string;      // nt "Külv", "Kultiveerimine", "Taimekaitse"
  startTime: string;
  endTime?: string;
  workingWidthM: number;
  points: TelemetryPoint[];
  swathPolygon?: Feature<Polygon | MultiPolygon>;
  trailLine?: Feature<LineString>;
  workedAreaHa: number;
  distanceKm: number;
  avgSpeedKmH: number;
}
