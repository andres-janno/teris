// src/data/sampleVehicles.ts
import { 
  INITIAL_VEHICLES, 
  INITIAL_IMPLEMENTS, 
  INITIAL_TELTONIKA_DEVICES, 
  enrichVehicles 
} from './sampleFleet';
import type { EnrichedVehicle } from '../types/fleet';

export * from './sampleFleet';

// Default enriched vehicles for map and initial state
export const SAMPLE_VEHICLES: EnrichedVehicle[] = enrichVehicles(
  INITIAL_VEHICLES,
  INITIAL_IMPLEMENTS,
  INITIAL_TELTONIKA_DEVICES
);
