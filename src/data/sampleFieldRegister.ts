// src/data/sampleFieldRegister.ts
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import { SAMPLE_FIELDS } from './sampleFields';

const CROP_ROTATION_2025 = [
  { crop: 'Taliraps (Mercedes)', color: '#10b981', yieldT: 3.8, areaFactor: 1.02 },
  { crop: 'Põldhernes (Astronaute)', color: '#84cc16', yieldT: 4.2, areaFactor: 0.98 },
  { crop: 'Suvioder (Planet)', color: '#d97706', yieldT: 5.8, areaFactor: 1.00 },
  { crop: 'Talinisu (Skagen)', color: '#eab308', yieldT: 7.2, areaFactor: 1.04 },
  { crop: 'Põlduba (Tiffany)', color: '#06b6d4', yieldT: 4.5, areaFactor: 0.96 }
];

const CROP_ROTATION_2024 = [
  { crop: 'Suvioder (RGT Planet)', color: '#d97706', yieldT: 6.1, areaFactor: 1.05 },
  { crop: 'Talinisu (Edvins)', color: '#eab308', yieldT: 6.8, areaFactor: 0.97 },
  { crop: 'Kaer (Symphony)', color: '#f59e0b', yieldT: 5.2, areaFactor: 1.00 },
  { crop: 'Rukis (KWS Bono)', color: '#a16207', yieldT: 6.5, areaFactor: 1.03 },
  { crop: 'Punane ristik / Rohumaa', color: '#22c55e', yieldT: 8.0, areaFactor: 1.01 }
];

const CROP_ROTATION_2023 = [
  { crop: 'Rukis (KWS Bono)', color: '#a16207', yieldT: 6.3, areaFactor: 1.01 },
  { crop: 'Taliraps (Mercedes)', color: '#10b981', yieldT: 3.6, areaFactor: 0.99 },
  { crop: 'Talinisu (Skagen)', color: '#eab308', yieldT: 7.1, areaFactor: 1.02 },
  { crop: 'Suvioder (Planet)', color: '#d97706', yieldT: 5.5, areaFactor: 0.96 },
  { crop: 'Põldhernes (Astronaute)', color: '#84cc16', yieldT: 4.0, areaFactor: 1.00 }
];

/**
 * Teisendab 60 PRIA põldu ja massiivi aastatepõhiseks MasterField registriks
 */
export const INITIAL_MASTER_FIELDS: MasterField[] = SAMPLE_FIELDS.features.map((feature, idx) => {
  const p = feature.properties;
  const area2026 = p.areaHa || 5.0;

  const rot2025 = CROP_ROTATION_2025[idx % CROP_ROTATION_2025.length];
  const rot2024 = CROP_ROTATION_2024[idx % CROP_ROTATION_2024.length];
  const rot2023 = CROP_ROTATION_2023[idx % CROP_ROTATION_2023.length];

  const area2025 = Math.round(area2026 * rot2025.areaFactor * 100) / 100;
  const area2024 = Math.round(area2026 * rot2024.areaFactor * 100) / 100;
  const area2023 = Math.round(area2026 * rot2023.areaFactor * 100) / 100;

  const history: FieldYearlyRecord[] = [
    {
      year: 2026,
      areaHa: area2026,
      crop: p.crop || 'Talinisu (Skagen)',
      cropVariety: p.crop ? p.crop.split('(')[1]?.replace(')', '') || '' : 'Skagen',
      cropColor: p.cropColor || '#eab308',
      targetYieldTonsHa: 7.5,
      actualYieldTonsHa: undefined,
      workedAreaHa: p.workedAreaHa || 0,
      workProgress: p.workProgress || 0,
      status: p.status || 'not_started',
      seedingDate: '2025-09-18',
      notes: p.notes || 'Põhiväetis NPK 8-20-30 (250 kg/ha) antud sügisel.'
    },
    {
      year: 2025,
      areaHa: area2025,
      crop: rot2025.crop,
      cropVariety: rot2025.crop.split('(')[1]?.replace(')', '') || '',
      cropColor: rot2025.color,
      targetYieldTonsHa: rot2025.yieldT,
      actualYieldTonsHa: Math.round((rot2025.yieldT + (idx % 3 === 0 ? 0.4 : -0.2)) * 10) / 10,
      workedAreaHa: area2025,
      workProgress: 100,
      status: 'completed',
      seedingDate: '2024-09-15',
      harvestDate: '2025-08-12',
      notes: 'Koristatud kuiva ilmaga, keskmine niiskus 14.2%.'
    },
    {
      year: 2024,
      areaHa: area2024,
      crop: rot2024.crop,
      cropVariety: rot2024.crop.split('(')[1]?.replace(')', '') || '',
      cropColor: rot2024.color,
      targetYieldTonsHa: rot2024.yieldT,
      actualYieldTonsHa: rot2024.yieldT,
      workedAreaHa: area2024,
      workProgress: 100,
      status: 'completed',
      seedingDate: '2024-04-28',
      harvestDate: '2024-08-20',
      notes: 'Eelvili hästi lagunenud, lubjatud 3 t/ha.'
    },
    {
      year: 2023,
      areaHa: area2023,
      crop: rot2023.crop,
      cropVariety: rot2023.crop.split('(')[1]?.replace(')', '') || '',
      cropColor: rot2023.color,
      targetYieldTonsHa: rot2023.yieldT,
      actualYieldTonsHa: rot2023.yieldT,
      workedAreaHa: area2023,
      workProgress: 100,
      status: 'completed',
      seedingDate: '2023-04-20',
      harvestDate: '2023-08-15',
      notes: 'Suurepärane saagiaasta, proteiinisisaldus 13.8%.'
    }
  ];

  const soilTypes = ['Leostunud liivsavi (LP)', 'Näivleetunud liivsavi (LPg)', 'Leostunud saviliiv (Ko)', 'Gleimuld (Gk)'];
  const soil = soilTypes[idx % soilTypes.length];

  return {
    id: p.id || `field-${idx + 1}`,
    name: p.name || `Põld ${idx + 1}`,
    fieldCode: p.fieldCode || `PRIA-${idx + 1}`,
    cadastralCode: p.cadastralCode || `89201:00${(idx % 9) + 1}:010${idx % 9}`,
    soilType: soil,
    drainageSystem: idx % 2 === 0,
    landowner: idx % 3 === 0 ? 'Oma maa' : (idx % 3 === 1 ? 'Rent (Maaomanik OÜ)' : 'Rent (Eraomanik)'),
    notes: p.notes || '',
    geometry: feature.geometry,
    history
  };
});
