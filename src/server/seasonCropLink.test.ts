import { describe, it, expect } from 'vitest';
import { resolveSeasonCrop, type LinkCrop } from './seasonCropLink.ts';

const crop = (id: string, name: string, extra: Partial<LinkCrop> = {}): LinkCrop => ({
  id, name, priaName: null, priaUndersowing: false, priaNameWithoutUndersowing: null, priaNameWithUndersowing: null,
  priaNameWithLegumeUndersowing: null, varieties: [], ...extra
});
const crops = [
  crop('c-nisu', 'Talinisu', { priaName: 'Talinisu', priaUndersowing: true }),
  crop('c-uba', 'Põlduba', { priaName: 'Muu põlduba', varieties: [{ id: 'v-j', name: 'Jõgeva', priaName: 'Põlduba "Jõgeva"' }] }),
  crop('c-ristik', 'Ristik', { priaName: 'Ristik (vähemalt 80% ristikut)' })
];

describe('resolveSeasonCrop', () => {
  it('PRIA impordi nimi: kultuur registrist, allakülv nimest, PRIA nimi jääb', () => {
    expect(resolveSeasonCrop({ crop: 'Talinisu liblikõieliste allakülviga' }, crops)).toEqual({
      crop: 'Talinisu', cropId: 'c-nisu', varietyId: null, undersowing: 'LEGUME', priaCropName: 'Talinisu liblikõieliste allakülviga'
    });
  });
  it('vormist registri nimi + allakülv: PRIA nimi tuletatakse', () => {
    const r = resolveSeasonCrop({ crop: 'Talinisu', undersowing: 'OTHER' }, crops);
    expect(r.priaCropName).toBe('Talinisu allakülviga, v.a liblikõieliste allakülviga');
  });
  it('sordi PRIA nimetus', () => {
    const r = resolveSeasonCrop({ crop: 'Põlduba', cropVariety: 'Jõgeva' }, crops);
    expect(r).toMatchObject({ cropId: 'c-uba', varietyId: 'v-j', priaCropName: 'Põlduba "Jõgeva"' });
  });
  it('muutmata valikuga jääb senine PRIA nimi (registri hilisem muudatus ei muuda ajalugu)', () => {
    const existing = { cropId: 'c-ristik', cropVariety: null, undersowing: 'NONE' as const, priaCropName: 'Ristik (vanem nimi)' };
    expect(resolveSeasonCrop({ crop: 'Ristik' }, crops, existing).priaCropName).toBe('Ristik (vanem nimi)');
    expect(resolveSeasonCrop({ crop: 'Talinisu' }, crops, existing).priaCropName).toBe('Talinisu allakülvita');
  });
  it('kultuuri muutmisel otsustab nimi, mitte kaasa saadetud vana seos', () => {
    expect(resolveSeasonCrop({ crop: 'Ristik', cropId: 'c-nisu', undersowing: 'LEGUME' }, crops)).toMatchObject({ cropId: 'c-ristik', priaCropName: 'Ristik (vähemalt 80% ristikut)' });
    expect(resolveSeasonCrop({ crop: 'Talinisu allakülvita', undersowing: 'LEGUME' }, crops).undersowing).toBe('NONE');
  });
  it('registrist puuduv ja valimata kultuur', () => {
    expect(resolveSeasonCrop({ crop: 'Muu heintaimede segu' }, crops)).toMatchObject({ crop: 'Muu heintaimede segu', cropId: null, priaCropName: 'Muu heintaimede segu' });
    expect(resolveSeasonCrop({ crop: '' }, crops)).toMatchObject({ crop: 'Teadmata kultuur', cropId: null, priaCropName: null });
  });
});
