import { describe, it, expect } from 'vitest';
import { canDelete } from './db';

describe('canDelete', () => {
  const user = { username: 'rein', isAdmin: false };
  const admin = { username: 'andresj', isAdmin: true };

  it('kasutaja saab kustutada enda loodud kirjet', () => {
    expect(canDelete(user, 'rein')).toBe(true);
  });

  it('kasutaja ei saa kustutada teise loodud ega teadmata loojaga kirjet', () => {
    expect(canDelete(user, 'andresj')).toBe(false);
    expect(canDelete(user, null)).toBe(false);
  });

  it('admin saab kustutada kõiki kirjeid', () => {
    expect(canDelete(admin, 'rein')).toBe(true);
    expect(canDelete(admin, null)).toBe(true);
  });

  it('sisselogimata ei saa kustutada', () => {
    expect(canDelete(null, 'rein')).toBe(false);
  });
});
