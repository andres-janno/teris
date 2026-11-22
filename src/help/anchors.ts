// src/help/anchors.ts — vahepealkirjade (h3) ankrud. Ankru lühinimi tuletatakse pealkirjast; sama algoritm on
// sanitizeHelp'is (DOM-i id) ja extractAnchors'is (admin: peatükki-lingi valik, otsing: tabamuse koht).

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
  return s || 'jaotis';
}

/** Järgmine unikaalne lühinimi sama dokumendi sees: esimene `import`, siis `import-2`, `import-3`. */
export function nextSlug(seen: Map<string, number>, text: string): string {
  const base = slugify(text);
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
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

/** Peatüki h3 pealkirjad dokumendi järjekorras koos ankru lühinimega */
export function extractAnchors(html: string): Anchor[] {
  const seen = new Map<string, number>();
  const out: Anchor[] = [];
  for (const m of html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const text = textOfHtml(m[1]);
    out.push({ slug: nextSlug(seen, text), text });
  }
  return out;
}
