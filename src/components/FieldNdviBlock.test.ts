// Põllu kaardi NDVI plokk: olekud (laadimine, tulemus, viga, pilve all), tühistamine ja peidetud olek
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Polygon } from 'geojson';
import type { NdviSummary } from '../services/ndvi';

vi.mock('../services/fieldNdvi', () => ({ computeFieldNdvi: vi.fn() }));

import { computeFieldNdvi } from '../services/fieldNdvi';
import { FieldNdviBlock, NdviBlockView } from './FieldNdviBlock';
import { startNdviLoad, coverageNote, ndviStateFor, scheduleNdviLoad, NDVI_DEBOUNCE_MS, type NdviBlockState } from './fieldNdviState';

const geometry: Polygon = { type: 'Polygon', coordinates: [[[24, 58], [24.01, 58], [24.01, 58.01], [24, 58]]] };
const summary: NdviSummary = { mean: 0.456, classShares: [0.1, 0.3, 0.6], coverage: 1, cloudShare: 0 };
const mocked = vi.mocked(computeFieldNdvi);
const html = (state: NdviBlockState) => renderToStaticMarkup(createElement(NdviBlockView, { date: '2026-08-15', state }));
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => mocked.mockReset());

describe('NdviBlockView', () => {
  it('laadimise ajal näitab pealkirja, kuupäeva pp.kk.aaaa ja laadimise märki', () => {
    const out = html({ status: 'loading' });
    expect(out).toContain('NDVI');
    expect(out).toContain('15.08.2026');
    expect(out).toContain('Arvutan satelliidipildist');
    expect(out).toContain('role="status"');
  });

  it('tulemus: keskmine kahe komakohaga eesti komaga, klassid ja protsendid', () => {
    const out = html({ status: 'ready', summary });
    expect(out).toContain('0,46');
    expect(out).toContain('keskmine NDVI');
    expect(out).toContain('Paljas muld, kõrs');
    expect(out).toContain('60%');
    expect(out).toContain('10 m serv');
    expect(out).not.toContain('Arvutan');
  });

  it('viga: lühike tekst', () => {
    expect(html({ status: 'error' })).toContain('Satelliidipilti ei saanud laadida');
  });

  it('pilve all: eraldi tekst', () => {
    expect(html({ status: 'cloudy' })).toContain('Sel päeval on põld pilve all');
  });

  it('osaline kaetus annab allkirja, täielik mitte', () => {
    expect(coverageNote(summary)).toBeNull();
    expect(coverageNote({ ...summary, coverage: 0.7, cloudShare: 0.2 })).toBe('Arvestatud 70% põllust, 20% oli pilves.');
    expect(coverageNote({ ...summary, coverage: 0.4, cloudShare: 0 })).toContain('pole usaldusväärne');
  });
});

describe('FieldNdviBlock peidetud olek', () => {
  it('kuupäev puudub (kiht väljas) → plokki pole ja arvutust ei käivitata', () => {
    const out = renderToStaticMarkup(createElement(FieldNdviBlock, { geometry, date: null }));
    expect(out).toBe('');
    expect(mocked).not.toHaveBeenCalled();
  });

  it('kuupäevaga renderdub plokk', () => {
    const out = renderToStaticMarkup(createElement(FieldNdviBlock, { geometry, date: '2026-08-15' }));
    expect(out).toContain('15.08.2026');
  });
});

describe('startNdviLoad', () => {
  it('annab laadimise ja seejärel tulemuse', async () => {
    mocked.mockResolvedValue(summary);
    const states: NdviBlockState[] = [];
    startNdviLoad(geometry, '2026-08-15', (s) => states.push(s));
    await flush();
    expect(mocked).toHaveBeenCalledWith(geometry, '2026-08-15');
    expect(states.map((s) => s.status)).toEqual(['loading', 'ready']);
  });

  it('null tulemus tähendab pilve all', async () => {
    mocked.mockResolvedValue(null);
    const states: NdviBlockState[] = [];
    startNdviLoad(geometry, '2026-08-15', (s) => states.push(s));
    await flush();
    expect(states.at(-1)).toEqual({ status: 'cloudy' });
  });

  it('viga annab vea oleku', async () => {
    let rejectLoad!: (e: Error) => void;
    mocked.mockReturnValueOnce(new Promise<NdviSummary | null>((_, rej) => { rejectLoad = rej; }));
    const states: NdviBlockState[] = [];
    startNdviLoad(geometry, '2026-08-15', (s) => states.push(s));
    rejectLoad(new Error('x'));
    await flush();
    expect(states.at(-1)).toEqual({ status: 'error' });
  });

  it('tühistatud arvutuse tulemust ei näidata (kaart suleti või päev vahetus)', async () => {
    let resolveOld!: (v: NdviSummary) => void;
    mocked.mockReturnValueOnce(new Promise<NdviSummary | null>((r) => { resolveOld = r; }));
    mocked.mockResolvedValueOnce({ ...summary, mean: 0.8 });
    const states: NdviBlockState[] = [];
    const cancelOld = startNdviLoad(geometry, '2026-08-15', (s) => states.push(s));
    cancelOld();
    startNdviLoad(geometry, '2026-08-20', (s) => states.push(s));
    resolveOld(summary);
    await flush();
    const ready = states.filter((s) => s.status === 'ready');
    expect(ready).toHaveLength(1);
    expect(ready[0].status === 'ready' && ready[0].summary.mean).toBe(0.8);
  });

  it('tühistatud arvutuse viga ei kirjuta olekut üle', async () => {
    let rejectOld!: (e: Error) => void;
    mocked.mockReturnValueOnce(new Promise<NdviSummary | null>((_, rej) => { rejectOld = rej; }));
    const states: NdviBlockState[] = [];
    const cancel = startNdviLoad(geometry, '2026-08-15', (s) => states.push(s));
    cancel();
    rejectOld(new Error('x'));
    await flush();
    expect(states.map((s) => s.status)).toEqual(['loading']);
  });
});

describe('ndviStateFor (vana päeva tulemus ei jää näitama)', () => {
  it('sama päev → salvestatud olek', () => {
    const ready: NdviBlockState = { status: 'ready', summary };
    expect(ndviStateFor({ date: '2026-08-15', state: ready }, '2026-08-15')).toEqual(ready);
  });

  it('kuupäev on muutunud → laadimine, ka kui eelmise päeva tulemus on olemas', () => {
    expect(ndviStateFor({ date: '2026-08-15', state: { status: 'ready', summary } }, '2026-08-20')).toEqual({ status: 'loading' });
  });

  it('pole veel ühtegi tulemust → laadimine', () => {
    expect(ndviStateFor(null, '2026-08-20')).toEqual({ status: 'loading' });
  });
});

describe('scheduleNdviLoad (viivitus, fake timers)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ei käivita arvutust enne viivitust, käivitab pärast seda', async () => {
    mocked.mockResolvedValue(summary);
    const states: NdviBlockState[] = [];
    scheduleNdviLoad(geometry, '2026-08-15', (s) => states.push(s));
    await vi.advanceTimersByTimeAsync(NDVI_DEBOUNCE_MS - 1);
    expect(mocked).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(states.map((s) => s.status)).toEqual(['loading', 'ready']);
  });

  it('kiiresti vahetatud päevadest arvutatakse ainult viimane päev', async () => {
    mocked.mockResolvedValue(summary);
    const cancelFirst = scheduleNdviLoad(geometry, '2026-08-15', () => {});
    await vi.advanceTimersByTimeAsync(200);
    cancelFirst();
    const cancelSecond = scheduleNdviLoad(geometry, '2026-08-16', () => {});
    await vi.advanceTimersByTimeAsync(200);
    cancelSecond();
    scheduleNdviLoad(geometry, '2026-08-17', () => {});
    await vi.advanceTimersByTimeAsync(NDVI_DEBOUNCE_MS);
    expect(mocked.mock.calls.map((c) => c[1])).toEqual(['2026-08-17']);
  });

  it('tühistamine enne viivituse lõppu → ei arvutata ega näidata midagi', async () => {
    const states: NdviBlockState[] = [];
    const cancel = scheduleNdviLoad(geometry, '2026-08-15', (s) => states.push(s));
    cancel();
    await vi.advanceTimersByTimeAsync(NDVI_DEBOUNCE_MS * 2);
    expect(mocked).not.toHaveBeenCalled();
    expect(states).toEqual([]);
  });

  it('tühistamine pärast käivitust katkestab pooleli arvutuse tulemuse', async () => {
    let resolveOld!: (v: NdviSummary | null) => void;
    mocked.mockReturnValueOnce(new Promise<NdviSummary | null>((r) => { resolveOld = r; }));
    const states: NdviBlockState[] = [];
    const cancel = scheduleNdviLoad(geometry, '2026-08-15', (s) => states.push(s));
    await vi.advanceTimersByTimeAsync(NDVI_DEBOUNCE_MS);
    expect(mocked).toHaveBeenCalledTimes(1);
    cancel();
    resolveOld(summary);
    await vi.advanceTimersByTimeAsync(0);
    expect(states.map((s) => s.status)).toEqual(['loading']);
  });
});
