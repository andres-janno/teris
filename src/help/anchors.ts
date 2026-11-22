// src/help/anchors.ts — vahepealkirjade (h3) ankrud. Ankru lühinimi tuletatakse pealkirjast; sama algoritm on
// sanitizeHelp'is (DOM-i id) ja extractAnchors'is (admin: peatükki-lingi valik, otsing: tabamuse koht).

import { GUIDE_ANCHOR_MAX } from './guideLink.ts';

export interface Anchor {
  slug: string;
  text: string;
}

/** Pealkirjast lühinimi: väiketähed, täpitähed ilma täpita (õ→o, ä→a, ö→o, ü→u, š→s, ž→z), muu → `-` */
export function slugify(text: string): string {
  const s = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // ankur on kuni GUIDE_ANCHOR_MAX märki; 10 märki jääb korduvuse järelliitele (`-2`, `-3` …)
  const cut = s.slice(0, GUIDE_ANCHOR_MAX - 10).replace(/-+$/g, '');
  return cut || 'jaotis';
}

/**
 * Järgmine unikaalne lühinimi sama dokumendi sees: esimene `import`, siis `import-2`, `import-3`.
 * Väljastatud slug'e peetakse `seen`-is meeles eraldi (`\0`-eesliitega), et pealkiri „Import 2“ ei põrkuks tuletatud `import-2`-ga.
 */
export function nextSlug(seen: Map<string, number>, text: string): string {
  const base = slugify(text);
  let n = seen.get(base) ?? 0;
  let candidate: string;
  do {
    n += 1;
    candidate = n === 1 ? base : `${base}-${n}`;
  } while (seen.has(`\0${candidate}`));
  seen.set(base, n);
  seen.set(`\0${candidate}`, 1);
  return candidate;
}

/** DOM-i id (eesliide väldib kokkupõrget rakenduse enda id-dega) */
export const anchorDomId = (slug: string): string => `g-${slug}`;

/** HTML-i nähtav tekst: sildid maha, tavalised olemid lahti, tühikud ühte */
export function textOfHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Peatüki h3 pealkirjad dokumendi järjekorras koos ankru lühinimega. Sisend peab olema sanitize'itud HTML (sanitizeHelp), et väljund vastaks vaate id-dele. */
export function extractAnchors(html: string): Anchor[] {
  const seen = new Map<string, number>();
  const out: Anchor[] = [];
  for (const m of html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const text = textOfHtml(m[1]);
    out.push({ slug: nextSlug(seen, text), text });
  }
  return out;
}
