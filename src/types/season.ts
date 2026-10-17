// src/types/season.ts

/**
 * Põllumajandusliku hooaja master-kirje: aasta, nimi ja märkmed.
 * Lukus hooaeg (isLocked) on muudatusteks suletud; sulgemise aja ja sulgeja paneb server.
 */
export interface FarmingSeason {
  id: string | number;
  year: number;                  // Hooaja aasta (nt 2026)
  name: string;                  // Hooaja nimi (nt "Hooaeg 2026")
  isLocked: boolean;             // Kui true, on hooaeg muudatusteks suletud
  closedAt?: string | null;      // Millal hooaeg suleti (ISO)
  closedBy?: string | null;      // Kes sulges (kasutajatunnus)
  notes?: string | null;         // Hooaja märkmed
}

/** Vaikimisi hooaeg: jooksev aasta, kui see hooaeg on olemas, muidu lähim olemasolev (võrdsel kaugusel varasem). */
export const activeSeasonYear = (seasons: Pick<FarmingSeason, 'year'>[], currentYear = new Date().getFullYear()): number => {
  if (seasons.length === 0) return currentYear;
  return seasons
    .map((s) => s.year)
    .reduce((best, y) => {
      const d = Math.abs(y - currentYear);
      const bd = Math.abs(best - currentYear);
      return d < bd || (d === bd && y < best) ? y : best;
    });
};

/** Hooaja valiku aastad: vahemik vaikimisi hooaeg −4 … +3, ainult hooaegade tabelis olevad aastad (kasvavas järjekorras). */
export const seasonSelectorYears = (seasons: Pick<FarmingSeason, 'year'>[], currentYear = new Date().getFullYear()): number[] => {
  const active = activeSeasonYear(seasons, currentYear);
  return [...new Set(seasons.map((s) => s.year))].filter((y) => y >= active - 4 && y <= active + 3).sort((a, b) => a - b);
};

/**
 * Registris kuvatav olek, tuletatud põldude kultuuridest (mitte käsitsi valitud).
 * Hooaja põllud = selle või eelmise hooaja põllud; puuduv kirje = kultuur määramata.
 * lukus → Suletud; ühtki määratud kultuuri → Avamata;
 * osal põldudel kultuur määramata → Planeerimisel; kõigil määratud → Aktiivne.
 */
export type SeasonPhase = 'unopened' | 'planning' | 'active' | 'closed';

export const SEASON_PHASE_META: Record<SeasonPhase, { label: string; color: string; bg: string; description: string }> = {
  unopened: {
    label: 'Avamata',
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.12)',
    description: 'Hooaja põldudele pole veel ühtegi kultuuri määratud.'
  },
  planning: {
    label: 'Planeerimisel',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.15)',
    description: 'Osal hooaja põldudel on kultuur veel määramata.'
  },
  active: {
    label: 'Aktiivne',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    description: 'Kõigil hooaja põldudel on kultuur määratud.'
  },
  closed: {
    label: 'Suletud',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.15)',
    description: 'Hooaeg on muudatusteks suletud.'
  }
};

export const isCropUndetermined = (crop?: string | null): boolean => {
  const c = (crop ?? '').trim().toLowerCase();
  // 'teadmata kultuur' = server salvestab tühja kultuuri sellisena
  return c === '' || c === 'määramata' || c === 'teadmata kultuur';
};

/** Hooaja olek selle aasta põllukirjete kultuuride järgi. */
export const deriveSeasonPhase = (isLocked: boolean, crops: (string | null | undefined)[]): SeasonPhase => {
  if (isLocked) return 'closed';
  const determined = crops.filter((c) => !isCropUndetermined(c)).length;
  if (determined === 0) return 'unopened';
  return determined < crops.length ? 'planning' : 'active';
};
