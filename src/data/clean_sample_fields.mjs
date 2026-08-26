globalThis.self = globalThis;
import fs from 'fs';
import { SAMPLE_FIELDS } from './sampleFields.ts';

const cleanFields = SAMPLE_FIELDS.map((f) => {
  const cleanObj = {
    id: f.id,
    num: f.num,
    name: f.name,
    fieldCode: f.fieldCode,
    cadastralCode: f.cadastralCode,
    soilType: f.soilType || 'Leostunud liivsavi (LP)',
    drainageSystem: f.drainageSystem ?? true,
    landowner: f.landowner || 'Oma maa'
  };
  return cleanObj;
});

const content = `// src/data/sampleFields.ts
import type { BaseFieldInfo } from "../types/field";

/**
 * Põldude püsivad ja muutumatud põhiandmed (Master Data):
 * - id: Unikaalne sisemine ID (autoincrement)
 * - num: Põllu number PRIA impordist / kasutaja määratud
 * - name: Põllu nimi (kasutaja määratud)
 * - fieldCode: PRIA massiivi number
 * - cadastralCode: Katastritunnus
 * - soilType, drainageSystem, landowner: Püsivad maa omadused
 *
 * MÄRKUS: Kõik aastapõhised andmed (pindala, kultuur, saagikus, geomeetria/piirid) asuvad failis \`sampleFieldSeasons.ts\`
 */
export const SAMPLE_FIELDS: BaseFieldInfo[] = ${JSON.stringify(cleanFields, null, 2)};
`;

fs.writeFileSync('/Users/andresj/Progemine/loisu/src/data/sampleFields.ts', content, 'utf8');
console.log('Cleaned sampleFields.ts successfully! Records:', cleanFields.length);
