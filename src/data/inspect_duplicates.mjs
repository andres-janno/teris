globalThis.self = globalThis;
import fs from 'fs';
import { SAMPLE_FIELDS } from './sampleFields.ts';
import { SAMPLE_FIELD_SEASONS } from './sampleFieldSeasons.ts';

const counts = {};
SAMPLE_FIELDS.forEach(f => {
  counts[f.fieldCode] = (counts[f.fieldCode] || 0) + 1;
});

console.log('Total fields:', SAMPLE_FIELDS.length);
const duplicates = Object.entries(counts).filter(([code, cnt]) => cnt > 1);
console.log('Duplicate fieldCodes count:', duplicates.length);
duplicates.forEach(([code, cnt]) => {
  const matching = SAMPLE_FIELDS.filter(f => f.fieldCode === code);
  console.log(`\nfieldCode: ${code} (count: ${cnt})`);
  matching.forEach(m => console.log(`  id: ${m.id}, num: "${m.num}", name: "${m.name}", cadastralCode: "${m.cadastralCode}"`));
});
