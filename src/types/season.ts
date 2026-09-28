// src/types/season.ts

export type SeasonStatus = 'planning' | 'active' | 'harvesting' | 'closed';

/**
 * Põllumajandusliku hooaja master-kirje
 * Hooaeg algab põldude ettevalmistuse ja külvamisega ning lõpeb koristamisega.
 * Kui koristus on lõppenud, suletakse hooaeg muudatusteks (isLocked = true).
 */
export interface FarmingSeason {
  id: string | number;           // Hooaja unikaalne ID (nt 'season-2026' või 2026)
  year: number;                  // Hooaja aasta (nt 2026, 2025, 2024, 2023, 2027)
  name: string;                  // Hooaja nimi (nt "Hooaeg 2026" või "2025/2026 hooaeg")
  status: SeasonStatus;          // 'planning' | 'active' | 'harvesting' | 'closed'
  isLocked: boolean;             // Kui true, on hooaeg muudatusteks suletud (arhiveeritud / read-only)
  
  // Hooaja elutsükli kuupäevad
  preparationStartDate?: string | null; // Põldude ettevalmistuse algus (sügiskünd / kevadine mullaharimine)
  seedingStartDate?: string | null;     // Külvide algus
  harvestStartDate?: string | null;     // Koristuse algus
  harvestEndDate?: string | null;       // Koristuse lõpp
  closedAt?: string | null;             // Millal hooaeg ametlikult suleti
  closedBy?: string | null;             // Kes sulges (nt 'Rein Janno')
  
  // Hooaja agrotehnilised ja finantsilised koondandmed
  totalAreaHa?: number | null;          // Hooaja põllupind kokku
  fieldsCount?: number | null;          // Põldude arv
  targetYieldTons?: number | null;      // Plaaniline kogusaak (tonnides)
  actualYieldTons?: number | null;      // Tegelik koristatud kogusaak (tonnides)
  notes?: string | null;                // Hooaja kokkuvõte / märkmed (ilm, kvaliteet, PRIA toetused)
}

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
  return c === '' || c === 'määramata';
};

/** Hooaja olek selle aasta põllukirjete kultuuride järgi. */
export const deriveSeasonPhase = (isLocked: boolean, crops: (string | null | undefined)[]): SeasonPhase => {
  if (isLocked) return 'closed';
  const determined = crops.filter((c) => !isCropUndetermined(c)).length;
  if (determined === 0) return 'unopened';
  return determined < crops.length ? 'planning' : 'active';
};
