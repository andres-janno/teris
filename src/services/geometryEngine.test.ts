import { describe, it, expect } from 'vitest';
import { getVisibleElementsBounds, getGeometryLabelPoint, getGeometriesLabelPoint } from './geometryEngine';

const hidden = { fields: false, vehicles: false, cultivation: false, poi: false, soilSamples: false };

describe('getVisibleElementsBounds', () => {
  it('arvestab ainult nähtavaid kihte', () => {
    const params = {
      visibility: { ...hidden, vehicles: true },
      vehicles: [{ position: [58.1, 25.8] as [number, number] }, { position: [58.3, 26.1] as [number, number] }],
      soilSamples: [{ lat: 59, lng: 24 }]
    };
    expect(getVisibleElementsBounds(params)).toEqual([[58.1, 25.8], [58.3, 26.1]]);
  });

  it('lisab mullaproovid ja Põllutööde rajad', () => {
    const params = {
      visibility: { ...hidden, cultivation: true, soilSamples: true },
      soilSamples: [{ lat: 58.0, lng: 25.0 }],
      vehicleTracks: [{ trailLine: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[26.0, 58.5], [26.2, 58.6]] } } }]
    };
    expect(getVisibleElementsBounds(params)).toEqual([[58.0, 25.0], [58.6, 26.2]]);
  });

  it('tagastab null, kui midagi pole nähtav', () => {
    expect(getVisibleElementsBounds({ visibility: hidden })).toBeNull();
  });
});

describe('getGeometryLabelPoint', () => {
  it('ristküliku puhul keskpunkt', () => {
    const p = getGeometryLabelPoint({ type: 'Polygon', coordinates: [[[25, 58], [25.02, 58], [25.02, 58.01], [25, 58.01], [25, 58]]] });
    expect(p![0]).toBeCloseTo(58.005, 4);
    expect(p![1]).toBeCloseTo(25.01, 4);
  });

  it('U-kujulise põllu silt jääb põllu sisse, mitte tühja keskele', () => {
    // U: alumine riba + kaks haru; raskuskese on tühjas „orus“
    const u = { type: 'Polygon' as const, coordinates: [[[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]]] };
    const [lat, lng] = getGeometryLabelPoint(u)!;
    const inValley = lng > 1 && lng < 2 && lat > 1;
    expect(inValley).toBe(false);
  });

  it('MultiPolygoni puhul suurim osa', () => {
    const p = getGeometryLabelPoint({
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
        [[[1, 1], [1.1, 1], [1.1, 1.1], [1, 1.1], [1, 1]]]
      ]
    });
    expect(p![0]).toBeGreaterThan(1);
  });
});

describe('getGeometriesLabelPoint', () => {
  it('kahe kõrvuti põllu massiivi silt on ühendi keskel (põlluvahel)', () => {
    const left = { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };
    const right = { type: 'Polygon' as const, coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] };
    const [lat, lng] = getGeometriesLabelPoint([left, right])!;
    expect(lat).toBeCloseTo(0.5, 2);
    expect(lng).toBeGreaterThan(0.5);
    expect(lng).toBeLessThan(1.5);
  });
});
