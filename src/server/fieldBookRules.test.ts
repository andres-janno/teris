import { describe, expect, it } from 'vitest';
import { findMatchingWork, operationLines, type ExistingWork } from './fieldBookRules';
import type { FieldBookImportOperation, ParsedProduct } from '../types/fieldOperation';

const prod = (p: Partial<ParsedProduct>): ParsedProduct => ({
  category: null, name: null, kind: null, spec: null, amount: null, unit: null, nKgHa: null, pKgHa: null, kKgHa: null, activeIngredient: null, ...p
});
const op = (p: Partial<FieldBookImportOperation>): FieldBookImportOperation => ({
  type: 'Kündmine', dateFrom: '2026-04-27', dateTo: null, areaHa: 2.42, method: null, performerId: null, notes: null, products: [], ...p
});
const work = (p: Partial<ExistingWork>): ExistingWork => ({
  id: 'w1', activity: 'Kündmine', plannedFrom: null, plannedTo: null, entries: [], productKeys: [], ...p
});

describe('findMatchingWork', () => {
  it('sama tegevus, kuupäev kuni 2 päeva kaugusel kandest', () => {
    const w = work({ entries: [{ from: '2026-05-02', to: null }] });
    expect(findMatchingWork(op({ dateFrom: '2026-04-27', dateTo: '2026-04-30' }), [w], new Set())?.id).toBe('w1');
    expect(findMatchingWork(op({ dateFrom: '2026-04-27', dateTo: '2026-04-29' }), [w], new Set())).toBeNull();
  });
  it('plaani kuupäev arvestatakse, plaanita ja kanneteta töö ei sobi', () => {
    expect(findMatchingWork(op({}), [work({ plannedFrom: '2026-04-28', plannedTo: null })], new Set())?.id).toBe('w1');
    expect(findMatchingWork(op({}), [work({})], new Set())).toBeNull();
  });
  it('teine tegevus või juba seotud töö ei sobi', () => {
    const w = work({ plannedFrom: '2026-04-27' });
    expect(findMatchingWork(op({ type: 'Rullimine' }), [w], new Set())).toBeNull();
    expect(findMatchingWork(op({}), [w], new Set(['w1']))).toBeNull();
  });
  it('taimekaitsel peab olema ühine toode; mitme seast lähim', () => {
    const tkv = 'Taimekaitsevahendi kasutamine';
    const o = op({ type: tkv, dateFrom: '2026-05-26', products: [prod({ name: 'Tombo WG' })] });
    const a = work({ id: 'a', activity: tkv, plannedFrom: '2026-05-25', productKeys: ['moxa'] });
    const b = work({ id: 'b', activity: tkv, plannedFrom: '2026-05-24', productKeys: ['tombo wg'] });
    const c = work({ id: 'c', activity: tkv, plannedFrom: '2026-05-26', productKeys: ['tombo wg'] });
    expect(findMatchingWork(o, [a, b, c], new Set())?.id).toBe('c');
    expect(findMatchingWork(o, [a], new Set())).toBeNull();
  });
});

describe('operationLines', () => {
  it('väetis: materjal normi, NPK ja registriga', () => {
    const [l] = operationLines(op({
      type: 'Väetamine',
      products: [prod({ category: 'Väetis registrist', name: 'NPK 18-12-9', kind: 'NPK väetis', amount: 250, unit: 'kg/ha', nKgHa: 45, pKgHa: 13.08, kKgHa: 18.68 })]
    }));
    expect(l).toMatchObject({ kind: 'MATERIAL', label: 'NPK 18-12-9', amount: 250, unit: 'kg', perHa: true, priaRegister: 'Väetis registrist', priaKind: 'NPK väetis', nKgHa: 45, materialCategory: 'FERTILIZER' });
  });
  it('külv: sort, liik ja seemne kategooria', () => {
    const [l] = operationLines(op({
      type: 'Külvamine/istutamine',
      products: [prod({ category: 'Eesti sordiregister', name: 'Testsort', kind: 'Suvinisu', spec: 'C1', amount: 200, unit: 'kg/ha' })]
    }));
    expect(l).toMatchObject({ kind: 'MATERIAL', label: 'Testsort', priaSpec: 'C1', materialCategory: 'SEED' });
  });
  it('saagikoristus: HARVEST, kultuuri tüüp meetodist', () => {
    const [l] = operationLines(op({ type: 'Saagikoristus', method: 'Põhikultuur', products: [prod({ kind: 'Terad', amount: 4, unit: 't/ha' })] }));
    expect(l).toMatchObject({ kind: 'HARVEST', label: 'Saak', amount: 4, unit: 't', perHa: true, priaKind: 'Terad', priaSpec: 'Põhikultuur', materialCategory: null });
  });
  it('seire: OBSERVATION, kogus ei ole ha kohta', () => {
    const [l] = operationLines(op({ type: 'Seire', products: [prod({ category: 'Umbrohud', name: 'Põldsinep', amount: 7, unit: 'taime/m2' })] }));
    expect(l).toMatchObject({ kind: 'OBSERVATION', label: 'Põldsinep', amount: 7, unit: 'taime/m2', perHa: false, priaRegister: 'Umbrohud' });
  });
  it('nimetu toode jäetakse vahele (v.a saak)', () => {
    expect(operationLines(op({ type: 'Väetamine', products: [prod({ amount: 1, unit: 'kg/ha' })] }))).toEqual([]);
  });
});
