// src/types/field.ts
import type { Feature, Polygon, MultiPolygon } from 'geojson';

export interface FieldProperties {
  id: number | string;        // Unikaalne sisemine ID (autoincrement)
  num?: string;               // PRIA põllu number impordist (nt '4', '4-1', '1')
  name: string;               // Põllu nimi (kasutaja määratud)
  fieldCode: string;          // PRIA massiivi number (nt '61144313542')
  cadastralCode?: string;     // Katastritunnus
  areaHa: number;             // Pindala hektarites
  perimeterM?: number;        // Ümbermõõt meetrites
  crop?: string;              // Põllukultuur (nt Talinisu, Oder, Raps)
  cropColor?: string;         // Visuaalne värv kaardil
  year?: number;              // Hooeaasta aasta
  workedAreaHa?: number;      // Haritud pindala (arvutatud Teltonika järgi)
  workProgress?: number;      // 0 - 100%
  status?: 'not_started' | 'in_progress' | 'completed';
  notes?: string;
  rawProperties?: Record<string, any>;
}

export type FieldFeature = Feature<Polygon | MultiPolygon, FieldProperties>;

export interface FieldCollection {
  type: 'FeatureCollection';
  features: FieldFeature[];
}

export * from './fieldRegister';


