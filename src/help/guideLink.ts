// src/help/guideLink.ts — viide juhendi peatükile ja ankrule. Sama kuju on sügavlingil (`#guide.fields#import`),
// peatükkide vahelises HTML-lingis ja kohtjuhendi `guide_link` väljal (`guide.fields#import`, ilma `#`-ta).
import { isGuideChapterKey, type GuideChapterKey } from './guideChapters.ts';

export interface GuideRef {
  /** null = juhend ilma kindla peatükita (avaneb esimene nähtav) */
  chapter: GuideChapterKey | null;
  /** h3 ankru lühinimi (vt anchors.ts) */
  anchor: string | null;
}

/** Ankru ja kogu `guide_link` väärtuse suurim pikkus (märkides); sügavlingi ja HTML-lingi ankur on samuti piiratud */
export const GUIDE_ANCHOR_MAX = 80;
export const GUIDE_LINK_MAX = 120;

const REF = /^#?guide(?:\.([a-z][a-z-]*))?(?:#([a-z0-9][a-z0-9-]*))?$/;

export function parseGuideRef(raw: string): GuideRef | null {
  const m = REF.exec(raw.trim());
  if (!m) return null;
  const key = m[1] ? `guide.${m[1]}` : null;
  if (key !== null && !isGuideChapterKey(key)) return null;
  if (key === null && m[2]) return null; // ankur ilma peatükita pole mõttekas
  if (m[2] && m[2].length > GUIDE_ANCHOR_MAX) return null;
  return { chapter: key as GuideChapterKey | null, anchor: m[2] ?? null };
}

/** `guide.fields#import` (ilma `#`-ta) — kohtjuhendi `guide_link` väärtus */
export const formatGuideRef = (chapter: GuideChapterKey, anchor?: string | null): string => (anchor ? `${chapter}#${anchor}` : chapter);

/** Kohtjuhendi `guide_link`: peab osutama peatükile ega alga `#`-ga */
export function isValidGuideLink(s: string): boolean {
  if (s.startsWith('#') || s.length > GUIDE_LINK_MAX) return false;
  const ref = parseGuideRef(s);
  return ref !== null && ref.chapter !== null;
}

/** Sügavlingi hash: `#guide`, `#guide.fields`, `#guide.fields#import` */
export const guideHash = (ref: GuideRef): string => (ref.chapter ? `#${formatGuideRef(ref.chapter, ref.anchor)}` : '#guide');

const PEER_LINK = /<a\s[^>]*?href="#(guide\.[a-z-]+)(?:#[a-z0-9-]+)?"[^>]*>([\s\S]*?)<\/a>/gi;

/**
 * Viited peatükkidele, mille moodulit ettevõttel pole: link asendub tekstiga + märkega „(vajab moodulit …)“.
 * `missingModule(key)` annab mooduli nime (või null, kui peatükk on kasutatav). Töötab puhastatud HTML-iga.
 */
export function markModuleLinks(html: string, missingModule: (key: GuideChapterKey) => string | null): string {
  return html.replace(PEER_LINK, (whole, key: string, text: string) => {
    if (!isGuideChapterKey(key)) return whole;
    const label = missingModule(key);
    return label ? `<span>${text} (vajab moodulit „${label}“)</span>` : whole;
  });
}
