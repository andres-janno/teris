// src/services/satelliteLayer.ts
// Satiladu (Maa- ja Ruumiamet) Sentinel-2 päevapildid kaardikihina.
// WMS (teenus.maaamet.ee/ows/wms-sentinel-2-*) toetab ainult L-EST97 (EPSG:3301), kaart on aga
// Web Mercatoris. Iga kaardiplaadi jaoks küsitakse L-EST97 pilt, mis katab plaadi, ja see
// joonistatakse lõuendile tükkhaaval afiinteisendusega (4×4 lahtrit plaadi kohta) — viga jääb
// alla piksli ka Eesti servades, kus koordinaatvõrgud on kuni ~2,5° teineteise suhtes pööratud.
import L from 'leaflet';
import proj4 from 'proj4';
import { affineFromTriangles } from './affine';

const EPSG3301_DEF = '+proj=lcc +lat_1=59.33333333333334 +lat_2=58 +lat_0=57.51755393055556 +lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
proj4.defs('EPSG:3301', EPSG3301_DEF);
const toLest = proj4('EPSG:4326', 'EPSG:3301');

export type SatelliteProductId = 'rgb' | 'nrg' | 'ndvi';

export const SATELLITE_PRODUCTS: Record<SatelliteProductId, { label: string; title: string }> = {
  rgb: { label: 'RGB', title: 'Tavavärvid — nagu inimsilm näeb' },
  nrg: { label: 'NRG', title: 'Valevärvid (lähiinfrapuna, punane, roheline): elujõuline taimkate on erkpunane' },
  ndvi: { label: 'NDVI', title: 'Taimkatteindeks: roheline = tihe ja elujõuline taimkate, punane/tume = paljas maa, vesi, ehitised' }
};

/** NDVI legend (värvid Satiladu WMS-i legendipildilt) */
export const NDVI_LEGEND_GRADIENT =
  'linear-gradient(to right, #0a0532 0%, #8f012d 11%, #ad002c 11%, #f2cf95 55%, #ffeea9 55%, #5e9a64 85%, #2b7c4c 100%)';

export const SATELLITE_ATTRIBUTION =
  'Satelliidipilt: <a href="https://esthub.maaruum.ee/est/satiladu-p1.html" target="_blank" rel="noopener">Maa- ja Ruumiamet, Satiladu</a> (Copernicus Sentinel-2)';

// WMS-i kehtiv ala (Capabilities: LatLonBoundingBox), väljaspool seda plaate ei küsita
const SATELLITE_BOUNDS = L.latLngBounds([56.72, 20.77], [59.99, 29.9]);
const GRID = 4;
const MAX_SOURCE_PX = 1024;

function wmsUrl(product: SatelliteProductId, date: string, bbox: [number, number, number, number], width: number, height: number): string {
  const params = new URLSearchParams({
    date,
    service: 'WMS',
    request: 'GetMap',
    version: '1.1.1',
    layers: `sentinel_2_${product}`,
    styles: '',
    format: 'image/png',
    transparent: 'true',
    srs: 'EPSG:3301',
    bbox: bbox.join(','),
    width: String(width),
    height: String(height)
  });
  return `https://teenus.maaamet.ee/ows/wms-sentinel-2-${product}?${params}`;
}

interface SatelliteLayerOptions extends L.GridLayerOptions {
  product: SatelliteProductId;
  date: string;
}

const SatelliteGridLayer = L.GridLayer.extend({
  createTile(this: L.GridLayer & { options: SatelliteLayerOptions }, coords: L.Coords, done: L.DoneCallback) {
    const tile = L.DomUtil.create('canvas', 'leaflet-tile') as HTMLCanvasElement;
    const size = this.getTileSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    tile.width = size.x * dpr;
    tile.height = size.y * dpr;
    const map = (this as unknown as { _map: L.Map })._map;

    // Plaadi ruudustiku punktid: sihtpiksel (lõuendil) ja L-EST97 koordinaat
    const dest: [number, number][][] = [];
    const lest: [number, number][][] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let j = 0; j <= GRID; j++) {
      dest.push([]);
      lest.push([]);
      for (let i = 0; i <= GRID; i++) {
        const px = (i / GRID) * size.x;
        const py = (j / GRID) * size.y;
        const ll = map.unproject(L.point(coords.x * size.x + px, coords.y * size.y + py), coords.z);
        const [x, y] = toLest.forward([ll.lng, ll.lat]);
        dest[j].push([px * dpr, py * dpr]);
        lest[j].push([x, y]);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }

    // Lähtepildi suurus nii, et lahutus vastaks plaadi lahutusele
    const tileMeters = Math.hypot(lest[0][GRID][0] - lest[0][0][0], lest[0][GRID][1] - lest[0][0][1]);
    const pxPerMeter = (size.x * dpr) / tileMeters;
    const srcW = Math.min(MAX_SOURCE_PX, Math.max(1, Math.ceil((maxX - minX) * pxPerMeter)));
    const srcH = Math.min(MAX_SOURCE_PX, Math.max(1, Math.ceil((maxY - minY) * pxPerMeter)));
    const sx = srcW / (maxX - minX);
    const sy = srcH / (maxY - minY);
    const srcPx = (p: [number, number]): [number, number] => [(p[0] - minX) * sx, (maxY - p[1]) * sy];

    const img = new Image();
    img.onload = () => {
      const ctx = tile.getContext('2d');
      if (!ctx) return done(undefined, tile);
      for (let j = 0; j < GRID; j++) {
        for (let i = 0; i < GRID; i++) {
          const [x0, y0] = dest[j][i];
          const [x1, y1] = dest[j + 1][i + 1];
          ctx.save();
          ctx.beginPath();
          // Pool pikslit ülekatet, et lahtrite vahele ei jääks juuksepeenikesi vahesid
          ctx.rect(x0 - 0.5, y0 - 0.5, x1 - x0 + 1, y1 - y0 + 1);
          ctx.clip();
          ctx.setTransform(...affineFromTriangles(
            [srcPx(lest[j][i]), srcPx(lest[j][i + 1]), srcPx(lest[j + 1][i])],
            [dest[j][i], dest[j][i + 1], dest[j + 1][i]]
          ));
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        }
      }
      done(undefined, tile);
    };
    img.onerror = () => done(new Error('Satelliidipildi plaati ei saanud laadida'), tile);
    img.src = wmsUrl(this.options.product, this.options.date, [minX, minY, maxX, maxY], srcW, srcH);
    return tile;
  }
});

export function createSatelliteLayer(product: SatelliteProductId, date: string): L.GridLayer {
  return new (SatelliteGridLayer as unknown as new (o: SatelliteLayerOptions) => L.GridLayer)({
    product,
    date,
    bounds: SATELLITE_BOUNDS,
    minZoom: 6,
    maxZoom: 20,
    // Sentinel-2 lahutus on 10 m; suuremal suumil venitatakse z16 plaate, et WMS-i mitte koormata
    maxNativeZoom: 16,
    zIndex: 200,
    attribution: SATELLITE_ATTRIBUTION
  });
}
