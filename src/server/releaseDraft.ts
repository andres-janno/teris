// src/server/releaseDraft.ts — puhtad funktsioonid changelog/unreleased.jsonl parsimiseks,
// kuupäevapõhise versiooni arvutamiseks ja release-mustandi koostamiseks (testitav ilma DB-ta).
import { randomUUID } from 'node:crypto';
import type {
  ChangelogEntry,
  ReleaseNoteCategory,
  ReleaseNoteItem,
  ReleaseNoteSourceCommit
} from '../types/releaseNotes.ts';

const TYPE_MAP: Record<string, ReleaseNoteCategory> = {
  feature: 'FEATURE',
  feat: 'FEATURE',
  fix: 'FIX',
  bugfix: 'FIX',
  improvement: 'IMPROVEMENT',
  improve: 'IMPROVEMENT',
  perf: 'IMPROVEMENT'
};

export function normalizeChangelogType(raw: string): ReleaseNoteCategory | null {
  return TYPE_MAP[raw.trim().toLowerCase()] ?? null;
}

export function parseChangelogJsonl(content: string): { entries: ChangelogEntry[]; errors: string[] } {
  const entries: ChangelogEntry[] = [];
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const type = normalizeChangelogType(String(obj.type ?? ''));
      const text = String(obj.text ?? '').trim();
      if (!type) {
        errors.push(`Rida ${i + 1}: tundmatu tüüp "${String(obj.type ?? '')}"`);
        continue;
      }
      if (!text) {
        errors.push(`Rida ${i + 1}: tühi tekst`);
        continue;
      }
      const area = typeof obj.area === 'string' && obj.area.trim() ? obj.area.trim() : undefined;
      const commit = typeof obj.commit === 'string' && obj.commit.trim() ? obj.commit.trim() : undefined;
      const date = typeof obj.date === 'string' && obj.date.trim() ? obj.date.trim() : undefined;
      entries.push({ type, text, ...(area ? { area } : {}), ...(commit ? { commit } : {}), ...(date ? { date } : {}) });
    } catch {
      errors.push(`Rida ${i + 1}: vigane JSON`);
    }
  }
  return { entries, errors };
}

/** Kuupäevapõhine versioon (Tallinna kuupäev YYYY.MM.DD; kokkupõrkel YYYY.MM.DD-2, -3 jne). */
export function nextDateVersion(existingVersions: Iterable<string>, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const base = `${get('year')}.${get('month')}.${get('day')}`;
  const existing = new Set(existingVersions);
  if (!existing.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Tuvastab conventional commit'ist kliendile olulise varu-punkti (feat/fix). */
export function parseConventionalCommit(commit: ReleaseNoteSourceCommit): ReleaseNoteItem | null {
  const m = /^(feat|fix)(?:\(([^)]+)\))?!?:\s*(.+)$/i.exec(commit.subject.trim());
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const scope = m[2]?.trim();
  const desc = m[3].trim();
  if (!desc) return null;
  // Sisemised skoopid, mida vaikimisi kliendile ei pakuta
  if (scope && /^(test|ci|build|chore|deps)$/i.test(scope)) return null;
  return {
    id: randomUUID(),
    category: kind === 'feat' ? 'FEATURE' : 'FIX',
    ...(scope ? { area: scope } : {}),
    text: desc.charAt(0).toUpperCase() + desc.slice(1)
  };
}

export function buildDraftItems(
  entries: ChangelogEntry[],
  commits: ReleaseNoteSourceCommit[],
  includeGitFallback: boolean
): { items: ReleaseNoteItem[]; uncoveredCommits: ReleaseNoteSourceCommit[] } {
  const coveredHashes = new Set(entries.map((e) => e.commit?.slice(0, 7)).filter(Boolean));
  const items: ReleaseNoteItem[] = entries.map((e) => ({
    id: randomUUID(),
    category: e.type,
    ...(e.area ? { area: e.area } : {}),
    text: e.text
  }));

  const uncoveredCommits = commits.filter((c) => {
    if (coveredHashes.has(c.hash.slice(0, 7))) return false;
    return parseConventionalCommit(c) !== null;
  });

  // Kasuta git-fallbacki ainult siis, kui unreleased.jsonl-is pole veel ühtegi kureeritud kirjet
  // (muidu satuvad enne committi lisatud eestikeelsete ridade kõrvale toored ingliskeelsed commit-pealkirjad).
  if (includeGitFallback && entries.length === 0) {
    for (const c of uncoveredCommits) {
      const parsed = parseConventionalCommit(c);
      if (parsed) items.push(parsed);
    }
  }

  // Sorteeri kategooriate järjekorras: FEATURE → IMPROVEMENT → FIX
  const order: Record<ReleaseNoteCategory, number> = { FEATURE: 0, IMPROVEMENT: 1, FIX: 2 };
  items.sort((a, b) => order[a.category] - order[b.category]);
  return { items, uncoveredCommits };
}

/** Ühendab olemasoleva mustandi punktid uutega, vältides sama teksti duplikaate. */
export function mergeDraftItems(existing: ReleaseNoteItem[], incoming: ReleaseNoteItem[]): ReleaseNoteItem[] {
  const seen = new Set(existing.map((i) => `${i.category}:${i.text.trim().toLowerCase()}`));
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.category}:${item.text.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  const order: Record<ReleaseNoteCategory, number> = { FEATURE: 0, IMPROVEMENT: 1, FIX: 2 };
  merged.sort((a, b) => order[a.category] - order[b.category]);
  return merged;
}

/** Ühendab olemasoleva mustandi git commitid uutega (uusimad ees, unikaalne hash). */
export function mergeSourceCommits(
  existing: ReleaseNoteSourceCommit[],
  incoming: ReleaseNoteSourceCommit[]
): ReleaseNoteSourceCommit[] {
  const seen = new Set<string>();
  const out: ReleaseNoteSourceCommit[] = [];
  for (const c of [...incoming, ...existing]) {
    const h = c.hash.slice(0, 7);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(c);
  }
  return out;
}
