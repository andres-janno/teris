// src/types/fieldRegister.ts
import type { Polygon, MultiPolygon } from 'geojson';
import type { FieldFeature, FieldCollection } from './field';

/**
 * Ühe konkreetse põllumajandusaasta / hooaja kirje (suurus ja kultuur võivad igal aastal erineda)
 */
export interface FieldYearlyRecord {
  year: number;                 // Hooaja aasta (nt 2026, 2025, 2024, 2027)
  areaHa: number;               // Põllu pindala sellel aastal (hektarites)
  crop: string;                 // Põllukultuur (nt Talinisu, Suvioder, Taliraps)
  cropVariety?: string;         // Sordinimi (nt 'Skagen', 'Planet', 'Mercedes')
  cropColor: string;            // Värvikood kaardil (nt #eab308)
  targetYieldTonsHa?: number;   // Plaaniline saagikus (t/ha)
  actualYieldTonsHa?: number;   // Tegelik koristatud saagikus (t/ha)
  workedAreaHa?: number;        // Haritud pindala sellel aastal
  workProgress?: number;        // Töö edenemine (0 - 100%)
  status?: 'not_started' | 'in_progress' | 'completed';
  seedingDate?: string;         // Külvikuupäev (ISO / string)
  harvestDate?: string;         // Koristuskuupäev
  notes?: string;               // Hooaja märkmed (väetised, taimekaitse, PRIA toetuskood)
}

/**
 * Põllu püsiv master-kirje registris
 */
export interface MasterField {
  id: string;                   // Püsiv kordumatu ID (nt 'field-pria-2')
  name: string;                 // Põllu nimi (nt 'Põld nr 2 (Loisu)')
  fieldCode: string;            // PRIA põllu / massiivi number
  cadastralCode?: string;       // Katastritunnus (nt '89201:001:0100')
  soilType?: string;            // Mullastik (nt 'Leostunud liivsavi / LP')
  drainageSystem?: boolean;     // Drenaaž / maaparandussüsteem olemas
  landowner?: string;           // Maaomanik / rentnik
  notes?: string;               // Üldised püsivad märkmed
  geometry: Polygon | MultiPolygon; // Põllu piirid (GeoJSON)
  history: FieldYearlyRecord[]; // Aastate ajalugu (aasta kaupa pindalad ja kultuurid)
}

/**
 * Teisendab MasterField kirje vastava aasta GeoJSON FieldFeature-iks kaardil kuvamiseks
 */
export function getFieldFeatureForYear(field: MasterField, selectedYear: number): FieldFeature {
  const yearRecord = field.history.find((h) => h.year === selectedYear) 
    || field.history[0] 
    || {
      year: selectedYear,
      areaHa: 0,
      crop: 'Määramata',
      cropColor: '#94a3b8',
      workedAreaHa: 0,
      workProgress: 0,
      status: 'not_started'
    };

  return {
    type: 'Feature',
    id: field.id,
    geometry: field.geometry,
    properties: {
      id: field.id,
      name: field.name,
      fieldCode: field.fieldCode,
      cadastralCode: field.cadastralCode,
      areaHa: yearRecord.areaHa,
      crop: yearRecord.crop,
      cropColor: yearRecord.cropColor,
      year: yearRecord.year,
      workedAreaHa: yearRecord.workedAreaHa || 0,
      workProgress: yearRecord.workProgress || 0,
      status: yearRecord.status || 'not_started',
      notes: yearRecord.notes || field.notes,
      rawProperties: {
        soilType: field.soilType,
        landowner: field.landowner,
        drainageSystem: field.drainageSystem,
        variety: yearRecord.cropVariety,
        targetYield: yearRecord.targetYieldTonsHa,
        historyCount: field.history.length
      }
    }
  };
}

/**
 * Genereerib valitud aasta kohta täieliku FeatureCollection-i
 */
export function generateFieldCollectionForYear(masterFields: MasterField[], selectedYear: number): FieldCollection {
  return {
    type: 'FeatureCollection',
    features: masterFields.map((f) => getFieldFeatureForYear(f, selectedYear))
  };
}
