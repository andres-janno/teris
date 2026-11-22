// src/help/guideSearch.ts — otsing üle kõigi peatükkide: tabamus on lõik (p, li, h3, h4), mille tekstis esinevad kõik
// otsisõnad; kaasas on lähim eelnev h3 ankur, et klõps viiks täpsesse kohta.
import { nextSlug, textOfHtml } from './anchors';
import type { GuideChapterKey } from './guideChapters';

export interface SearchChapter {
  key: GuideChapterKey;
  title: string;
  html: string;
}

export interface GuideHit {
  chapter: GuideChapterKey;
  chapterTitle: string;
  /** Lähima eelneva h3 lühinimi (null = enne esimest vahepealkirja) */
  anchor: string | null;
  anchorText: string | null;
  /** Katkend: enne tabamust, tabamus (esimene otsisõna), pärast tabamust; servas „…“ */
  before: string;
  match: string;
  after: string;
}

const BEFORE = 50;
const AFTER = 70;

export function searchGuide(chapters: SearchChapter[], query: string, limit = 30): GuideHit[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: GuideHit[] = [];
  for (const ch of chapters) {
    const seen = new Map<string, number>();
    let anchor: string | null = null;
    let anchorText: string | null = null;
    for (const m of ch.html.matchAll(/<(h3|h4|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const text = textOfHtml(m[2]);
      if (!text) continue;
      if (m[1].toLowerCase() === 'h3') {
        anchor = nextSlug(seen, text);
        anchorText = text;
      }
      const low = text.toLowerCase();
      if (!words.every((w) => low.includes(w))) continue;
      const at = low.indexOf(words[0]);
      const from = Math.max(0, at - BEFORE);
      const to = Math.min(text.length, at + words[0].length + AFTER);
      hits.push({
        chapter: ch.key,
        chapterTitle: ch.title,
        anchor,
        anchorText,
        before: (from > 0 ? '…' : '') + text.slice(from, at),
        match: text.slice(at, at + words[0].length),
        after: text.slice(at + words[0].length, to) + (to < text.length ? '…' : '')
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}
