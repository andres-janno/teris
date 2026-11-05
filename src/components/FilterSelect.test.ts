import { describe, expect, it } from 'vitest';
import { findTypeaheadIndex } from './FilterSelect';

describe('findTypeaheadIndex', () => {
  const labels = ['Kõik laod', 'Aita', 'Kuivati', 'Rõngu', 'Ülekanne'];
  it('hüppab järgmise sama tähega valikuni, tsükliliselt', () => {
    expect(findTypeaheadIndex(labels, 0, 'k')).toBe(2);
    expect(findTypeaheadIndex(labels, 2, 'k')).toBe(0);
  });
  it('ei erista suur- ja väiketähte, tunneb täpitähti', () => {
    expect(findTypeaheadIndex(labels, 0, 'R')).toBe(3);
    expect(findTypeaheadIndex(labels, 0, 'ü')).toBe(4);
  });
  it('leidmata → -1', () => {
    expect(findTypeaheadIndex(labels, 0, 'x')).toBe(-1);
  });
});
