import { describe, it, expect } from 'vitest';
import { workTypeDisplayName } from './workTypeName.ts';

describe('workTypeDisplayName', () => {
  it('kasutab lühinime', () => {
    expect(workTypeDisplayName({ name: 'Umbrohutõrje', shortName: ' Herbitsiid ' })).toBe('Herbitsiid');
  });
  it('langeb tagasi PRIA nimele', () => {
    expect(workTypeDisplayName({ name: 'Umbrohutõrje', shortName: '  ' })).toBe('Umbrohutõrje');
    expect(workTypeDisplayName({ name: 'Umbrohutõrje', shortName: null })).toBe('Umbrohutõrje');
    expect(workTypeDisplayName({ name: 'Umbrohutõrje' })).toBe('Umbrohutõrje');
  });
});
