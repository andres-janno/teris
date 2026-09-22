// src/services/soilSampleParser.ts
import shp from 'shpjs';
import type { Point } from 'geojson';
import type { SoilSample } from '../types/soilSample';
import { getProp, parseEstonianNumber, ensureCpgEntry } from './shpParser';

/**
 * Parses a soil-sample-points Shapefile ZIP (nt PMK "proovipunktid" eksport)
 * punktikujundeist SoilSample massiiviks. Erinevalt PRIA põldude SHP-st on
 * need failid juba WGS84 (EPSG:4326) kraadides, seega koordinaate ei teisendata.
 */
export async function parseSoilSampleShapefileZip(buffer: ArrayBuffer): Promise<SoilSample[]> {
  const bufferWithCpg = await ensureCpgEntry(buffer);
  const geojsonResult = await shp(bufferWithCpg);

  const featureCollections = Array.isArray(geojsonResult) ? geojsonResult : [geojsonResult];
  const samples: SoilSample[] = [];

  for (const fc of featureCollections) {
    if (!fc || !fc.features) continue;

    for (const feat of fc.features) {
      if (!feat.geometry || feat.geometry.type !== 'Point') continue;

      const [lng, lat] = (feat.geometry as Point).coordinates;
      const props = feat.properties || {};

      const fieldCode = getProp(props, 'xy_id');
      const sampleNumber = getProp(props, 'proovnr');
      const yearRaw = getProp(props, 'aasta');

      if (!fieldCode || !sampleNumber || !yearRaw) continue;

      samples.push({
        id: 0,
        sampleNumber,
        fieldCode,
        year: parseInt(yearRaw, 10),
        lat,
        lng,
        ph: parseEstonianNumber(getProp(props, 'ph')) ?? null,
        phosphorus: parseEstonianNumber(getProp(props, 'p')) ?? null,
        potassium: parseEstonianNumber(getProp(props, 'k')) ?? null,
        calcium: parseEstonianNumber(getProp(props, 'ca')) ?? null,
        magnesium: parseEstonianNumber(getProp(props, 'mg')) ?? null,
        copper: parseEstonianNumber(getProp(props, 'cu')) ?? null,
        manganese: parseEstonianNumber(getProp(props, 'mn')) ?? null,
        boron: parseEstonianNumber(getProp(props, 'b')) ?? null,
        organicCarbon: parseEstonianNumber(getProp(props, 'corg')) ?? null,
        limeRequirement: parseEstonianNumber(getProp(props, 'lubjatarve')) ?? null
      });
    }
  }

  return samples;
}
