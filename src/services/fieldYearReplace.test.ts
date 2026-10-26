import { describe, it, expect } from 'vitest';
import { planYearReplacement, matchImportedField, inReplaceScope, type ReplaceCandidateField } from './fieldYearReplace';

const f = (id: number, num: string, operatorId: string | undefined, history: { year: number; worksCount?: number }[], fieldCode = '100'): ReplaceCandidateField => ({
  id, num, name: `Põld ${num}`, fieldCode, operatorId, history
});

describe('planYearReplacement', () => {
  const fields = [
    f(1, '1', 'A', [{ year: 2026 }, { year: 2025 }]),          // failis → jääb
    f(2, '2', 'A', [{ year: 2026, worksCount: 0 }]),            // eemaldatakse
    f(3, '3', 'A', [{ year: 2026, worksCount: 2 }]),            // töid → jäetakse alles
    f(4, '4', 'A', [{ year: 2025 }]),                            // sel aastal kirjet pole
    f(5, '5', 'B', [{ year: 2026 }]),                            // teine operaator
    f(6, '6', undefined, [{ year: 2026 }])                       // operaatorita
  ];

  it('operaatoriga: eemaldab ainult selle operaatori failis puuduvad, tööga jätab alles', () => {
    const plan = planYearReplacement(fields, 2026, 'A', [1]);
    expect(plan.removed.map((r) => r.fieldId)).toEqual([2]);
    expect(plan.skipped).toEqual([{ fieldId: 3, num: '3', name: 'Põld 3', works: 2 }]);
  });

  it('operaatorita: ainult operaatorita põllud', () => {
    const plan = planYearReplacement(fields, 2026, undefined, []);
    expect(plan.removed.map((r) => r.fieldId)).toEqual([6]);
    expect(plan.skipped).toEqual([]);
  });

  it('keep-ID-d võrreldakse stringina ja tulemus on numbri järgi', () => {
    const plan = planYearReplacement([f(10, '10', 'A', [{ year: 2026 }]), f(9, '9', 'A', [{ year: 2026 }]), f(8, '8', 'A', [{ year: 2026 }])], 2026, 'A', ['8']);
    expect(plan.removed.map((r) => r.num)).toEqual(['9', '10']);
  });
});

describe('inReplaceScope / matchImportedField', () => {
  it('ulatus', () => {
    expect(inReplaceScope('A', 'A')).toBe(true);
    expect(inReplaceScope('B', 'A')).toBe(false);
    expect(inReplaceScope(undefined, 'A')).toBe(false);
    expect(inReplaceScope(null, undefined)).toBe(true);
    expect(inReplaceScope('A', undefined)).toBe(false);
  });

  it('vaste: sama operaator, siis operaatorita, teist operaatorit mitte', () => {
    const list = [f(1, '1', 'B', []), f(2, '1', undefined, []), f(3, '1', 'A', [])];
    expect(matchImportedField(list, '100', '1', 'A')?.id).toBe(3);
    expect(matchImportedField(list.slice(0, 2), '100', '1', 'A')?.id).toBe(2);
    expect(matchImportedField(list.slice(0, 1), '100', '1', 'A')).toBeUndefined();
    expect(matchImportedField(list, '100', '1')?.id).toBe(1);
  });
});
