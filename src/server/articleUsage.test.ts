import { describe, expect, it } from 'vitest';
import { articleSeasonTotals } from './articleUsage';

describe('articleSeasonTotals', () => {
  it('summeerib planeeritud (norm x pindala) ja kasutatud materjali kaupa', () => {
    const m = articleSeasonTotals(
      [
        { articleId: 'a', ratePerHa: 200, areaHa: 10.5 },
        { articleId: 'a', ratePerHa: 50, areaHa: 2 },
        { articleId: 'b', ratePerHa: 1.5, areaHa: 3 }
      ],
      [
        { articleId: 'a', quantity: 1000.255 },
        { articleId: 'a', quantity: 500 }
      ]
    );
    expect(m.get('a')).toEqual({ plannedQty: 2200, usedQty: 1500.26, entryCount: 2 });
    expect(m.get('b')).toEqual({ plannedQty: 4.5, usedQty: 0, entryCount: 0 });
  });
  it('null norm annab 0 ja materjalita read jäetakse välja', () => {
    const m = articleSeasonTotals(
      [{ articleId: 'a', ratePerHa: null, areaHa: 5 }, { articleId: null, ratePerHa: 3, areaHa: 5 }],
      [{ articleId: null, quantity: 9 }, { articleId: 'c', quantity: 2 }]
    );
    expect(m.has('a')).toBe(false);
    expect(m.size).toBe(1);
    expect(m.get('c')).toEqual({ plannedQty: 0, usedQty: 2, entryCount: 1 });
  });
});
