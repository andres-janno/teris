# e-PRIA põlluraamatu import (1. etapp) — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importida e-PRIA põlluraamatu väljavõte (`.xls`) põllu+hooaja tegevusteks ja kuvada need põllu kaardil.

**Architecture:** Brauseris loeb SheetJS faili lehtede kaupa ridadeks; puhas parser tõlgendab read põllu andmeteks; puhas "import builder" sobitab põllud/teostajad ja koostab API keha. Server (`dbApiPlugin.ts`) kirjutab ühes transaktsioonis kaks uut tabelit (`field_operations`, `field_operation_products`) ja uuendab `field_seasons` saagid/kuupäevad. Põllu kaart laeb tegevused avamisel.

**Tech Stack:** React 19 + TypeScript + Vite 8, Prisma 6 + PostgreSQL, SheetJS (`xlsx`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-polluraamatu-import-design.md`

## Global Constraints

- Kõik npm/npx/prisma/psql käsud jooksevad **kaugserveris**: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && <käsk>"`. Kohalik `/Users/andresj/Progemine/teris` ja kaugserveri `/home/debian/teris` on **sama failisüsteem** — faile muuda kohalikult (Edit/Write), käivita kaugelt. Ära käivita npm-i kohalikus Macis.
- Andmebaasi päring: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && psql \"\$(sed -n 's/^DATABASE_URL=\"\(.*\)?schema=public\"/\1/p' .env)\" -c \"<SQL>\""`. Parooli ära kirjuta ühtegi faili.
- Tüübikontroll: `npx tsc --noEmit -p tsconfig.app.json` (juurkausta `tsconfig.json` on ainult viited — `-p .` ei kontrolli midagi). **Lähtetaseme teadaolev viga:** `src/components/MapYearSelector.tsx(41,9): error TS6133 'currentSeason'` — see ei ole selle töö oma; uusi vigu ei tohi tekkida.
- Dev serveri taaskäivitus (pärast `prisma generate`) **kahe eraldi** SSH käsuna (üks käsk tapaks iseenda):
  1. `ssh uvn-243-120.tll07.zonevs.eu "pkill -9 -f 'node /home/debian/teris/node_modules/.bin/vite'"`
  2. `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && rm -f /tmp/teris_dev.log; setsid nohup npm run dev > /tmp/teris_dev.log 2>&1 < /dev/null & disown"` ja siis `sleep 6; ssh uvn-243-120.tll07.zonevs.eu "tail -5 /tmp/teris_dev.log"`
- API baas-URL testimiseks: `http://185.31.243.120:5173`.
- Enne iga andmeid muutvat testi: `ssh uvn-243-120.tll07.zonevs.eu "TS=\$(date +%Y%m%d_%H%M%S); cd /home/debian/teris && pg_dump \"\$(sed -n 's/^DATABASE_URL=\"\(.*\)?schema=public\"/\1/p' .env)\" -Fc -f ~/db_backups/teris_db_\$TS.dump && echo \$TS"`.
- **Isikuandmed:** päris faili (`._scratch/polluraamat_valjavote_24_09_2026.xls`) ega selle nimesid **ei commit'ita**; testides kasuta väljamõeldud nimesid ("Testija Tõnu", "Mari Tamm").
- UI tekstid ja koodikommentaarid eesti keeles (nagu ülejäänud koodibaasis).
- Commit: ainult nimetatud failid (`git add <failid>`), sõnum eesti keeles, lõpus rida `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `src/types/fieldOperation.ts` (uus) | Kõik põlluraamatu tüübid: parseri väljund, API keha/vastus, eelvaate rida |
| `src/services/fieldBookParser.ts` (uus) | Puhtad funktsioonid: `parseDecimal`, `parseDate`, `parseDateRange`, `parseAmount`, `parseFieldBookSheet` (ei impordi SheetJS-i) |
| `src/services/fieldBookParser.test.ts` (uus) | Parseri ühiktestid |
| `src/services/fieldBookWorkbook.ts` (uus) | SheetJS: `.xls` → lehtede read; `parseFieldBookFile` |
| `src/services/fieldBookImport.ts` (uus) | `matchPartyByName`, `buildFieldBookImport` (sobitamine + API keha + eelvaade) |
| `src/services/fieldBookImport.test.ts` (uus) | Import builderi ühiktestid |
| `vitest.config.ts` (uus) | Vitesti konfiguratsioon ilma Vite pluginateta |
| `prisma/schema.prisma` | Mudelid `FieldOperation`, `FieldOperationProduct` + tagasiseosed |
| `src/server/dbApiPlugin.ts` | `POST /api/field-operations/import`, `GET /api/field-operations`, parties `_count` |
| `src/services/api.ts` | `importFieldBook`, `getFieldOperations` |
| `src/types/party.ts`, `src/components/RelatedPartiesModal.tsx` | `performedOperationsCount` kasutusloenduris |
| `src/components/FieldBookUploadModal.tsx` (uus) | Impordiaken |
| `src/components/FieldManagerModal.tsx`, `src/App.tsx` | Nupp "Impordi põlluraamat" ja akna ühendamine |
| `src/components/FieldOperationsSection.tsx` (uus) | "Põllutööd {aasta}" jaotis |
| `src/components/FieldDetailsDrawer.tsx` | Jaotise lisamine põllu kaardile |
| `src/index.css` | `.field-op-*` stiilid |

---

### Task 1: Vitest, tüübid ja põlluraamatu lehe parser

**Files:**
- Create: `vitest.config.ts`, `src/types/fieldOperation.ts`, `src/services/fieldBookParser.ts`, `src/services/fieldBookParser.test.ts`
- Modify: `package.json` (devDependency `vitest`, skript `test`)

**Interfaces:**
- Produces (`src/types/fieldOperation.ts`): `ParsedProduct`, `ParsedOperation`, `ParsedFieldBookSheet`, `FieldBookSheetResult`, `FieldBookImportOperation`, `FieldBookImportField`, `FieldBookImportPayload`, `FieldBookImportResult`, `FieldOperationDto`, `FieldOperationProductDto`, `FieldOperationsResponse`, `FieldBookPreviewRow` — täpselt nagu allpool.
- Produces (`src/services/fieldBookParser.ts`):
  - `parseDecimal(raw: string): number | null`
  - `parseDate(raw: string): string` — `"pp.kk.aaaa"` → `"aaaa-kk-pp"`, muidu viskab `Error('Loetamatu kuupäev: "<raw>"')`
  - `parseDateRange(raw: string): { dateFrom: string; dateTo: string | null }`
  - `parseAmount(raw: string): { amount: number | null; unit: string | null }`
  - `parseFieldBookSheet(sheetName: string, rows: string[][]): ParsedFieldBookSheet`

- [ ] **Step 1: Paigalda Vitest**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npm i -D vitest@latest && npx vitest --version"`
Expected: versiooninumber (nt `vitest/4.x`). Kui npm annab peer-dependency konflikti Vite 8-ga, peatu ja teata — ära kasuta `--force`.

- [ ] **Step 2: Lisa skript ja Vitesti konfiguratsioon**

`package.json` → `"scripts"` alla lisa `"test": "vitest run"`.

`vitest.config.ts`:

```ts
// Eraldi konfiguratsioon, et Vitest ei laeks vite.config.ts pluginaid
// (dbApiPlugin avaks andmebaasiühendused).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
```

- [ ] **Step 3: Loo tüübid `src/types/fieldOperation.ts`**

```ts
// src/types/fieldOperation.ts
// e-PRIA põlluraamatu import ja põllutööde kuvamine.

export interface ParsedProduct {
  category: string | null;         // "Register/Materjal"
  name: string | null;             // toode, sort või umbrohi
  kind: string | null;             // "Liik/tüüp"
  spec: string | null;             // "Täpsustus" (nt seemne kategooria OTS)
  amount: number | null;
  unit: string | null;             // "kg/ha", "l/ha", "t/ha", "taime/m2", "g/ha"
  nKgHa: number | null;
  pKgHa: number | null;
  kKgHa: number | null;
  activeIngredient: string | null;
}

export interface ParsedOperation {
  type: string;                    // PRIA "Tegevus"
  dateFrom: string;                // "aaaa-kk-pp"
  dateTo: string | null;
  areaHa: number | null;
  method: string | null;
  performerName: string | null;
  notes: string | null;
  products: ParsedProduct[];
}

export interface ParsedFieldBookSheet {
  sheetName: string;
  season: number;
  fieldCode: string;
  num: string;
  areaHa: number | null;
  crop: string;
  targetYieldTonsHa: number | null;
  actualYieldTonsHa: number | null;
  seedingDate: string | null;
  harvestDate: string | null;
  operations: ParsedOperation[];
}

export interface FieldBookSheetResult {
  sheetName: string;
  sheet: ParsedFieldBookSheet | null;
  error: string | null;
}

export interface FieldBookImportOperation {
  type: string;
  dateFrom: string;
  dateTo: string | null;
  areaHa: number | null;
  method: string | null;
  performerId: string | null;
  notes: string | null;
  products: ParsedProduct[];
}

export interface FieldBookImportField {
  fieldCode: string;
  num: string;
  season: number;
  targetYieldTonsHa: number | null;
  actualYieldTonsHa: number | null;
  seedingDate: string | null;
  harvestDate: string | null;
  operations: FieldBookImportOperation[];
}

export interface FieldBookImportPayload {
  operatorId: string;
  fields: FieldBookImportField[];
}

export interface FieldBookImportResult {
  success: boolean;
  imported: number;
  operations: number;
  products: number;
  skipped: { fieldCode: string; num: string; season: number }[];
}

export interface FieldOperationProductDto extends ParsedProduct {
  id: number;
  sortOrder: number;
}

export interface FieldOperationDto {
  id: number;
  type: string;
  dateFrom: string;
  dateTo: string | null;
  areaHa: number | null;
  method: string | null;
  notes: string | null;
  performerName: string | null;
  sortOrder: number;
  products: FieldOperationProductDto[];
}

export interface FieldOperationsResponse {
  targetYieldTonsHa: number | null;
  actualYieldTonsHa: number | null;
  operations: FieldOperationDto[];
}

export interface FieldBookPreviewRow {
  sheetName: string;
  fieldCode: string | null;
  num: string | null;
  season: number | null;
  fieldName: string | null;       // registri nimi, kui sobitus
  matched: boolean;
  operationsCount: number;
  productsCount: number;
  unmatchedPerformers: string[];
  seasonLocked: boolean;
  error: string | null;
}
```

- [ ] **Step 4: Kirjuta ebaõnnestuvad testid `src/services/fieldBookParser.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  parseDecimal,
  parseDate,
  parseDateRange,
  parseAmount,
  parseFieldBookSheet
} from './fieldBookParser';

// Rida 13 veeruga (A..M), puuduvad lahtrid tühjad.
const r = (...cells: string[]): string[] => {
  const out = [...cells];
  while (out.length < 13) out.push('');
  return out;
};

// Anonüümitud näide e-PRIA väljavõtte lehe ülesehitusest.
const SHEET_2: string[][] = [
  r('osaühing Test-Agro / 10000000', '', '', '', '', '', '', 'e-PRIA / Põlluraamatu väljavõte'),
  r(),
  r('Põllu üldandmed'),
  r('Hooaeg', '2025'),
  r('Põllumassiivi number', '61044415735'),
  r('Põllu number', '2'),
  r('Põllu pindala (ha)', '7,67'),
  r('Kasutusõigus', '(SR) Suuline rendileping'),
  r('Maakasutus', '(P) Põllumaa'),
  r('Põllumajanduskultuur', 'Talinisu allakülvita'),
  r(),
  r('Kultuuri tüüp', 'Kultuur', 'Saagi tüüp', 'Planeeritud saak (t/ha)', 'Tegelik saak (t/ha)'),
  r('Põhikultuur', 'talinisu allakülvita', 'Terad', '4,00', '3,50'),
  r('Põhikultuur', 'talinisu allakülvita'),
  r(),
  r('Tegevus', 'Kuupäev', 'Pindala', 'Muud omadused', 'Register/Materjal', 'Nimi', 'Liik/tüüp', 'Täpsustus', 'Kogus', 'N (kg/ha)', 'P (kg/ha)', 'K (kg/ha)', 'Märkused'),
  r('Külvamine/istutamine', '26.09.2024', '7,67', '', 'EL ühtne sordileht', 'Julia', 'Talinisu', 'OTS', '240 kg/ha'),
  r('Väetamine', '03.04.2025 - 07.04.2025', '7,67', 'Paisklaotamine;', 'Väetis registrist', 'Ammooniumnitraat 34,4%', 'Ammooniumnitraat', '', '200 kg/ha', '68,8'),
  r('Seire', '30.04.2025', '7,67', '', 'Umbrohud', 'Põldsinep', '', '', '7 taime/m2', '', '', '', 'Umbrohud täies jõus'),
  r('Taimekaitsevahendi kasutamine', '02.05.2025 - 03.05.2025', '7,67', 'Teostaja: Testija Tõnu', 'Taimekaitsevahendid registrist', 'Tombo WG', 'Herbitsiid', '', '0,20 kg/ha'),
  r('', '', '', 'Toimeaine: Etüültrineksapak', 'Taimekaitsevahendid registrist', 'MOXA', 'Kasvuregulaator', '', '0,20 l/ha', '', '', '', 'Lamandumise oht'),
  r('', '', '', '', 'Märgaja/kleepaine', 'Dassoil', '', '', '0,50 l/ha', '', '', '', 'Lamandumise oht'),
  r('Saagikoristus', '31.07.2025 - 07.08.2025', '7,67', 'Põhikultuur;', '', '', 'Terad', '', '3,5 t/ha'),
  r('Kündmine', '10.08.2025', '7,67'),
  r('Külvamine/istutamine', '15.08.2025', '7,67', '', 'EL ühtne sordileht', 'cult', 'Taliraps', 'OTS', '4 kg/ha'),
  r('', '', '', '', '', '', '', '', 'NPK Kokku', '146,46', '15,27', '53,06'),
  r(),
  r('Trükitud: 24.09.2026'),
  r('Koostaja: TEST KOOSTAJA')
];

describe('abifunktsioonid', () => {
  it('parseDecimal loeb komaga ja tühikutega arve', () => {
    expect(parseDecimal('7,67')).toBe(7.67);
    expect(parseDecimal('1 234,5')).toBe(1234.5);
    expect(parseDecimal('4')).toBe(4);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });

  it('parseDate teisendab pp.kk.aaaa ISO-ks ja viskab vigasel', () => {
    expect(parseDate('26.09.2024')).toBe('2024-09-26');
    expect(() => parseDate('2024-09-26')).toThrow(/Loetamatu kuupäev/);
  });

  it('parseDateRange toetab üksikut kuupäeva ja vahemikku', () => {
    expect(parseDateRange('30.04.2025')).toEqual({ dateFrom: '2025-04-30', dateTo: null });
    expect(parseDateRange('03.04.2025 - 07.04.2025')).toEqual({ dateFrom: '2025-04-03', dateTo: '2025-04-07' });
  });

  it('parseAmount jagab koguse ja ühiku', () => {
    expect(parseAmount('0,20 kg/ha')).toEqual({ amount: 0.2, unit: 'kg/ha' });
    expect(parseAmount('7 taime/m2')).toEqual({ amount: 7, unit: 'taime/m2' });
    expect(parseAmount('')).toEqual({ amount: null, unit: null });
    expect(parseAmount('umbes palju')).toEqual({ amount: null, unit: 'umbes palju' });
  });
});

describe('parseFieldBookSheet', () => {
  const sheet = parseFieldBookSheet('2', SHEET_2);

  it('loeb päise ja saagid', () => {
    expect(sheet.season).toBe(2025);
    expect(sheet.fieldCode).toBe('61044415735');
    expect(sheet.num).toBe('2');
    expect(sheet.areaHa).toBe(7.67);
    expect(sheet.crop).toBe('Talinisu allakülvita');
    expect(sheet.targetYieldTonsHa).toBe(4);
    expect(sheet.actualYieldTonsHa).toBe(3.5);
  });

  it('loeb tegevused, jätab välja NPK Kokku, Trükitud ja Koostaja read', () => {
    expect(sheet.operations.map((o) => o.type)).toEqual([
      'Külvamine/istutamine',
      'Väetamine',
      'Seire',
      'Taimekaitsevahendi kasutamine',
      'Saagikoristus',
      'Kündmine',
      'Külvamine/istutamine'
    ]);
  });

  it('väetamine: vahemik, meetod ilma semikoolonita, N kogus', () => {
    const op = sheet.operations[1];
    expect(op.dateFrom).toBe('2025-04-03');
    expect(op.dateTo).toBe('2025-04-07');
    expect(op.method).toBe('Paisklaotamine');
    expect(op.products).toHaveLength(1);
    expect(op.products[0]).toMatchObject({ name: 'Ammooniumnitraat 34,4%', amount: 200, unit: 'kg/ha', nKgHa: 68.8, pKgHa: null });
  });

  it('seire: umbrohu arvukus ja märkus', () => {
    const op = sheet.operations[2];
    expect(op.products[0]).toMatchObject({ category: 'Umbrohud', name: 'Põldsinep', amount: 7, unit: 'taime/m2' });
    expect(op.notes).toBe('Umbrohud täies jõus');
  });

  it('taimekaitse: teostaja, jätkuread tootena, toimeaine toote juures', () => {
    const op = sheet.operations[3];
    expect(op.performerName).toBe('Testija Tõnu');
    expect(op.method).toBeNull();
    expect(op.products.map((p) => p.name)).toEqual(['Tombo WG', 'MOXA', 'Dassoil']);
    expect(op.products[0].activeIngredient).toBeNull();
    expect(op.products[1].activeIngredient).toBe('Etüültrineksapak');
    expect(op.notes).toBe('Lamandumise oht');
  });

  it('koristus ja kündmine', () => {
    expect(sheet.operations[4].method).toBe('Põhikultuur');
    expect(sheet.operations[4].products[0]).toMatchObject({ kind: 'Terad', amount: 3.5, unit: 't/ha' });
    expect(sheet.operations[5].products).toEqual([]);
  });

  it('külvi- ja koristuskuupäev: järgmise kultuuri külv ei loe', () => {
    expect(sheet.seedingDate).toBe('2024-09-26');
    expect(sheet.harvestDate).toBe('2025-08-07');
  });

  it('võtab saagid esimeselt täidetud kultuurirealt', () => {
    const rows = SHEET_2.map((row) => [...row]);
    rows[12] = r('Põhikultuur', 'talinisu allakülvita');
    rows[13] = r('Põhikultuur', 'talinisu allakülvita', 'Terad', '5,00', '');
    const s = parseFieldBookSheet('2', rows);
    expect(s.targetYieldTonsHa).toBe(5);
    expect(s.actualYieldTonsHa).toBeNull();
  });

  it('koristuseta: külvikuupäev on esimene põhikultuuri külv', () => {
    const rows = SHEET_2.filter((row) => row[0] !== 'Saagikoristus');
    const s = parseFieldBookSheet('2', rows);
    expect(s.harvestDate).toBeNull();
    expect(s.seedingDate).toBe('2024-09-26');
  });

  it('põhikultuuri külv pärast koristust ei muuda külvikuupäeva', () => {
    const rows = SHEET_2.map((row) => [...row]);
    rows[24] = r('Külvamine/istutamine', '20.09.2025', '7,67', '', 'EL ühtne sordileht', 'Julia', 'Talinisu', 'OTS', '230 kg/ha');
    const s = parseFieldBookSheet('2', rows);
    expect(s.seedingDate).toBe('2024-09-26');
  });

  it('viskab lehe vea loetamatu kuupäeva korral', () => {
    const rows = SHEET_2.map((row) => [...row]);
    rows[23] = r('Kündmine', 'eile', '7,67');
    expect(() => parseFieldBookSheet('2', rows)).toThrow(/Loetamatu kuupäev/);
  });

  it('viskab vea, kui tegevuste tabel puudub', () => {
    expect(() => parseFieldBookSheet('2', SHEET_2.slice(0, 14))).toThrow(/Tegevuste tabel puudub/);
  });
});
```

- [ ] **Step 5: Käivita testid — peavad ebaõnnestuma**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npm test 2>&1 | tail -15"`
Expected: FAIL — `Failed to resolve import "./fieldBookParser"` (moodulit veel pole).

- [ ] **Step 6: Kirjuta `src/services/fieldBookParser.ts`**

```ts
// src/services/fieldBookParser.ts
// e-PRIA "Põlluraamatu väljavõte" lehe tõlgendamine. Puhtad funktsioonid —
// SheetJS-i siin ei kasutata (vt fieldBookWorkbook.ts), et loogika oleks testitav.
import type { ParsedFieldBookSheet, ParsedOperation, ParsedProduct } from '../types/fieldOperation';

const COLS = 13;
const PRODUCT_COLS = [4, 5, 6, 7, 8, 9, 10, 11];

export function parseDecimal(raw: string): number | null {
  const t = raw.replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw: string): string {
  const m = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) throw new Error(`Loetamatu kuupäev: "${raw}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function parseDateRange(raw: string): { dateFrom: string; dateTo: string | null } {
  const parts = raw.split(' - ').map((p) => p.trim());
  if (parts.length === 2) return { dateFrom: parseDate(parts[0]), dateTo: parseDate(parts[1]) };
  return { dateFrom: parseDate(raw), dateTo: null };
}

export function parseAmount(raw: string): { amount: number | null; unit: string | null } {
  const t = raw.trim();
  if (!t) return { amount: null, unit: null };
  const m = t.match(/^([\d\s]+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { amount: null, unit: t };
  return { amount: parseDecimal(m[1]), unit: m[2].trim() || null };
}

export function parseFieldBookSheet(sheetName: string, rows: string[][]): ParsedFieldBookSheet {
  const cell = (r: number, c: number) => (rows[r]?.[c] ?? '').trim();
  const find = (label: string) => rows.findIndex((row) => (row[0] ?? '').trim() === label);
  const header = (label: string) => {
    const i = find(label);
    return i >= 0 ? cell(i, 1) : '';
  };

  const season = parseInt(header('Hooaeg'), 10);
  if (Number.isNaN(season)) throw new Error('Hooaeg puudub');
  const fieldCode = header('Põllumassiivi number');
  if (!fieldCode) throw new Error('Põllumassiivi number puudub');

  const opIdx = find('Tegevus');
  if (opIdx < 0) throw new Error('Tegevuste tabel puudub');
  const cropIdx = find('Kultuuri tüüp');

  let targetYieldTonsHa: number | null = null;
  let actualYieldTonsHa: number | null = null;
  if (cropIdx >= 0) {
    for (let i = cropIdx + 1; i < opIdx; i++) {
      if (!cell(i, 0)) continue;
      const target = parseDecimal(cell(i, 3));
      const actual = parseDecimal(cell(i, 4));
      if (target !== null || actual !== null) {
        targetYieldTonsHa = target;
        actualYieldTonsHa = actual;
        break;
      }
    }
  }

  const operations: ParsedOperation[] = [];
  let current: ParsedOperation | null = null;

  for (let i = opIdx + 1; i < rows.length; i++) {
    const c = Array.from({ length: COLS }, (_, j) => cell(i, j));
    if (c[0].startsWith('Trükitud') || c[0].startsWith('Koostaja')) continue;
    if (c[8] === 'NPK Kokku') continue;
    if (c.every((v) => !v)) continue;

    if (c[0]) {
      current = {
        type: c[0],
        ...parseDateRange(c[1]),
        areaHa: parseDecimal(c[2]),
        method: null,
        performerName: null,
        notes: null,
        products: []
      };
      operations.push(current);
    }
    if (!current) continue;

    let activeIngredient: string | null = null;
    const other = c[3];
    if (other.startsWith('Teostaja:')) {
      current.performerName ??= other.slice('Teostaja:'.length).trim() || null;
    } else if (other.startsWith('Toimeaine:')) {
      activeIngredient = other.slice('Toimeaine:'.length).trim() || null;
    } else if (other) {
      current.method ??= other.replace(/;\s*$/, '').trim() || null;
    }

    if (c[12]) current.notes ??= c[12];

    if (PRODUCT_COLS.some((j) => c[j])) {
      const { amount, unit } = parseAmount(c[8]);
      const product: ParsedProduct = {
        category: c[4] || null,
        name: c[5] || null,
        kind: c[6] || null,
        spec: c[7] || null,
        amount,
        unit,
        nKgHa: parseDecimal(c[9]),
        pKgHa: parseDecimal(c[10]),
        kKgHa: parseDecimal(c[11]),
        activeIngredient
      };
      current.products.push(product);
    }
  }

  const crop = header('Põllumajanduskultuur');
  const cropLower = crop.toLowerCase();
  const harvest = operations.find((o) => o.type === 'Saagikoristus' && o.method === 'Põhikultuur');
  const harvestDate = harvest ? harvest.dateTo ?? harvest.dateFrom : null;
  const sowings = operations
    .filter((o) => o.type === 'Külvamine/istutamine')
    .filter((o) => o.products.some((p) => p.kind && cropLower.includes(p.kind.toLowerCase())))
    .filter((o) => !harvest || o.dateFrom <= harvest.dateFrom)
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));

  return {
    sheetName,
    season,
    fieldCode,
    num: header('Põllu number') || sheetName,
    areaHa: parseDecimal(header('Põllu pindala (ha)')),
    crop,
    targetYieldTonsHa,
    actualYieldTonsHa,
    seedingDate: sowings[0]?.dateFrom ?? null,
    harvestDate,
    operations
  };
}
```

- [ ] **Step 7: Käivita testid — peavad läbima**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npm test 2>&1 | tail -15"`
Expected: PASS, kõik `fieldBookParser.test.ts` testid rohelised.

- [ ] **Step 8: Tüübikontroll**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep 'error TS'"`
Expected: ainult lähtetaseme `MapYearSelector.tsx(41,9)` viga.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/types/fieldOperation.ts src/services/fieldBookParser.ts src/services/fieldBookParser.test.ts
git commit -m "$(cat <<'EOF'
Lisa e-PRIA põlluraamatu lehe parser ja Vitest.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: SheetJS ja faili lugemine (kontroll päris failiga)

**Files:**
- Create: `src/services/fieldBookWorkbook.ts`
- Modify: `package.json` (dependency `xlsx`)

**Interfaces:**
- Consumes: `parseFieldBookSheet` (Task 1), `FieldBookSheetResult` (Task 1)
- Produces:
  - `readFieldBookWorkbook(buffer: ArrayBuffer): { sheetName: string; rows: string[][] }[]`
  - `parseFieldBookFile(buffer: ArrayBuffer): FieldBookSheetResult[]` — viskab `Error('See ei ole e-PRIA põlluraamatu väljavõte')`

- [ ] **Step 1: Paigalda SheetJS ametlikust levitusest**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz && node -e \"import('xlsx').then(m => console.log(m.version))\""`
Expected: `0.20.3`. Kui allalaadimine ebaõnnestub, peatu ja teata (ära paigalda npm registri `xlsx@0.18.5`).

- [ ] **Step 2: Kirjuta `src/services/fieldBookWorkbook.ts`**

```ts
// src/services/fieldBookWorkbook.ts
// SheetJS: e-PRIA põlluraamatu .xls → lehtede read → parsitud põllud.
import * as XLSX from 'xlsx';
import type { FieldBookSheetResult } from '../types/fieldOperation';
import { parseFieldBookSheet } from './fieldBookParser';

export function readFieldBookWorkbook(buffer: ArrayBuffer): { sheetName: string; rows: string[][] }[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
  return wb.SheetNames.map((sheetName) => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: '',
      blankrows: true
    });
    return {
      sheetName,
      rows: aoa.map((row) => row.map((v) => (v === null || v === undefined ? '' : String(v))))
    };
  });
}

export function parseFieldBookFile(buffer: ArrayBuffer): FieldBookSheetResult[] {
  const sheets = readFieldBookWorkbook(buffer);
  const isFieldBook = sheets.some(
    (s) =>
      (s.rows[0] ?? []).some((v) => v.includes('Põlluraamatu väljavõte')) &&
      s.rows.some((row) => (row[0] ?? '').trim() === 'Tegevus')
  );
  if (!isFieldBook) throw new Error('See ei ole e-PRIA põlluraamatu väljavõte');

  return sheets.map((s) => {
    try {
      return { sheetName: s.sheetName, sheet: parseFieldBookSheet(s.sheetName, s.rows), error: null };
    } catch (err) {
      return { sheetName: s.sheetName, sheet: null, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
```

- [ ] **Step 3: Kontrollkäivitus päris failiga (skripti ei commit'ita)**

Loo `._scratch/check_fieldbook.mts`:

```ts
import { readFileSync } from 'fs';
import { parseFieldBookFile } from '../src/services/fieldBookWorkbook.ts';

const buf = readFileSync(new URL('./polluraamat_valjavote_24_09_2026.xls', import.meta.url));
const results = parseFieldBookFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const ok = results.filter((r) => r.sheet);
const ops = ok.flatMap((r) => r.sheet!.operations);
console.log('lehti', results.length, 'vigu', results.filter((r) => r.error).map((r) => `${r.sheetName}: ${r.error}`));
console.log('tegevusi', ops.length, 'tooteid', ops.reduce((n, o) => n + o.products.length, 0));
console.log('saagiga lehti', ok.filter((r) => r.sheet!.actualYieldTonsHa !== null || r.sheet!.targetYieldTonsHa !== null).length);
console.log('hooajad', [...new Set(ok.map((r) => r.sheet!.season))]);
console.log('näide', JSON.stringify(ok.find((r) => r.sheetName === '2')?.sheet?.operations.slice(0, 2)));
console.log('massiivid numbrina?', ok.filter((r) => !/^\d{11}$/.test(r.sheet!.fieldCode)).map((r) => r.sheet!.fieldCode));
```

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npx tsx ._scratch/check_fieldbook.mts"`
Expected:
- `lehti 31 vigu []`
- `tegevusi 325`
- `saagiga lehti 18`
- `hooajad [ 2025 ]`
- `massiivid numbrina? []` (kõik 11-kohalised)

Kui mõni arv erineb, uuri erinevust (nt kas SheetJS andis arvu teisiti kui pandas) ja paranda parserit **koos testiga Task 1 testifailis**, enne kui jätkad.

- [ ] **Step 4: Tüübikontroll**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep 'error TS'"`
Expected: ainult lähtetaseme viga.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/services/fieldBookWorkbook.ts
git commit -m "$(cat <<'EOF'
Lisa põlluraamatu .xls lugemine SheetJS-iga.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Sobitamine ja impordi keha koostamine

**Files:**
- Create: `src/services/fieldBookImport.ts`, `src/services/fieldBookImport.test.ts`

**Interfaces:**
- Consumes: `FieldBookSheetResult`, `FieldBookImportPayload`, `FieldBookPreviewRow` (Task 1); `MasterField` (`src/types/fieldRegister.ts`), `RelatedParty` (`src/types/party.ts`), `FarmingSeason` (`src/types/season.ts`)
- Produces:
  - `matchPartyByName(name: string, parties: RelatedParty[]): RelatedParty | null`
  - `buildFieldBookImport(results: FieldBookSheetResult[], ctx: { masterFields: MasterField[]; parties: RelatedParty[]; seasons: FarmingSeason[]; operatorId: string }): { rows: FieldBookPreviewRow[]; payload: FieldBookImportPayload }`

- [ ] **Step 1: Kirjuta ebaõnnestuvad testid `src/services/fieldBookImport.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { matchPartyByName, buildFieldBookImport } from './fieldBookImport';
import type { MasterField } from '../types/fieldRegister';
import type { RelatedParty } from '../types/party';
import type { FarmingSeason } from '../types/season';
import type { FieldBookSheetResult, ParsedFieldBookSheet } from '../types/fieldOperation';

const party = (id: string, name: string) => ({ id, name, type: 'PERSON', roles: ['DRIVER'] }) as unknown as RelatedParty;
const PARTIES = [party('p-mari', 'Mari Tamm'), party('op-1', 'Test Agro OÜ')];

const field = (id: number, fieldCode: string, num: string, operatorId: string, years: number[], name = `Põld ${num}`) =>
  ({ id, fieldCode, num, operatorId, name, history: years.map((year) => ({ year })) }) as unknown as MasterField;

const SEASONS = [{ year: 2025, isLocked: true }, { year: 2026, isLocked: false }] as unknown as FarmingSeason[];

const sheet = (over: Partial<ParsedFieldBookSheet> = {}): ParsedFieldBookSheet => ({
  sheetName: '2', season: 2025, fieldCode: '61044415735', num: '2', areaHa: 7.67,
  crop: 'Talinisu allakülvita', targetYieldTonsHa: 4, actualYieldTonsHa: 3.5,
  seedingDate: '2024-09-26', harvestDate: '2025-08-07',
  operations: [
    { type: 'Taimekaitsevahendi kasutamine', dateFrom: '2025-05-02', dateTo: '2025-05-03', areaHa: 7.67, method: null,
      performerName: 'Tamm Mari', notes: null,
      products: [{ category: null, name: 'Tombo WG', kind: 'Herbitsiid', spec: null, amount: 0.2, unit: 'kg/ha', nKgHa: null, pKgHa: null, kKgHa: null, activeIngredient: null }] },
    { type: 'Taimekaitsevahendi kasutamine', dateFrom: '2025-06-06', dateTo: null, areaHa: 7.67, method: null,
      performerName: 'Tundmatu Isik', notes: null, products: [] },
    { type: 'Kündmine', dateFrom: '2025-08-10', dateTo: null, areaHa: 7.67, method: null, performerName: null, notes: null, products: [] }
  ],
  ...over
});

describe('matchPartyByName', () => {
  it('sobitab mõlemas nimejärjekorras, tõstu- ja tühikutundetult', () => {
    expect(matchPartyByName('Mari Tamm', PARTIES)?.id).toBe('p-mari');
    expect(matchPartyByName('Tamm Mari', PARTIES)?.id).toBe('p-mari');
    expect(matchPartyByName('  TAMM   mari ', PARTIES)?.id).toBe('p-mari');
  });
  it('tagastab null, kui vastet pole', () => {
    expect(matchPartyByName('Tundmatu Isik', PARTIES)).toBeNull();
  });
});

describe('buildFieldBookImport', () => {
  const masterFields = [
    field(5, '61044415735', '2', 'op-1', [2025, 2026], 'Kodu'),
    field(9, '61044415735', '2', 'op-2', [2025])
  ];
  const results: FieldBookSheetResult[] = [
    { sheetName: '2', sheet: sheet(), error: null },
    { sheetName: '7', sheet: sheet({ sheetName: '7', num: '7' }), error: null },
    { sheetName: '9', sheet: null, error: 'Loetamatu kuupäev: "eile"' }
  ];
  const { rows, payload } = buildFieldBookImport(results, { masterFields, parties: PARTIES, seasons: SEASONS, operatorId: 'op-1' });

  it('sobitab põllu valitud operaatori ja hooaja järgi', () => {
    expect(rows[0]).toMatchObject({ sheetName: '2', matched: true, fieldName: 'Kodu', operationsCount: 3, productsCount: 1, seasonLocked: true, error: null });
  });

  it('loetleb sobitamata teostajad ühekordselt', () => {
    expect(rows[0].unmatchedPerformers).toEqual(['Tundmatu Isik']);
  });

  it('märgib sobitamata põllu ja lehe vea', () => {
    expect(rows[1]).toMatchObject({ sheetName: '7', matched: false, fieldName: null });
    expect(rows[2]).toMatchObject({ sheetName: '9', matched: false, error: 'Loetamatu kuupäev: "eile"' });
  });

  it('koostab API keha ainult sobitatud põldudest, teostaja ID-ga', () => {
    expect(payload.operatorId).toBe('op-1');
    expect(payload.fields).toHaveLength(1);
    const f = payload.fields[0];
    expect(f).toMatchObject({ fieldCode: '61044415735', num: '2', season: 2025, actualYieldTonsHa: 3.5, seedingDate: '2024-09-26' });
    expect(f.operations.map((o) => o.performerId)).toEqual(['p-mari', null, null]);
    expect(f.operations[0].products[0].name).toBe('Tombo WG');
  });

  it('teise operaatori sama massiivi+numbriga põld ei sobitu', () => {
    const other = buildFieldBookImport([results[0]], { masterFields: [masterFields[1]], parties: PARTIES, seasons: SEASONS, operatorId: 'op-1' });
    expect(other.rows[0].matched).toBe(false);
    expect(other.payload.fields).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Käivita — peab ebaõnnestuma**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npm test 2>&1 | tail -15"`
Expected: FAIL — `Failed to resolve import "./fieldBookImport"`.

- [ ] **Step 3: Kirjuta `src/services/fieldBookImport.ts`**

```ts
// src/services/fieldBookImport.ts
// Põlluraamatu parsitud lehtede sobitamine registriga ja impordi API keha koostamine.
import type { MasterField } from '../types/fieldRegister';
import type { RelatedParty } from '../types/party';
import type { FarmingSeason } from '../types/season';
import type {
  FieldBookImportPayload,
  FieldBookPreviewRow,
  FieldBookSheetResult
} from '../types/fieldOperation';

const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// PRIA võib nime anda kujul "Perenimi Eesnimi"; proovime ka pööratud järjekorda.
export function matchPartyByName(name: string, parties: RelatedParty[]): RelatedParty | null {
  const n = normalizeName(name);
  if (!n) return null;
  const parts = n.split(' ');
  const candidates = new Set([
    n,
    [...parts.slice(1), parts[0]].join(' '),
    [parts[parts.length - 1], ...parts.slice(0, -1)].join(' ')
  ]);
  return parties.find((p) => candidates.has(normalizeName(p.name))) ?? null;
}

export function buildFieldBookImport(
  results: FieldBookSheetResult[],
  ctx: { masterFields: MasterField[]; parties: RelatedParty[]; seasons: FarmingSeason[]; operatorId: string }
): { rows: FieldBookPreviewRow[]; payload: FieldBookImportPayload } {
  const rows: FieldBookPreviewRow[] = [];
  const payload: FieldBookImportPayload = { operatorId: ctx.operatorId, fields: [] };

  for (const result of results) {
    const s = result.sheet;
    if (!s) {
      rows.push({
        sheetName: result.sheetName, fieldCode: null, num: null, season: null, fieldName: null,
        matched: false, operationsCount: 0, productsCount: 0, unmatchedPerformers: [],
        seasonLocked: false, error: result.error
      });
      continue;
    }

    const field = ctx.masterFields.find(
      (f) =>
        f.fieldCode === s.fieldCode &&
        (f.num || '') === s.num &&
        f.operatorId === ctx.operatorId &&
        f.history.some((h) => h.year === s.season)
    );

    const unmatched = new Set<string>();
    const operations = s.operations.map((op) => {
      const performer = op.performerName ? matchPartyByName(op.performerName, ctx.parties) : null;
      if (op.performerName && !performer) unmatched.add(op.performerName);
      return {
        type: op.type,
        dateFrom: op.dateFrom,
        dateTo: op.dateTo,
        areaHa: op.areaHa,
        method: op.method,
        performerId: performer?.id ?? null,
        notes: op.notes,
        products: op.products
      };
    });

    rows.push({
      sheetName: s.sheetName,
      fieldCode: s.fieldCode,
      num: s.num,
      season: s.season,
      fieldName: field?.name ?? null,
      matched: Boolean(field),
      operationsCount: operations.length,
      productsCount: operations.reduce((n, o) => n + o.products.length, 0),
      unmatchedPerformers: [...unmatched],
      seasonLocked: ctx.seasons.find((x) => x.year === s.season)?.isLocked ?? false,
      error: null
    });

    if (field) {
      payload.fields.push({
        fieldCode: s.fieldCode,
        num: s.num,
        season: s.season,
        targetYieldTonsHa: s.targetYieldTonsHa,
        actualYieldTonsHa: s.actualYieldTonsHa,
        seedingDate: s.seedingDate,
        harvestDate: s.harvestDate,
        operations
      });
    }
  }

  return { rows, payload };
}
```

- [ ] **Step 4: Käivita testid — peavad läbima**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npm test 2>&1 | tail -15"`
Expected: PASS (mõlemad testifailid).

- [ ] **Step 5: Tüübikontroll**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep 'error TS'"`
Expected: ainult lähtetaseme viga.

- [ ] **Step 6: Commit**

```bash
git add src/services/fieldBookImport.ts src/services/fieldBookImport.test.ts
git commit -m "$(cat <<'EOF'
Lisa põlluraamatu sobitamine põldude ja teostajatega.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Andmemudel ja teostaja kasutusloendur

**Files:**
- Modify: `prisma/schema.prisma` (`FieldSeason` ~rida 170–213, `RelatedParty` ~rida 222–241, faili lõppu uued mudelid)
- Modify: `src/server/dbApiPlugin.ts` (`/api/parties` GET `_count` ~rida 823–849)
- Modify: `src/types/party.ts`, `src/components/RelatedPartiesModal.tsx` (~rida 656–666)

**Interfaces:**
- Produces: Prisma kliendis `prisma.fieldOperation`, `prisma.fieldOperationProduct`; `RelatedParty.performedOperationsCount?: number`.

- [ ] **Step 1: Varukoopia** (vt Global Constraints).

- [ ] **Step 2: Lisa mudelid `prisma/schema.prisma` lõppu**

```prisma
// ============================================================================
// 9. PÕLLURAAMAT (FIELD OPERATIONS) — e-PRIA põlluraamatu väljavõtte import
// ============================================================================

model FieldOperation {
  id            Int       @id @default(autoincrement())
  fieldSeasonId Int
  type          String    // PRIA "Tegevus": "Väetamine", "Kündmine", ...
  dateFrom      DateTime
  dateTo        DateTime? // vahemiku lõpp; tühi, kui üks päev
  areaHa        Float?
  method        String?   // "Paisklaotamine", "Pritsimine", "Põhikultuur"
  performerId   String?   // teostaja seotud isikute registrist
  notes         String?
  sortOrder     Int
  createdAt     DateTime  @default(now())

  fieldSeason   FieldSeason             @relation(fields: [fieldSeasonId], references: [id], onDelete: Cascade)
  performer     RelatedParty?           @relation(fields: [performerId], references: [id], onDelete: SetNull)
  products      FieldOperationProduct[]

  @@index([fieldSeasonId])
  @@index([performerId])
  @@map("field_operations")
}

model FieldOperationProduct {
  id               Int     @id @default(autoincrement())
  operationId      Int
  category         String? // "Register/Materjal"
  name             String? // toode, sort või umbrohi
  kind             String? // "Liik/tüüp"
  spec             String? // "Täpsustus"
  amount           Float?
  unit             String?
  nKgHa            Float?
  pKgHa            Float?
  kKgHa            Float?
  activeIngredient String?
  sortOrder        Int

  operation        FieldOperation @relation(fields: [operationId], references: [id], onDelete: Cascade)

  @@index([operationId])
  @@map("field_operation_products")
}
```

`model FieldSeason` seoste plokki (rea `varietyEntity …` järele) lisa:

```prisma
  operations          FieldOperation[]
```

`model RelatedParty` seoste plokki (rea `fieldsAsOperator Field[]` järele) lisa:

```prisma
  performedOperations FieldOperation[]
```

- [ ] **Step 3: Rakenda skeem ja genereeri klient**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npx prisma db push --skip-generate 2>&1 | tail -4 && npx prisma generate 2>&1 | grep -i 'generated\|error'"`
Expected: "Your database is now in sync" **ilma** andmekao hoiatuseta (ainult uued tabelid) ja "Generated Prisma Client". Kui ilmub "data loss" hoiatus, peatu.

- [ ] **Step 4: Lisa teostaja kasutusloendur `/api/parties` GET-i**

`src/server/dbApiPlugin.ts` `_count.select` plokki lisa `performedOperations: true`, ja `mapped` objektis:

```ts
              operatorFieldsCount: _count.fieldsAsOperator,
              performedOperationsCount: _count.performedOperations,
              usageCount: _count.vehicles + _count.cadastralParcels + _count.poiContacts + _count.fieldsAsOperator + _count.performedOperations
```

`src/types/party.ts` — `operatorFieldsCount` järele:

```ts
  performedOperationsCount?: number; // Mitu põllutööd teostajana (põlluraamatust)
```

`src/components/RelatedPartiesModal.tsx` — seoste loetelus rea `if (party.poiContactsCount) …` järele:

```ts
                            if (party.performedOperationsCount) parts.push(`${party.performedOperationsCount} põllutööga (teostaja)`);
```

- [ ] **Step 5: Taaskäivita dev server ja kontrolli**

Taaskäivitus (vt Global Constraints), siis:
Run: `curl -s http://185.31.243.120:5173/api/parties | python3 -c "import json,sys; print([(p['name'], p.get('performedOperationsCount'), p.get('usageCount')) for p in json.load(sys.stdin)])"`
Expected: igal isikul `performedOperationsCount` = 0; `usageCount` sama mis enne.

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && psql \"\$(sed -n 's/^DATABASE_URL=\"\(.*\)?schema=public\"/\1/p' .env)\" -c '\d field_operations' -c '\d field_operation_products'"`
Expected: mõlemad tabelid FK-dega (`ON DELETE CASCADE` hooajale/tegevusele, `ON DELETE SET NULL` teostajale).

- [ ] **Step 6: Tüübikontroll** (vt Task 1 Step 8).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/server/dbApiPlugin.ts src/types/party.ts src/components/RelatedPartiesModal.tsx
git commit -m "$(cat <<'EOF'
Lisa põllutööde tabelid ja teostaja kasutusloendur.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: API — import ja päring

**Files:**
- Modify: `src/server/dbApiPlugin.ts` (uued plokid enne rida `return json(res, { error: 'Not found' }, 404);`)
- Modify: `src/services/api.ts`

**Interfaces:**
- Consumes: `FieldBookImportPayload`, `FieldBookImportResult`, `FieldOperationsResponse` (Task 1)
- Produces:
  - `POST /api/field-operations/import` → `FieldBookImportResult`
  - `GET /api/field-operations?fieldId=<number>&year=<number>` → `FieldOperationsResponse`
  - `api.importFieldBook(payload: FieldBookImportPayload): Promise<FieldBookImportResult>`
  - `api.getFieldOperations(fieldId: number | string, year: number): Promise<FieldOperationsResponse>`

- [ ] **Step 1: Lisa endpointid `src/server/dbApiPlugin.ts`**

Enne rida `return json(res, { error: 'Not found' }, 404);`:

```ts
          // 9. Põlluraamat (e-PRIA väljavõtte import)
          if (pathname === '/api/field-operations/import' && method === 'POST') {
            const body = await parseBody(req);
            const operatorId: string | undefined = body?.operatorId;
            const fieldsIn: any[] = Array.isArray(body?.fields) ? body.fields : [];
            if (!operatorId) return json(res, { error: 'operatorId on kohustuslik' }, 400);

            const toDate = (d: string | null | undefined) => (d ? new Date(d) : null);

            const result = await prisma.$transaction(
              async (tx) => {
                let imported = 0;
                let operations = 0;
                let products = 0;
                const skipped: { fieldCode: string; num: string; season: number }[] = [];

                for (const f of fieldsIn) {
                  const field = await tx.field.findFirst({
                    where: { fieldCode: String(f.fieldCode), num: String(f.num), operatorId }
                  });
                  const fieldSeason = field
                    ? await tx.fieldSeason.findUnique({
                        where: { fieldId_year: { fieldId: field.id, year: Number(f.season) } }
                      })
                    : null;
                  if (!fieldSeason) {
                    skipped.push({ fieldCode: f.fieldCode, num: f.num, season: f.season });
                    continue;
                  }

                  // Põlluraamatut rakenduses käsitsi ei muudeta — import asendab
                  // selle hooajakirje tegevused täielikult.
                  await tx.fieldOperation.deleteMany({ where: { fieldSeasonId: fieldSeason.id } });

                  const ops: any[] = Array.isArray(f.operations) ? f.operations : [];
                  for (const [i, op] of ops.entries()) {
                    const prods: any[] = Array.isArray(op.products) ? op.products : [];
                    await tx.fieldOperation.create({
                      data: {
                        fieldSeasonId: fieldSeason.id,
                        type: String(op.type),
                        dateFrom: new Date(op.dateFrom),
                        dateTo: toDate(op.dateTo),
                        areaHa: op.areaHa ?? null,
                        method: op.method ?? null,
                        performerId: op.performerId ?? null,
                        notes: op.notes ?? null,
                        sortOrder: i,
                        products: {
                          create: prods.map((p, j) => ({
                            category: p.category ?? null,
                            name: p.name ?? null,
                            kind: p.kind ?? null,
                            spec: p.spec ?? null,
                            amount: p.amount ?? null,
                            unit: p.unit ?? null,
                            nKgHa: p.nKgHa ?? null,
                            pKgHa: p.pKgHa ?? null,
                            kKgHa: p.kKgHa ?? null,
                            activeIngredient: p.activeIngredient ?? null,
                            sortOrder: j
                          }))
                        }
                      }
                    });
                    operations++;
                    products += prods.length;
                  }

                  // Tühi väärtus failis ei kustuta olemasolevat.
                  const seasonUpdate: Record<string, unknown> = {};
                  if (f.targetYieldTonsHa != null) seasonUpdate.targetYieldTonsHa = Number(f.targetYieldTonsHa);
                  if (f.actualYieldTonsHa != null) seasonUpdate.actualYieldTonsHa = Number(f.actualYieldTonsHa);
                  if (f.seedingDate) seasonUpdate.seedingDate = new Date(f.seedingDate);
                  if (f.harvestDate) seasonUpdate.harvestDate = new Date(f.harvestDate);
                  if (Object.keys(seasonUpdate).length > 0) {
                    await tx.fieldSeason.update({ where: { id: fieldSeason.id }, data: seasonUpdate });
                  }
                  imported++;
                }

                return { imported, operations, products, skipped };
              },
              { timeout: 60000 }
            );

            return json(res, { success: true, ...result });
          }

          if (pathname === '/api/field-operations' && method === 'GET') {
            const fieldId = Number(url.searchParams.get('fieldId'));
            const year = Number(url.searchParams.get('year'));
            if (!fieldId || !year) return json(res, { error: 'fieldId ja year on kohustuslikud' }, 400);

            const fieldSeason = await prisma.fieldSeason.findUnique({
              where: { fieldId_year: { fieldId, year } }
            });
            if (!fieldSeason) {
              return json(res, { targetYieldTonsHa: null, actualYieldTonsHa: null, operations: [] });
            }

            const ops = await prisma.fieldOperation.findMany({
              where: { fieldSeasonId: fieldSeason.id },
              orderBy: [{ dateFrom: 'asc' }, { sortOrder: 'asc' }],
              include: {
                products: { orderBy: { sortOrder: 'asc' } },
                performer: { select: { name: true } }
              }
            });

            const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
            return json(res, {
              targetYieldTonsHa: fieldSeason.targetYieldTonsHa,
              actualYieldTonsHa: fieldSeason.actualYieldTonsHa,
              operations: ops.map(({ performer, fieldSeasonId: _fs, performerId: _p, createdAt: _c, ...o }) => ({
                ...o,
                dateFrom: day(o.dateFrom),
                dateTo: day(o.dateTo),
                performerName: performer?.name ?? null,
                products: o.products.map(({ operationId: _op, ...p }) => p)
              }))
            });
          }
```

- [ ] **Step 2: Lisa klient `src/services/api.ts`**

Importide juurde:

```ts
import type { FieldBookImportPayload, FieldBookImportResult, FieldOperationsResponse } from '../types/fieldOperation';
```

`api` objekti lõppu (pärast `importSoilSamples`):

```ts
  async importFieldBook(payload: FieldBookImportPayload): Promise<FieldBookImportResult> {
    const res = await fetch('/api/field-operations/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Põlluraamatu import ebaõnnestus');
    }
    return res.json();
  },

  async getFieldOperations(fieldId: number | string, year: number): Promise<FieldOperationsResponse> {
    const res = await fetch(`/api/field-operations?fieldId=${encodeURIComponent(String(fieldId))}&year=${year}`);
    if (!res.ok) throw new Error('Põllutööde laadimine ebaõnnestus');
    return res.json();
  }
```

- [ ] **Step 3: Tüübikontroll** (vt Task 1 Step 8). Kui `noUnusedLocals` kaebab `_fs`/`_p`/`_c`/`_op` üle, asenda destruktureerimine eraldi `const { performer, products, ...rest } = o` ja ehita objekt käsitsi väljadega `id, type, dateFrom, dateTo, areaHa, method, notes, sortOrder` — ära lülita reeglit välja.

- [ ] **Step 4: API test (varukoopia enne!)**

Leia testiks sobiv hooajakirje (põld massiiviga `61044415735`, nr `2`, operaator `party-loisu-agro`, 2025):

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && psql \"\$(sed -n 's/^DATABASE_URL=\"\(.*\)?schema=public\"/\1/p' .env)\" -At -c \"SELECT f.id, fs.id, fs.\\\"actualYieldTonsHa\\\" FROM fields f JOIN field_seasons fs ON fs.\\\"fieldId\\\"=f.id WHERE f.\\\"fieldCode\\\"='61044415735' AND f.num='2' AND f.\\\"operatorId\\\"='party-loisu-agro' AND fs.year=2025;\""`
Expected: üks rida `<fieldId>|<fieldSeasonId>|` (saak tühi). Pane `fieldId` kirja.

Loo `._scratch/op_test.json`:

```json
{ "operatorId": "party-loisu-agro", "fields": [
  { "fieldCode": "61044415735", "num": "2", "season": 2025,
    "targetYieldTonsHa": null, "actualYieldTonsHa": null, "seedingDate": null, "harvestDate": null,
    "operations": [{ "type": "Kündmine", "dateFrom": "2025-08-10", "dateTo": null, "areaHa": 7.67,
      "method": null, "performerId": null, "notes": "TEST", "products": [] }] },
  { "fieldCode": "00000000000", "num": "1", "season": 2025,
    "targetYieldTonsHa": null, "actualYieldTonsHa": null, "seedingDate": null, "harvestDate": null, "operations": [] }
] }
```

Run (kaks korda järjest):
`curl -s -X POST -H 'Content-Type: application/json' --data @/Users/andresj/Progemine/teris/._scratch/op_test.json http://185.31.243.120:5173/api/field-operations/import`
Expected mõlemal korral: `{"success":true,"imported":1,"operations":1,"products":0,"skipped":[{"fieldCode":"00000000000","num":"1","season":2025}]}`

Run: `curl -s "http://185.31.243.120:5173/api/field-operations?fieldId=<fieldId>&year=2025"`
Expected: `operations` pikkusega **1** (kordusimport ei kahekordistanud), `dateFrom` `"2025-08-10"`, `notes` `"TEST"`.

Tagasivõtu test: muuda `._scratch/op_test.json` esimese tegevuse `"performerId": "ei-ole-olemas"` ja `"notes": "TEST2"`, POST uuesti.
Expected: HTTP 500 veaga; GET näitab endiselt ühte tegevust märkusega `"TEST"` (transaktsioon tühistati).

- [ ] **Step 5: Koristus**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && psql \"\$(sed -n 's/^DATABASE_URL=\"\(.*\)?schema=public\"/\1/p' .env)\" -c \"DELETE FROM field_operations WHERE notes IN ('TEST','TEST2');\"" && rm /Users/andresj/Progemine/teris/._scratch/op_test.json`
Expected: `DELETE 1`.

- [ ] **Step 6: Commit**

```bash
git add src/server/dbApiPlugin.ts src/services/api.ts
git commit -m "$(cat <<'EOF'
Lisa põlluraamatu impordi ja põllutööde päringu API.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Impordiaken ja ühendamine

**Files:**
- Create: `src/components/FieldBookUploadModal.tsx`
- Modify: `src/components/FieldManagerModal.tsx` (props ~rida 43/63, nupp ~rida 646)
- Modify: `src/App.tsx` (import, state ~rida 278, modali renderdus ~rida 1275)

**Interfaces:**
- Consumes: `parseFieldBookFile` (Task 2), `buildFieldBookImport` (Task 3), `api.importFieldBook` (Task 5)
- Produces: `<FieldBookUploadModal isOpen onClose onImported masterFields parties seasons />`; `FieldManagerModal` prop `onOpenFieldBookUpload?: () => void`.

- [ ] **Step 1: Kirjuta `src/components/FieldBookUploadModal.tsx`**

```tsx
// src/components/FieldBookUploadModal.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, UploadCloud, FileSpreadsheet, Check, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import type { MasterField } from '../types/fieldRegister';
import type { RelatedParty } from '../types/party';
import type { FarmingSeason } from '../types/season';
import type { FieldBookSheetResult } from '../types/fieldOperation';
import { parseFieldBookFile } from '../services/fieldBookWorkbook';
import { buildFieldBookImport } from '../services/fieldBookImport';
import { api } from '../services/api';

interface FieldBookUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  masterFields: MasterField[];
  parties: RelatedParty[];
  seasons: FarmingSeason[];
}

export const FieldBookUploadModal: React.FC<FieldBookUploadModalProps> = ({
  isOpen,
  onClose,
  onImported,
  masterFields,
  parties,
  seasons
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FieldBookSheetResult[] | null>(null);
  const [operatorId, setOperatorId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const operators = parties.filter((p) => p.roles?.includes('OPERATOR'));

  useEffect(() => {
    if (isOpen) {
      setResults(null);
      setError(null);
      if (!operatorId && operators.length === 1) setOperatorId(operators[0].id);
    }
  }, [isOpen, operators.length]);

  const built = useMemo(
    () => (results && operatorId ? buildFieldBookImport(results, { masterFields, parties, seasons, operatorId }) : null),
    [results, operatorId, masterFields, parties, seasons]
  );

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setError(null);
    setResults(null);
    setIsProcessing(true);
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Palun vali e-PRIA põlluraamatu väljavõte (.xls või .xlsx).');
      setResults(parseFieldBookFile(await file.arrayBuffer()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Viga faili lugemisel.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!built || built.payload.fields.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.importFieldBook(built.payload);
      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import ebaõnnestus.');
    } finally {
      setIsSaving(false);
    }
  };

  const rows = built?.rows ?? [];
  const matched = rows.filter((r) => r.matched);
  const seasonsInFile = [...new Set(rows.map((r) => r.season).filter((y): y is number => y !== null))].sort();
  const lockedSeasons = [...new Set(rows.filter((r) => r.seasonLocked && r.season !== null).map((r) => r.season as number))];
  const unmatchedPerformers = [...new Set(rows.flatMap((r) => r.unmatchedPerformers))];
  const opsTotal = matched.reduce((n, r) => n + r.operationsCount, 0);

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <FileSpreadsheet className="text-emerald" size={24} />
            <div>
              <h3>Impordi põlluraamat</h3>
              <p className="modal-subtitle">e-PRIA "Põlluraamatu väljavõte" (.xls) — iga leht on üks põld</p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''} ${results ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {isProcessing ? (
              <div className="dropzone-state">
                <RefreshCw size={36} className="animate-spin text-emerald" />
                <p>Loen põlluraamatut...</p>
              </div>
            ) : results ? (
              <div className="dropzone-state success">
                <FileSpreadsheet size={36} className="text-emerald" />
                <h4>{rows.length} lehte loetud</h4>
                <span className="file-reupload-hint">Klõpsa siia uue faili valimiseks</span>
              </div>
            ) : (
              <div className="dropzone-state">
                <UploadCloud size={44} className="dropzone-icon" />
                <h4>Lohista põlluraamatu väljavõte siia</h4>
                <p>või klõpsa faili valimiseks arvutist</p>
              </div>
            )}
          </div>

          {error && (
            <div className="alert-box error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {results && (
            <div className="parsed-preview-box">
              <div className="form-group" style={{ margin: '8px 0' }}>
                <label>Operaator (kelle põldudega sobitatakse) *</label>
                <select className="form-input" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
                  <option value="">-- Vali operaator --</option>
                  {operators.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {built && (
                <>
                  <div className="preview-header">
                    <strong>
                      {rows.length} põldu, hooaeg {seasonsInFile.join(', ')} · {matched.length} sobitatud · {opsTotal} tegevust
                      {unmatchedPerformers.length > 0 ? ` · ${unmatchedPerformers.length} sobitamata teostajat` : ''}
                    </strong>
                  </div>

                  {lockedSeasons.length > 0 && (
                    <div className="alert-box">
                      <Lock size={16} />
                      <span>Hooaeg {lockedSeasons.join(', ')} on lukus — import lisab arhiiviandmed.</span>
                    </div>
                  )}

                  {unmatchedPerformers.length > 0 && (
                    <div className="alert-box error">
                      <AlertCircle size={16} />
                      <span>
                        Seotud isikute registris puuduvad teostajad: {unmatchedPerformers.join(', ')}. Nende tegevused
                        imporditakse ilma teostajata — lisa isik registrisse ja impordi uuesti, kui soovid seost.
                      </span>
                    </div>
                  )}

                  <div className="preview-fields-scroll">
                    {rows.map((row) => (
                      <div key={row.sheetName} className="preview-field-row">
                        <div className="p-title">
                          <strong>
                            {row.matched ? '✓' : '✗'} Nr {row.num ?? row.sheetName}
                            {row.fieldName ? ` · ${row.fieldName}` : ''}
                          </strong>
                          <span className="p-crop">
                            {row.error
                              ? `Viga: ${row.error}`
                              : row.matched
                                ? `${row.fieldCode} · ${row.operationsCount} tegevust · ${row.productsCount} toodet`
                                : `${row.fieldCode} · põldu selle operaatori ja hooajaga ei leitud — jäetakse vahele`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Loobu</button>
          {built && matched.length > 0 && (
            <button className="btn btn-primary" onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
              <span>Impordi {matched.length} põllu tööd hooajale {seasonsInFile.join(', ')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Nupp põldude registris `src/components/FieldManagerModal.tsx`**

Props-liidesesse `onOpenSoilUpload?: () => void;` järele: `onOpenFieldBookUpload?: () => void;`. Destruktureerimisse `onOpenSoilUpload,` järele: `onOpenFieldBookUpload,`. Tööriistaribal `{onOpenSoilUpload && (...)}` ploki järele:

```tsx
              {onOpenFieldBookUpload && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    onClose();
                    onOpenFieldBookUpload();
                  }}
                  title="Impordi e-PRIA põlluraamatu väljavõte (.xls)"
                >
                  <Plus size={14} />
                  <span>Impordi põlluraamat</span>
                </button>
              )}
```

- [ ] **Step 3: Ühenda `src/App.tsx`**

Importide juurde (rea `import { SoilSampleUploadModal } …` järele):

```tsx
import { FieldBookUploadModal } from './components/FieldBookUploadModal';
```

State (rea `const [isSoilUploadOpen, setIsSoilUploadOpen] = useState(false);` järele):

```tsx
  const [isFieldBookUploadOpen, setIsFieldBookUploadOpen] = useState(false);
```

`<FieldManagerModal` propsidesse `onOpenSoilUpload={…}` järele:

```tsx
        onOpenFieldBookUpload={() => setIsFieldBookUploadOpen(true)}
```

`<SoilSampleUploadModal … />` järele:

```tsx
      <FieldBookUploadModal
        isOpen={isFieldBookUploadOpen}
        onClose={() => setIsFieldBookUploadOpen(false)}
        onImported={() => {
          api.getMasterFields().then(setMasterFields).catch((err) => console.error('Põldude uuendamine ebaõnnestus:', err));
        }}
        masterFields={masterFields}
        parties={parties}
        seasons={seasons}
      />
```

(NB: `masterFields={masterFields}` — **kõik** põllud, mitte operaatori filtriga `operatorMasterFields`; operaatori valib aken ise.)

- [ ] **Step 4: Tüübikontroll ja HMR**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep 'error TS'; tail -3 /tmp/teris_dev.log"` ja `curl -s -o /dev/null -w '%{http_code}\n' http://185.31.243.120:5173/`
Expected: ainult lähtetaseme viga; HMR uuendused ilma vigadeta; `200`.

- [ ] **Step 5: Commit**

```bash
git add src/components/FieldBookUploadModal.tsx src/components/FieldManagerModal.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
Lisa põlluraamatu impordiaken põldude registrisse.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: "Põllutööd" jaotis põllu kaardil

**Files:**
- Create: `src/components/FieldOperationsSection.tsx`
- Modify: `src/components/FieldDetailsDrawer.tsx` (enne `{/* Notes */}` plokki ~rida 305)
- Modify: `src/index.css` (`.section-subtitle` / `.detail-section` reeglite järele ~rida 1135)

**Interfaces:**
- Consumes: `api.getFieldOperations` (Task 5), `FieldOperationsResponse`, `FieldOperationDto` (Task 1)
- Produces: `<FieldOperationsSection fieldId={number | string} year={number} />`

- [ ] **Step 1: Kirjuta `src/components/FieldOperationsSection.tsx`**

```tsx
// src/components/FieldOperationsSection.tsx
import React, { useEffect, useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import type { FieldOperationsResponse, FieldOperationProductDto } from '../types/fieldOperation';
import { api } from '../services/api';

interface FieldOperationsSectionProps {
  fieldId: number | string;
  year: number;
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

const productLine = (p: FieldOperationProductDto) => {
  const parts = [p.name, p.kind, p.spec].filter(Boolean) as string[];
  if (p.amount !== null) parts.push(`${fmtNum(p.amount)}${p.unit ? ` ${p.unit}` : ''}`);
  const npk = [p.nKgHa !== null ? `N ${fmtNum(p.nKgHa)}` : '', p.pKgHa !== null ? `P ${fmtNum(p.pKgHa)}` : '', p.kKgHa !== null ? `K ${fmtNum(p.kKgHa)}` : '']
    .filter(Boolean)
    .join(' ');
  if (npk) parts.push(npk);
  if (p.activeIngredient) parts.push(`toimeaine ${p.activeIngredient}`);
  return parts.join(' · ');
};

export const FieldOperationsSection: React.FC<FieldOperationsSectionProps> = ({ fieldId, year }) => {
  const [data, setData] = useState<FieldOperationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set());

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    api
      .getFieldOperations(fieldId, year)
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Laadimine ebaõnnestus'));
    return () => {
      active = false;
    };
  }, [fieldId, year]);

  const toggleNotes = (id: number) =>
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ops = data?.operations ?? [];
  const nTotal = ops.reduce((sum, o) => sum + o.products.reduce((s, p) => s + (p.nKgHa ?? 0), 0), 0);
  const summary = [
    `${ops.length} tegevust`,
    nTotal > 0 ? `N ${Math.round(nTotal)} kg/ha` : '',
    data?.actualYieldTonsHa != null || data?.targetYieldTonsHa != null
      ? `saak ${data?.actualYieldTonsHa != null ? fmtNum(data.actualYieldTonsHa) : '–'} / ${data?.targetYieldTonsHa != null ? fmtNum(data.targetYieldTonsHa) : '–'} t/ha`
      : ''
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="detail-section">
      <div className="section-subtitle">
        <ClipboardList size={14} />
        <span>Põllutööd {year}</span>
      </div>

      {error && <p className="notes-text">{error}</p>}
      {!error && !data && <p className="notes-text">Laadin...</p>}
      {data && ops.length === 0 && <p className="notes-text">Selle hooaja põllutöid pole imporditud.</p>}

      {ops.length > 0 && (
        <>
          <div className="field-op-summary">{summary}</div>
          <ul className="field-ops-list">
            {ops.map((op) => (
              <li key={op.id} className="field-op-item">
                <div className="field-op-head">
                  <span className="field-op-date">{op.dateTo ? `${fmtDate(op.dateFrom)} – ${fmtDate(op.dateTo)}` : fmtDate(op.dateFrom)}</span>
                  <span className="field-op-type">{op.type}</span>
                </div>
                {(op.method || op.performerName) && (
                  <div className="field-op-meta">{[op.method, op.performerName].filter(Boolean).join(' · ')}</div>
                )}
                {op.products.map((p) => (
                  <div key={p.id} className="field-op-product">{productLine(p)}</div>
                ))}
                {op.notes && (
                  <button type="button" className="field-op-notes-toggle" onClick={() => toggleNotes(op.id)}>
                    {openNotes.has(op.id) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    <span>Märkused</span>
                  </button>
                )}
                {op.notes && openNotes.has(op.id) && <div className="field-op-notes">{op.notes}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Lisa jaotis `src/components/FieldDetailsDrawer.tsx`**

Importide juurde:

```tsx
import { FieldOperationsSection } from './FieldOperationsSection';
```

Enne rida `{/* Notes */}`:

```tsx
        {props.year && <FieldOperationsSection fieldId={props.id} year={props.year} />}
```

- [ ] **Step 3: Lisa stiilid `src/index.css`** (reegli `.detail-section { margin-top: 14px; }` järele)

```css
.field-op-summary {
  font-size: 0.74rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.field-ops-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.field-op-item {
  background: var(--stat-bg);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
}

.field-op-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 0.76rem;
}

.field-op-date {
  color: var(--text-secondary);
  white-space: nowrap;
}

.field-op-type {
  font-weight: 700;
  color: var(--text-primary);
}

.field-op-meta,
.field-op-product {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.field-op-notes-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 3px;
  background: none;
  border: none;
  padding: 0;
  font-size: 0.68rem;
  color: var(--emerald-500);
  cursor: pointer;
}

.field-op-notes {
  font-size: 0.7rem;
  color: var(--text-primary);
  margin-top: 3px;
  font-style: italic;
}
```

- [ ] **Step 4: Tüübikontroll ja HMR** (vt Task 6 Step 4).

- [ ] **Step 5: Commit**

```bash
git add src/components/FieldOperationsSection.tsx src/components/FieldDetailsDrawer.tsx src/index.css
git commit -m "$(cat <<'EOF'
Kuva põllu kaardil hooaja põllutööd.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Päris faili import ja kontroll

Kood selles etapis ei muutu — see on andmete import ja lõppkontroll. Kui kasutaja eelistab importida ise impordiaknast, jäta Step 3 vahele ja tee Step 1–2 ning 4–6 pärast tema importi.

**Files:**
- Create (ei commit'ita): `._scratch/run_fieldbook_import.mts`

- [ ] **Step 1: Varukoopia** (vt Global Constraints). Pane ajatempel kirja.

- [ ] **Step 2: Teiste hooajakirjete hetktõmmis**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && psql \"\$(sed -n 's/^DATABASE_URL=\"\(.*\)?schema=public\"/\1/p' .env)\" -At -c \"SELECT md5(string_agg(fs.id||':'||fs.year||':'||fs.crop||':'||coalesce(fs.\\\"actualYieldTonsHa\\\"::text,'')||':'||coalesce(fs.\\\"seedingDate\\\"::text,''), ',' ORDER BY fs.id)) FROM field_seasons fs WHERE fs.year <> 2025;\""`
Expected: üks md5 väärtus — pane kirja.

- [ ] **Step 3: Impordi skriptiga**

`._scratch/run_fieldbook_import.mts`:

```ts
import { readFileSync } from 'fs';
import { parseFieldBookFile } from '../src/services/fieldBookWorkbook.ts';
import { buildFieldBookImport } from '../src/services/fieldBookImport.ts';

const BASE = 'http://localhost:5173';
const get = async (p: string) => (await fetch(BASE + p)).json();

const buf = readFileSync(new URL('./polluraamat_valjavote_24_09_2026.xls', import.meta.url));
const results = parseFieldBookFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const [masterFields, parties, seasons] = await Promise.all([get('/api/master-fields'), get('/api/parties'), get('/api/seasons')]);
const { rows, payload } = buildFieldBookImport(results, { masterFields, parties, seasons, operatorId: 'party-loisu-agro' });

console.log('lehti', rows.length, 'sobitatud', rows.filter((r) => r.matched).length, 'vigu', rows.filter((r) => r.error).length);
console.log('tegevusi', payload.fields.reduce((n, f) => n + f.operations.length, 0));
console.log('sobitamata teostajaid', [...new Set(rows.flatMap((r) => r.unmatchedPerformers))].length);

const res = await fetch(BASE + '/api/field-operations/import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
console.log('import', res.status, await res.text());
```

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && npx tsx ._scratch/run_fieldbook_import.mts"`
Expected: `lehti 31 sobitatud 31 vigu 0`, `tegevusi 325`, `import 200 {"success":true,"imported":31,"operations":325,"products":<N>,"skipped":[]}`. Sobitamata teostajate arv teata kasutajale (nimesid väljundisse ei logi — ainult arv).

- [ ] **Step 4: Kontrolli andmebaasis**

Run: `ssh uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && psql \"\$(sed -n 's/^DATABASE_URL=\"\(.*\)?schema=public\"/\1/p' .env)\" -c \"SELECT COUNT(*) ops, COUNT(DISTINCT \\\"fieldSeasonId\\\") seasons, COUNT(\\\"performerId\\\") with_performer FROM field_operations;\" -c \"SELECT COUNT(*) FILTER (WHERE \\\"actualYieldTonsHa\\\" IS NOT NULL OR \\\"targetYieldTonsHa\\\" IS NOT NULL) with_yield, COUNT(*) FILTER (WHERE \\\"seedingDate\\\" IS NOT NULL) with_seeding, COUNT(*) FILTER (WHERE \\\"harvestDate\\\" IS NOT NULL) with_harvest FROM field_seasons WHERE year=2025;\""`
Expected: `ops 325`, `seasons 31`; `with_yield 18`; külvi/koristuse arvud teata kasutajale.

- [ ] **Step 5: Kordusimport ja teiste hooaegade puutumatus**

Käivita Step 3 skript uuesti.
Expected: sama vastus; Step 4 esimene päring näitab endiselt `ops 325` (ei kahekordistunud).
Käivita Step 2 päring uuesti.
Expected: md5 **sama** mis Step 2-s.

- [ ] **Step 6: Koristus ja üleandmine**

Run: `rm /Users/andresj/Progemine/teris/._scratch/run_fieldbook_import.mts /Users/andresj/Progemine/teris/._scratch/check_fieldbook.mts`
Päris faili `._scratch/polluraamat_valjavote_24_09_2026.xls` kustutamise otsustab kasutaja (vaja 2. etapi arenduseks). Kasutajale: palu avada mõni 2025 põld kaardil ja vaadata jaotist "Põllutööd 2025" (brauseri kontroll, mida agent ise teha ei saa) ning mainida sobitamata teostajate arv.
