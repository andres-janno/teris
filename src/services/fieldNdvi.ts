// src/services/fieldNdvi.ts
// Põllu NDVI kokkuvõte valitud kuupäeva Satiladu pildist. Brauser laeb põllu ümbruse NDVI ja RGB pildi
// L-EST97-s (WMS lubab CORS-i, seega saab piksleid lugeda), loeb NDVI värvist tagasi ja jätab välja
// pilved (RGB järgi), andmeteta alad ning 10 m serva (segapikslid metsa, tee või kraaviga).
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import type { Polygon, MultiPolygon } from 'geojson';
import { satelliteWmsUrl } from './satelliteLayer';
import { ndviFromColor, isCloudPixel, pointInRings, summarizeNdvi, type NdviSummary } from './ndvi';

const toLest = proj4('EPSG:4326', 'EPSG:3301');
const METERS_PER_PX = 5; // Sentinel-2 on 10 m; poolik samm teeb põllu servamaski täpsemaks
const MAX_PX = 1024;
const EDGE_BUFFER_M = 10;

function loadPixels(url: string, width: number, height: number): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('Lõuend pole saadaval'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(ctx.getImageData(0, 0, width, height).data);
    };
    img.onerror = () => reject(new Error('Satelliidipilti ei saanud laadida'));
    img.src = url;
  });
}

function toLestRings(geometry: Polygon | MultiPolygon): [number, number][][] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((poly) => poly.map((ring) => ring.map((p) => toLest.forward([p[0], p[1]]) as [number, number])));
}

export async function computeFieldNdvi(geometry: Polygon | MultiPolygon, date: string): Promise<NdviSummary | null> {
  // Serv maha; väga kitsal põllul jääb alles terve põld
  let inner: Polygon | MultiPolygon = geometry;
  try {
    const buffered = turf.buffer(turf.feature(geometry), -EDGE_BUFFER_M, { units: 'meters' });
    if (buffered && turf.area(buffered) > 0) inner = buffered.geometry as Polygon | MultiPolygon;
  } catch {
    // vigane geomeetria — kasutame tervet põldu
  }
  const rings = toLestRings(inner);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  const width = Math.max(1, Math.min(MAX_PX, Math.ceil((maxX - minX) / METERS_PER_PX)));
  const height = Math.max(1, Math.min(MAX_PX, Math.ceil((maxY - minY) / METERS_PER_PX)));
  const bbox: [number, number, number, number] = [minX, minY, maxX, maxY];

  const [ndviPx, rgbPx] = await Promise.all([
    loadPixels(satelliteWmsUrl('ndvi', date, bbox, width, height), width, height),
    loadPixels(satelliteWmsUrl('rgb', date, bbox, width, height), width, height)
  ]);

  const values: number[] = [];
  let total = 0;
  let clouds = 0;
  const pxW = (maxX - minX) / width;
  const pxH = (maxY - minY) / height;
  for (let j = 0; j < height; j++) {
    const y = maxY - (j + 0.5) * pxH;
    for (let i = 0; i < width; i++) {
      if (!pointInRings(minX + (i + 0.5) * pxW, y, rings)) continue;
      total++;
      const o = (j * width + i) * 4;
      if (ndviPx[o + 3] < 255 || rgbPx[o + 3] < 255) continue; // andmed puuduvad (lennuribast väljas)
      if (isCloudPixel(rgbPx[o], rgbPx[o + 1], rgbPx[o + 2])) {
        clouds++;
        continue;
      }
      const v = ndviFromColor(ndviPx[o], ndviPx[o + 1], ndviPx[o + 2]);
      if (v !== null) values.push(v);
    }
  }
  return summarizeNdvi(values, total, clouds);
}
