import { describe, it, expect } from 'vitest';
import { snapToCell, neighborCells, geometryCenter } from './grid';

describe('snapToCell', () => {
  it('ümardab 0,1° ruudustikule', () => {
    expect(snapToCell(58.1234, 25.8761)).toEqual({ lat: 58.1, lon: 25.9 });
    expect(snapToCell(58.15, 25.85)).toEqual({ lat: 58.2, lon: 25.9 });
  });
  it('ei tekita ujukoma sabasid', () => {
    expect(snapToCell(59.30000001, 26.7).lat).toBe(59.3);
  });
});

describe('neighborCells', () => {
  it('8 naabrit, enne külgnaabrid, siis nurgad', () => {
    const n = neighborCells({ lat: 58.1, lon: 25.8 });
    expect(n).toHaveLength(8);
    expect(n.slice(0, 4)).toEqual(expect.arrayContaining([{ lat: 58.2, lon: 25.8 }, { lat: 58, lon: 25.8 }, { lat: 58.1, lon: 25.7 }, { lat: 58.1, lon: 25.9 }]));
    expect(n.slice(4)).toContainEqual({ lat: 58.2, lon: 25.9 });
  });
});

describe('geometryCenter', () => {
  it('polügooni keskpunkt', () => {
    const c = geometryCenter({ type: 'Polygon', coordinates: [[[25.8, 58.1], [25.82, 58.1], [25.82, 58.12], [25.8, 58.12], [25.8, 58.1]]] });
    expect(c!.lat).toBeCloseTo(58.11, 3);
    expect(c!.lon).toBeCloseTo(25.81, 3);
  });
  it('multipolügoon', () => {
    const c = geometryCenter({ type: 'MultiPolygon', coordinates: [[[[25.8, 58.1], [25.82, 58.1], [25.82, 58.12], [25.8, 58.1]]]] });
    expect(c).not.toBeNull();
  });
  it('vigane geomeetria → null', () => {
    expect(geometryCenter(null)).toBeNull();
    expect(geometryCenter({ type: 'Polygon', coordinates: [] })).toBeNull();
  });
});
