import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import { encodePng } from './weatherRadar';
import { decodePng } from './pngDecode';
import { cloudMaskFromRgba, fieldPixelsByCell, validateCloudCheckPolygons } from './satelliteClouds';

describe('decodePng', () => {
  it('loeb RGBA PNG-i tagasi samadeks piksliteks', () => {
    const rgba = new Uint8Array([1, 2, 3, 255, 250, 250, 250, 255, 9, 9, 9, 0, 40, 120, 60, 255]);
    const png = decodePng(encodePng(2, 2, rgba));
    expect(png.width).toBe(2);
    expect(png.height).toBe(2);
    expect(Array.from(png.rgba)).toEqual(Array.from(rgba));
  });
});

describe('cloudMaskFromRgba', () => {
  it('0 = andmed puuduvad, 1 = selge, 2 = pilv', () => {
    const rgba = new Uint8Array([40, 120, 60, 255, 235, 238, 240, 255, 0, 0, 0, 0]);
    expect(Array.from(cloudMaskFromRgba(rgba))).toEqual([1, 2, 0]);
  });
});

describe('fieldPixelsByCell', () => {
  const lest = '+proj=lcc +lat_1=59.33333333333334 +lat_2=58 +lat_0=57.51755393055556 +lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
  const toWgs = (x: number, y: number) => proj4(lest, 'EPSG:4326', [x, y]) as [number, number];

  it('100 × 100 m ruut L-EST97-s = 4 pikslit (50 m) õiges ruudus ja reas', () => {
    // Ruut 610 000…610 100 × 6 445 000…6 445 100 → ruut 61_644 (6 440 000…6 450 000), veerud 0–1,
    // read alt 100–101 (= ülevalt 98–99)
    const ring = [[610000, 6445000], [610100, 6445000], [610100, 6445100], [610000, 6445100], [610000, 6445000]]
      .map(([x, y]) => toWgs(x + 0.01, y + 0.01));
    const cells = fieldPixelsByCell([[ring]]);
    expect([...cells.keys()]).toEqual(['61_644']);
    expect(cells.get('61_644')!.sort((a, b) => a - b)).toEqual([98 * 200, 98 * 200 + 1, 99 * 200, 99 * 200 + 1]);
  });

  it('kattuvaid põlde loetakse üks kord', () => {
    const ring = [[610000, 6445000], [610100, 6445000], [610100, 6445100], [610000, 6445100], [610000, 6445000]]
      .map(([x, y]) => toWgs(x + 0.01, y + 0.01));
    expect(fieldPixelsByCell([[ring], [ring]]).get('61_644')!.length).toBe(4);
  });
});

describe('validateCloudCheckPolygons', () => {
  const ring = [[25.88, 58.13], [25.89, 58.13], [25.89, 58.14], [25.88, 58.13]];
  it('lubab korrektse ja keelab vigase', () => {
    expect(validateCloudCheckPolygons([[ring]])).toBeNull();
    expect(validateCloudCheckPolygons([])).not.toBeNull();
    expect(validateCloudCheckPolygons([[[[1, 2], [3, 4]]]])).not.toBeNull();
    expect(validateCloudCheckPolygons([[ring.map(([x, y]) => [x + 20, y])]])).not.toBeNull();
  });
});
