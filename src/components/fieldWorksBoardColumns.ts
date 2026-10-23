// src/components/fieldWorksBoardColumns.ts — põllutööde tahvli veergude jaotus kalendriaasta järgi.
// Hooaja Y tööd jagunevad: eelmise aasta (Y-1) sügistööd ja käesoleva aasta (Y) tööd.
// Puhas loogika (ilma Reactita), et seda saaks testida.
import type { WorkPhase } from '../types/fieldWork';

export type BoardYearGroup = 'PREV' | 'CURRENT';
export type BoardColumn = 'PREV_PREPARATION' | 'PREV_SOWING' | 'PREPARATION' | 'SOWING' | 'CARE' | 'HARVEST';

export interface BoardWorkLike {
  phase: WorkPhase;
  entries: { date: string }[];
  plannedDateFrom: string | null;
  plannedText: string | null;
}

// Töö kuupäev tahvli jaoks: varaseim kande kuupäev, muidu planeeritud algus (ISO YYYY-MM-DD)
export function boardWorkDate(work: BoardWorkLike): string | null {
  const dates = work.entries.map((e) => e.date).filter(Boolean).sort();
  return dates[0] ?? work.plannedDateFrom ?? null;
}

export function boardYearGroup(work: BoardWorkLike, seasonYear: number, isWinter: boolean): BoardYearGroup {
  // Koristus kuulub alati käesolevasse aastasse
  if (work.phase === 'HARVEST') return 'CURRENT';
  const date = boardWorkDate(work);
  if (date) {
    const y = Number(date.slice(0, 4));
    return Number.isFinite(y) && y < seasonYear ? 'PREV' : 'CURRENT';
  }
  if (isWinter && (work.phase === 'PREPARATION' || work.phase === 'SOWING')) return 'PREV';
  if ((work.plannedText ?? '').toLowerCase().includes('ügis')) return 'PREV';
  return 'CURRENT';
}

export function boardColumn(work: BoardWorkLike, seasonYear: number, isWinter: boolean): BoardColumn {
  if (boardYearGroup(work, seasonYear, isWinter) === 'PREV') {
    // Sügisene hooldus pärast külvi (nt herbitsiid taliviljal) läheb sügiskülvi veergu
    return work.phase === 'PREPARATION' ? 'PREV_PREPARATION' : 'PREV_SOWING';
  }
  return work.phase;
}
