globalThis.self = globalThis;
import fs from 'fs';
import { SAMPLE_FIELDS } from './sampleFields.ts';
import { SAMPLE_FIELD_SEASONS } from './sampleFieldSeasons.ts';
import { INITIAL_SEASONS } from './sampleSeasons.ts';

// 1. Normalize Seasons with integer IDs
const normalizedSeasons = INITIAL_SEASONS.map((s, idx) => ({
  id: idx + 1,
  year: s.year,
  name: s.name,
  status: s.status,
  isLocked: s.isLocked,
  preparationStartDate: s.preparationStartDate || null,
  seedingStartDate: s.seedingStartDate || null,
  harvestStartDate: s.harvestStartDate || null,
  harvestEndDate: s.harvestEndDate || null,
  closedAt: s.closedAt || null,
  closedBy: s.closedBy || null,
  totalAreaHa: s.totalAreaHa || null,
  fieldsCount: s.fieldsCount || null,
  targetYieldTons: s.targetYieldTons || null,
  actualYieldTons: s.actualYieldTons || null,
  notes: s.notes || null
}));

const seasonIdByYear = {};
normalizedSeasons.forEach(s => {
  seasonIdByYear[s.year] = s.id;
});

// 2. Normalize Fields with autoincrement integer IDs
const normalizedFields = SAMPLE_FIELDS.map((f, idx) => ({
  id: idx + 1,
  num: f.num,
  name: f.name,
  fieldCode: f.fieldCode,
  cadastralCode: f.cadastralCode || null,
  soilType: f.soilType || 'Leostunud liivsavi (LP)',
  drainageSystem: f.drainageSystem ?? true,
  landowner: f.landowner || 'Oma maa',
  notes: f.notes || null
}));

// 3. Normalize FieldSeasons as flat relational rows with fieldId & seasonId
const flatFieldSeasonRows = [];
const seasonsMapById = {};
let fieldSeasonRowId = 1;

for (const field of normalizedFields) {
  const originalHistory = SAMPLE_FIELD_SEASONS[field.id] || SAMPLE_FIELD_SEASONS[String(field.id)] || [];
  const fieldList = [];

  for (const h of originalHistory) {
    const seasonId = seasonIdByYear[h.year] || null;
    const row = {
      id: fieldSeasonRowId++,
      fieldId: field.id,
      seasonId: seasonId,
      year: h.year,
      areaHa: h.areaHa,
      crop: h.crop,
      cropVariety: h.cropVariety || null,
      cropColor: h.cropColor || '#eab308',
      targetYieldTonsHa: h.targetYieldTonsHa || null,
      actualYieldTonsHa: h.actualYieldTonsHa || null,
      workedAreaHa: h.workedAreaHa ?? 0,
      workProgress: h.workProgress ?? 0,
      status: h.status || 'not_started',
      seedingDate: h.seedingDate || null,
      harvestDate: h.harvestDate || null,
      notes: h.notes || null,
      geometry: h.geometry
    };

    flatFieldSeasonRows.push(row);
    fieldList.push(row);
  }

  seasonsMapById[field.id] = fieldList;
}

console.log('Seasons count:', normalizedSeasons.length);
console.log('Fields count:', normalizedFields.length);
console.log('FieldSeason rows count:', flatFieldSeasonRows.length);

// Write normalized sampleSeasons.ts
const seasonsContent = `// src/data/sampleSeasons.ts
import type { FarmingSeason } from '../types/season';

/**
 * Normaliseeritud Hooaegade tabel (Prisma: model Season)
 */
export const INITIAL_SEASONS: FarmingSeason[] = ${JSON.stringify(normalizedSeasons, null, 2)};
`;

fs.writeFileSync('/Users/andresj/Progemine/loisu/src/data/sampleSeasons.ts', seasonsContent, 'utf8');

// Write normalized sampleFields.ts
const fieldsContent = `// src/data/sampleFields.ts
import type { BaseFieldInfo } from "../types/field";

/**
 * Normaliseeritud Põldude tabel (Prisma: model Field)
 * - id: Int @id @default(autoincrement())
 * - num: String
 * - name: String
 * - fieldCode: String @unique
 * - cadastralCode: String?
 * - soilType: String?
 * - drainageSystem: Boolean @default(false)
 * - landowner: String?
 */
export const SAMPLE_FIELDS: BaseFieldInfo[] = ${JSON.stringify(normalizedFields, null, 2)};
`;

fs.writeFileSync('/Users/andresj/Progemine/loisu/src/data/sampleFields.ts', fieldsContent, 'utf8');

// Write normalized sampleFieldSeasons.ts
const fieldSeasonsContent = `// src/data/sampleFieldSeasons.ts
import type { FieldSeasonEntity } from "../types/fieldSeason";

/**
 * Normaliseeritud Põllu-Hooaja seosetabel (Prisma: model FieldSeason)
 * Seob põllu (fieldId) ja hooaja (seasonId/year).
 * Sisaldab konkreetse aasta agrotehnilisi andmeid ja selle hooaja piire (geometry).
 */
export const SAMPLE_FIELD_SEASONS_ROWS: FieldSeasonEntity[] = ${JSON.stringify(flatFieldSeasonRows, null, 2)};

/**
 * Kiire lookup-indeks põllu ID järgi (frontend optimeeringuks)
 */
export const SAMPLE_FIELD_SEASONS: Record<number | string, FieldSeasonEntity[]> = ${JSON.stringify(seasonsMapById, null, 2)};
`;

fs.writeFileSync('/Users/andresj/Progemine/loisu/src/data/sampleFieldSeasons.ts', fieldSeasonsContent, 'utf8');
console.log('Successfully written normalized mock data!');
