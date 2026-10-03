import { describe, expect, it } from 'vitest';
import {
  buildEntryLines,
  canConfirm,
  filterTemplatePhasesForAutumn,
  filterTemplatePhasesForCurrent,
  isWinterCrop,
  matchCrop,
  mergeLines,
  summarizeLines,
  type StoredLine
} from './fieldWorkRules';

const crops = [
  { id: 'c1', name: 'Talinisu', isWinterCrop: true },
  { id: 'c2', name: 'Põlduba', isWinterCrop: false },
  { id: 'c3', name: 'Suvinisu', isWinterCrop: false }
];

describe('matchCrop', () => {
  it('seob PRIA nime registri kultuuriga', () => {
    expect(matchCrop('Talinisu allakülvita', crops)?.id).toBe('c1');
    expect(matchCrop('Muu põlduba', crops)?.id).toBe('c2');
  });
  it('määramata kultuur → null', () => {
    expect(matchCrop('Teadmata kultuur', crops)).toBeNull();
    expect(matchCrop('', crops)).toBeNull();
    expect(matchCrop('Kartul', crops)).toBeNull();
  });
});

describe('isWinterCrop', () => {
  it('tuvastab talivilja nimest või registrist', () => {
    expect(isWinterCrop('Talinisu allakülvita', crops)).toBe(true);
    expect(isWinterCrop('Taliraps', crops)).toBe(true);
    expect(isWinterCrop('Rukis', crops)).toBe(true);
    expect(isWinterCrop('Muu põlduba', crops)).toBe(false);
    expect(isWinterCrop('Suvinisu', crops)).toBe(false);
    expect(isWinterCrop('', crops)).toBe(false);
  });
});

describe('buildEntryLines', () => {
  it('masin ja haakeriist saavad sama tundide arvu eraldi ridadena', () => {
    const lines = buildEntryLines({
      laborHours: 8,
      vehicle: { id: 'v1', name: 'Traktor' },
      implement: { id: 'i1', name: 'Ader' },
      equipmentHours: 7.4,
      fuelLiters: 68,
      materials: [{ id: 'm1', name: 'Väetis', unit: 'kg', quantity: 1418 }, { id: 'm2', name: 'Seeme', unit: 'kg', quantity: 0 }]
    });
    expect(lines.map((l) => [l.kind, l.quantity])).toEqual([
      ['LABOR', 8],
      ['MACHINE', 7.4],
      ['IMPLEMENT', 7.4],
      ['FUEL', 68],
      ['MATERIAL', 1418]
    ]);
    expect(lines.map((l) => l.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });
  it('koristuse saak on HARVEST rida', () => {
    expect(buildEntryLines({ harvestTonnes: 198.4 })).toMatchObject([{ kind: 'HARVEST', quantity: 198.4, unit: 't' }]);
  });
});

const stored = (kind: StoredLine['kind'], quantity: number, unitPrice: number | null, confirmedQuantity: number | null): StoredLine => ({
  kind, quantity, unitPrice, confirmedQuantity, vehicleId: null, implementId: null, materialId: null, label: kind, unit: 'h', sortOrder: 0
});

describe('mergeLines', () => {
  it('säilitab ühiku kulu ja jääb PENDING olekusse', () => {
    const r = mergeLines([stored('LABOR', 8, 12, null)], buildEntryLines({ laborHours: 9 }), 'PENDING');
    expect(r.financeStatus).toBe('PENDING');
    expect(r.lines[0].unitPrice).toBe(12);
  });
  it('kinnitatud kande koguse muutus → CHANGED, vana kogus alles', () => {
    const r = mergeLines([stored('LABOR', 8, 12, 8)], buildEntryLines({ laborHours: 9 }), 'CONFIRMED');
    expect(r.financeStatus).toBe('CHANGED');
    expect(r.lines[0].confirmedQuantity).toBe(8);
  });
  it('muutmata kogused jätavad kinnituse kehtima', () => {
    const r = mergeLines([stored('LABOR', 8, 12, 8)], buildEntryLines({ laborHours: 8 }), 'CONFIRMED');
    expect(r.financeStatus).toBe('CONFIRMED');
  });
  it('eemaldatud rida kinnitatud kandel → CHANGED', () => {
    const r = mergeLines([stored('LABOR', 8, 12, 8), stored('FUEL', 50, 1.5, 50)], buildEntryLines({ laborHours: 8 }), 'CONFIRMED');
    expect(r.financeStatus).toBe('CHANGED');
  });
});

describe('canConfirm / summarizeLines', () => {
  it('kinnitada saab ainult hinnastatud ridadega', () => {
    expect(canConfirm([{ unitPrice: 1 }, { unitPrice: null }])).toBe(false);
    expect(canConfirm([{ unitPrice: 0 }])).toBe(true);
    expect(canConfirm([])).toBe(false);
  });
  it('kütus eraldi, masin ja haakeriist koos', () => {
    const r = summarizeLines([
      { kind: 'LABOR', quantity: 10, unitPrice: 15 },
      { kind: 'MACHINE', quantity: 5, unitPrice: 40 },
      { kind: 'IMPLEMENT', quantity: 5, unitPrice: 10 },
      { kind: 'FUEL', quantity: 100, unitPrice: 1.2 },
      { kind: 'MATERIAL', quantity: 200, unitPrice: 0.5 },
      { kind: 'HARVEST', quantity: 10, unitPrice: 200 }
    ]);
    expect(r).toEqual({ labor: 150, equipment: 250, fuel: 120, materials: 100, costTotal: 620, revenue: 2000, profit: 1380 });
  });
});

describe('filterTemplatePhases (malli tööde filtreerimine hooaja ja vilja tüübi järgi)', () => {
  it('jooksvas aastas taliviljal rakenduvad ainult hooldus ja koristus', () => {
    expect(filterTemplatePhasesForCurrent(true, 'PREPARATION')).toBe(false);
    expect(filterTemplatePhasesForCurrent(true, 'SOWING')).toBe(false);
    expect(filterTemplatePhasesForCurrent(true, 'CARE')).toBe(true);
    expect(filterTemplatePhasesForCurrent(true, 'HARVEST')).toBe(true);
  });

  it('jooksvas aastas suviviljal rakenduvad kõik 4 faasi', () => {
    expect(filterTemplatePhasesForCurrent(false, 'PREPARATION')).toBe(true);
    expect(filterTemplatePhasesForCurrent(false, 'SOWING')).toBe(true);
    expect(filterTemplatePhasesForCurrent(false, 'CARE')).toBe(true);
    expect(filterTemplatePhasesForCurrent(false, 'HARVEST')).toBe(true);
  });

  it('sügistöödes taliviljal rakenduvad ettevalmistus ja külv', () => {
    expect(filterTemplatePhasesForAutumn(true, 'PREPARATION')).toBe(true);
    expect(filterTemplatePhasesForAutumn(true, 'SOWING')).toBe(true);
    expect(filterTemplatePhasesForAutumn(true, 'CARE')).toBe(false);
    expect(filterTemplatePhasesForAutumn(true, 'HARVEST')).toBe(false);
  });

  it('sügistöödes suviviljal rakendub AINULT ettevalmistus (külv toimub kevadel)', () => {
    expect(filterTemplatePhasesForAutumn(false, 'PREPARATION')).toBe(true);
    expect(filterTemplatePhasesForAutumn(false, 'SOWING')).toBe(false);
    expect(filterTemplatePhasesForAutumn(false, 'CARE')).toBe(false);
    expect(filterTemplatePhasesForAutumn(false, 'HARVEST')).toBe(false);
  });
});

