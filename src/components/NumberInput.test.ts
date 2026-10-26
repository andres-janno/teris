import { describe, expect, it } from 'vitest';
import { formatNumberText, parseNumberText } from './NumberInput';

describe('parseNumberText', () => {
  it('tühi ja vigane → null', () => {
    expect(parseNumberText('')).toBeNull();
    expect(parseNumberText('-')).toBeNull();
    expect(parseNumberText(',')).toBeNull();
    expect(parseNumberText('abc')).toBeNull();
    expect(parseNumberText('1,2,3')).toBeNull();
  });
  it('koma ja punkt', () => {
    expect(parseNumberText('2,5')).toBe(2.5);
    expect(parseNumberText('2.5')).toBe(2.5);
    expect(parseNumberText('2,')).toBe(2);
    expect(parseNumberText('0,0')).toBe(0);
    expect(parseNumberText('-3,25')).toBe(-3.25);
  });
  it('täisarv ümardab', () => {
    expect(parseNumberText('2,6', true)).toBe(3);
    expect(parseNumberText('50', true)).toBe(50);
  });
});

describe('formatNumberText', () => {
  it('komaga, ilma grupeerimiseta', () => {
    expect(formatNumberText(1234.5, 2)).toBe('1234,5');
    expect(formatNumberText(58.123456789, 6)).toBe('58,123457');
    expect(formatNumberText(50, 0)).toBe('50');
    expect(formatNumberText(0, 2)).toBe('0');
  });
});
