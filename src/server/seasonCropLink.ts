// src/server/seasonCropLink.ts — põllu hooaja kultuuritekst (PRIA nimi, nt "Talinisu allakülvita") → registri kultuur (cropId).
// Seos tuletatakse nimest; käsitsi valikut pole, seega iga muudatus (hooaja salvestus, kultuuri lisamine/ümbernimetamine) seob uuesti.
import type { TxClient } from './db.ts';
import { matchCrop } from './fieldWorkRules.ts';

export async function loadCropsForLink(db: TxClient) {
  return db.crop.findMany({ select: { id: true, name: true } });
}

export function seasonCropId(cropText: string | null | undefined, crops: { id: string; name: string }[]): string | null {
  return matchCrop(cropText, crops)?.id ?? null;
}

// Kõigi hooaegade seos registriga uuesti; muudab ainult erinevad read. Tagastab muudetud ridade arvu.
export async function relinkSeasonCrops(db: TxClient): Promise<number> {
  const crops = await loadCropsForLink(db);
  const seasons = await db.fieldSeason.findMany({ select: { id: true, crop: true, cropId: true } });
  const byTarget = new Map<string | null, number[]>();
  for (const s of seasons) {
    const target = seasonCropId(s.crop, crops);
    if (target !== s.cropId) byTarget.set(target, [...(byTarget.get(target) ?? []), s.id]);
  }
  let changed = 0;
  for (const [cropId, ids] of byTarget) {
    changed += (await db.fieldSeason.updateMany({ where: { id: { in: ids } }, data: { cropId } })).count;
  }
  return changed;
}
