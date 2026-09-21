// src/services/shpParser.ts
import shp from 'shpjs';
import JSZip from 'jszip';
import proj4 from 'proj4';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { FieldFeature, FieldCollection } from '../types/field';

// Register Estonian L-EST97 coordinate system
const EPSG3301_DEF = '+proj=lcc +lat_1=59.33333333333334 +lat_2=58 +lat_0=57.51755393055556 +lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
proj4.defs('EPSG:3301', EPSG3301_DEF);
proj4.defs('L-EST97', EPSG3301_DEF);

const CROP_COLORS: Record<string, string> = {
  'talinisu': '#eab308',      // Yellow/Gold
  'suvinisu': '#facc15',
  'oder': '#ca8a04',          // Amber
  'suvioder': '#d97706',
  'taliraps': '#10b981',      // Emerald Green
  'suviraps': '#34d399',
  'rukis': '#a16207',         // Brown/Bronze
  'kaer': '#fbbf24',          // Light Gold
  'hernes': '#65a30d',        // Lime Green
  'uba': '#84cc16',
  'hein': '#22c55e',          // Bright Green
  'kesa': '#78716c',          // Gray/Stone
  'mais': '#f59e0b',          // Orange-yellow
  'kartul': '#d97706',
  'default': '#3b82f6'        // Blue
};

export function getCropColor(cropName?: string): string {
  if (!cropName) return CROP_COLORS.default;
  const lower = cropName.toLowerCase();
  for (const [key, color] of Object.entries(CROP_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return CROP_COLORS.default;
}

/**
 * Checks if coordinates are within Estonian L-EST97 bounding box:
 * X (East): ~300000 to ~800000
 * Y (North): ~6300000 to ~6700000
 */
function isLest97(coords: number[]): boolean {
  const [x, y] = coords;
  return x > 200000 && x < 900000 && y > 6000000 && y < 7000000;
}

function transformCoord(coord: number[]): [number, number] {
  if (isLest97(coord)) {
    const [x, y] = coord;
    const [lng, lat] = proj4('EPSG:3301', 'EPSG:4326', [x, y]);
    return [lng, lat];
  }
  // If already [lng, lat]
  return [coord[0], coord[1]];
}

function transformGeometry(geom: Polygon | MultiPolygon): Polygon | MultiPolygon {
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map(ring => ring.map(coord => transformCoord(coord)))
    };
  } else if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map(polygon => 
        polygon.map(ring => ring.map(coord => transformCoord(coord)))
      )
    };
  }
  return geom;
}

/**
 * Loeb DBF atribuudi väärtuse tõstutundetult (PRIA eksportide veerunimede
 * suur/väiketäht varieerub eri tööriistade/aastate vahel, nt "pollunr" vs
 * "POLLUNR"), proovides mitut võimalikku nimevarianti järjekorras.
 */
function getProp(props: Record<string, unknown>, ...keys: string[]): string | undefined {
  const lowerMap: Record<string, unknown> = {};
  for (const k of Object.keys(props)) lowerMap[k.toLowerCase()] = (props as any)[k];
  for (const key of keys) {
    const v = lowerMap[key.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return undefined;
}

/**
 * PRIA .dbf salvestab kümnendarvud koma-eraldajaga (nt "5,54") —
 * teisendab need JS-i mõistetavaks ("5.54").
 */
function parseEstonianNumber(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(',', '.'));
  return isNaN(n) ? undefined : n;
}

/**
 * shpjs loeb .dbf teksti kodeeringu ZIP-i kaasas oleva .cpg failist; kui
 * see puudub (nagu PRIA enda eksportidel sageli), langeb shpjs tagasi
 * UTF-8-le ja rikub Eesti täpitähed (ü, õ jne). PRIA .dbf failid on
 * reaalselt Windows-1257 (Balti) kodeeringus — lisame ZIP-i puuduva
 * .cpg kirje, et shpjs dekodeeriks õigesti.
 */
async function ensureCpgEntry(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  const hasCpg = Object.keys(zip.files).some((name) => name.toLowerCase().endsWith('.cpg'));
  if (hasCpg) return buffer;

  const dbfEntry = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith('.dbf'));
  if (!dbfEntry) return buffer;

  const baseName = dbfEntry.slice(0, -4);
  zip.file(`${baseName}.cpg`, 'windows-1257');
  return zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Parses a PRIA Shapefile ZIP buffer and transforms it into unified FieldCollection
 */
export async function parseShapefileZip(buffer: ArrayBuffer, fileName: string = 'PRIA_põllud'): Promise<FieldCollection> {
  const bufferWithCpg = await ensureCpgEntry(buffer);
  const geojsonResult = await shp(bufferWithCpg);
  
  // shpjs can return a single GeoJSON FeatureCollection or an array of them
  const featureCollections = Array.isArray(geojsonResult) ? geojsonResult : [geojsonResult];
  const allFeatures: FieldFeature[] = [];

  let fieldIndex = 1;

  for (const fc of featureCollections) {
    if (!fc || !fc.features) continue;

    for (const feat of fc.features) {
      if (!feat.geometry) continue;

      const geomType = feat.geometry.type;
      if (geomType !== 'Polygon' && geomType !== 'MultiPolygon') continue;

      const transformedGeom = transformGeometry(feat.geometry as Polygon | MultiPolygon);
      
      const props = feat.properties || {};

      // Detect PRIA field number ("num"), massiiv ("fieldCode"), cadastral code and name.
      // Tõstutundetu otsing (vt getProp) — reaalsed PRIA eksportijad kasutavad
      // väiketähtedega eestikeelseid nimesid (pollunr, massiiv, kultuur, ...).
      const rawNum = getProp(props, 'pollunr', 'pol_nr', 'pollu_nr', 'pol_jarje_nr', 'jarje_nr', 'nr', 'pollu_number', 'polnr', 'field_nr');
      const num = rawNum || String(fieldIndex);
      const rawMassiiv = getProp(props, 'massiiv', 'massiiv_nr', 'mass_nr', 'massiivi_nr', 'massiivik', 'massiiv_kood');
      const fieldCode = rawMassiiv || `61044${1000 + fieldIndex}`;
      const name = getProp(props, 'nimi', 'name', 'pol_nimi') || `Põld ${num}`;
      const cadastralCode = getProp(props, 'kataster', 'kat_tunnus', 'kat_nr');
      const rawCrop = getProp(props, 'kultuur', 'kult_nimi', 'crop', 'maakasutus');
      const crop = rawCrop ? rawCrop.charAt(0).toUpperCase() + rawCrop.slice(1) : 'Talinisu';
      const pindalaHa = parseEstonianNumber(getProp(props, 'pindala', 'pindala_ha', 'area_ha'));
      const muutja = getProp(props, 'muutja');
      
      // PRIA ametlik pindala (dbf "pindala") on eelistatud, kuna see on
      // toetusõiguslikult siduv väärtus — geomeetriast arvutatud pindala
      // (turf) on ainult varuväärtus, kui dbf pindala puudub.
      let areaHa = pindalaHa && pindalaHa > 0 ? Math.round(pindalaHa * 100) / 100 : 0;
      if (areaHa === 0) {
        try {
          const tempFeature: Feature<Polygon | MultiPolygon> = {
            type: 'Feature',
            geometry: transformedGeom,
            properties: {}
          };
          const areaSqMeters = turf.area(tempFeature);
          areaHa = Math.round((areaSqMeters / 10000) * 100) / 100;
        } catch (err) {
          // jääb 0, alumine fallback (5.0) rakendub allpool
        }
      }

      const fieldFeature: FieldFeature = {
        type: 'Feature',
        id: fieldIndex,
        geometry: transformedGeom,
        properties: {
          id: fieldIndex,
          num: String(num),
          name: String(name),
          fieldCode: String(fieldCode),
          cadastralCode: cadastralCode ? String(cadastralCode) : undefined,
          areaHa: areaHa > 0 ? areaHa : 5.0,
          crop: String(crop),
          cropColor: getCropColor(String(crop)),
          year: new Date().getFullYear(),
          workedAreaHa: 0,
          workProgress: 0,
          status: 'not_started',
          notes: getProp(props, 'markus', 'kommentaar', 'kirjeldus') || (muutja ? `${fileName} imporditud (PRIA muutja: ${muutja})` : `${fileName} imporditud`),
          rawProperties: props
        }
      };

      allFeatures.push(fieldFeature);
      fieldIndex++;
    }
  }

  return {
    type: 'FeatureCollection',
    features: allFeatures
  };
}
