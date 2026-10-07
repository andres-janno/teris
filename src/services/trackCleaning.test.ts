import { describe, it, expect } from 'vitest';
import { cleanTrack } from './trackCleaning';
import type { TelemetryPoint } from '../types/telemetry';

// ~1 m põhja suunas laiuskraadides
const M = 1 / 111195;

const pt = (i: number, northM: number, isWorking: boolean): TelemetryPoint => ({
  timestamp: new Date(Date.UTC(2026, 9, 7, 12, 0, i)).toISOString(),
  lat: 58.3 + northM * M,
  lng: 26.7,
  speedKmH: isWorking ? 5 : 0,
  heading: 0,
  isWorking,
  workingWidthM: 12
});

describe('cleanTrack', () => {
  it('jätab paigal hüplevad punktid vahele, kuid säilitab esimese ja viimase', () => {
    const points = [pt(0, 0, false), pt(1, 0.5, false), pt(2, -0.4, false), pt(3, 0.3, false), pt(4, 0.1, false)];
    const cleaned = cleanTrack(points);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0]).toBe(points[0]);
    expect(cleaned[1]).toBe(points[4]);
  });

  it('säilitab liikumise punktid', () => {
    const points = Array.from({ length: 10 }, (_, i) => pt(i, i * 3, true));
    expect(cleanTrack(points)).toHaveLength(10);
  });

  it('märgib lühikese töölõigu mitte-töötavaks', () => {
    const points = [pt(0, 0, false), pt(1, 3, true), pt(2, 6, true), pt(3, 9, false), pt(4, 12, false)];
    const cleaned = cleanTrack(points, { minWorkRunM: 10 });
    expect(cleaned.every((p) => !p.isWorking)).toBe(true);
    // Sisendit ei muudeta
    expect(points[1].isWorking).toBe(true);
  });

  it('säilitab piisavalt pika töölõigu', () => {
    const points = [pt(0, 0, false), ...Array.from({ length: 6 }, (_, i) => pt(i + 1, 3 + i * 3, true)), pt(7, 25, false)];
    const cleaned = cleanTrack(points, { minWorkRunM: 10 });
    expect(cleaned.filter((p) => p.isWorking)).toHaveLength(6);
  });
});
