import { describe, expect, it } from 'vitest';
import { convertQty } from './units';

describe('convertQty', () => {
  it('sama ühik (tõstutundetu, tühikud) jääb samaks', () => {
    expect(convertQty(5, 'kg', ' KG ')).toBe(5);
    expect(convertQty(2, 'l', 'l')).toBe(2);
  });
  it('teisendab g/kg/t vahel', () => {
    expect(convertQty(1500, 'g', 'kg')).toBe(1.5);
    expect(convertQty(2, 't', 'kg')).toBe(2000);
    expect(convertQty(250, 'kg', 't')).toBe(0.25);
  });
  it('teisendamatu paar annab null', () => {
    expect(convertQty(1, 'l', 'kg')).toBeNull();
    expect(convertQty(1, 'tk', 'kg')).toBeNull();
  });
  it('objekti prototüübi nimed ei ole ühikud', () => {
    expect(convertQty(1, 'constructor', 'kg')).toBeNull();
    expect(convertQty(1, 'kg', 'toString')).toBeNull();
  });
});
