import type { Polygon, MultiPolygon } from 'geojson';
import type { FieldFeature, FieldCollection } from './field';
import type { FieldCadastralLink } from './cadastre';

/**
 * Ühe konkreetse põllumajandusaasta / hooaja kirje (suurus ja kultuur võivad igal aastal erineda)
 */
export interface FieldYearlyRecord {
  fieldSeasonId?: number;       // andmebaasi field_seasons.id (serverist; uuel kirjel puudub)
  year: number;                 // Hooaja aasta (nt 2026, 2025, 2024, 2027)
  areaHa: number;               // Põllu pindala sellel aastal (hektarites)
  eligibleAreaHa?: number | null; // PRIA toetusõiguslik pindala ha
  areaChangeReason?: string | null; // Pindala muutuse põhjus (nt võsa pealekasv, kraavihooldus)
  crop: string;                 // Põllukultuur (nt Talinisu, Suvioder, Taliraps)
  cropVariety?: string | null;  // Sordinimi (nt 'Skagen', 'Planet', 'Mercedes')
  cropColor: string;            // Värvikood kaardil (nt #eab308)
  operationsCount?: number;     // Põlluraamatu tegevuste arv sel aastal (ainult lugemiseks)
  targetYieldTonsHa?: number | null; // Plaaniline saagikus (t/ha)
  actualYieldTonsHa?: number | null; // Tegelik koristatud saagikus (t/ha)
  workedAreaHa?: number;        // Haritud pindala sellel aastal
  workProgress?: number;        // Töö edenemine (0 - 100%)
  status?: 'not_started' | 'in_progress' | 'completed';
  seedingDate?: string | null;  // Külvikuupäev (ISO / string)
  harvestDate?: string | null;  // Koristuskuupäev
  boundaryPointsCount?: number | null; // Tippude arv
  perimeterM?: number | null;   // Ümbermõõt meetrites
  notes?: string | null;        // Hooaja märkmed (väetised, taimekaitse, PRIA toetuskood)
  cadastralParcels?: FieldCadastralLink[]; // Selle konkreetse hooaja koosseisu kuuluvad katastriüksused
  geometry?: Polygon | MultiPolygon; // Selle konkreetse hooaja/aasta põllupiirid
}

/**
 * Põllu püsiv master-kirje registris
 */
export interface MasterField {
  id: number | string;          // Unikaalne sisemine number / ID (autoincrement andmebaasis)
  num?: string;                 // Põllu number PRIA impordist (nt '4', '4-1', '1', '2A')
  name: string;                 // Põllu nimi (kasutaja poolt määratud/muudetav)
  fieldCode: string;            // PRIA massiivi number (nt '61144313542')
  cadastralCode?: string;       // Peamine katastritunnus (tagasiühilduvuse jaoks)
  cadastralParcels?: FieldCadastralLink[]; // Baas/vaikimisi katastriüksused
  soilType?: string;            // Mullastik (nt 'Leostunud liivsavi / LP')
  drainageSystem?: boolean;     // Drenaaž / maaparandussüsteem olemas
  operatorId?: string;          // Põllu operaator ID (seotud isikute registrist)
  operatorName?: string;        // Põllu operaatori nimi (serveri poolt lisatud, kuvamiseks)
  notes?: string;               // Üldised püsivad märkmed
  geometry?: Polygon | MultiPolygon; // Baaspiirid (kui aasta oma puudub)
  history: FieldYearlyRecord[]; // Aastate ajalugu (aasta kaupa pindalad, piirid, katastrid ja kultuurid)
}

/**
 * Loendab GeoJSON geomeetria tippude (punktide) arvu
 */
export function countGeometryVertices(geometry?: Polygon | MultiPolygon): number {
  if (!geometry || !geometry.coordinates) return 0;
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce((sum, poly) => 
      sum + poly.reduce((pSum, ring) => pSum + ring.length, 0), 0);
  }
  return 0;
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

  const geometry = (yearRecord.geometry || field.geometry || {
    type: 'Polygon',
    coordinates: []
  }) as Polygon | MultiPolygon;

  const pointsCount = yearRecord.boundaryPointsCount || countGeometryVertices(geometry);
  const activeCadastralParcels = yearRecord.cadastralParcels || field.cadastralParcels || [];

  return {
    type: 'Feature',
    id: field.id,
    geometry,
    properties: {
      id: field.id,
      num: field.num,
      name: field.name,
      fieldCode: field.fieldCode,
      cadastralCode: field.cadastralCode,
      areaHa: yearRecord.areaHa,
      eligibleAreaHa: yearRecord.eligibleAreaHa,
      areaChangeReason: yearRecord.areaChangeReason,
      perimeterM: yearRecord.perimeterM,
      crop: yearRecord.crop,
      cropColor: yearRecord.cropColor,
      year: yearRecord.year,
      workedAreaHa: yearRecord.workedAreaHa || 0,
      workProgress: yearRecord.workProgress || 0,
      status: (yearRecord.status as any) || 'not_started',
      notes: yearRecord.notes || field.notes,
      rawProperties: {
        soilType: field.soilType,
        drainageSystem: field.drainageSystem,
        cadastralParcels: activeCadastralParcels,
        variety: yearRecord.cropVariety,
        targetYield: yearRecord.targetYieldTonsHa,
        actualYield: yearRecord.actualYieldTonsHa,
        pointsCount,
        historyCount: field.history.length
      }
    }
  };
}

/**
 * Genereerib valitud aasta kohta täieliku FeatureCollection-i.
 * Näitab ainult põlde, millel on TÄPSELT selle aasta kirje — muidu näitaks
 * (getFieldFeatureForYear'i history[0]-fallbacki tõttu) ka põlde, mida
 * sel aastal üldse deklareeritud pole, nende vana aasta andmetega, mis
 * paisutab välja nii põldude arvu kui kogupindala (nt PRIA 2026 impordi
 * järel: reaalselt 31 põldu deklareeritud, aga kuvati kõik 38 registris
 * olevat põldu).
 */
export function generateFieldCollectionForYear(masterFields: MasterField[], selectedYear: number): FieldCollection {
  return {
    type: 'FeatureCollection',
    features: masterFields
      .filter((f) => f.history.some((h) => h.year === selectedYear))
      .map((f) => getFieldFeatureForYear(f, selectedYear))
  };
}

