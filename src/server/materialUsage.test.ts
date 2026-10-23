import { describe, expect, it } from 'vitest';
import { materialSeasonTotals } from './materialUsage';

describe('materialSeasonTotals', () => {
  it('summeerib planeeritud (norm x pindala) ja kasutatud materjali kaupa', () => {
    const m = materialSeasonTotals(
      [
        { materialId: 'a', ratePerHa: 200, areaHa: 10.5 },
        { materialId: 'a', ratePerHa: 50, areaHa: 2 },
        { materialId: 'b', ratePerHa: 1.5, areaHa: 3 }
      ],
      [
        { materialId: 'a', quantity: 1000.255 },
        { materialId: 'a', quantity: 500 }
      ]
    );
    expect(m.get('a')).toEqual({ plannedQty: 2200, usedQty: 1500.26 });
    expect(m.get('b')).toEqual({ plannedQty: 4.5, usedQty: 0 });
  });
  it('null norm annab 0 ja materjalita read jäetakse välja', () => {
    const m = materialSeasonTotals(
      [{ materialId: 'a', ratePerHa: null, areaHa: 5 }, { materialId: null, ratePerHa: 3, areaHa: 5 }],
      [{ materialId: null, quantity: 9 }, { materialId: 'c', quantity: 2 }]
    );
    expect(m.has('a')).toBe(false);
    expect(m.size).toBe(1);
    expect(m.get('c')).toEqual({ plannedQty: 0, usedQty: 2 });
  });
});
