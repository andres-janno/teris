import { describe, it, expect } from 'vitest';
import { matchPartyByName, buildFieldBookImport } from './fieldBookImport';
import type { MasterField } from '../types/fieldRegister';
import type { RelatedParty } from '../types/party';
import type { FarmingSeason } from '../types/season';
import type { FieldBookSheetResult, ParsedFieldBookSheet } from '../types/fieldOperation';

const party = (id: string, name: string) => ({ id, name, type: 'PERSON', roles: ['DRIVER'] }) as unknown as RelatedParty;
const PARTIES = [party('p-mari', 'Mari Tamm'), party('op-1', 'Test Agro OÜ')];

const field = (id: number, fieldCode: string, num: string, operatorId: string, years: number[], name = `Põld ${num}`) =>
  ({ id, fieldCode, num, operatorId, name, history: years.map((year) => ({ year })) }) as unknown as MasterField;

const SEASONS = [{ year: 2025, isLocked: true }, { year: 2026, isLocked: false }] as unknown as FarmingSeason[];

const sheet = (over: Partial<ParsedFieldBookSheet> = {}): ParsedFieldBookSheet => ({
  sheetName: '2', season: 2025, fieldCode: '61044415735', num: '2', areaHa: 7.67,
  crop: 'Talinisu allakülvita', targetYieldTonsHa: 4, actualYieldTonsHa: 3.5,
  seedingDate: '2024-09-26', harvestDate: '2025-08-07',
  operations: [
    { type: 'Taimekaitsevahendi kasutamine', dateFrom: '2025-05-02', dateTo: '2025-05-03', areaHa: 7.67, method: null,
      performerName: 'Tamm Mari', notes: null,
      products: [{ category: null, name: 'Tombo WG', kind: 'Herbitsiid', spec: null, amount: 0.2, unit: 'kg/ha', nKgHa: null, pKgHa: null, kKgHa: null, activeIngredient: null }] },
    { type: 'Taimekaitsevahendi kasutamine', dateFrom: '2025-06-06', dateTo: null, areaHa: 7.67, method: null,
      performerName: 'Tundmatu Isik', notes: null, products: [] },
    { type: 'Kündmine', dateFrom: '2025-08-10', dateTo: null, areaHa: 7.67, method: null, performerName: null, notes: null, products: [] }
  ],
  ...over
});

describe('matchPartyByName', () => {
  it('sobitab mõlemas nimejärjekorras, tõstu- ja tühikutundetult', () => {
    expect(matchPartyByName('Mari Tamm', PARTIES)?.id).toBe('p-mari');
    expect(matchPartyByName('Tamm Mari', PARTIES)?.id).toBe('p-mari');
    expect(matchPartyByName('  TAMM   mari ', PARTIES)?.id).toBe('p-mari');
  });
  it('tagastab null, kui vastet pole', () => {
    expect(matchPartyByName('Tundmatu Isik', PARTIES)).toBeNull();
  });
});

describe('buildFieldBookImport', () => {
  const masterFields = [
    field(5, '61044415735', '2', 'op-1', [2025, 2026], 'Kodu'),
    field(9, '61044415735', '2', 'op-2', [2025])
  ];
  const results: FieldBookSheetResult[] = [
    { sheetName: '2', sheet: sheet(), error: null },
    { sheetName: '7', sheet: sheet({ sheetName: '7', num: '7' }), error: null },
    { sheetName: '9', sheet: null, error: 'Loetamatu kuupäev: "eile"' }
  ];
  const { rows, payload } = buildFieldBookImport(results, { masterFields, parties: PARTIES, seasons: SEASONS, operatorId: 'op-1' });

  it('sobitab põllu valitud operaatori ja hooaja järgi', () => {
    expect(rows[0]).toMatchObject({ sheetName: '2', matched: true, fieldName: 'Kodu', operationsCount: 3, productsCount: 1, seasonLocked: true, error: null });
  });

  it('loetleb sobitamata teostajad ühekordselt', () => {
    expect(rows[0].unmatchedPerformers).toEqual(['Tundmatu Isik']);
  });

  it('märgib sobitamata põllu ja lehe vea', () => {
    expect(rows[1]).toMatchObject({ sheetName: '7', matched: false, fieldName: null });
    expect(rows[2]).toMatchObject({ sheetName: '9', matched: false, error: 'Loetamatu kuupäev: "eile"' });
  });

  it('koostab API keha ainult sobitatud põldudest, teostaja ID-ga', () => {
    expect(payload.operatorId).toBe('op-1');
    expect(payload.fields).toHaveLength(1);
    const f = payload.fields[0];
    expect(f).toMatchObject({ fieldCode: '61044415735', num: '2', season: 2025, actualYieldTonsHa: 3.5, seedingDate: '2024-09-26' });
    expect(f.operations.map((o) => o.performerId)).toEqual(['p-mari', null, null]);
    expect(f.operations[0].products[0].name).toBe('Tombo WG');
  });

  it('teise operaatori sama massiivi+numbriga põld ei sobitu', () => {
    const other = buildFieldBookImport([results[0]], { masterFields: [masterFields[1]], parties: PARTIES, seasons: SEASONS, operatorId: 'op-1' });
    expect(other.rows[0].matched).toBe(false);
    expect(other.payload.fields).toHaveLength(0);
  });
});
