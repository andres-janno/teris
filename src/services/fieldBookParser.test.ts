import { describe, it, expect } from 'vitest';
import {
  parseDecimal,
  parseDate,
  parseDateRange,
  parseAmount,
  parseFieldBookSheet
} from './fieldBookParser';

// Rida 13 veeruga (A..M), puuduvad lahtrid tühjad.
const r = (...cells: string[]): string[] => {
  const out = [...cells];
  while (out.length < 13) out.push('');
  return out;
};

// Anonüümitud näide e-PRIA väljavõtte lehe ülesehitusest.
const SHEET_2: string[][] = [
  r('osaühing Test-Agro / 10000000', '', '', '', '', '', '', 'e-PRIA / Põlluraamatu väljavõte'),
  r(),
  r('Põllu üldandmed'),
  r('Hooaeg', '2025'),
  r('Põllumassiivi number', '61044415735'),
  r('Põllu number', '2'),
  r('Põllu pindala (ha)', '7,67'),
  r('Kasutusõigus', '(SR) Suuline rendileping'),
  r('Maakasutus', '(P) Põllumaa'),
  r('Põllumajanduskultuur', 'Talinisu allakülvita'),
  r(),
  r('Kultuuri tüüp', 'Kultuur', 'Saagi tüüp', 'Planeeritud saak (t/ha)', 'Tegelik saak (t/ha)'),
  r('Põhikultuur', 'talinisu allakülvita', 'Terad', '4,00', '3,50'),
  r('Põhikultuur', 'talinisu allakülvita'),
  r(),
  r('Tegevus', 'Kuupäev', 'Pindala', 'Muud omadused', 'Register/Materjal', 'Nimi', 'Liik/tüüp', 'Täpsustus', 'Kogus', 'N (kg/ha)', 'P (kg/ha)', 'K (kg/ha)', 'Märkused'),
  r('Külvamine/istutamine', '26.09.2024', '7,67', '', 'EL ühtne sordileht', 'Julia', 'Talinisu', 'OTS', '240 kg/ha'),
  r('Väetamine', '03.04.2025 - 07.04.2025', '7,67', 'Paisklaotamine;', 'Väetis registrist', 'Ammooniumnitraat 34,4%', 'Ammooniumnitraat', '', '200 kg/ha', '68,8'),
  r('Seire', '30.04.2025', '7,67', '', 'Umbrohud', 'Põldsinep', '', '', '7 taime/m2', '', '', '', 'Umbrohud täies jõus'),
  r('Taimekaitsevahendi kasutamine', '02.05.2025 - 03.05.2025', '7,67', 'Teostaja: Testija Tõnu', 'Taimekaitsevahendid registrist', 'Tombo WG', 'Herbitsiid', '', '0,20 kg/ha'),
  r('', '', '', 'Toimeaine: Etüültrineksapak', 'Taimekaitsevahendid registrist', 'MOXA', 'Kasvuregulaator', '', '0,20 l/ha', '', '', '', 'Lamandumise oht'),
  r('', '', '', '', 'Märgaja/kleepaine', 'Dassoil', '', '', '0,50 l/ha', '', '', '', 'Lamandumise oht'),
  r('Saagikoristus', '31.07.2025 - 07.08.2025', '7,67', 'Põhikultuur;', '', '', 'Terad', '', '3,5 t/ha'),
  r('Kündmine', '10.08.2025', '7,67'),
  r('Külvamine/istutamine', '15.08.2025', '7,67', '', 'EL ühtne sordileht', 'cult', 'Taliraps', 'OTS', '4 kg/ha'),
  r('', '', '', '', '', '', '', '', 'NPK Kokku', '146,46', '15,27', '53,06'),
  r(),
  r('Trükitud: 24.09.2026'),
  r('Koostaja: TEST KOOSTAJA')
];

describe('abifunktsioonid', () => {
  it('parseDecimal loeb komaga ja tühikutega arve', () => {
    expect(parseDecimal('7,67')).toBe(7.67);
    expect(parseDecimal('1 234,5')).toBe(1234.5);
    expect(parseDecimal('4')).toBe(4);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });

  it('parseDate teisendab pp.kk.aaaa ISO-ks ja viskab vigasel', () => {
    expect(parseDate('26.09.2024')).toBe('2024-09-26');
    expect(() => parseDate('2024-09-26')).toThrow(/Loetamatu kuupäev/);
  });

  it('parseDateRange toetab üksikut kuupäeva ja vahemikku', () => {
    expect(parseDateRange('30.04.2025')).toEqual({ dateFrom: '2025-04-30', dateTo: null });
    expect(parseDateRange('03.04.2025 - 07.04.2025')).toEqual({ dateFrom: '2025-04-03', dateTo: '2025-04-07' });
  });

  it('parseAmount jagab koguse ja ühiku', () => {
    expect(parseAmount('0,20 kg/ha')).toEqual({ amount: 0.2, unit: 'kg/ha' });
    expect(parseAmount('7 taime/m2')).toEqual({ amount: 7, unit: 'taime/m2' });
    expect(parseAmount('')).toEqual({ amount: null, unit: null });
    expect(parseAmount('umbes palju')).toEqual({ amount: null, unit: 'umbes palju' });
  });
});

describe('parseFieldBookSheet', () => {
  const sheet = parseFieldBookSheet('2', SHEET_2);

  it('loeb päise ja saagid', () => {
    expect(sheet.season).toBe(2025);
    expect(sheet.fieldCode).toBe('61044415735');
    expect(sheet.num).toBe('2');
    expect(sheet.areaHa).toBe(7.67);
    expect(sheet.crop).toBe('Talinisu allakülvita');
    expect(sheet.targetYieldTonsHa).toBe(4);
    expect(sheet.actualYieldTonsHa).toBe(3.5);
  });

  it('loeb tegevused, jätab välja NPK Kokku, Trükitud ja Koostaja read', () => {
    expect(sheet.operations.map((o) => o.type)).toEqual([
      'Külvamine/istutamine',
      'Väetamine',
      'Seire',
      'Taimekaitsevahendi kasutamine',
      'Saagikoristus',
      'Kündmine',
      'Külvamine/istutamine'
    ]);
  });

  it('väetamine: vahemik, meetod ilma semikoolonita, N kogus', () => {
    const op = sheet.operations[1];
    expect(op.dateFrom).toBe('2025-04-03');
    expect(op.dateTo).toBe('2025-04-07');
    expect(op.method).toBe('Paisklaotamine');
    expect(op.products).toHaveLength(1);
    expect(op.products[0]).toMatchObject({ name: 'Ammooniumnitraat 34,4%', amount: 200, unit: 'kg/ha', nKgHa: 68.8, pKgHa: null });
  });

  it('seire: umbrohu arvukus ja märkus', () => {
    const op = sheet.operations[2];
    expect(op.products[0]).toMatchObject({ category: 'Umbrohud', name: 'Põldsinep', amount: 7, unit: 'taime/m2' });
    expect(op.notes).toBe('Umbrohud täies jõus');
  });

  it('taimekaitse: teostaja, jätkuread tootena, toimeaine toote juures', () => {
    const op = sheet.operations[3];
    expect(op.performerName).toBe('Testija Tõnu');
    expect(op.method).toBeNull();
    expect(op.products.map((p) => p.name)).toEqual(['Tombo WG', 'MOXA', 'Dassoil']);
    expect(op.products[0].activeIngredient).toBeNull();
    expect(op.products[1].activeIngredient).toBe('Etüültrineksapak');
    expect(op.notes).toBe('Lamandumise oht');
  });

  it('koristus ja kündmine', () => {
    expect(sheet.operations[4].method).toBe('Põhikultuur');
    expect(sheet.operations[4].products[0]).toMatchObject({ kind: 'Terad', amount: 3.5, unit: 't/ha' });
    expect(sheet.operations[5].products).toEqual([]);
  });

  it('külvi- ja koristuskuupäev: järgmise kultuuri külv ei loe', () => {
    expect(sheet.seedingDate).toBe('2024-09-26');
    expect(sheet.harvestDate).toBe('2025-08-07');
  });

  it('võtab saagid esimeselt täidetud kultuurirealt', () => {
    const rows = SHEET_2.map((row) => [...row]);
    rows[12] = r('Põhikultuur', 'talinisu allakülvita');
    rows[13] = r('Põhikultuur', 'talinisu allakülvita', 'Terad', '5,00', '');
    const s = parseFieldBookSheet('2', rows);
    expect(s.targetYieldTonsHa).toBe(5);
    expect(s.actualYieldTonsHa).toBeNull();
  });

  it('koristuseta: külvikuupäev on esimene põhikultuuri külv', () => {
    const rows = SHEET_2.filter((row) => row[0] !== 'Saagikoristus');
    const s = parseFieldBookSheet('2', rows);
    expect(s.harvestDate).toBeNull();
    expect(s.seedingDate).toBe('2024-09-26');
  });

  it('põhikultuuri külv pärast koristust ei muuda külvikuupäeva', () => {
    const rows = SHEET_2.map((row) => [...row]);
    rows[24] = r('Külvamine/istutamine', '20.09.2025', '7,67', '', 'EL ühtne sordileht', 'Julia', 'Talinisu', 'OTS', '230 kg/ha');
    const s = parseFieldBookSheet('2', rows);
    expect(s.seedingDate).toBe('2024-09-26');
  });

  it('viskab lehe vea loetamatu kuupäeva korral', () => {
    const rows = SHEET_2.map((row) => [...row]);
    rows[23] = r('Kündmine', 'eile', '7,67');
    expect(() => parseFieldBookSheet('2', rows)).toThrow(/Loetamatu kuupäev/);
  });

  it('viskab vea, kui tegevuste tabel puudub', () => {
    expect(() => parseFieldBookSheet('2', SHEET_2.slice(0, 14))).toThrow(/Tegevuste tabel puudub/);
  });
});
