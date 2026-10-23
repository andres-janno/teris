// src/services/fieldWorksBoardColumns.ts — põllutööde tahvli veergude jaotus kalendriaasta järgi.
// Hooaja Y tööd jagunevad: eelmise aasta (Y-1) sügistööd ja käesoleva aasta (Y) tööd.
// Sügisploki (eelmise või järgmise aasta) tööd jagunevad külvi kuupäeva järgi: Ettevalmistus · Sügiskülv · Sügishooldus.
// Puhas loogika (ilma Reactita), kasutavad tahvel, server ja skriptid.
import type { WorkPhase } from '../types/fieldWork.ts';
import { PRIA_ACTIVITY } from './pria.ts';

export type BoardYearGroup = 'PREV' | 'CURRENT';
export type BoardColumn = 'PREV_PREPARATION' | 'PREV_SOWING' | 'PREV_CARE' | WorkPhase;
export type AutumnColumn = 'PREP' | 'SOWING' | 'CARE';

export interface BoardWorkLike {
  id: string;
  phase: WorkPhase;
  priaCode: string | null;
  entries: { date: string }[];
  plannedDateFrom: string | null;
  plannedText: string | null;
}

// Töö kuupäev tahvli jaoks: varaseim kande kuupäev, muidu planeeritud algus (ISO YYYY-MM-DD)
export function boardWorkDate(work: Pick<BoardWorkLike, 'entries' | 'plannedDateFrom'>): string | null {
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

export const isSowingWork = (work: Pick<BoardWorkLike, 'phase' | 'priaCode'>) =>
  work.priaCode === PRIA_ACTIVITY.SOWING || work.phase === 'SOWING';

// Ühe põllu sügisploki tööde veerud. Külv → Sügiskülv; dateeritud töö kuni varaseima külvi päevani (k.a) →
// Ettevalmistus, hiljem → Sügishooldus; dateeritud külvita plokis kõik Ettevalmistus. Kuupäevata töö faasi järgi.
export function autumnColumns(works: BoardWorkLike[]): Map<string, AutumnColumn> {
  const sowDates = works.filter(isSowingWork).map(boardWorkDate).filter((d): d is string => !!d).sort();
  const sowDate = sowDates[0] ?? null;
  const out = new Map<string, AutumnColumn>();
  for (const w of works) {
    if (isSowingWork(w)) {
      out.set(w.id, 'SOWING');
      continue;
    }
    const date = boardWorkDate(w);
    if (date) out.set(w.id, sowDate && date > sowDate ? 'CARE' : 'PREP');
    else out.set(w.id, w.phase === 'PREPARATION' ? 'PREP' : 'CARE');
  }
  return out;
}

const PREV_COLUMN: Record<AutumnColumn, BoardColumn> = { PREP: 'PREV_PREPARATION', SOWING: 'PREV_SOWING', CARE: 'PREV_CARE' };

// Põllu hooaja Y kõigi tööde veerud: eelmise aasta sügistööd sügisploki reegliga, ülejäänud faasi järgi
export function boardColumns(works: BoardWorkLike[], seasonYear: number, isWinter: boolean): Map<string, BoardColumn> {
  const out = new Map<string, BoardColumn>();
  const prev: BoardWorkLike[] = [];
  for (const w of works) {
    if (boardYearGroup(w, seasonYear, isWinter) === 'PREV') prev.push(w);
    else out.set(w.id, w.phase);
  }
  for (const [id, c] of autumnColumns(prev)) out.set(id, PREV_COLUMN[c]);
  return out;
}
