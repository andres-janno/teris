// src/types/vehicle.ts
export * from './fleet';

// Re-export EnrichedVehicle as Vehicle for backward compatibility with components expecting full telemetry
import type { EnrichedVehicle } from './fleet';
export type { EnrichedVehicle as Vehicle };
