import { describe, it, expect } from 'vitest';
import {
  SYSTEM_CATEGORIES, isGoods, articleFieldRules, sanitizeArticleFields, matchesPriaKind, categoryChangeError
} from './articleRules';

describe('SYSTEM_CATEGORIES', () => {
  it('iga süsteemne liik üks kord ja õiges rühmas', () => {
    const kinds = SYSTEM_CATEGORIES.map((c) => c.systemKind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(SYSTEM_CATEGORIES.find((c) => c.systemKind === 'FUEL')).toMatchObject({ group: 'CONSUMABLE', name: 'Kütus' });
    expect(SYSTEM_CATEGORIES.find((c) => c.systemKind === 'GRAIN')).toMatchObject({ group: 'PRODUCE', name: 'Terad' });
    expect(SYSTEM_CATEGORIES.filter((c) => c.group === 'SERVICE')).toHaveLength(4);
  });
});

describe('isGoods', () => {
  it('teenus pole kaup, muud on', () => {
    expect(isGoods('SERVICE')).toBe(false);
    expect(isGoods('CONSUMABLE')).toBe(true);
    expect(isGoods('PRODUCE')).toBe(true);
    expect(isGoods('OTHER_GOODS')).toBe(true);
  });
});

describe('articleFieldRules', () => {
  it('teenusel hind, laoseisu ja ladu pole', () => {
    expect(articleFieldRules('SERVICE', 'MACHINE_TIME')).toMatchObject({ price: true, stock: false, defaultWarehouse: false, pria: false, crop: false });
  });
  it('seemnel PRIA ja sort, hinda pole', () => {
    expect(articleFieldRules('CONSUMABLE', 'SEED')).toMatchObject({ pria: true, seed: true, fertilizer: false, price: false, stock: true, defaultWarehouse: true });
  });
  it('väetisel NPK, taimekaitsel toimeaine', () => {
    expect(articleFieldRules('CONSUMABLE', 'FERTILIZER')).toMatchObject({ pria: true, fertilizer: true });
    expect(articleFieldRules('CONSUMABLE', 'PLANT_PROTECTION')).toMatchObject({ pria: true, plantProtection: true });
  });
  it('teradel kultuur', () => {
    expect(articleFieldRules('PRODUCE', 'GRAIN')).toMatchObject({ crop: true, pria: false, stock: true });
  });
  it('kasutaja liik kulumaterjalis: ainult laoväljad', () => {
    expect(articleFieldRules('CONSUMABLE', null)).toEqual({
      pria: false, seed: false, fertilizer: false, plantProtection: false, price: false, crop: false, defaultWarehouse: true, stock: true
    });
  });
});

describe('sanitizeArticleFields', () => {
  it('nullib liigiga sobimatud väljad', () => {
    const f = {
      price: 40, cropId: 'c1', defaultWarehouseId: 'w1', cropVarietyId: 'v1', priaRegister: 'R', priaKind: 'K', priaSpec: 'C1',
      activeIngredient: 'A', nPct: 10, pPct: 5, kPct: 3
    };
    expect(sanitizeArticleFields(f, articleFieldRules('SERVICE', 'LABOR_TIME'))).toEqual({
      price: 40, cropId: null, defaultWarehouseId: null, cropVarietyId: null, priaRegister: null, priaKind: null, priaSpec: null,
      activeIngredient: null, nPct: null, pPct: null, kPct: null
    });
    expect(sanitizeArticleFields(f, articleFieldRules('CONSUMABLE', 'FERTILIZER'))).toEqual({
      price: null, cropId: null, defaultWarehouseId: 'w1', cropVarietyId: null, priaRegister: 'R', priaKind: 'K', priaSpec: null,
      activeIngredient: null, nPct: 10, pPct: 5, kPct: 3
    });
  });
});

describe('matchesPriaKind', () => {
  it('PRIA liik vastab süsteemsele liigile', () => {
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: 'SEED' }, 'SEED')).toBe(true);
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: 'FERTILIZER' }, 'SEED')).toBe(false);
  });
  it('OTHER = kulumaterjal, mis pole seeme, väetis ega taimekaitse', () => {
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: null }, 'OTHER')).toBe(true);
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: 'FUEL' }, 'OTHER')).toBe(true);
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: 'SEED' }, 'OTHER')).toBe(false);
    expect(matchesPriaKind({ group: 'SERVICE', systemKind: null }, 'OTHER')).toBe(false);
    expect(matchesPriaKind({ group: 'PRODUCE', systemKind: 'GRAIN' }, 'OTHER')).toBe(false);
  });
});

describe('categoryChangeError', () => {
  it('uus liik: lubatud', () => {
    expect(categoryChangeError(null, 'OTHER_GOODS')).toBeNull();
  });
  it('süsteemset liiki ei saa teise rühma viia', () => {
    expect(categoryChangeError({ group: 'CONSUMABLE', systemKind: 'FUEL' }, 'OTHER_GOODS')).toMatch(/Süsteemse liigi rühma/);
    expect(categoryChangeError({ group: 'CONSUMABLE', systemKind: 'FUEL' }, 'CONSUMABLE')).toBeNull();
  });
  it('kasutaja liigi rühma ei saa teenuse ja kauba vahel muuta', () => {
    expect(categoryChangeError({ group: 'CONSUMABLE', systemKind: null }, 'SERVICE')).toMatch(/teenuse ja kauba/);
    expect(categoryChangeError({ group: 'CONSUMABLE', systemKind: null }, 'OTHER_GOODS')).toBeNull();
  });
});
