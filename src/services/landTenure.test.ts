import { describe, it, expect } from 'vitest';
import { deriveOwnershipType } from './landTenure';

const op = { id: 'p1', name: 'Loisu Agro OÜ' };

describe('deriveOwnershipType', () => {
  it('omanik = operaator → oma maa (nime tõstutundetu, tühikud ühtlustatud)', () => {
    expect(deriveOwnershipType({ ownerName: ' loisu  agro OÜ ' }, op)).toBe('OWNED');
    expect(deriveOwnershipType({ ownerPartyId: 'p1', ownerName: 'muu nimi' }, op)).toBe('OWNED');
  });
  it('muu omanik → renditud', () => {
    expect(deriveOwnershipType({ ownerName: 'Jaan Tamm' }, op)).toBe('RENTED');
    expect(deriveOwnershipType({ ownerPartyId: 'p2' }, op)).toBe('RENTED');
    expect(deriveOwnershipType({ ownerName: 'Jaan Tamm' }, null)).toBe('RENTED');
  });
  it('omanikuta üksus → oma maa', () => {
    expect(deriveOwnershipType({ ownerName: '' }, op)).toBe('OWNED');
    expect(deriveOwnershipType({}, null)).toBe('OWNED');
  });
});
