globalThis.self = globalThis;
import fs from 'fs';
import shp from 'shpjs';

async function checkGeom(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const result = await shp(buffer);
  const fcs = Array.isArray(result) ? result : [result];
  for (const fc of fcs) {
    const f0 = fc.features[0];
    console.log(zipPath, 'Geom type:', f0.geometry.type, 'Coord sample:', JSON.stringify(f0.geometry.coordinates[0][0]));
  }
}

async function run() {
  await checkGeom('./src/data/pollud_09_08_2026.zip');
  await checkGeom('./src/data/massiivid_01_08_2026.zip');
}

run().catch(console.error);
