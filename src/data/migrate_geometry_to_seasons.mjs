globalThis.self = globalThis;
import fs from 'fs';
import { SAMPLE_FIELDS } from './sampleFields.ts';
import { SAMPLE_FIELD_SEASONS } from './sampleFieldSeasons.ts';

// 1. Create clean static base fields (NO geometries in sampleFields.ts)
const cleanBaseFields = SAMPLE_FIELDS.features.map((feature, idx) => {
  const p = feature.properties || {};
  return {
    id: p.id,
    num: p.num,
    name: p.name,
    fieldCode: p.fieldCode,
    cadastralCode: p.cadastralCode,
    soilType: p.soilType || 'Leostunud liivsavi (LP)',
    drainageSystem: p.drainageSystem ?? (idx % 2 === 0),
    landowner: p.landowner || (idx % 3 === 0 ? 'Oma maa' : (idx % 3 === 1 ? 'Rent (Maaomanik OÜ)' : 'Rent (Eraomanik)')),
    notes: p.notes || '',
    rawProperties: p.rawProperties
  };
});

// Map geometry by field id from current sampleFields
const geometryMap = {};
SAMPLE_FIELDS.features.forEach((feature) => {
  geometryMap[feature.properties.id] = feature.geometry;
});

// 2. Attach geometry to each season in SAMPLE_FIELD_SEASONS
const updatedSeasonsMap = {};
for (const [fieldId, seasons] of Object.entries(SAMPLE_FIELD_SEASONS)) {
  const geom = geometryMap[fieldId];
  updatedSeasonsMap[fieldId] = seasons.map((seasonRec) => ({
    ...seasonRec,
    geometry: geom // Season-specific boundary
  }));
}

// Write sampleFields.ts
const fieldsContent = `// src/data/sampleFields.ts
import type { BaseFieldInfo } from "../types/field";

/**
 * Põldude püsivad ja muutumatud põhiandmed:
 * - id: Unikaalne sisemine ID (autoincrement)
 * - num: Põllu number PRIA impordist / kasutaja määratud
 * - name: Põllu nimi (kasutaja määratud)
 * - fieldCode: PRIA massiivi number
 * - cadastralCode: Katastritunnus
 * - soilType, drainageSystem, landowner: Püsivad maa omadused
 *
 * MÄRKUS: Põllu piirid / geomeetria asuvad aastapõhiselt failis \`sampleFieldSeasons.ts\`
 */
export const SAMPLE_FIELDS: BaseFieldInfo[] = ${JSON.stringify(cleanBaseFields, null, 2)};
`;

fs.writeFileSync('/Users/andresj/Progemine/loisu/src/data/sampleFields.ts', fieldsContent, 'utf8');
console.log('Successfully written lightweight sampleFields.ts with', cleanBaseFields.length, 'records');

// Write sampleFieldSeasons.ts with geometries
const seasonsContent = `// src/data/sampleFieldSeasons.ts
import type { FieldYearlyRecord } from "../types/fieldRegister";

/**
 * Põldude aastapõhised muutuvad andmed, geomeetriad ja külvikord (põllu ID järgi):
 * - geometry: Selle konkreetse aasta/hooaja põllupiirid (GeoJSON Polygon | MultiPolygon)
 * - areaHa: Põllu suurus sellel konkreetsel aastal (ha)
 * - crop: Põllukultuur
 * - cropVariety: Sordinimi
 * - cropColor: Värv kaardil
 * - targetYieldTonsHa: Saagiootus (t/ha)
 * - actualYieldTonsHa: Koristatud saak (t/ha)
 * - workedAreaHa: Haritud pindala
 * - workProgress: Edenemine (%)
 * - status: Töö staatus
 * - seedingDate / harvestDate: Agrotehnilised kuupäevad
 * - notes: Hooaja märkmed
 */
export const SAMPLE_FIELD_SEASONS: Record<number | string, FieldYearlyRecord[]> = ${JSON.stringify(updatedSeasonsMap, null, 2)};
`;

fs.writeFileSync('/Users/andresj/Progemine/loisu/src/data/sampleFieldSeasons.ts', seasonsContent, 'utf8');
console.log('Successfully written sampleFieldSeasons.ts with geometries for', Object.keys(updatedSeasonsMap).length, 'fields');
