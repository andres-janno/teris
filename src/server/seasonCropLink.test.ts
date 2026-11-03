import { describe, it, expect } from 'vitest';
import { seasonCropId } from './seasonCropLink.ts';

const crops = [
  { id: 'c-nisu', name: 'Talinisu' }, { id: 'c-suvinisu', name: 'Suvinisu' }, { id: 'c-uba', name: 'Põlduba' },
  { id: 'c-ristik', name: 'Ristik' }, { id: 'c-rukis', name: 'Rukis' }
];

describe('seasonCropId', () => {
  it('seob PRIA pika nime registri kultuuriga', () => {
    expect(seasonCropId('Talinisu allakülvita', crops)).toBe('c-nisu');
    expect(seasonCropId('Muu põlduba', crops)).toBe('c-uba');
    expect(seasonCropId('Ristik (vähemalt 80% ristikut, kuni 20% heintaimi), v.a punane, roosa ja valge ristik', crops)).toBe('c-ristik');
    expect(seasonCropId('Rukis, v.a sangaste rukis, allakülvita', crops)).toBe('c-rukis');
    expect(seasonCropId('Suvinisu', crops)).toBe('c-suvinisu');
  });
  it('valimata või registrist puuduv kultuur jääb sidumata', () => {
    expect(seasonCropId('Teadmata kultuur', crops)).toBeNull();
    expect(seasonCropId('', crops)).toBeNull();
    expect(seasonCropId('Kartul', crops)).toBeNull();
  });
});
