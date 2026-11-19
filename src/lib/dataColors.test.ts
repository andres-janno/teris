import { describe, expect, it } from 'vitest';
import * as dc from './dataColors';
import { UNDETERMINED_CROP_COLOR as serverUndetermined } from '../server/fieldSeasonCopy';
import { SOIL_LEVEL_COLOR as soilLevelColor } from '../types/soilSample';

const HEX = /^#[0-9a-f]{6}$/;

describe('andmevärvid', () => {
  it('kõik väärtused on 6-kohalised väiketähtedega hex-id', () => {
    const all = [
      dc.DEFAULT_CROP_COLOR, dc.UNDETERMINED_CROP_COLOR, dc.DEFAULT_VEHICLE_COLOR,
      ...Object.values(dc.SOIL_LEVEL_COLOR), ...Object.values(dc.FINANCE_COST_COLOR), ...Object.values(dc.TRIP_MAP_COLOR),
    ];
    for (const c of all) expect(c).toMatch(HEX);
  });
  it('vaikimisi kultuur kollane, määramata hall, uus sõiduk roheline (olemasolevad andmed)', () => {
    expect(dc.DEFAULT_CROP_COLOR).toBe('#eab308');
    expect(dc.UNDETERMINED_CROP_COLOR).toBe('#94a3b8');
    expect(dc.DEFAULT_VEHICLE_COLOR).toBe('#22c55e');
  });
  it('server ja mullatüübid kasutavad sama konstanti', () => {
    expect(serverUndetermined).toBe(dc.UNDETERMINED_CROP_COLOR);
    expect(soilLevelColor).toBe(dc.SOIL_LEVEL_COLOR);
  });
});

describe('kihtide värvimärgid (etapp 4d)', () => {
  it('on kaheksa kihti; fields ja vehicles järgivad teemat (CSS-muutuja), ülejäänud hex või gradient', () => {
    expect(Object.keys(dc.LAYER_SWATCH).sort()).toEqual(['cadastre', 'cultivation', 'fields', 'poi', 'satellite', 'soil', 'vehicles', 'weather']);
    expect(dc.LAYER_SWATCH.fields).toBe('var(--amber-400)');
    expect(dc.LAYER_SWATCH.vehicles).toBe('var(--emerald-400)');
    for (const k of ['cultivation', 'poi', 'cadastre', 'soil', 'weather'] as const) expect(dc.LAYER_SWATCH[k]).toMatch(HEX);
    expect(dc.LAYER_SWATCH.satellite).toMatch(/^linear-gradient\(/);
  });
});
