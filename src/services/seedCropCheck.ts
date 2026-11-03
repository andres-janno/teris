// src/services/seedCropCheck.ts — külvi seemne kultuur vs põllu hooaja kultuur (hoiatus, mitte keeld).
// Seemne kultuur tuleb artikli sordist (sort kuulub registri kultuurile); sordita seemet ei kontrollita.
import type { Article } from '../types/fieldWork';

export interface SeedCheck {
  seasonCrop: { id: string; name: string } | null; // põllu hooaja registri kultuur
  crops: { id: string; name: string; varieties?: { id: string }[] }[];
}

export interface SeedMismatch { articleName: string; seedCropName: string }

export function seedCropMismatches(articleIds: string[], articles: Article[], check: SeedCheck | undefined): SeedMismatch[] {
  if (!check?.seasonCrop) return [];
  const out: SeedMismatch[] = [];
  for (const id of new Set(articleIds.filter(Boolean))) {
    const a = articles.find((m) => m.id === id);
    if (!a?.cropVarietyId) continue;
    const seedCrop = check.crops.find((c) => c.varieties?.some((v) => v.id === a.cropVarietyId));
    if (seedCrop && seedCrop.id !== check.seasonCrop.id) out.push({ articleName: a.name, seedCropName: seedCrop.name });
  }
  return out;
}
