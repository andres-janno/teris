// PRIA vormiridade puhtad abifunktsioonid: koguse ümberarvutus pindala muutumisel
import { describe, it, expect } from 'vitest';
import { emptyPriaRow, recomputeTotals, recomputeHarvestTotal } from './PriaLinesEditor';

describe('recomputeTotals', () => {
  it('arvutab koguse kokku normist uue pindala järgi', () => {
    const rows = [{ ...emptyPriaRow(), label: 'NPK', ratePerHa: '250', total: '605' }];
    expect(recomputeTotals(rows, 1.21)[0].total).toBe('302,5');
  });

  it('normita rida jätab koguse kokku alles', () => {
    const rows = [{ ...emptyPriaRow(), label: 'NPK', ratePerHa: '', total: '605' }];
    expect(recomputeTotals(rows, 1.21)[0].total).toBe('605');
  });

  it('loeb komaga normi', () => {
    const rows = [{ ...emptyPriaRow(), label: 'Herbitsiid', ratePerHa: '0,5', total: '' }];
    expect(recomputeTotals(rows, 10)[0].total).toBe('5');
  });
});

describe('recomputeHarvestTotal', () => {
  it('arvutab saagi kokku normist', () => {
    expect(recomputeHarvestTotal({ ratePerHa: '4', total: '9,68', priaKind: 'Terad', priaSpec: '' }, 1.21).total).toBe('4,84');
  });

  it('normita saak jätab koguse alles', () => {
    expect(recomputeHarvestTotal({ ratePerHa: '', total: '9,68', priaKind: '', priaSpec: '' }, 1.21).total).toBe('9,68');
  });
});
