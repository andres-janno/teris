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

export function isWinterCrop(cropText: string | null | undefined, crops?: { name: string; isWinterCrop?: boolean }[]): boolean {
  if (isCropUndetermined(cropText)) return false;
  if (crops && crops.length > 0) {
    const matched = matchCrop(cropText, crops as any);
    if (matched && typeof (matched as any).isWinterCrop === 'boolean') {
      return (matched as any).isWinterCrop;
    }
  }
  const text = String(cropText).toLowerCase().trim();
  return text.startsWith('tali') || text.includes('talinisu') || text.includes('taliraps') || text.includes('talioder') || text.includes('rukis');
}

