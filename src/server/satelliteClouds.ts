// src/server/satelliteClouds.ts
// Oma pilvekontroll Satiladu Sentinel-2 päevapiltidele, põldude kaupa.
// Satiladu enda "pilvevaba" filter ei sobi: see lubab õhukese pilve/uduga päevi ja selle andmed lõppesid
// 2026-08-11 (hilisemaid päevi ei tunnistata kunagi pilvevabaks). Siin: L-EST97 10 km ruutude kaupa
// laaditakse iga päeva kohta väike RGB pilt (50 m/piksel), sellest tehakse mask (andmed puuduvad / selge /
// pilv) ja hoitakse mälus ning kettal. Pilvisus loetakse ainult põldude pikslitelt.
import { mkdir, readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { deflateSync, inflateSync } from 'zlib';
import proj4 from 'proj4';
import { decodePng } from './pngDecode.ts';
import { isCloudPixel, pointInRings } from '../services/ndvi.ts';
import { getSatiladuDates } from './satiladu.ts';

proj4.defs('EPSG:3301', '+proj=lcc +lat_1=59.33333333333334 +lat_2=58 +lat_0=57.51755393055556 +lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
const toLest = proj4('EPSG:4326', 'EPSG:3301');

const CELL_M = 10_000;
const PX_M = 50;
const CELL_PX = CELL_M / PX_M; // 200
const FETCH_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 30_000;
const MEMORY_MAX = 2000; // maske (à 40 kB)
/** Nii palju päevi tagasi võib pilt veel täieneda — neid kettale ei salvestata */
const FRESH_DAYS = 3;
const CACHE_DIR = process.env.TERIS_SAT_CACHE_DIR || join(homedir(), '.cache', 'teris', 'satellite-clouds');

/** Piksli olek maskis */
const NO_DATA = 0, CLEAR = 1, CLOUD = 2;

/** Päev loetakse põldude kohal selgeks, kui andmeid on ≥ 90% põldudest ja pilves ≤ 10% neist */
export const CLEAR_MIN_COVERAGE = 0.9;
export const CLEAR_MAX_CLOUD = 0.1;

const memory = new Map<string, Uint8Array>();
const inflight = new Map<string, Promise<Uint8Array>>();

function remember(key: string, mask: Uint8Array) {
  if (memory.size >= MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, mask);
}

/** RGBA → mask (0 andmed puuduvad, 1 selge, 2 pilv) */
export function cloudMaskFromRgba(rgba: Uint8Array): Uint8Array {
  const mask = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < mask.length; i++) {
    const o = i * 4;
    if (rgba[o + 3] < 255) mask[i] = NO_DATA;
    else mask[i] = isCloudPixel(rgba[o], rgba[o + 1], rgba[o + 2]) ? CLOUD : CLEAR;
  }
  return mask;
}

function cellUrl(date: string, cx: number, cy: number): string {
  const params = new URLSearchParams({
    date,
    service: 'WMS',
    request: 'GetMap',
    version: '1.1.1',
    layers: 'sentinel_2_rgb',
    styles: '',
    format: 'image/png',
    transparent: 'true',
    srs: 'EPSG:3301',
    bbox: [cx * CELL_M, cy * CELL_M, (cx + 1) * CELL_M, (cy + 1) * CELL_M].join(','),
    width: String(CELL_PX),
    height: String(CELL_PX)
  });
  return `https://teenus.maaamet.ee/ows/wms-sentinel-2-rgb?${params}`;
}

function isFresh(date: string): boolean {
  return Date.now() - new Date(`${date}T00:00:00Z`).getTime() < FRESH_DAYS * 86_400_000;
}

async function loadCellMask(date: string, cx: number, cy: number): Promise<Uint8Array> {
  const key = `${date}_${cx}_${cy}`;
  const hit = memory.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const file = join(CACHE_DIR, `${key}.bin`);
    try {
      const mask = new Uint8Array(inflateSync(await readFile(file)));
      if (mask.length === CELL_PX * CELL_PX) {
        remember(key, mask);
        return mask;
      }
    } catch {
      // vahemälus pole
    }
    const res = await fetch(cellUrl(date, cx, cy), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/png')) {
      throw new Error(`Satelliidipilti ei saanud (${date}, ${res.status})`);
    }
    const png = decodePng(Buffer.from(await res.arrayBuffer()));
    const mask = cloudMaskFromRgba(png.rgba);
    remember(key, mask);
    if (!isFresh(date)) {
      await mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
      await writeFile(file, deflateSync(mask)).catch(() => {});
    }
    return mask;
  })();
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

/** Põldude pikslid ruutude kaupa: ruudu võti → maskiindeksid, mis jäävad mõne põllu sisse */
export function fieldPixelsByCell(polygons: [number, number][][][]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const poly of polygons) {
    const rings = poly.map((ring) => ring.map(([lng, lat]) => toLest.forward([lng, lat]) as [number, number]));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of rings[0] ?? []) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (!Number.isFinite(minX)) continue;
    // Pikslikeskmed globaalses 50 m võrgus
    const i0 = Math.floor(minX / PX_M), i1 = Math.floor(maxX / PX_M);
    const j0 = Math.floor(minY / PX_M), j1 = Math.floor(maxY / PX_M);
    for (let gj = j0; gj <= j1; gj++) {
      const y = (gj + 0.5) * PX_M;
      for (let gi = i0; gi <= i1; gi++) {
        const x = (gi + 0.5) * PX_M;
        if (!pointInRings(x, y, rings)) continue;
        const cx = Math.floor(gi / CELL_PX), cy = Math.floor(gj / CELL_PX);
        const col = gi - cx * CELL_PX;
        const row = CELL_PX - 1 - (gj - cy * CELL_PX); // pildi ülemine rida on ruudu põhjaserv
        const key = `${cx}_${cy}`;
        let list = out.get(key);
        if (!list) out.set(key, (list = []));
        list.push(row * CELL_PX + col);
      }
    }
  }
  // Kattuvad põllud (nt sama põld eri aastatel) loetakse üks kord
  for (const [k, list] of out) out.set(k, [...new Set(list)]);
  return out;
}

const MAX_POLYGONS = 2000;
const MAX_VERTICES = 300_000;

/** Kontrollib päringu põlde: [hulknurk][rõngas][punkt] = [pikkus, laius], Eesti piires. Veateade või null. */
export function validateCloudCheckPolygons(polygons: unknown): string | null {
  if (!Array.isArray(polygons) || !polygons.length) return 'Põllud puuduvad';
  if (polygons.length > MAX_POLYGONS) return 'Liiga palju põlde korraga';
  let vertices = 0;
  for (const poly of polygons) {
    if (!Array.isArray(poly) || !poly.length) return 'Vigane põllu geomeetria';
    for (const ring of poly) {
      if (!Array.isArray(ring) || ring.length < 4) return 'Vigane põllu geomeetria';
      for (const p of ring) {
        if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return 'Vigane põllu geomeetria';
        if (p[0] < 20 || p[0] > 30 || p[1] < 56 || p[1] > 61) return 'Põllud peavad jääma Eestisse';
        vertices++;
      }
    }
  }
  return vertices > MAX_VERTICES ? 'Liiga palju piiripunkte korraga' : null;
}

export interface DateCloudStat {
  date: string;
  /** Põldude osa, mille kohta pildil on andmed (0…1) */
  coverage: number;
  /** Pilves osa andmetega põlluosast (0…1) */
  cloud: number;
}

async function statForDate(date: string, cells: Map<string, number[]>): Promise<DateCloudStat> {
  let total = 0, data = 0, cloud = 0;
  for (const [key, pixels] of cells) {
    const [cx, cy] = key.split('_').map(Number);
    const mask = await loadCellMask(date, cx, cy);
    for (const p of pixels) {
      total++;
      if (mask[p] === NO_DATA) continue;
      data++;
      if (mask[p] === CLOUD) cloud++;
    }
  }
  return { date, coverage: total ? data / total : 0, cloud: data ? cloud / data : 1 };
}

/**
 * Pilvisus põldude kohal kõigil perioodi päevadel (uusim ees). Töötab kuni ajapiiranguni ja tagastab
 * seni kontrollitud päevad; korduspäring jätkab (maskid on vahemälus).
 */
export async function checkFieldClouds(
  from: string,
  to: string,
  polygons: [number, number][][][],
  budgetMs = 8000
): Promise<{ stats: DateCloudStat[]; total: number }> {
  const dates = await getSatiladuDates({ from, to });
  const cells = fieldPixelsByCell(polygons);
  if (!cells.size) return { stats: [], total: dates.length };

  const deadline = Date.now() + budgetMs;
  const stats: (DateCloudStat | undefined)[] = new Array(dates.length);
  let next = 0;
  const worker = async () => {
    while (next < dates.length && Date.now() < deadline) {
      const i = next++;
      try {
        stats[i] = await statForDate(dates[i], cells);
      } catch (err) {
        console.warn('Pilvekontroll ebaõnnestus:', dates[i], err instanceof Error ? err.message : err);
        stats[i] = { date: dates[i], coverage: 0, cloud: 1 };
      }
    }
  };
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));
  // Ainult katkematu algus (uusimast alates), et klient saaks jätkata järjest
  const done: DateCloudStat[] = [];
  for (const s of stats) {
    if (!s) break;
    done.push(s);
  }
  return { stats: done, total: dates.length };
}
