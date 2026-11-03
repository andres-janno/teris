// src/server/seasonCropLink.ts — põllu hooaja kultuur registri järgi.
// Hooajal: cropId (registri kultuur), crop (= registri nimi, kuvamiseks), undersowing ja priaCropName (PRIA kultuur).
// PRIA kultuur tuletatakse salvestamisel registri reeglist; PRIA impordi nimi jääb alles nii, nagu PRIA-s oli.
import type { TxClient } from './db.ts';
import { matchCrop, isUndeterminedCrop } from './fieldWorkRules.ts';
import { derivePriaCropName, parseUndersowing, type Undersowing } from '../services/priaCropName.ts';

const CROP_SELECT = {
  id: true, name: true, priaName: true, priaUndersowing: true,
  priaNameWithoutUndersowing: true, priaNameWithUndersowing: true, priaNameWithLegumeUndersowing: true,
  varieties: { select: { id: true, name: true, priaName: true } }
} as const;

export type LinkCrop = Awaited<ReturnType<typeof loadCropsForLink>>[number];

export async function loadCropsForLink(db: TxClient) {
  return db.crop.findMany({ select: CROP_SELECT });
}

const UNDERSOWING: Undersowing[] = ['NONE', 'OTHER', 'LEGUME'];
export const isUndersowing = (v: unknown): v is Undersowing => UNDERSOWING.includes(v as Undersowing);

const sameText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

const findVariety = (crop: LinkCrop, name: string | null | undefined) =>
  name ? crop.varieties.find((v) => sameText(v.name, name)) ?? null : null;

export interface SeasonCropInput {
  crop: string | null | undefined; // registri nimi (vorm) või PRIA nimi (import)
  cropId?: string | null;
  cropVariety?: string | null;
  undersowing?: unknown;
}

export interface SeasonCropState {
  cropId: string | null;
  cropVariety: string | null;
  undersowing: Undersowing;
  priaCropName: string | null;
}

/** Hooaja kultuuriväljad salvestamiseks. `existing` = sama hooaja senine seis (PRIA nimi jääb, kui valik ei muutunud). */
export function resolveSeasonCrop(input: SeasonCropInput, crops: LinkCrop[], existing?: SeasonCropState | null) {
  const text = (input.crop ?? '').trim();
  if (isUndeterminedCrop(text)) {
    return { crop: text || 'Teadmata kultuur', cropId: null, varietyId: null, undersowing: 'NONE' as Undersowing, priaCropName: null };
  }
  // Nimi otsustab (klient saadab muutmisel ka vana cropId); seos ainult siis, kui nimi registriga ei sobi
  const reg = crops.find((c) => sameText(c.name, text)) ?? matchCrop(text, crops)
    ?? (input.cropId ? crops.find((c) => c.id === input.cropId) : undefined) ?? null;
  if (!reg) {
    // Registrist puuduv kultuur: nimi jääb ka PRIA nimeks
    return { crop: text, cropId: null, varietyId: null, undersowing: isUndersowing(input.undersowing) ? input.undersowing : parseUndersowing(text), priaCropName: text };
  }
  const fromPria = !sameText(text, reg.name); // PRIA impordi (või varasem) pikk nimi
  // PRIA nimes on allakülv kirjas; vormist tuleb valik; muidu senine
  const undersowing: Undersowing = fromPria
    ? parseUndersowing(text)
    : isUndersowing(input.undersowing) ? input.undersowing : existing?.undersowing ?? 'NONE';
  const variety = findVariety(reg, input.cropVariety);
  const unchanged = !!existing?.priaCropName && existing.cropId === reg.id && existing.undersowing === undersowing
    && sameText(existing.cropVariety, input.cropVariety);
  const priaCropName = fromPria ? text : unchanged ? existing!.priaCropName : derivePriaCropName(reg, variety, undersowing);
  return { crop: reg.name, cropId: reg.id, varietyId: variety?.id ?? null, undersowing, priaCropName };
}

/**
 * Kõigi hooaegade kultuur registriga kooskõlla: sidumata hooaeg seotakse nime järgi, seotud hooaja nimi = registri nimi.
 * PRIA kultuur jääb alles; puudumisel võetakse senine pikk nimi või tuletatakse. Tagastab muudetud ridade arvu.
 */
export async function relinkSeasonCrops(db: TxClient): Promise<number> {
  const crops = await loadCropsForLink(db);
  const seasons = await db.fieldSeason.findMany({
    select: { id: true, crop: true, cropId: true, cropVariety: true, varietyId: true, undersowing: true, priaCropName: true }
  });
  let changed = 0;
  for (const s of seasons) {
    if (isUndeterminedCrop(s.crop)) continue;
    const reg = (s.cropId ? crops.find((c) => c.id === s.cropId) : undefined) ?? matchCrop(s.crop, crops);
    if (!reg) {
      if (s.cropId || s.priaCropName == null) {
        await db.fieldSeason.update({ where: { id: s.id }, data: { cropId: null, priaCropName: s.priaCropName ?? s.crop } });
        changed++;
      }
      continue;
    }
    const fromPria = !sameText(s.crop, reg.name);
    const undersowing: Undersowing = s.priaCropName == null && fromPria ? parseUndersowing(s.crop) : s.undersowing;
    const variety = findVariety(reg, s.cropVariety);
    const data = {
      cropId: reg.id,
      crop: reg.name,
      varietyId: variety?.id ?? s.varietyId,
      undersowing,
      priaCropName: s.priaCropName ?? (fromPria ? s.crop : derivePriaCropName(reg, variety, undersowing))
    };
    if (data.cropId !== s.cropId || data.crop !== s.crop || data.varietyId !== s.varietyId || data.undersowing !== s.undersowing || data.priaCropName !== s.priaCropName) {
      await db.fieldSeason.update({ where: { id: s.id }, data });
      changed++;
    }
  }
  return changed;
}
