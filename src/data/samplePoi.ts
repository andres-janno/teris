// src/data/samplePoi.ts
import type { PointOfInterest } from '../types/poi';

export const SAMPLE_POI_LIST: PointOfInterest[] = [
  {
    id: 'poi-loisu-vesi',
    name: 'Loisu vesi',
    category: 'water_point',
    position: [58.13761, 25.88228],
    description: 'Puurkaev ja pritside kiirtäitmisjaam (40m³ vahemahuti).',
    capacity: '40 m³ mahuti / 1000 L/min',
    contactPerson: 'Rein Janno',
    phone: '+372 5552 9988',
    accessNotes: 'Kõvakattega ringtee, vaba ligipääs suurtele pritsidele.',
    isActive: true,
    createdAt: '2026-04-12'
  },
  {
    id: 'poi-karstna-farm',
    name: 'Kärstna farm',
    category: 'workshop',
    position: [58.1381, 25.80099],
    description: 'Kärstna tootmisbaas, masinakuur ja töökoda.',
    capacity: 'Tootmiskeskus ja garaažid',
    contactPerson: 'Mati Kask',
    phone: '+372 5554 4432',
    accessNotes: 'Vaba sissesõit maanteelt 24176.',
    isActive: true,
    createdAt: '2026-03-15'
  },
  {
    id: 'poi-sigala-vaetis',
    name: 'Sigala väetis',
    category: 'warehouse',
    position: [58.11913, 25.88461],
    description: 'Väetise- ja kemikaaliladu, vedelsõnniku laadimisala.',
    capacity: '500 t Big-Bag väetist',
    contactPerson: 'Kalle Laojuhataja',
    phone: '+372 5558 1123',
    accessNotes: 'Laadimisplats tõstukiga otse külvikutele.',
    isActive: true,
    createdAt: '2026-04-01'
  },
  {
    id: 'poi-riidaja-kuivati',
    name: 'Riidaja kuivati',
    category: 'dryer',
    position: [58.09407, 25.89995],
    description: 'Riidaja teraviljakuivati ja punkrid (35 t/h, 3200 tonni).',
    capacity: '3200 t / 35 t/h',
    contactPerson: 'Kuivatimeister',
    phone: '+372 5551 2341',
    accessNotes: '60t autokaal otse sissesõidul maanteelt 23246.',
    isActive: true,
    createdAt: '2026-04-10'
  }
];
