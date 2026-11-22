// src/help/guideLink.ts — viide juhendi peatükile ja ankrule. Sama kuju on sügavlingil (`#guide.fields#import`),
// peatükkide vahelises HTML-lingis ja kohtjuhendi `guide_link` väljal (`guide.fields#import`, ilma `#`-ta).
import { isGuideChapterKey, type GuideChapterKey } from './guideChapters.ts';

export interface GuideRef {
  /** null = juhend ilma kindla peatükita (avaneb esimene nähtav) */
  chapter: GuideChapterKey | null;
  /** h3 ankru lühinimi (vt anchors.ts) */
  anchor: string | null;
}

const REF = /^#?guide(?:\.([a-z][a-z-]*))?(?:#([a-z0-9][a-z0-9-]*))?$/;

export function parseGuideRef(raw: string): GuideRef | null {
  const m = REF.exec(raw.trim());
  if (!m) return null;
  const key = m[1] ? `guide.${m[1]}` : null;
  if (key !== null && !isGuideChapterKey(key)) return null;
  if (key === null && m[2]) return null; // ankur ilma peatükita pole mõttekas
  return { chapter: key as GuideChapterKey | null, anchor: m[2] ?? null };
}

/** `guide.fields#import` (ilma `#`-ta) — kohtjuhendi `guide_link` väärtus */
export const formatGuideRef = (chapter: GuideChapterKey, anchor?: string | null): string => (anchor ? `${chapter}#${anchor}` : chapter);

/** Kohtjuhendi `guide_link`: peab osutama peatükile ega alga `#`-ga */
export function isValidGuideLink(s: string): boolean {
  if (s.startsWith('#')) return false;
  const ref = parseGuideRef(s);
  return ref !== null && ref.chapter !== null;
}
