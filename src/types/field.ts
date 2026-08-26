// src/types/field.ts
import type { Feature, Polygon, MultiPolygon } from 'geojson';

/**
 * Põllu püsivad ja muutumatud põhiandmed
 */
export interface BaseFieldProperties {
  id: number | string;        // Unikaalne sisemine ID (autoincrement)
  num?: string;               // PRIA põllu number impordist (nt '4', '4-1', '1')
  name: string;               // Põllu nimi (kasutaja määratud)
  fieldCode: string;          // PRIA massiivi number (nt '61144313542')
  cadastralCode?: string;     // Katastritunnus
  soilType?: string;          // Mullastik
  drainageSystem?: boolean;   // Drenaaž / maaparandussüsteem
  landowner?: string;         // Maaomanik / rentnik
  notes?: string;             // Üldised püsivad märkmed
  rawProperties?: Record<string, any>;
}

export type BaseFieldInfo = BaseFieldProperties;

export type BaseFieldFeature = Feature<Polygon | MultiPolygon, BaseFieldProperties>;

export interface BaseFieldCollection {
  type: 'FeatureCollection';
  features: BaseFieldFeature[];
}

/**
 * Konkreetse põllumajandusaasta liitandmed (kaardil kuvamiseks)
 */
export interface FieldProperties extends BaseFieldProperties {
  areaHa: number;             // Pindala hektarites (sellel aastal)
  perimeterM?: number;        // Ümbermõõt meetrites
  crop?: string;              // Põllukultuur (nt Talinisu, Oder, Raps)
  cropColor?: string;         // Visuaalne värv kaardil
  year?: number;              // Hooeaasta aasta
  workedAreaHa?: number;      // Haritud pindala (arvutatud Teltonika järgi)
  workProgress?: number;      // 0 - 100%
  status?: 'not_started' | 'in_progress' | 'completed';
}

export type FieldFeature = Feature<Polygon | MultiPolygon, FieldProperties>;

export interface FieldCollection {
  type: 'FeatureCollection';
  features: FieldFeature[];
}

export * from './fieldRegister';


