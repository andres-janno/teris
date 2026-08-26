globalThis.self = globalThis;
import fs from 'fs';
import { SAMPLE_FIELDS } from './sampleFields.ts';
import { SAMPLE_FIELD_SEASONS } from './sampleFieldSeasons.ts';

// Group by fieldCode
const grouped = new Map();

for (const field of SAMPLE_FIELDS) {
  const code = field.fieldCode;
  if (!grouped.has(code)) {
    grouped.set(code, []);
  }
  grouped.get(code).push(field);
}

console.log('Unique fieldCodes count:', grouped.size);

const uniqueFields = [];
const uniqueSeasons = {};
let newId = 1;

for (const [code, items] of grouped.entries()) {
  // Find best item (one with non-generic name or first)
  const bestItem = items.find(it => it.name && !it.name.startsWith('Massiiv ')) || items[0];

  // Combine geometries for all items with this fieldCode for each season
  // Look at seasons for each item
  const itemIds = items.map(it => it.id);
  
  // Base field entry
  const baseField = {
    id: newId,
    num: bestItem.num,
    name: bestItem.name,
    fieldCode: code,
    cadastralCode: bestItem.cadastralCode,
    soilType: bestItem.soilType,
    drainageSystem: bestItem.drainageSystem,
    landowner: bestItem.landowner
  };
  uniqueFields.push(baseField);

  // Combine seasons for this field
  // Take season templates from primary item
  const primarySeasons = SAMPLE_FIELD_SEASONS[bestItem.id] || [];

  // Collect all polygons across items with this fieldCode
  const allPolygons = [];
  for (const itId of itemIds) {
    const sList = SAMPLE_FIELD_SEASONS[itId] || [];
    const geom = sList[0]?.geometry;
    if (geom) {
      if (geom.type === 'Polygon') {
        allPolygons.push(geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        allPolygons.push(...geom.coordinates);
      }
    }
  }

  const combinedGeom = allPolygons.length === 1
    ? { type: 'Polygon', coordinates: allPolygons[0] }
    : { type: 'MultiPolygon', coordinates: allPolygons };

  // Calculate total area across all parts
  const total2026Area = items.reduce((sum, it) => {
    const s = (SAMPLE_FIELD_SEASONS[it.id] || []).find(x => x.year === 2026);
    return sum + (s?.areaHa || 0);
  }, 0);

  const roundedArea = Math.round(total2026Area * 100) / 100;

  const seasons = primarySeasons.map(s => {
    const factor = (primarySeasons[0]?.areaHa > 0) ? (s.areaHa / primarySeasons[0].areaHa) : 1;
    const sArea = Math.round(roundedArea * factor * 100) / 100;
    return {
      year: s.year,
      areaHa: sArea > 0 ? sArea : roundedArea,
      crop: s.crop,
      cropVariety: s.cropVariety,
      cropColor: s.cropColor,
      targetYieldTonsHa: s.targetYieldTonsHa,
      actualYieldTonsHa: s.actualYieldTonsHa,
      workedAreaHa: s.status === 'completed' ? (sArea > 0 ? sArea : roundedArea) : s.workedAreaHa,
      workProgress: s.workProgress,
      status: s.status,
      seedingDate: s.seedingDate,
      harvestDate: s.harvestDate,
      notes: s.notes,
      geometry: combinedGeom
    };
  });

  uniqueSeasons[newId] = seasons;
  newId++;
}

console.log(`Generated ${uniqueFields.length} unique fields and seasons`);

// Write sampleFields.ts
const fieldsContent = `// src/data/sampleFields.ts
import type { BaseFieldInfo } from "../types/field";

/**
 * Põldude püsivad ja muutumatud põhiandmed (Master Data):
 * - Iga kirje esindab unikaalset PRIA massiivi (fieldCode on unikaalne)
 * - id: Unikaalne sisemine ID (autoincrement)
 * - num: Põllu number PRIA impordist / kasutaja määratud
 * - name: Põllu nimi (kasutaja määratud)
 * - fieldCode: PRIA massiivi unikaalne number
 * - cadastralCode: Katastritunnus
 * - soilType, drainageSystem, landowner: Püsivad maa omadused
 *
 * MÄRKUS: Kõik aastapõhised andmed (pindala, kultuur, saagikus, geomeetria/piirid) asuvad failis \`sampleFieldSeasons.ts\`
 */
export const SAMPLE_FIELDS: BaseFieldInfo[] = ${JSON.stringify(uniqueFields, null, 2)};
`;

fs.writeFileSync('/Users/andresj/Progemine/loisu/src/data/sampleFields.ts', fieldsContent, 'utf8');

// Write sampleFieldSeasons.ts
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
export const SAMPLE_FIELD_SEASONS: Record<number | string, FieldYearlyRecord[]> = ${JSON.stringify(uniqueSeasons, null, 2)};
`;

fs.writeFileSync('/Users/andresj/Progemine/loisu/src/data/sampleFieldSeasons.ts', seasonsContent, 'utf8');
console.log('Successfully written unique sampleFields.ts and sampleFieldSeasons.ts');
