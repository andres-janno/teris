// src/services/cropMatch.ts — PRIA kultuurinime ("Talinisu allakülvita", "Muu põlduba") sidumine
// kultuuride registriga. Sama loogika nagu serveris (fieldWorkRules.ts matchCrop).
import { isCropUndetermined } from '../types/season';

export function matchCrop<T extends { name: string }>(cropText: string | null | undefined, crops: T[]): T | null {
  if (isCropUndetermined(cropText)) return null;
  const text = String(cropText).toLowerCase().trim();
  const sorted = [...crops].sort((a, b) => b.name.length - a.name.length);
  return (
    sorted.find((c) => {
      const name = c.name.toLowerCase();
      return name === text || text.includes(name) || name.startsWith(text);
    }) ?? null
  );
}
