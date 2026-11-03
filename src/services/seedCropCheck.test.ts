import { describe, it, expect } from 'vitest';
import { seedCropMismatches } from './seedCropCheck';
import type { Article } from '../types/fieldWork';

const art = (id: string, name: string, cropVarietyId: string | null) => ({ id, name, cropVarietyId } as Article);
const articles = [art('a1', 'Suvinisu Mooni', 'v-mooni'), art('a2', 'Talinisu Skagen', 'v-skagen'), art('a3', 'Seeme sordita', null)];
const crops = [
  { id: 'c-tn', name: 'Talinisu', varieties: [{ id: 'v-skagen' }] },
  { id: 'c-sn', name: 'Suvinisu', varieties: [{ id: 'v-mooni' }] }
];

describe('seedCropMismatches', () => {
  it('hoiatab, kui seemne sort kuulub teisele kultuurile', () => {
    expect(seedCropMismatches(['a1', 'a2', 'a3'], articles, { seasonCrop: { id: 'c-tn', name: 'Talinisu' }, crops }))
      .toEqual([{ articleName: 'Suvinisu Mooni', seedCropName: 'Suvinisu' }]);
  });
  it('kultuurita hooaeg või kontrollita vorm ei hoiata', () => {
    expect(seedCropMismatches(['a1'], articles, { seasonCrop: null, crops })).toEqual([]);
    expect(seedCropMismatches(['a1'], articles, undefined)).toEqual([]);
  });
});
