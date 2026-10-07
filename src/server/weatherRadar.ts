// src/server/weatherRadar.ts
// Sajuradar: Keskkonnaagentuuri (Ilmateenistus) Harku + Sürgavere radarite koondpilt KAIA avaandmetest.
// KAIA annab iga 5 minuti järel ODIM_H5 faili (PCAPPI, sajuintensiivsus RATE mm/h, Mercatori võrk).
// Server laeb viimase faili, värvib selle läbipaistvaks PNG-ks ja hoiab mälus kuni uue kaadrini.
import { deflateSync, crc32 } from 'zlib';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ready as h5ready, File as H5File } from 'h5wasm/node';
import { RADAR_RATE_SCALE } from '../services/radarScale.ts';

const KAIA_API = 'https://avaandmed.keskkonnaportaal.ee/api/lists/active';
const RADAR_CONTENT_TYPE = '0102FB01';
// KAIA uus kaader tuleb iga 5 min; kontrollime uut mitte sagedamini kui see
const REFRESH_MS = 2.5 * 60 * 1000;
// Mitu viimast kaadrit hoitakse ja antakse kaardile animatsiooniks (5 min vahega)
export const RADAR_FRAME_COUNT = 10;

export interface RadarFrame {
  /** Mõõtmise aeg (UTC, ISO) */
  time: string;
  /** [[lõuna, lääs], [põhi, ida]] */
  bounds: [[number, number], [number, number]];
  png: Buffer;
}

/** Värvib RATE väljad RGBA-ks; nodata, undetect ja nõrk (< 0,1 mm/h) sadu jäävad läbipaistvaks. */
export function colorizeRate(values: ArrayLike<number>, nodata: number, undetect: number, gain = 1, offset = 0): Uint8Array {
  const rgba = new Uint8Array(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    const raw = values[i];
    if (raw === nodata || raw === undetect) continue;
    const rate = raw * gain + offset;
    let step: (typeof RADAR_RATE_SCALE)[number] | null = null;
    for (const s of RADAR_RATE_SCALE) {
      if (rate >= s.min) step = s;
      else break;
    }
    if (!step) continue;
    const o = i * 4;
    rgba[o] = step.color[0];
    rgba[o + 1] = step.color[1];
    rgba[o + 2] = step.color[2];
    rgba[o + 3] = step.alpha;
  }
  return rgba;
}

/** Minimaalne PNG kodeerija (RGBA, 8 bitti, filter 0). */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bitisügavus
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

type KaiaDocument = {
  id: number | string;
  metadata: Record<string, unknown>;
  fileMetadata?: { id: number | string } | { id: number | string }[];
};

type CompositeRef = { docId: string; fileId: string; time: string };

/** KAIA viimased koondpildid, uuemad eespool. */
async function findRecentComposites(count: number): Promise<CompositeRef[]> {
  // Aken peab katma RADAR_FRAME_COUNT kaadrit (5 min vahega) koos KAIA viite ja võimalike vahelejäämistega
  const since = new Date(Date.now() - (count * 5 + 40) * 60 * 1000).toISOString();
  const res = await fetch(`${KAIA_API}/items/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter: {
        and: {
          children: [
            { underContentType: { contentType: RADAR_CONTENT_TYPE } },
            { isEqual: { field: 'Radar', value: 'comp' } },
            { isEqual: { field: 'RadarDataType', value: 'CAP' } },
            { greaterThan: { field: 'Timestamp', value: since } }
          ]
        }
      },
      pageSize: 100,
      includeFileMetadata: true,
      fields: ['Timestamp']
    }),
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`KAIA päring ebaõnnestus: ${res.status}`);
  const body = (await res.json()) as { documents?: KaiaDocument[] };
  const docs = (body.documents ?? [])
    .map((d) => ({ d, t: new Date(String(d.metadata.Timestamp)).getTime() }))
    .filter((x) => !isNaN(x.t))
    .sort((a, b) => b.t - a.t);
  const refs: CompositeRef[] = [];
  for (const { d, t } of docs) {
    const file = Array.isArray(d.fileMetadata) ? d.fileMetadata[0] : d.fileMetadata;
    if (!file) continue;
    const time = new Date(t).toISOString();
    if (refs.some((r) => r.time === time)) continue;
    refs.push({ docId: String(d.id), fileId: String(file.id), time });
    if (refs.length >= count) break;
  }
  return refs;
}

async function loadComposite(docId: string, fileId: string, time: string): Promise<RadarFrame> {
  const res = await fetch(`${KAIA_API}/items/${docId}/files/${fileId}`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`KAIA faili allalaadimine ebaõnnestus: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());

  // h5wasm-i Node'i versioon loeb päris failisüsteemist
  await h5ready;
  const path = join(tmpdir(), `teris-radar-${process.pid}-${Date.now()}.h5`);
  await writeFile(path, bytes);
  try {
    const f = new H5File(path, 'r');
    try {
      const attrs = (p: string) => {
        const o = f.get(p) as any;
        return Object.fromEntries(
          Object.entries(o.attrs as Record<string, { value: unknown }>).map(([k, a]) => [k, typeof a.value === 'bigint' ? Number(a.value) : a.value])
        ) as Record<string, any>;
      };
      const where = attrs('where');
      const what = attrs('dataset1/what');
      if (what.quantity !== 'RATE') throw new Error(`Ootamatu radari suurus: ${what.quantity}`);
      const data = (f.get('dataset1/data1/data') as any).value as ArrayLike<number>;
      const width = Number(where.xsize);
      const height = Number(where.ysize);
      const rgba = colorizeRate(data, Number(what.nodata), Number(what.undetect), Number(what.gain ?? 1), Number(what.offset ?? 0));
      // Mercatori võrk: lõunaserv LL-nurgast, põhjaserv UL-nurgast. (Faili LR_lat erineb LL_lat-ist;
      // radarite katvusringide asukoha järgi sobib LL-nurk, vt muudatuse kirjeldust.)
      return {
        time,
        bounds: [[Number(where.LL_lat), Number(where.LL_lon)], [Number(where.UL_lat), Number(where.UR_lon)]],
        png: encodePng(width, height, rgba)
      };
    } finally {
      f.close();
    }
  } finally {
    await unlink(path).catch(() => {});
  }
}

// Viimased kaadrid, vanemad eespool
let cached: RadarFrame[] = [];
let lastCheck = 0;
let inFlight: Promise<RadarFrame[]> | null = null;

/** Viimased RADAR_FRAME_COUNT kaadrit (vanemad eespool); KAIA-t kontrollitakse kõige rohkem kord REFRESH_MS jooksul. */
export async function getRecentRadarFrames(): Promise<RadarFrame[]> {
  if (cached.length && Date.now() - lastCheck < REFRESH_MS) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const refs = await findRecentComposites(RADAR_FRAME_COUNT);
      lastCheck = Date.now();
      if (!refs.length) return cached;
      const frames: RadarFrame[] = [];
      // Juba töödeldud kaadrid võetakse vahemälust, alla laaditakse ainult uued
      for (const ref of refs) {
        const existing = cached.find((f) => f.time === ref.time);
        try {
          frames.push(existing ?? await loadComposite(ref.docId, ref.fileId, ref.time));
        } catch (err) {
          console.error(`Sajuradar: kaadri ${ref.time} laadimine ebaõnnestus:`, err);
        }
      }
      if (frames.length) cached = frames.sort((a, b) => a.time.localeCompare(b.time));
      return cached;
    } catch (err) {
      console.error('Sajuradar: KAIA andmete laadimine ebaõnnestus:', err);
      // Viga ei tohi koormata KAIA-t igal päringul — proovi uuesti järgmise intervalli järel
      lastCheck = Date.now();
      return cached;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Konkreetse aja kaader (kui see on veel mälus). */
export function getCachedRadarFrame(time: string): RadarFrame | null {
  return cached.find((f) => f.time === time) ?? null;
}
