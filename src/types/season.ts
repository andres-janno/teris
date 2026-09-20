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
  preparationStartDate?: string; // Põldude ettevalmistuse algus (sügiskünd / kevadine mullaharimine)
  seedingStartDate?: string;     // Külvide algus
  harvestStartDate?: string;     // Koristuse algus
  harvestEndDate?: string;       // Koristuse lõpp
  closedAt?: string;             // Millal hooaeg ametlikult suleti
  closedBy?: string;             // Kes sulges (nt 'Rein Janno')
  
  // Hooaja agrotehnilised ja finantsilised koondandmed
  totalAreaHa?: number;          // Hooaja põllupind kokku
  fieldsCount?: number;          // Põldude arv
  targetYieldTons?: number;      // Plaaniline kogusaak (tonnides)
  actualYieldTons?: number;      // Tegelik koristatud kogusaak (tonnides)
  notes?: string;                // Hooaja kokkuvõte / märkmed (ilm, kvaliteet, PRIA toetused)
}

export const SEASON_STATUS_META: Record<SeasonStatus, { label: string; color: string; bg: string; icon: string; description: string }> = {
  planning: {
    label: 'Planeerimisel',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.15)',
    icon: '📝',
    description: 'Külvikorra, väetamise ja põllutööde eelplaneerimine.'
  },
  active: {
    label: 'Aktiivne (Käimas)',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    icon: '🌱',
    description: 'Külvitööd, hooldus, pritsimine ja väetamine täies hoos.'
  },
  harvesting: {
    label: 'Koristusel',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
    icon: '🚜',
    description: 'Kultuuride koristus ja viljavedu kuivatisse.'
  },
  closed: {
    label: 'Suletud (Lukus)',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.15)',
    icon: '🔒',
    description: 'Koristus on lõppenud. Hooaeg on muudatusteks suletud ja arhiveeritud.'
  }
};
