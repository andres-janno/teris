import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('hilisem vahe asendab varasema', () => {
    expect(cn('px-2', 'px-3')).toBe('px-3');
  });
  it('text-2xs on kirjasuurus, mitte värv — ei kustu värviga koos', () => {
    expect(cn('text-2xs', 'text-foreground')).toBe('text-2xs text-foreground');
  });
  it('text-2xs asendab teise kirjasuuruse', () => {
    expect(cn('text-xs', 'text-2xs')).toBe('text-2xs');
  });
  it('jätab välja tühjad tingimused', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
