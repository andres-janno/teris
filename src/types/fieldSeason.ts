import type { Polygon, MultiPolygon } from 'geojson';
import type { FieldCadastralLink } from './cadastre';

/**
 * Normaliseeritud relatsiooniline kirje andmebaasis (Prisma: model FieldSeason)
 * Seob põllu (Field) ja hooaja (Season).
 */
export interface FieldSeasonEntity {
  id: number;                          // Int @id @default(autoincrement())
  fieldId: number;                     // Int (FK -> Field.id)
  seasonId?: number | null;            // Int? (FK -> Season.id)
  year: number;                        // Int (Hooaja aasta, nt 2026)
  areaHa: number;                      // Float (Põllu suurus sellel konkreetsel aastal)
  eligibleAreaHa?: number | null;      // Float? (PRIA toetusõiguslik pindala ha)
  areaChangeReason?: string | null;    // String? (Põhjus nt võsastumine, kraaviäär, laienemine)
  crop: string;                        // String (Põllukultuur)
  cropVariety?: string | null;         // String? (Sordinimi)
  cropColor: string;                   // String (Kaardi värv)
  targetYieldTonsHa?: number | null;   // Float? (Plaaniline saak t/ha)
  actualYieldTonsHa?: number | null;   // Float? (Tegelik saak t/ha)
  workedAreaHa?: number;               // Float (Haritud pindala ha)
  workProgress?: number;               // Float (Edenemine 0-100%)
  status?: 'not_started' | 'in_progress' | 'completed' | string;
  seedingDate?: string | null;         // DateTime? / String?
  harvestDate?: string | null;         // DateTime? / String?
  boundaryPointsCount?: number | null; // Int? (Geomeetria tippude/punktide arv)
  perimeterM?: number | null;          // Float? (Põllu ümbermõõt meetrites)
  notes?: string | null;               // String? (Märkmed)
  cadastralParcels?: FieldCadastralLink[]; // Selle konkreetse hooaja koosseisu kuuluvad katastriüksused
  geometry: Polygon | MultiPolygon;    // Json (GeoJSON geomeetria sellel hooajal)
}

export type FieldYearlyRecord = FieldSeasonEntity;


