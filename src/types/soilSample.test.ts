import { describe, expect, it } from 'vitest';
import { getSoilMetricColor, getSoilMetricLevel, SOIL_LEVEL_COLOR } from './soilSample';

describe('mulla näitaja tase', () => {
  it('pH: ≤5.5 halb, ≤6.5 hoiatus, muidu hea', () => {
    expect(getSoilMetricLevel('ph', 5.2)).toBe('bad');
    expect(getSoilMetricLevel('ph', 6.0)).toBe('warn');
    expect(getSoilMetricLevel('ph', 7.1)).toBe('good');
  });
  it('lubjatarve on ümberpööratud: kõrge = halb', () => {
    expect(getSoilMetricLevel('limeRequirement', 0.5)).toBe('good');
    expect(getSoilMetricLevel('limeRequirement', 3)).toBe('warn');
    expect(getSoilMetricLevel('limeRequirement', 5)).toBe('bad');
  });
  it('puuduv väärtus ja vanus → none', () => {
    expect(getSoilMetricLevel('ph', null)).toBe('none');
    expect(getSoilMetricLevel('ph', undefined)).toBe('none');
    expect(getSoilMetricLevel('age', 3)).toBe('none');
  });
  it('kaardi värv tuleb tasemest, puuduv = hall', () => {
    expect(getSoilMetricColor('ph', 5.2)).toBe(SOIL_LEVEL_COLOR.bad);
    expect(getSoilMetricColor('potassium', 200)).toBe(SOIL_LEVEL_COLOR.good);
    expect(getSoilMetricColor('ph', undefined)).toBe('#94a3b8');
  });
});
