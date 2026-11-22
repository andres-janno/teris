// src/help/helpStore.ts — juhendid laaditakse rakenduses üks kord (GET /api/help) ja jagatakse kõigile HelpHint'idele ja
// juhendi vaatele: kohtjuhendite tekstid, seotud peatükid (guideLinks) ja peatükkide tekstid.
import { useSyncExternalStore } from 'react';
import type { HelpKey } from './helpRegistry';
import type { GuideChapterKey } from './guideChapters';

interface HelpState {
  articles: Partial<Record<HelpKey, string>>;
  guideLinks: Partial<Record<HelpKey, string>>;
  chapters: Partial<Record<GuideChapterKey, string>>;
  loaded: boolean;
}

let state: HelpState = { articles: {}, guideLinks: {}, chapters: {}, loaded: false };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function fetchHelp(): Promise<void> {
  return fetch('/api/help', { credentials: 'same-origin' })
    .then((r) => {
      if (!r.ok) throw new Error(`GET /api/help ${r.status}`); // eelmine seis jääb alles
      return r.json();
    })
    .then((d: Partial<Omit<HelpState, 'loaded'>>) => {
      state = { articles: d.articles ?? {}, guideLinks: d.guideLinks ?? {}, chapters: d.chapters ?? {}, loaded: true };
      listeners.forEach((l) => l());
    });
}

function load() {
  if (loading) return;
  loading = fetchHelp().catch(() => {
    loading = null; // proovi järgmisel kuvamisel uuesti
  });
}

/** Juhendi vaade värskendab teksti iga avamisel (teenusepakkuja võib seda vahepeal muuta). */
export function reloadHelp(): Promise<void> {
  return fetchHelp().catch(() => {});
}

/** Praegune seis (testid) */
export const peekHelp = (): HelpState => state;

const subscribe = (l: () => void) => {
  listeners.add(l);
  load();
  return () => listeners.delete(l);
};

const getState = () => state;

export const useHelpArticle = (key: HelpKey): string | undefined => useSyncExternalStore(subscribe, getState).articles[key];

/** Kohtjuhendi seotud peatükk kujul `guide.fields#import` (puudub, kui seost pole) */
export const useGuideLink = (key: HelpKey): string | undefined => useSyncExternalStore(subscribe, getState).guideLinks[key];

export const useGuideChapters = (): { chapters: HelpState['chapters']; loaded: boolean } => useSyncExternalStore(subscribe, getState);
