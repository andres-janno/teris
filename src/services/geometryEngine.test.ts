import { describe, it, expect } from 'vitest';
import { getVisibleElementsBounds } from './geometryEngine';

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
