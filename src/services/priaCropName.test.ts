import { describe, it, expect } from 'vitest';
import { derivePriaCropName, parseUndersowing, stripUndersowing, hasUndersowingVariant } from './priaCropName';

const talinisu = { name: 'Talinisu', priaName: 'Talinisu', priaUndersowing: true };
const rukis = { name: 'Rukis', priaName: 'Rukis, v.a "Sangaste" rukis', priaUndersowing: true, priaNameWithoutUndersowing: 'Rukis, v.a "Sangaste" rukis, allakülvita' };

describe('derivePriaCropName', () => {
  it('liidab allakülvi variandi', () => {
    expect(derivePriaCropName(talinisu, null, 'NONE')).toBe('Talinisu allakülvita');
    expect(derivePriaCropName(talinisu, null, 'OTHER')).toBe('Talinisu allakülviga, v.a liblikõieliste allakülviga');
    expect(derivePriaCropName(talinisu, null, 'LEGUME')).toBe('Talinisu liblikõieliste allakülviga');
  });
  it('erandnimi asendab vaikenime ainult oma variandil', () => {
    expect(derivePriaCropName(rukis, null, 'NONE')).toBe('Rukis, v.a "Sangaste" rukis, allakülvita');
    expect(derivePriaCropName(rukis, null, 'LEGUME')).toBe('Rukis, v.a "Sangaste" rukis liblikõieliste allakülviga');
  });
  it('allakülvi eristuseta kultuur on alusnimega, PRIA nimetuseta kultuur oma nimega', () => {
    expect(derivePriaCropName({ name: 'Põlduba', priaName: 'Muu põlduba' }, null, 'LEGUME')).toBe('Muu põlduba');
    expect(derivePriaCropName({ name: 'Kaer', priaUndersowing: true }, null, 'NONE')).toBe('Kaer allakülvita');
  });
  it('sordi PRIA nimetus asendab kultuuri aluse', () => {
    expect(derivePriaCropName(rukis, { priaName: '"Sangaste" rukis' }, 'NONE')).toBe('"Sangaste" rukis allakülvita');
    expect(derivePriaCropName({ name: 'Põlduba', priaName: 'Muu põlduba' }, { priaName: 'Põlduba "Jõgeva"' }, 'NONE')).toBe('Põlduba "Jõgeva"');
    expect(derivePriaCropName(talinisu, { priaName: '  ' }, 'NONE')).toBe('Talinisu allakülvita');
  });
});

describe('PRIA nime lahtivõtmine', () => {
  it.each([
    ['Talinisu allakülvita', 'NONE', 'Talinisu'],
    ['Suvioder liblikõieliste allakülviga', 'LEGUME', 'Suvioder'],
    ['Talinisu allakülviga, v.a liblikõieliste allakülviga', 'OTHER', 'Talinisu'],
    ['Rukis, v.a sangaste rukis, allakülvita', 'NONE', 'Rukis, v.a sangaste rukis'],
    ['Muu põlduba', 'NONE', 'Muu põlduba']
  ])('%s', (text, u, base) => {
    expect(parseUndersowing(text)).toBe(u);
    expect(stripUndersowing(text)).toBe(base);
  });
  it('tunneb allakülvi variandi ära', () => {
    expect(hasUndersowingVariant('Kaer allakülvita')).toBe(true);
    expect(hasUndersowingVariant('Muu põlduba')).toBe(false);
  });
});
