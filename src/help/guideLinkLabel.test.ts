import { describe, expect, it } from 'vitest';
import { guideLinkLabel } from './guideLinkLabel.ts';

describe('guideLinkLabel', () => {
  it('peatüki pealkiri, ankruga sulgudes', () => {
    expect(guideLinkLabel('guide.fields')).toBe('Põllud');
    expect(guideLinkLabel('guide.fields#import')).toBe('Põllud (import)');
  });
  it('tühi link annab tühja', () => {
    expect(guideLinkLabel(null)).toBe('');
    expect(guideLinkLabel('')).toBe('');
  });
  it('tundmatu peatükk ja vigane link ei viska, näidatakse toorelt', () => {
    expect(guideLinkLabel('guide.removed-chapter#x')).toBe('guide.removed-chapter#x');
    expect(guideLinkLabel('rämps <>')).toBe('rämps <>');
  });
});
