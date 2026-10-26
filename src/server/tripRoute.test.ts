import { describe, it, expect } from 'vitest';
import type { Polygon } from 'geojson';
import { segmentTrip, buildRoute, type Place, type TripPoint } from './tripRoute';

const LAT0 = 58.12;
const LNG0 = 25.9;
const M_LAT = 1 / 110_574;
const M_LNG = 1 / (111_320 * Math.cos((LAT0 * Math.PI) / 180));
const at = (xM: number, yM: number) => ({ lat: LAT0 + yM * M_LAT, lng: LNG0 + xM * M_LNG });

// Ruut x ∈ [x0, x0+size], y ∈ [0, size] meetrites
const square = (x0: number, size: number): Polygon => {
  const c = [at(x0, 0), at(x0 + size, 0), at(x0 + size, size), at(x0, size), at(x0, 0)];
  return { type: 'Polygon', coordinates: [c.map((p) => [p.lng, p.lat])] };
};

const T0 = new Date('2026-10-21T05:00:00Z').getTime();
const min = (m: number) => new Date(T0 + m * 60_000);
const pt = (m: number, xM: number, yM: number, ignition: boolean | null = true): TripPoint => ({ time: min(m), ...at(xM, yM), ignition });

const OPTS = { fieldRadiusM: 10, poiRadiusM: 25, minVisitMs: 60_000 } as const;

describe('segmentTrip', () => {
  it('laiendab sõitu sessioonist välja ja peatub süüte väljalülitamisel', () => {
    const pts: TripPoint[] = [
      pt(0, 0, 0, true), // varasem sõit
      pt(5, 0, 0, false), // süüde väljas → katkestus
      pt(10, 0, 0, true), // sõidu algus
      pt(15, 0, 0, true),
      pt(20, 0, 0, true), // sessioon algab
      pt(30, 0, 0, true), // sessioon lõpeb
      pt(40, 0, 0, true),
      pt(45, 0, 0, null), // süüteväljata seade → loeb sees olevaks
      pt(50, 0, 0, false), // süüde väljas
      pt(55, 0, 0, true)
    ];
    const trip = segmentTrip(pts, min(20), min(30));
    expect(trip).not.toBeNull();
    expect(trip!.start.getTime()).toBe(min(10).getTime());
    expect(trip!.end.getTime()).toBe(min(45).getTime());
    expect(trip!.points).toHaveLength(6);
  });

  it('peatub üle 20 min vahe juures', () => {
    const pts: TripPoint[] = [pt(0, 0, 0), pt(21, 0, 0), pt(30, 0, 0), pt(40, 0, 0), pt(59, 0, 0), pt(80, 0, 0)];
    const trip = segmentTrip(pts, min(30), min(40));
    expect(trip!.start.getTime()).toBe(min(21).getTime());
    expect(trip!.end.getTime()).toBe(min(59).getTime());
  });

  it('tagastab null, kui sessiooni ajal punkte pole', () => {
    expect(segmentTrip([pt(0, 0, 0)], min(30), min(40))).toBeNull();
  });
});

describe('buildRoute', () => {
  const field: Place = { id: '450', kind: 'FIELD', label: 'Nr 4 Toosi', geometry: square(0, 100) };

  it('põld 10 m piiri kaugusel sobib, 15 m kaugusel mitte', () => {
    const near = buildRoute([pt(0, -8, 50), pt(5, -8, 50)], [field], OPTS);
    expect(near.start.place?.id).toBe('450');
    const far = buildRoute([pt(0, -15, 50), pt(5, -15, 50)], [field], OPTS);
    expect(far.start.place).toBeNull();
    expect(far.visits).toHaveLength(0);
  });

  it('huvipunkt 25 m sees sobib, 30 m kaugusel mitte', () => {
    const poi: Place = { id: 'poi1', kind: 'POI', label: 'Kuivati', ...at(500, 500) };
    expect(buildRoute([pt(0, 520, 500), pt(5, 520, 500)], [poi], OPTS).start.place?.id).toBe('poi1');
    expect(buildRoute([pt(0, 530, 500), pt(5, 530, 500)], [poi], OPTS).start.place).toBeNull();
  });

  it('külastused järjekorras saabumise ja lahkumisega; lühike külastus jääb välja; tundmatu algus/lõpp', () => {
    const poi: Place = { id: 'poi1', kind: 'POI', label: 'Töökoda', ...at(1000, 1000) };
    const field2: Place = { id: '451', kind: 'FIELD', label: 'Nr 5 Mirka', geometry: square(300, 100) };
    const pts: TripPoint[] = [
      pt(0, 2000, 2000), // tundmatu algus
      pt(2, 1000, 1000), // töökoda 2–6
      pt(4, 1000, 1005),
      pt(6, 1000, 1000),
      pt(8, 350, 50), // põld 451 ainult üks punkt (< 1 min) → välja
      pt(10, 1500, 1500),
      pt(12, 50, 50), // põld 450 12–30
      pt(20, 60, 60),
      pt(30, 50, 40),
      pt(35, 3000, 3000) // tundmatu lõpp
    ];
    const route = buildRoute(pts, [field, field2, poi], OPTS);
    expect(route.start.place).toBeNull();
    expect(route.start.time).toBe(min(0).toISOString());
    expect(route.end.place).toBeNull();
    expect(route.end.time).toBe(min(35).toISOString());
    expect(route.visits.map((v) => v.place.id)).toEqual(['poi1', '450']);
    expect(route.visits[0]).toMatchObject({ arrive: min(2).toISOString(), leave: min(6).toISOString() });
    expect(route.visits[1]).toMatchObject({ arrive: min(12).toISOString(), leave: min(30).toISOString() });
  });

  it('mitme sobiva koha korral eelistatakse preferPlaceId-d, muidu lähimat', () => {
    // Kaks kattuvat põldu; punkt mõlemas
    const a: Place = { id: 'A', kind: 'FIELD', label: 'Nr 1 A', geometry: square(0, 100) };
    const b: Place = { id: 'B', kind: 'FIELD', label: 'Nr 2 B', geometry: square(50, 100) };
    const pts = [pt(0, 75, 50), pt(5, 75, 50)];
    expect(buildRoute(pts, [a, b], { ...OPTS, preferPlaceId: 'B' }).start.place?.id).toBe('B');
    expect(buildRoute(pts, [a, b], { ...OPTS, preferPlaceId: 'A' }).start.place?.id).toBe('A');
    // Lähim: põld 5 m kaugusel vs huvipunkt 20 m kaugusel → põld
    const poi: Place = { id: 'P', kind: 'POI', label: 'Kaal', ...at(-25, 50) };
    expect(buildRoute([pt(0, -5, 50), pt(5, -5, 50)], [a, poi], OPTS).start.place?.id).toBe('A');
  });
});
