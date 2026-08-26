// src/data/sampleFieldRegister.ts
import type { MasterField } from '../types/fieldRegister';
import { SAMPLE_FIELDS } from './sampleFields';
import { SAMPLE_FIELD_SEASONS } from './sampleFieldSeasons';

/**
 * Kombineerib põldude püsivad andmed (sampleFields.ts) ja aastapõhised andmed ning geomeetriad (sampleFieldSeasons.ts)
 * ühtseks MasterField registriks.
 */
export const INITIAL_MASTER_FIELDS: MasterField[] = SAMPLE_FIELDS.map((field, idx) => {
  const history = SAMPLE_FIELD_SEASONS[field.id] || [];
  const latestGeom = history[0]?.geometry;

  return {
    id: field.id,
    num: field.num ? String(field.num) : String(idx + 1),
    name: field.name,
    fieldCode: field.fieldCode,
    cadastralCode: field.cadastralCode,
    soilType: field.soilType || 'Leostunud liivsavi (LP)',
    drainageSystem: field.drainageSystem ?? (idx % 2 === 0),
    landowner: field.landowner || (idx % 3 === 0 ? 'Oma maa' : (idx % 3 === 1 ? 'Rent (Maaomanik OÜ)' : 'Rent (Eraomanik)')),
    notes: field.notes || '',
    geometry: latestGeom,
    history
  };
});
