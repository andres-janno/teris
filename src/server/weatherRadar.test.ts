import { describe, it, expect } from 'vitest';
import { inflateSync } from 'zlib';
import { colorizeRate, encodePng } from './weatherRadar';
import { RADAR_RATE_SCALE } from '../services/radarScale';

describe('colorizeRate', () => {
  it('jätab nodata, undetect ja nõrga saju läbipaistvaks', () => {
    const rgba = colorizeRate([65535, 0, 0.05], 65535, 0);
    expect(Array.from(rgba)).toEqual(new Array(12).fill(0));
  });

  it('värvib intensiivsuse skaala järgi', () => {
    const rgba = colorizeRate([0.2, 3, 100], 65535, 0);
    expect(Array.from(rgba.slice(0, 4))).toEqual([...RADAR_RATE_SCALE[0].color, RADAR_RATE_SCALE[0].alpha]);
    expect(Array.from(rgba.slice(4, 8))).toEqual([...RADAR_RATE_SCALE[3].color, RADAR_RATE_SCALE[3].alpha]);
    expect(Array.from(rgba.slice(8, 12))).toEqual([...RADAR_RATE_SCALE[7].color, RADAR_RATE_SCALE[7].alpha]);
  });
});

describe('encodePng', () => {
  it('kirjutab kehtiva PNG päise ja pikslid', () => {
    const rgba = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const png = encodePng(2, 1, rgba);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.readUInt32BE(16)).toBe(2);
    expect(png.readUInt32BE(20)).toBe(1);
    const idatLen = png.readUInt32BE(33);
    expect(png.toString('ascii', 37, 41)).toBe('IDAT');
    const raw = inflateSync(png.subarray(41, 41 + idatLen));
    expect(Array.from(raw)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
