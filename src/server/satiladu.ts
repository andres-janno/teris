// src/server/satiladu.ts
// Satiladu (Maa- ja Ruumiamet, https://esthub.maaruum.ee/est/satiladu-p1.html): Sentinel-2 päevapiltide loend.
// Avalikku API-t loendi jaoks pole, seega loeme kuupäevad Satiladu otsingulehe HTML-ist. Pilvevaba filter
// ("Määra otsinguala pilvevabal alal") vajab ala — ilma alata tagastab Satiladu tühja loendi.
// Pildid ise tulevad brauserisse otse WMS-ist (teenus.maaamet.ee), see moodul annab ainult kuupäevad.

const SATILADU_URL = 'https://esthub.maaruum.ee/index.php';
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const FETCH_TIMEOUT_MS = 30_000;

export interface SatiladuQuery {
  /** AAAA-KK-PP */
  from: string;
  /** AAAA-KK-PP */
  to: string;
  /** Ainult päevad, mil ala oli pilvevaba */
  cloudFree: boolean;
  /** [lõuna, lääs, põhi, ida] WGS84 — kohustuslik, kui cloudFree */
  bbox?: [number, number, number, number];
}

const cache = new Map<string, { at: number; dates: string[] }>();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Kontrollib päringu parameetreid; tagastab veateate või null. */
export function validateSatiladuQuery(q: SatiladuQuery): string | null {
  if (!ISO_DATE.test(q.from) || !ISO_DATE.test(q.to)) return 'Kuupäevad peavad olema kujul AAAA-KK-PP';
  if (q.from > q.to) return 'Alguskuupäev on hilisem kui lõppkuupäev';
  if (q.cloudFree && !q.bbox) return 'Pilvevaba otsing vajab ala (bbox)';
  if (q.bbox) {
    const [s, w, n, e] = q.bbox;
    if (![s, w, n, e].every(Number.isFinite) || s >= n || w >= e) return 'Vigane ala (bbox)';
    // Eesti ja lähiümbrus
    if (s < 56 || n > 61 || w < 20 || e > 30) return 'Ala peab jääma Eestisse';
  }
  return null;
}

/** Satiladu otsingutulemuse HTML → kuupäevad (AAAA-KK-PP), uusim ees, kordusteta. */
export function parseSatiladuDates(html: string): string[] {
  const dates = new Set<string>();
  for (const m of html.matchAll(/class="inim-kuup">\s*(\d{2})\.(\d{2})\.(\d{4})/g)) {
    dates.add(`${m[3]}-${m[2]}-${m[1]}`);
  }
  return [...dates].sort().reverse();
}

function cacheKey(q: SatiladuQuery): string {
  // Ala ümardatakse ~100 m täpsusele, et kaardi väike nihutamine kasutaks sama vastust
  const bbox = q.cloudFree && q.bbox ? q.bbox.map((v) => v.toFixed(3)).join(',') : '';
  return `${q.from}|${q.to}|${q.cloudFree ? 1 : 0}|${bbox}`;
}

/** Leafleti LatLngBounds kuju, mida Satiladu vorm ootab: "LatLng(N, E)|LatLng(S, W)". */
function satiladuBbox([s, w, n, e]: [number, number, number, number]): string {
  return `LatLng(${n}, ${e})|LatLng(${s}, ${w})`;
}

export async function getSatiladuDates(q: SatiladuQuery): Promise<string[]> {
  const key = cacheKey(q);
  const hit = cache.get(key);
  // Täna lõppev periood võib saada uue pildi; varasemad perioodid ei muutu, kuid hoiame ühtse aegumise
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.dates;

  const params = new URLSearchParams({
    lang_id: '1',
    page_id: '1',
    satelliit: 'S2',
    toode: '1', // RGB; kõigil Sentinel-2 toodetel on samad kuupäevad
    kuupaev_algus: q.from,
    kuupaev_lopp: q.to,
    pilvitu: q.cloudFree ? '1' : '0',
    bbox: q.cloudFree && q.bbox ? satiladuBbox(q.bbox) : ''
  });
  const res = await fetch(`${SATILADU_URL}?${params}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Satiladu vastas ${res.status}`);
  const dates = parseSatiladuDates(await res.text());

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), dates });
  return dates;
}
