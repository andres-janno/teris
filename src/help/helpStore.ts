// src/help/helpStore.ts — juhendid laaditakse rakenduses üks kord (GET /api/help) ja jagatakse kõigile HelpHint'idele.
import { useSyncExternalStore } from 'react';
import type { HelpKey } from './helpRegistry';

type Articles = Partial<Record<HelpKey, string>>;

let articles: Articles = {};
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  if (loading) return;
  loading = fetch('/api/help', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : { articles: {} }))
    .then((d: { articles?: Articles }) => {
      articles = d.articles ?? {};
      listeners.forEach((l) => l());
    })
    .catch(() => {
      loading = null; // proovi järgmisel kuvamisel uuesti
    });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  load();
  return () => listeners.delete(l);
};

export const useHelpArticle = (key: HelpKey): string | undefined =>
  useSyncExternalStore(subscribe, () => articles[key]);
