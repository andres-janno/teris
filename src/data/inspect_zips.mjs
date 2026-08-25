globalThis.self = globalThis;
import fs from 'fs';
import shp from 'shpjs';

async function inspect(zipPath) {
  console.log('=== Inspecting:', zipPath, '===');
  const buffer = fs.readFileSync(zipPath);
  const result = await shp(buffer);
  const fcs = Array.isArray(result) ? result : [result];
  for (const fc of fcs) {
    console.log('FeatureCollection fileName:', fc.fileName, 'count:', fc.features?.length);
    if (fc.features && fc.features.length > 0) {
      console.log('First feature properties:', JSON.stringify(fc.features[0].properties, null, 2));
      console.log('Features summary (first 5):');
      fc.features.slice(0, 5).forEach((f, i) => {
        console.log(`[${i}]`, f.properties);
      });
    }
  }
}

async function run() {
  await inspect('./src/data/pollud_09_08_2026.zip');
  await inspect('./src/data/massiivid_01_08_2026.zip');
}

run().catch(console.error);
