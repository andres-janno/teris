// src/tooling/uiUsage.ts — ühiste ui komponentide kasutussagedus rakenduses (näidatakse galeriis /ui).
// Puhtad funktsioonid: sisend on failide tekstid, väljund kokkuvõte; failide lugemine on uiUsagePlugin.ts-is.
// Node'i mooduleid siin ei kasutata, sest tüüpe impordib ka brauseri kood.

export type PropValueKind = 'static' | 'dynamic' | 'default';

export interface PropValueCount {
  kind: PropValueKind;
  /** Ainult staatilise väärtuse puhul (variant="ghost" → "ghost"). */
  value?: string;
  count: number;
}

export interface PropBreakdown {
  prop: string;
  values: PropValueCount[];
}

export interface FileCount {
  file: string;
  count: number;
}

/** Ühe propikombinatsiooni kasutuste arv; values on silt iga `comboProps` propi kohta (samas järjekorras). */
export interface PropCombo {
  values: string[];
  count: number;
}

export interface ComponentUsage {
  name: string;
  /** Kasutuskordi rakenduse vaadetes (esiletõstetud arv). */
  count: number;
  fileCount: number;
  files: FileCount[];
  props: PropBreakdown[];
  /** Propid, mille kombinatsioone loetakse (BREAKDOWN_PROPS-ist need, mida on vähemalt kord kirjutatud). */
  comboProps: string[];
  /** Kombinatsioonid kasutuse järgi kahanevalt (ainult rakenduse vaated). */
  combos: PropCombo[];
  /** Kasutuskordi teiste ühiste komponentide sees (src/components/ui/**, v.a. galerii ja testid). */
  insideUi: number;
}

export interface UiUsage {
  /** ISO aeg, millal loendus tehti. */
  generatedAt: string;
  components: ComponentUsage[];
}

/** Propid, mille väärtuste jaotust näidatakse (kui komponenti on neid kasutatud). */
export const BREAKDOWN_PROPS = ['variant', 'tone', 'size'] as const;

// Võrdse arvu puhul: staatilised väärtused enne, siis dünaamiline, viimasena vaikimisi.
const KIND_ORDER: Record<PropValueKind, number> = { static: 0, dynamic: 1, default: 2 };

const UI_DIR = 'src/components/ui/';

export const DEFAULT_LABEL = 'vaikimisi';
export const DYNAMIC_LABEL = 'dünaamiline';

/** Propi väärtuse silt: puuduv → „vaikimisi“, muidu väärtus ise. Galerii ja loendus kasutavad sama silti. */
export function propLabel(value: unknown): string {
  return value === undefined || value === null ? DEFAULT_LABEL : String(value);
}

/** Kombinatsiooni võti („vaikimisi · icon-sm“); sama vorming on galerii näidiste all ja hüpiku tabelis. */
export function comboKey(labels: string[]): string {
  return labels.join(' · ');
}

/** Mitu korda täpselt see kombinatsioon rakenduses esineb (0, kui ei esine). */
export function comboCount(usage: ComponentUsage, key: string): number {
  return usage.combos.find((c) => comboKey(c.values) === key)?.count ?? 0;
}

/** Kasutamata = ei rakenduse vaadetes ega teiste ühiste komponentide sees. */
export function isUnused(c: Pick<ComponentUsage, 'count' | 'insideUi'>): boolean {
  return c.count === 0 && c.insideUi === 0;
}

// Eemaldab rea- ja plokkkommentaarid, jättes sõne- ja mallsõnede sisu puutumata.
// Reavahetused säilivad. `//` kohe pärast `:` ei loe kommentaariks (URL JSX-tekstis).
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === '/' && next === '/' && src[i - 1] !== ':') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '"' || c === "'") {
      // Ülakoma JSX-tekstis (nt "Põllu's") ei tohi sööma hakata: sõne lõpeb hiljemalt rea lõpus.
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      const end = src[j] === c ? j + 1 : j;
      out += src.slice(i, end);
      i = end;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== '`') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Komponendid = index.ts-i `export { … }` nimed, mis algavad suurtähega. Tüübid on kirjas `type X` ja jäävad välja,
 * konstandid (UPPER_CASE) samuti; funktsioonid, hookid ja klassikonstandid (cn, parseNumberText, usePopupContainer,
 * cornerActionClass …) algavad väiketähega. `X as Y` → eksporditud nimi Y.
 */
export function parseUiComponents(indexSource: string): string[] {
  const names: string[] = [];
  for (const m of stripComments(indexSource).matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of m[1].split(',')) {
      const item = raw.trim();
      if (!item || /^type\s/.test(item)) continue;
      const name = item.split(/\s+as\s+/).pop()!.trim();
      if (/^[A-Z]/.test(name) && !/^[A-Z0-9_]+$/.test(name) && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

/** Ühiste komponentide enda failid, mille kasutus loetakse eraldi (galerii, testid ja `._` failid jäävad välja). */
export function isInsideUiFile(path: string): boolean {
  const p = path.replace(/\\/g, '/');
  const base = p.slice(p.lastIndexOf('/') + 1);
  return p.startsWith(UI_DIR) && p.endsWith('.tsx') && !base.startsWith('UiGallery') && !/\.test\./.test(base) && !base.startsWith('._');
}

/** Kas fail loetakse: kõik src all olevad .tsx, v.a. ui/ kaust (galerii ja komponendid ise), testid ja macOS-i `._` failid. */
export function isCountedFile(path: string): boolean {
  const p = path.replace(/\\/g, '/');
  const base = p.slice(p.lastIndexOf('/') + 1);
  return p.startsWith('src/') && p.endsWith('.tsx') && !p.startsWith(UI_DIR) && !/\.test\./.test(base) && !base.startsWith('._');
}

interface TagAttr {
  name: string;
  /** Väärtuse toortekst: "…" / '…' (jutumärkidega) või {…} (looksulgudega); null = väärtuseta (boolean). */
  raw: string | null;
}

/** Loeb avamärgendi atribuudid alates nimele järgnevast positsioonist; peatub tipptaseme `>` juures. */
function readAttrs(src: string, from: number): TagAttr[] {
  const attrs: TagAttr[] = [];
  const n = src.length;
  let i = from;
  while (i < n) {
    const c = src[i];
    if (c === '>') break;
    if (/\s/.test(c) || c === '/') { i++; continue; }
    if (c === '{') {
      i = skipBraces(src, i); // {...spread}
      continue;
    }
    const nm = /^[\w:$-]+/.exec(src.slice(i, i + 64));
    if (!nm) { i++; continue; }
    i += nm[0].length;
    let j = i;
    while (j < n && /\s/.test(src[j])) j++;
    if (src[j] !== '=') {
      attrs.push({ name: nm[0], raw: null });
      continue;
    }
    j++;
    while (j < n && /\s/.test(src[j])) j++;
    let end: number;
    if (src[j] === '"' || src[j] === "'") {
      const q = src[j];
      end = src.indexOf(q, j + 1);
      end = end === -1 ? n : end + 1;
    } else if (src[j] === '{') {
      end = skipBraces(src, j);
    } else {
      end = j;
    }
    attrs.push({ name: nm[0], raw: src.slice(j, end) });
    i = end;
  }
  return attrs;
}

/** Looksulgudes avaldise lõpp (sõned ja mallsõned arvestatud); tagastab positsiooni pärast sulgevat `}`. */
function skipBraces(src: string, start: number): number {
  let depth = 0;
  let i = start;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < n && src[i] !== c) i += src[i] === '\\' ? 2 : 1;
    } else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return n;
}

/** Staatiline väärtus: "x", 'x', {"x"}, {'x'}, {`x`} (ilma ${}); muu on dünaamiline. */
function staticValue(raw: string): string | null {
  const t = raw.trim();
  const m = /^(?:\{\s*)?(["'`])([^"'`$\\]*)\1(?:\s*\})?$/.exec(t);
  if (!m) return null;
  // Looksulgudeta väärtus peab olema jutumärkidega ja looksulgudega sümmeetriline.
  if (t.startsWith('{') !== t.endsWith('}')) return null;
  return m[2];
}

interface Acc {
  files: Map<string, number>;
  props: Map<string, Map<string, PropValueCount>>;
  /** Kõigi BREAKDOWN_PROPS siltide kombinatsioon (võti = siltide ühendus) → kordi. */
  tuples: Map<string, { labels: string[]; count: number }>;
  count: number;
  insideUi: number;
}

function bump(map: Map<string, PropValueCount>, key: string, v: Omit<PropValueCount, 'count'>): void {
  const cur = map.get(key);
  if (cur) cur.count++;
  else map.set(key, { ...v, count: 1 });
}

/**
 * Loendab komponentide kasutuse JSX-i avamärgendite `<Nimi` järgi. `<Nimi.Alam` loetakse Nimi kasutuseks (ui
 * komponendid ei kasuta punktiga alamkomponente, aga tulevane `Object.assign`-stiilis alamkomponent ei jää märkamata).
 * Variandi propide (variant/tone/size) jaotus: staatiline väärtus loetakse väärtuse kaupa, `{…}` on dünaamiline,
 * prop puudumine on vaikimisi; prop on aruandes ainult siis, kui seda on vähemalt kord kirjutatud.
 */
export function countUiUsage(input: {
  indexSource: string;
  files: Record<string, string>;
  generatedAt?: string;
}): UiUsage {
  const names = parseUiComponents(input.indexSource);
  const acc = new Map<string, Acc>(names.map((nm) => [nm, { files: new Map(), props: new Map(), tuples: new Map(), count: 0, insideUi: 0 }]));
  const tagRe = /(?<![\w$)\]])<([A-Z][\w$]*)(?![\w$])/g;

  const paths = Object.keys(input.files).filter((p) => isCountedFile(p) || isInsideUiFile(p)).sort();
  for (const path of paths) {
    const src = stripComments(input.files[path]);
    const inside = isInsideUiFile(path);
    for (const m of src.matchAll(tagRe)) {
      const a = acc.get(m[1]);
      if (!a) continue;
      if (inside) {
        a.insideUi++;
        continue;
      }
      a.count++;
      a.files.set(path, (a.files.get(path) ?? 0) + 1);
      const attrs = readAttrs(src, m.index + m[0].length);
      const labels: string[] = [];
      for (const prop of BREAKDOWN_PROPS) {
        const attr = attrs.find((x) => x.name === prop);
        const values = a.props.get(prop) ?? new Map<string, PropValueCount>();
        if (!attr || attr.raw === null) {
          bump(values, 'default', { kind: 'default' });
          labels.push(DEFAULT_LABEL);
        } else {
          const v = staticValue(attr.raw);
          if (v === null) {
            bump(values, 'dynamic', { kind: 'dynamic' });
            labels.push(DYNAMIC_LABEL);
          } else {
            bump(values, `static:${v}`, { kind: 'static', value: v });
            labels.push(v);
          }
        }
        a.props.set(prop, values);
      }
      const tk = labels.join('\u0000');
      const t = a.tuples.get(tk);
      if (t) t.count++;
      else a.tuples.set(tk, { labels, count: 1 });
    }
  }

  const components: ComponentUsage[] = names.map((name) => {
    const a = acc.get(name)!;
    const files = [...a.files].map(([file, count]) => ({ file, count })).sort((x, y) => y.count - x.count || x.file.localeCompare(y.file));
    const props: PropBreakdown[] = [];
    for (const prop of BREAKDOWN_PROPS) {
      const values = a.props.get(prop);
      if (!values) continue;
      // Näita ainult propi, mida on vähemalt kord kirjutatud (muidu oleks kõik "vaikimisi").
      if (![...values.keys()].some((k) => k !== 'default')) continue;
      const sorted = [...values.values()].sort(
        (x, y) => y.count - x.count || KIND_ORDER[x.kind] - KIND_ORDER[y.kind] || (x.value ?? '').localeCompare(y.value ?? '')
      );
      props.push({ prop, values: sorted });
    }
    const comboProps = props.map((p) => p.prop);
    const idx = comboProps.map((p) => BREAKDOWN_PROPS.indexOf(p as (typeof BREAKDOWN_PROPS)[number]));
    const merged = new Map<string, PropCombo>();
    for (const t of comboProps.length ? a.tuples.values() : []) {
      const values = idx.map((i) => t.labels[i]);
      const k = comboKey(values);
      const cur = merged.get(k);
      if (cur) cur.count += t.count;
      else merged.set(k, { values, count: t.count });
    }
    const combos = [...merged.values()].sort((x, y) => y.count - x.count || comboKey(x.values).localeCompare(comboKey(y.values)));
    return { name, count: a.count, fileCount: files.length, files, props, comboProps, combos, insideUi: a.insideUi };
  });

  return { generatedAt: input.generatedAt ?? new Date().toISOString(), components };
}
