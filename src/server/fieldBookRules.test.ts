import { describe, expect, it } from 'vitest';
import { findMatchingWork, operationLines, sowingKindMatchesCrop, splitPostHarvestOperations, type ExistingWork } from './fieldBookRules';
import type { FieldBookImportOperation, ParsedProduct } from '../types/fieldOperation';

const prod = (p: Partial<ParsedProduct>): ParsedProduct => ({
  category: null, name: null, kind: null, spec: null, amount: null, unit: null, nKgHa: null, pKgHa: null, kKgHa: null, activeIngredient: null, ...p
});
const op = (p: Partial<FieldBookImportOperation>): FieldBookImportOperation => ({
  type: 'Kündmine', dateFrom: '2026-04-27', dateTo: null, areaHa: 2.42, method: null, performerId: null, notes: null, products: [], ...p
});
const work = (p: Partial<ExistingWork>): ExistingWork => ({
  id: 'w1', activity: 'Kündmine', plannedFrom: null, plannedTo: null, entries: [], productKeys: [], fromTemplate: false, ...p
});

describe('findMatchingWork', () => {
  it('sama tegevus, kuupäev kuni 2 päeva kaugusel kandest', () => {
    const w = work({ entries: [{ from: '2026-05-02', to: null }] });
    expect(findMatchingWork(op({ dateFrom: '2026-04-27', dateTo: '2026-04-30' }), [w], new Set())?.id).toBe('w1');
    expect(findMatchingWork(op({ dateFrom: '2026-04-27', dateTo: '2026-04-29' }), [w], new Set())).toBeNull();
  });
  it('plaani kuupäev arvestatakse', () => {
    expect(findMatchingWork(op({}), [work({ plannedFrom: '2026-04-28', plannedTo: null })], new Set())?.id).toBe('w1');
  });
  it('kuupäevata ja kanneteta (mallist) töö sobib, kui kuupäevaga sobivat pole', () => {
    expect(findMatchingWork(op({}), [work({ fromTemplate: true })], new Set())?.id).toBe('w1');
    // mallist töö eelistatakse, muidu järjekorras esimene
    const a = work({ id: 'a' });
    const b = work({ id: 'b', fromTemplate: true });
    expect(findMatchingWork(op({}), [a, b], new Set())?.id).toBe('b');
    expect(findMatchingWork(op({}), [a, work({ id: 'c' })], new Set())?.id).toBe('a');
  });
  it('kuupäevaga sobiv töö võidab kuupäevata töö', () => {
    const undated = work({ id: 'u', fromTemplate: true });
    const dated = work({ id: 'd', plannedFrom: '2026-04-28' });
    expect(findMatchingWork(op({}), [undated, dated], new Set())?.id).toBe('d');
  });
  it('seotud kuupäevata tööd ei kasutata uuesti; kaugel kuupäevaga töö pole kuupäevata', () => {
    expect(findMatchingWork(op({}), [work({ fromTemplate: true })], new Set(['w1']))).toBeNull();
    expect(findMatchingWork(op({}), [work({ plannedFrom: '2026-06-01' })], new Set())).toBeNull();
    expect(findMatchingWork(op({}), [work({ entries: [{ from: '2026-06-01', to: null }] })], new Set())).toBeNull();
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
  it('taimekaitse rida toodetega sobib toodeteta tööga', () => {
    const tkv = 'Taimekaitsevahendi kasutamine';
    const o = op({ type: tkv, dateFrom: '2026-05-26', products: [prod({ name: 'Tombo WG' })] });
    expect(findMatchingWork(o, [work({ activity: tkv, plannedFrom: '2026-05-26', productKeys: [] })], new Set())?.id).toBe('w1');
    expect(findMatchingWork(o, [work({ activity: tkv, fromTemplate: true, productKeys: [] })], new Set())?.id).toBe('w1');
    // kuupäevata töö teise tootega ei sobi
    expect(findMatchingWork(o, [work({ activity: tkv, fromTemplate: true, productKeys: ['moxa'] })], new Set())).toBeNull();
  });
  it('taimekaitse rida ilma nimetatud toodeteta sobitub kuupäeva ja tegevuse järgi', () => {
    const tkv = 'Taimekaitsevahendi kasutamine';
    const o = op({ type: tkv, dateFrom: '2026-05-26', products: [] });
    expect(findMatchingWork(o, [work({ activity: tkv, plannedFrom: '2026-05-24', productKeys: [] })], new Set())?.id).toBe('w1');
    expect(findMatchingWork(o, [work({ activity: tkv, plannedFrom: '2026-05-23', productKeys: [] })], new Set())).toBeNull();
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

describe('splitPostHarvestOperations', () => {
  const harvest = op({ type: 'Saagikoristus', dateFrom: '2026-08-26' });
  const sow = (kind: string | null, dateFrom = '2026-09-09') =>
    op({ type: 'Külvamine/istutamine', dateFrom, products: [prod({ name: 'Loona', kind, spec: 'C2' })] });

  it('Nr 5: koristuse järel tehtud tööd järgmise hooaja alla, faasid külvi järgi', () => {
    const before = op({ type: 'Kündmine', dateFrom: '2026-04-20' });
    const ops = [before, harvest, op({ type: 'Randaalimine', dateFrom: '2026-09-07' }), op({ type: 'Väetamine', dateFrom: '2026-09-08' }), sow('Talioder')];
    const r = splitPostHarvestOperations(ops, 'Talioder allakülvita');
    expect(r.current.map((o) => o.type)).toEqual(['Kündmine', 'Saagikoristus']);
    expect(r.next.map((o) => [o.type, o.phase])).toEqual([
      ['Randaalimine', 'PREPARATION'], ['Väetamine', 'PREPARATION'], ['Külvamine/istutamine', 'SOWING']
    ]);
  });
  it('vahekultuuri külv jääb hooajale', () => {
    const r = splitPostHarvestOperations([harvest, op({ type: 'Randaalimine', dateFrom: '2026-09-01' }), sow('Valge sinep')], 'Talioder allakülvita');
    expect(r.current.map((o) => o.type)).toEqual(['Saagikoristus', 'Külvamine/istutamine']);
    expect(r.next.map((o) => [o.type, o.phase])).toEqual([['Randaalimine', 'PREPARATION']]);
  });
  it('liigita külv liigub', () => {
    const r = splitPostHarvestOperations([harvest, sow(null)], 'Talioder allakülvita');
    expect(r.next.map((o) => o.phase)).toEqual(['SOWING']);
  });
  it('järgmise hooaja põlluta või koristuseta ei liigu midagi', () => {
    const ops = [harvest, op({ type: 'Randaalimine', dateFrom: '2026-09-07' })];
    expect(splitPostHarvestOperations(ops, null)).toEqual({ current: ops, next: [] });
    const noHarvest = [op({ type: 'Randaalimine', dateFrom: '2026-09-07' })];
    expect(splitPostHarvestOperations(noHarvest, 'Talioder')).toEqual({ current: noHarvest, next: [] });
  });
  it('sügiskülviga samal päeval tehtud töö on ettevalmistus, hilisem hooldus', () => {
    const r = splitPostHarvestOperations([
      harvest, op({ type: 'Randaalimine', dateFrom: '2026-09-09' }), op({ type: 'Väetamine', dateFrom: '2026-09-09' }), sow('Talioder'),
      op({ type: 'Taimekaitsevahendi kasutamine', dateFrom: '2026-09-10' })
    ], 'Talioder allakülvita');
    expect(r.next.map((o) => [o.type, o.phase])).toEqual([
      ['Randaalimine', 'PREPARATION'], ['Väetamine', 'PREPARATION'], ['Külvamine/istutamine', 'SOWING'], ['Taimekaitsevahendi kasutamine', 'CARE']
    ]);
  });
  it('sügiskülvi järel tehtud töö on hooldus', () => {
    const r = splitPostHarvestOperations([harvest, sow('Talioder'), op({ type: 'Taimekaitsevahendi kasutamine', dateFrom: '2026-10-01' })], 'Talioder allakülvita');
    expect(r.next.map((o) => [o.type, o.phase])).toEqual([['Külvamine/istutamine', 'SOWING'], ['Taimekaitsevahendi kasutamine', 'CARE']]);
  });
  it('koristus ise ei liigu, ka viimane; koristuse päeval ja enne tehtud tööd jäävad', () => {
    const early = op({ type: 'Saagikoristus', dateFrom: '2026-08-10' });
    const sameDay = op({ type: 'Kündmine', dateFrom: '2026-08-26' });
    const r = splitPostHarvestOperations([early, sameDay, harvest], 'Talioder');
    expect(r.current).toHaveLength(3);
    expect(r.next).toEqual([]);
  });
});

describe('sowingKindMatchesCrop', () => {
  it('liik kultuuri nimes või kultuuri esimene sõna liigis', () => {
    expect(sowingKindMatchesCrop('Talioder', 'Talioder allakülvita')).toBe(true);
    expect(sowingKindMatchesCrop('talioder', '  TALIODER   allakülvita')).toBe(true);
    expect(sowingKindMatchesCrop('Talinisu (pehme)', 'Talinisu')).toBe(true);
    expect(sowingKindMatchesCrop('Valge sinep', 'Talioder allakülvita')).toBe(false);
    expect(sowingKindMatchesCrop(null, 'Talioder')).toBe(true);
  });
});
