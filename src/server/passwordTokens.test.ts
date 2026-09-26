import { describe, it, expect } from 'vitest';
import { tokenExpiry } from './passwordTokens';

describe('tokenExpiry', () => {
  const now = new Date('2026-09-26T10:00:00Z');
  it('kutse kehtib 7 päeva', () => {
    expect(tokenExpiry('INVITE', now).toISOString()).toBe('2026-10-03T10:00:00.000Z');
  });
  it('lähtestus kehtib 1 tund', () => {
    expect(tokenExpiry('RESET', now).toISOString()).toBe('2026-09-26T11:00:00.000Z');
  });
});
