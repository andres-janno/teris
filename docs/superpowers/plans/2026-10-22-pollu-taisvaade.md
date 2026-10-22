# Põllu täisvaade ja PRIA põlluraamat Terise töödes — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terise tööd (plaan) ja kanded (tegelik) kannavad PRIA e-põlluraamatu andmeid; PRIA väljavõtte import loob neist töid + kandeid; uus põllu täisvaade asendab põllu popup'i.

**Architecture:** Töötüübid = PRIA 29 tegevust. `field_works` muutub üheks planeeritud tegevuseks (unikaalsus tüübi kohta kaob, plaanil kuupäevad + read `field_work_lines`); `work_entries`/`work_entry_lines` saavad PRIA väljad. Import (`POST /api/field-book/import`) sobitab PRIA rea olemasoleva tööga (sama tüüp, ±2 päeva, taimekaitsel/väetamisel ühine toode) või loob töö + kande. Olemasolevad `field_operations` viiakse skriptiga üle ja tabelid kustutatakse. `FieldFullView` asendab `FieldDetailsDrawer`'i.

**Tech Stack:** React 19 + TypeScript + Vite 8, `node:http` server (`src/server`), Prisma 6 + PostgreSQL (RLS), Vitest, SheetJS.

**Spec:** `docs/superpowers/specs/2026-10-22-pollu-taisvaade-design.md`

## Global Constraints

- Kood asub serveris; kohalik `/Users/andresj/Progemine/teris` on sshfs-mount samast kaustast. Faile muuda kohalikult (Edit/Write), **kõik käsud** (npm, npx, git, psql) jooksevad serveris:
  `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`
- Andmebaasi ühendus käsureal: `set -a && . ./.env && set +a` ja siis `psql "${MIGRATE_DATABASE_URL%%\?*}"` (tabelite omanik). Ettevõtte andmete päringuks lisa esimeseks käsuks `-c "select set_config('app.tenant_id','tenant-loisu-agro',false)"` (RLS). Paroole ei kirjutata faili.
- Varukoopia enne iga andmeid muutvat sammu (skeem, migratsioon, üleviimine):
  `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1'`
- Skeemimuudatus: `npx prisma db push` ja `npx prisma generate`. Uue ettevõttepõhise tabeli puhul lisa see `scripts/tenancy/02-rls.sql` loendisse ja käivita `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql` ning `MIGRATE_DATABASE_URL=… npx tsx scripts/tenancy/05-tenant-fk-triggers.mts` (vt faili päis).
- Tüübikontroll: `npx tsc --noEmit -p tsconfig.app.json`. Testid: `npx vitest run <fail>`; kõik: `npm test`.
- Iga ülesande lõpus: commit (ainult nimetatud failid, `git add <failid>`) ja `npm run release` (tüübikontroll + testid + build + teenuse taaskäivitus). Commit-sõnum eesti keeles, lõpus rida `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Identifikaatorid (muutujad, failid, CSS klassid, URL-id, enumid) inglise keeles; koodikommentaarid ja UI-tekst eesti keeles. PRIA klassifikaatori väärtused (nt `"Taimekaitsevahendi kasutamine"`) on andmed ja jäävad eesti keelde.
- Kuupäevad UI-s `pp.kk.aaaa` (`formatDate`, `formatDateRange` failist `src/services/dateFormat.ts`), sisestus `DateInput` komponendiga — mitte natiivne `type="date"`.
- Isikuandmed: päris PRIA faile (`~/Downloads/pria/*.xls`) ega neis olevaid nimesid ei commit'ita; testides väljamõeldud nimed ("Testija Tõnu", "Mari Tamm").
- Sobivustolerants: **2 päeva** (`MATCH_TOLERANCE_DAYS = 2`).
- Server impordib jagatud puhtaid mooduleid kujul `'../services/x.ts'` (`.ts` laiendiga), nagu `src/server/fieldWorks.ts` teeb `'./fieldWorkRules.ts'`-iga.

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `priaCode`, `WorkSource`, `OBSERVATION`, `FieldWork` plaaniväljad, `FieldWorkLine`, kande ja rea PRIA väljad |
| `scripts/tenancy/02-rls.sql` | `field_work_lines` RLS loendisse |
| `src/services/pria.ts` (uus) | PRIA klassifikaatorid (29 tegevust, viisid, kategooriad, saagi/kultuuri tüübid, seire ühikud) + puhtad abifunktsioonid (ühik, kogus ha ↔ kokku, kuupäevade vahe, nimevõti) |
| `src/services/pria.test.ts` (uus) | testid |
| `src/server/fieldWorkRules.ts` | `LineDraft` PRIA atribuutidega, `buildEntryLines` (vaatlused, saagi tüübid), `mergeLines` võti, `summarizeLines` jätab OBSERVATION välja, `templateWorksToCreate` |
| `src/server/fieldWorkRules.test.ts` | testid |
| `src/server/workTypeMigration.ts` (uus) | puhas `splitRepeatedWork` |
| `src/server/workTypeMigration.test.ts` (uus) | testid |
| `scripts/pria-work-types.mts` (uus) | töötüüpide migratsioon ettevõtetele ja kataloogile |
| `src/server/fieldWorks.ts` | mall loendi järgi, tööde plaan + read, kande PRIA väljad, `GET /api/field-season-works` |
| `src/types/fieldWork.ts` | tüübid: plaan, read, PRIA atribuudid |
| `src/server/fieldBookRules.ts` (uus) | puhas sobitamine `findMatchingWork` ja PRIA rea → read `operationLines` |
| `src/server/fieldBookRules.test.ts` (uus) | testid |
| `src/server/fieldBookImport.ts` (uus) | põllu-hooaja impordi kirjutaja `importFieldSeasonOperations` (tx) |
| `src/server/apiHandler.ts` | `POST /api/field-book/import` (asendab vana) |
| `src/services/api.ts` | `importFieldBook` uus URL/tulemus, `getFieldSeasonWorks`, plaani API |
| `src/services/fieldBookImport.ts`, `src/components/FieldBookUploadModal.tsx` | eelvaate tekstid uue loogika järgi |
| `scripts/pria-to-field-works.mts` (uus) | `field_operations` → tööd + kanded |
| `src/components/FieldOverviewPanel.tsx` (uus) | popup'i vasaku osa sisu (tõstetud `FieldDetailsDrawer`'ist) |
| `src/components/FieldWorksTimeline.tsx` (uus) | täisvaate parem veerg |
| `src/components/FieldFullView.tsx` (uus) | täisvaade (päis, hooaeg, kaks veergu) |
| `src/components/PriaLinesEditor.tsx` (uus) | PRIA ridade sisestus (materjal/saak/seire) tegevuse järgi |
| `src/components/FieldWorkPlanDialog.tsx` (uus) | töö plaani lisamine/muutmine |
| `src/components/FieldWorkEntryDialog.tsx` | PRIA väljad, `occurrenceNo` välja, plaanist eeltäitmine |
| `src/components/FieldWorksBoard.tsx`, `AddFieldWorkDialog.tsx`, `WorkRegisterModal.tsx`, `src/admin/CatalogView.tsx`, `src/server/platformApi.ts` | kordumise eemaldus, sama tüübi mitu tööd |
| `src/App.tsx`, `src/index.css` | täisvaate ühendamine ja stiilid |
| Kustutatakse (ülesanne 13) | `FieldDetailsDrawer.tsx`, `FieldOperationsSection.tsx`, `/api/field-operations*`, `field_operations*` tabelid ja DTO-tüübid |

---

### Task 1: Andmebaasi skeem

**Files:**
- Modify: `prisma/schema.prisma` (mudelid `WorkType`, `CatalogWorkType`, `FieldWork`, `WorkEntry`, `WorkEntryLine`, `Material`, `RelatedParty`, enum `WorkEntryLineKind`)
- Modify: `scripts/tenancy/02-rls.sql:7-13`

**Interfaces:**
- Produces: Prisma mudel `FieldWorkLine` (`prisma.fieldWorkLine`), enum `WorkSource` (`'MANUAL' | 'PRIA_IMPORT'`), `WorkEntryLineKind.OBSERVATION`, väljad allpool. Kõik järgmised ülesanded eeldavad neid nimesid.

- [ ] **Step 1: Varukoopia** (Global Constraints käsk). Pane failinimi kirja.

- [ ] **Step 2: Muuda skeemi**

`enum WorkEntryLineKind` lõppu:
```prisma
  OBSERVATION // seire leid (ei osale finantsis)
```

`enum FinanceStatus` järele uus enum:
```prisma
enum WorkSource {
  MANUAL // Terises loodud (käsitsi või mallist)
  PRIA_IMPORT // PRIA põlluraamatu väljavõtte impordist
}
```

`model WorkType` — `usesMaterials` rea järele:
```prisma
  priaCode      String? // PRIA e-põlluraamatu tegevus, nt "Taimekaitsevahendi kasutamine"
```
ja `@@unique([tenantId, name])` järele:
```prisma
  @@unique([tenantId, priaCode])
```

`model CatalogWorkType` — `usesMaterials` rea järele:
```prisma
  priaCode      String?        @unique // PRIA e-põlluraamatu tegevus
```

`model FieldWork` — `notes` rea järele:
```prisma
  plannedDateFrom DateTime? // planeeritud algus (PRIA "Kuupäev")
  plannedDateTo   DateTime? // planeeritud lõpp; tühi = üks päev
  plannedAreaHa   Float? // planeeritud pindala; tühi = põllu pindala
  method          String? // väetamisviis jms: "Paisklaotamine", "Pritsimine"
  plannedWorkerId String? // planeeritud teostaja (taimekaitse)
  source          WorkSource @default(MANUAL)
```
relatsioonide hulka (`entries` järele):
```prisma
  plannedWorker RelatedParty?   @relation("FieldWorkPlannedWorker", fields: [plannedWorkerId], references: [id], onDelete: SetNull)
  lines         FieldWorkLine[]
```
ja asenda `@@unique([fieldSeasonId, workTypeId])` reaga:
```prisma
  @@index([fieldSeasonId, workTypeId]) // sama tüüpi töid võib põllul olla mitu
  @@index([plannedWorkerId])
```

Uus mudel `FieldWork` järele:
```prisma
// Töö plaani rida: planeeritud materjal (norm ha kohta) või saak
model FieldWorkLine {
  id               String            @id @default(cuid())
  tenantId         String            @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  fieldWorkId      String
  kind             WorkEntryLineKind // MATERIAL | HARVEST
  materialId       String?
  label            String
  ratePerHa        Float? // kogus ha kohta
  unit             String // kg, l, t, g, tk
  priaRegister     String? // "Väetis registrist", "Eesti sordiregister", "Märgaja/kleepaine", ...
  priaKind         String? // "Herbitsiid", "NPK väetis", "Suvinisu"; saagil saagi tüüp ("Terad")
  priaSpec         String? // seemne kategooria ("C1"); saagil kultuuri tüüp ("Põhikultuur")
  activeIngredient String? // toimeaine
  nKgHa            Float?
  pKgHa            Float?
  kKgHa            Float?
  sortOrder        Int               @default(0)

  fieldWork FieldWork @relation(fields: [fieldWorkId], references: [id], onDelete: Cascade)
  material  Material? @relation(fields: [materialId], references: [id], onDelete: Restrict)

  @@index([fieldWorkId])
  @@index([materialId])
  @@index([tenantId])
  @@map("field_work_lines")
}
```

`model WorkEntry` — `notes` rea järele:
```prisma
  dateTo               DateTime? // vahemiku lõpp (PRIA "27.04.2026 - 30.04.2026"); tühi = üks päev
  method               String? // tegelik viis (väetamisviis jms)
  source               WorkSource    @default(MANUAL)
```

`model WorkEntryLine` — `confirmedQuantity` rea järele:
```prisma
  ratePerHa         Float? // kogus ha kohta
  priaRegister      String? // vt FieldWorkLine; seirel seire liik ("Umbrohud")
  priaKind          String?
  priaSpec          String?
  activeIngredient  String?
  nKgHa             Float?
  pKgHa             Float?
  kKgHa             Float?
```

`model Material` relatsioonide hulka:
```prisma
  fieldWorkLines FieldWorkLine[]
```

`model RelatedParty` relatsioonide hulka:
```prisma
  plannedFieldWorks FieldWork[] @relation("FieldWorkPlannedWorker")
```

- [ ] **Step 3: RLS loend** — `scripts/tenancy/02-rls.sql` massiivis asenda `'field_works','work_entries','work_entry_lines',` reaga `'field_works','field_work_lines','work_entries','work_entry_lines',`.

- [ ] **Step 4: Rakenda**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx prisma db push && npx prisma generate && set -a && . ./.env && set +a && psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```
Expected: `db push` ütleb "Your database is now in sync"; kui ta küsib kinnitust unikaalsuse eemaldamiseks, see on andmeid mitte kaotav — käivita uuesti `--accept-data-loss` lipuga ainult siis, kui teade puudutab ainult `field_works_fieldSeasonId_workTypeId_key` indeksit. Trigerite skript trükib loodud trigerid, sh `field_work_lines`.

- [ ] **Step 5: Kontrolli**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm test'
```
Expected: tüübikontroll ilma uute vigadeta, testid läbivad (`tenantIsolation.test.ts` kontrollib ka uut tabelit).

- [ ] **Step 6: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add prisma/schema.prisma scripts/tenancy/02-rls.sql && git commit -m "Skeem: PRIA tegevused töötüüpidel, töö plaan ja plaaniread, kande PRIA väljad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 2: PRIA klassifikaator ja abifunktsioonid

**Files:**
- Create: `src/services/pria.ts`
- Test: `src/services/pria.test.ts`

**Interfaces:**
- Consumes: `WorkPhase`, `MaterialCategory` (`src/types/fieldWork.ts`).
- Produces (kasutavad ülesanded 3–12):
  - `interface PriaActivity { name: string; phase: WorkPhase; usesMaterials: boolean; sortOrder: number }`
  - `PRIA_ACTIVITIES: readonly PriaActivity[]` (29)
  - `PRIA_ACTIVITY = { SOWING: 'Külvamine/istutamine', HARVEST: 'Saagikoristus', FERTILIZING: 'Väetamine', LIMING: 'Lupjamine', PLANT_PROTECTION: 'Taimekaitsevahendi kasutamine', MONITORING: 'Seire' } as const`
  - `LEGACY_WORK_TYPE_MAP: Readonly<Record<string, string>>`
  - `FERTILIZING_METHODS`, `SEED_REGISTERS`, `SEED_CATEGORIES`, `FERTILIZER_REGISTERS`, `LIMING_REGISTERS`, `PLANT_PROTECTION_REGISTERS`, `CROP_TYPES`, `YIELD_TYPES`: `readonly string[]`; `OBSERVATION_UNITS: Readonly<Record<string, string>>`
  - `interface PriaAttrs { priaRegister: string | null; priaKind: string | null; priaSpec: string | null; activeIngredient: string | null; nKgHa: number | null; pKgHa: number | null; kKgHa: number | null }`
  - `EMPTY_PRIA_ATTRS: PriaAttrs`
  - `materialCategoryFor(activity: string, priaRegister?: string | null): MaterialCategory`
  - `baseUnit(unit: string | null | undefined): string`
  - `round2(n: number): number`
  - `totalFromRate(rate: number | null, areaHa: number | null): number | null`
  - `rateFromTotal(total: number | null, areaHa: number | null): number | null`
  - `nameKey(s: string | null | undefined): string`
  - `daysApart(a: { from: string; to: string | null }, b: { from: string; to: string | null }): number`

- [ ] **Step 1: Kirjuta test** `src/services/pria.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  PRIA_ACTIVITIES, LEGACY_WORK_TYPE_MAP, materialCategoryFor, baseUnit, totalFromRate, rateFromTotal, nameKey, daysApart
} from './pria';

describe('PRIA_ACTIVITIES', () => {
  it('sisaldab kõiki 29 tegevust unikaalsete nimedega', () => {
    expect(PRIA_ACTIVITIES).toHaveLength(29);
    expect(new Set(PRIA_ACTIVITIES.map((a) => a.name)).size).toBe(29);
  });
  it('vanad töötüübid viitavad olemasolevatele PRIA tegevustele', () => {
    const names = new Set(PRIA_ACTIVITIES.map((a) => a.name));
    for (const target of Object.values(LEGACY_WORK_TYPE_MAP)) expect(names.has(target)).toBe(true);
    expect(LEGACY_WORK_TYPE_MAP['Kõrrekoorimine']).toBe('Randaalimine');
    expect(LEGACY_WORK_TYPE_MAP['Leheväetamine']).toBe('Väetamine');
    expect(LEGACY_WORK_TYPE_MAP['Umbrohutõrje (enne külvi)']).toBe('Taimekaitsevahendi kasutamine');
  });
});

describe('materialCategoryFor', () => {
  it('kategooria tegevuse järgi', () => {
    expect(materialCategoryFor('Külvamine/istutamine')).toBe('SEED');
    expect(materialCategoryFor('Väetamine')).toBe('FERTILIZER');
    expect(materialCategoryFor('Lupjamine')).toBe('FERTILIZER');
    expect(materialCategoryFor('Taimekaitsevahendi kasutamine', 'Märgaja/kleepaine')).toBe('PLANT_PROTECTION');
    expect(materialCategoryFor('Kündmine')).toBe('OTHER');
  });
});

describe('ühikud ja kogused', () => {
  it('baseUnit eemaldab /ha', () => {
    expect(baseUnit('kg/ha')).toBe('kg');
    expect(baseUnit('l/ha')).toBe('l');
    expect(baseUnit('taime/m2')).toBe('taime/m2');
    expect(baseUnit(null)).toBe('');
  });
  it('kogus ha ↔ kokku kahe komakohaga', () => {
    expect(totalFromRate(250, 2.42)).toBe(605);
    expect(totalFromRate(0.15, 2.42)).toBe(0.36);
    expect(rateFromTotal(605, 2.42)).toBe(250);
    expect(totalFromRate(null, 2.42)).toBeNull();
    expect(rateFromTotal(10, 0)).toBeNull();
  });
});

describe('nameKey', () => {
  it('tõstutundetu ja tühikud normaliseeritud', () => {
    expect(nameKey('  Tombo   WG ')).toBe('tombo wg');
    expect(nameKey(null)).toBe('');
  });
});

describe('daysApart', () => {
  it('lõikuvad vahemikud → 0', () => {
    expect(daysApart({ from: '2026-04-27', to: '2026-04-30' }, { from: '2026-04-28', to: null })).toBe(0);
  });
  it('päevade vahe lähimate otste vahel', () => {
    expect(daysApart({ from: '2026-04-27', to: '2026-04-30' }, { from: '2026-05-02', to: null })).toBe(2);
    expect(daysApart({ from: '2026-05-10', to: null }, { from: '2026-05-01', to: '2026-05-07' })).toBe(3);
  });
});
```

- [ ] **Step 2: Käivita, peab kukkuma**

`ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/pria.test.ts'` → FAIL (moodul puudub).

- [ ] **Step 3: Kirjuta** `src/services/pria.ts`:

```ts
// src/services/pria.ts — PRIA e-põlluraamatu klassifikaatorid ja puhtad abifunktsioonid
// (kasutavad nii klient kui server). Väärtused on PRIA andmed ja jäävad eesti keelde.
import type { MaterialCategory, WorkPhase } from '../types/fieldWork';

export interface PriaActivity {
  name: string;
  phase: WorkPhase;
  usesMaterials: boolean;
  sortOrder: number;
}

const A = (name: string, phase: WorkPhase, usesMaterials = false) => ({ name, phase, usesMaterials });

// PRIA e-põlluraamatu 29 tegevust (järjekord töö loogika järgi)
export const PRIA_ACTIVITIES: readonly PriaActivity[] = [
  A('Kündmine', 'PREPARATION'),
  A('Kultiveerimine', 'PREPARATION'),
  A('Randaalimine', 'PREPARATION'),
  A('Libistamine', 'PREPARATION'),
  A('Äestamine', 'PREPARATION'),
  A('Freesimine', 'PREPARATION'),
  A('Sügavkobestamine', 'PREPARATION'),
  A('Vagude moodustamine', 'PREPARATION'),
  A('Kivikorjamine', 'PREPARATION'),
  A('Rullimine', 'PREPARATION'),
  A('Lupjamine', 'PREPARATION', true),
  A('Külvamine/istutamine', 'SOWING', true),
  A('Väetamine', 'CARE', true),
  A('Taimekaitsevahendi kasutamine', 'CARE', true),
  A('Seire', 'CARE'),
  A('Vaheltharimine', 'CARE'),
  A('Leegitamine', 'CARE'),
  A('Istandike hooldus', 'CARE'),
  A('Kastmine', 'CARE'),
  A('Purustusniide (hekseldamine)', 'CARE'),
  A('Niitmine', 'CARE'),
  A('Kaarutamine', 'CARE'),
  A('Vaalutamine', 'CARE'),
  A('Karjatamine', 'CARE'),
  A('Maaparandushoiutööd', 'CARE'),
  A('Sõnniku aunastamine', 'CARE'),
  A('Mullaproovi võtmine', 'CARE'),
  A('Saagikoristus', 'HARVEST'),
  A('Saagi vedu põllult', 'HARVEST')
].map((a, i) => ({ ...a, sortOrder: i }));

export const PRIA_ACTIVITY = {
  SOWING: 'Külvamine/istutamine',
  HARVEST: 'Saagikoristus',
  FERTILIZING: 'Väetamine',
  LIMING: 'Lupjamine',
  PLANT_PROTECTION: 'Taimekaitsevahendi kasutamine',
  MONITORING: 'Seire'
} as const;

// Enne PRIA klassifikaatorit kasutatud töötüübid → PRIA tegevus (migratsioon)
export const LEGACY_WORK_TYPE_MAP: Readonly<Record<string, string>> = {
  'Kõrrekoorimine': 'Randaalimine',
  'Künd': 'Kündmine',
  'Kivikoristus': 'Kivikorjamine',
  'Randaalimine': 'Randaalimine',
  'Libistamine': 'Libistamine',
  'Rullimine': 'Rullimine',
  'Umbrohutõrje (enne külvi)': 'Taimekaitsevahendi kasutamine',
  'Umbrohutõrje': 'Taimekaitsevahendi kasutamine',
  'Taimekaitse': 'Taimekaitsevahendi kasutamine',
  'Külv': 'Külvamine/istutamine',
  'Väetamine': 'Väetamine',
  'Leheväetamine': 'Väetamine',
  'Seire': 'Seire',
  'Koristus': 'Saagikoristus'
};

export const FERTILIZING_METHODS = ['Pindlaotamine', 'Paisklaotamine', 'Sisestuslaotamine', 'Pritsimine'] as const;
export const SEED_REGISTERS = ['Eesti sordiregister', 'EL ühtne sordileht', 'Muu'] as const;
export const SEED_CATEGORIES = ['OTS', 'AS', 'SE', 'E', 'C1', 'C2', 'C3', 'C', 'ST', 'GR', 'HM', 'CAC', 'PBTC', 'PB', 'S', 'A', 'B', 'F1'] as const;
export const FERTILIZER_REGISTERS = [
  'Väetis registrist', 'EL väetisetooted ja muud', 'Vedelsõnnik sh töödeldult', 'Poolvedelsõnnik sh töödeldult',
  'Tahesõnnik sh töödeldult', 'Sügavallapanusõnnik sh töödeldult', 'Silomahl', 'Kompost, mis ei sisalda sõnnikut',
  'Digestaat mis ei sisalda sõnnikut', 'Vadak', 'Reoveesete'
] as const;
export const LIMING_REGISTERS = [
  'Lubiväetis registrist', 'EL väetisetooted ja muud', 'Tuhk', 'Klinkritolm', 'Dolomiidijahu', 'Lubjakivijahu', 'Tolmpõlevkivituhk'
] as const;
export const PLANT_PROTECTION_REGISTERS = [
  'Taimekaitsevahendid registrist', 'Märgaja/kleepaine', 'Biostimulaator', 'Kasvuinhibiitor', 'Desikant'
] as const;
export const CROP_TYPES = ['Põhikultuur', 'Allakülv', 'Vahekultuur', 'KSM vahekultuur'] as const;
export const YIELD_TYPES = [
  'Terad', 'Haljasmass', 'Pallisilo', 'Hein', 'Põhk', 'Tervikkoristus', 'Marjad', 'Köögiviljad', 'Seemned',
  'Pealsed (Jäägid)', 'Viljad', 'Põletatud jäägid', 'Jääb põllule'
] as const;
// Seire liik → koguse ühik (PRIA määrab ühiku liigi järgi)
export const OBSERVATION_UNITS: Readonly<Record<string, string>> = {
  'Taimehaigused': '% lehepinnast',
  'Umbrohud': 'taime/m2',
  'Kahjurid': 'tk taime kohta',
  'Sündmused': '% külvatud pinnast'
};

export interface PriaAttrs {
  priaRegister: string | null;
  priaKind: string | null;
  priaSpec: string | null;
  activeIngredient: string | null;
  nKgHa: number | null;
  pKgHa: number | null;
  kKgHa: number | null;
}

export const EMPTY_PRIA_ATTRS: PriaAttrs = {
  priaRegister: null, priaKind: null, priaSpec: null, activeIngredient: null, nKgHa: null, pKgHa: null, kKgHa: null
};

export function materialCategoryFor(activity: string, _priaRegister?: string | null): MaterialCategory {
  if (activity === PRIA_ACTIVITY.SOWING) return 'SEED';
  if (activity === PRIA_ACTIVITY.FERTILIZING || activity === PRIA_ACTIVITY.LIMING) return 'FERTILIZER';
  if (activity === PRIA_ACTIVITY.PLANT_PROTECTION) return 'PLANT_PROTECTION';
  return 'OTHER';
}

// "kg/ha" → "kg"; ühikud ilma "/ha" osata jäävad samaks
export const baseUnit = (unit: string | null | undefined): string => (unit ?? '').replace(/\/ha$/, '').trim();

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const totalFromRate = (rate: number | null, areaHa: number | null): number | null =>
  rate == null || areaHa == null ? null : round2(rate * areaHa);

export const rateFromTotal = (total: number | null, areaHa: number | null): number | null =>
  total == null || !areaHa ? null : round2(total / areaHa);

export const nameKey = (s: string | null | undefined): string => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const dayNo = (iso: string) => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000);

// Kahe kuupäevavahemiku vahe päevades (0, kui lõikuvad). ISO "aaaa-kk-pp"; to = null → üks päev.
export function daysApart(a: { from: string; to: string | null }, b: { from: string; to: string | null }): number {
  const a1 = dayNo(a.from), a2 = dayNo(a.to ?? a.from);
  const b1 = dayNo(b.from), b2 = dayNo(b.to ?? b.from);
  if (a1 <= b2 && b1 <= a2) return 0;
  return a2 < b1 ? b1 - a2 : a1 - b2;
}
```

- [ ] **Step 4: Käivita, peab läbima** — sama käsk → PASS.

- [ ] **Step 5: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/services/pria.ts src/services/pria.test.ts && git commit -m "PRIA põlluraamatu klassifikaatorid ja abifunktsioonid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 3: Kande read PRIA atribuutidega

**Files:**
- Modify: `src/server/fieldWorkRules.ts` (tüübid `LineKind`, `LineDraft`, `EntryQuantities`; `buildEntryLines`, `lineKey`, `summarizeLines`)
- Test: `src/server/fieldWorkRules.test.ts`

**Interfaces:**
- Consumes: `PriaAttrs`, `EMPTY_PRIA_ATTRS`, `totalFromRate` (`src/services/pria.ts`).
- Produces:
  - `type LineKind = 'LABOR' | 'MACHINE' | 'IMPLEMENT' | 'FUEL' | 'MATERIAL' | 'HARVEST' | 'OBSERVATION'`
  - `interface LineDraft extends PriaAttrs { kind; vehicleId; implementId; materialId; label; quantity; unit; sortOrder; ratePerHa: number | null }`
  - `EntryQuantities.materials?: { id: string; name: string; unit: string; quantity: number; ratePerHa?: number | null; pria?: Partial<PriaAttrs> }[]`
  - `EntryQuantities.harvest?: { tonnes: number; ratePerHa: number | null; priaKind: string | null; priaSpec: string | null } | null` (asendab `harvestTonnes`; `harvestTonnes` jääb tagasiühilduvuseks)
  - `EntryQuantities.observations?: { label: string; quantity: number; unit: string; priaRegister: string | null }[]`

- [ ] **Step 1: Täienda teste** — `src/server/fieldWorkRules.test.ts`:

`stored()` abifunktsioon asenda:
```ts
const stored = (kind: StoredLine['kind'], quantity: number, unitPrice: number | null, confirmedQuantity: number | null): StoredLine => ({
  kind, quantity, unitPrice, confirmedQuantity, vehicleId: null, implementId: null, materialId: null, label: kind, unit: 'h', sortOrder: 0,
  ratePerHa: null, priaRegister: null, priaKind: null, priaSpec: null, activeIngredient: null, nKgHa: null, pKgHa: null, kKgHa: null
});
```

`describe('buildEntryLines')` lõppu:
```ts
  it('materjalirida kannab PRIA atribuute ja normi', () => {
    const [l] = buildEntryLines({
      materials: [{ id: 'm1', name: 'Tombo WG', unit: 'kg', quantity: 0.36, ratePerHa: 0.15, pria: { priaRegister: 'Taimekaitsevahendid registrist', priaKind: 'Herbitsiid' } }]
    });
    expect(l).toMatchObject({ kind: 'MATERIAL', quantity: 0.36, ratePerHa: 0.15, priaKind: 'Herbitsiid', activeIngredient: null });
  });
  it('saak koos saagi ja kultuuri tüübiga', () => {
    expect(buildEntryLines({ harvest: { tonnes: 9.68, ratePerHa: 4, priaKind: 'Terad', priaSpec: 'Põhikultuur' } })).toMatchObject([
      { kind: 'HARVEST', quantity: 9.68, unit: 't', ratePerHa: 4, priaKind: 'Terad', priaSpec: 'Põhikultuur' }
    ]);
  });
  it('seire leiud on OBSERVATION read, ka koguseta', () => {
    const lines = buildEntryLines({
      observations: [
        { label: 'Põldsinep', quantity: 7, unit: 'taime/m2', priaRegister: 'Umbrohud' },
        { label: 'Muu oluline sündmus', quantity: 0, unit: '', priaRegister: 'Sündmused' }
      ]
    });
    expect(lines.map((l) => [l.kind, l.label, l.quantity])).toEqual([
      ['OBSERVATION', 'Põldsinep', 7],
      ['OBSERVATION', 'Muu oluline sündmus', 0]
    ]);
  });
```

`describe('mergeLines')` lõppu:
```ts
  it('mitu materjalita vaatlust ei liitu üheks võtmeks', () => {
    const drafts = buildEntryLines({
      observations: [
        { label: 'A', quantity: 1, unit: 'taime/m2', priaRegister: 'Umbrohud' },
        { label: 'B', quantity: 2, unit: 'taime/m2', priaRegister: 'Umbrohud' }
      ]
    });
    expect(mergeLines([], drafts, 'PENDING').lines).toHaveLength(2);
  });
```

`describe('canConfirm / summarizeLines')` lõppu:
```ts
  it('vaatlused ei mõjuta finantsi ega kinnitamist', () => {
    expect(summarizeLines([{ kind: 'OBSERVATION', quantity: 7, unitPrice: null }]).costTotal).toBe(0);
    expect(canConfirm([{ unitPrice: 1, kind: 'LABOR' }, { unitPrice: null, kind: 'OBSERVATION' }])).toBe(true);
  });
```

- [ ] **Step 2: Käivita, peab kukkuma** — `npx vitest run src/server/fieldWorkRules.test.ts` → FAIL (tüübid/OBSERVATION puuduvad).

- [ ] **Step 3: Muuda** `src/server/fieldWorkRules.ts`:

Faili algusesse:
```ts
import { EMPTY_PRIA_ATTRS, type PriaAttrs } from '../services/pria.ts';
```

Asenda `LineKind`, `LineDraft`, `EntryQuantities`:
```ts
export type LineKind = 'LABOR' | 'MACHINE' | 'IMPLEMENT' | 'FUEL' | 'MATERIAL' | 'HARVEST' | 'OBSERVATION';

export interface LineDraft extends PriaAttrs {
  kind: LineKind;
  vehicleId: string | null;
  implementId: string | null;
  materialId: string | null;
  label: string;
  quantity: number;
  unit: string;
  sortOrder: number;
  ratePerHa: number | null; // kogus ha kohta (PRIA)
}

export interface EntryQuantities {
  laborHours?: number | null;
  workerName?: string | null;
  vehicle?: { id: string; name: string } | null;
  implement?: { id: string; name: string } | null;
  equipmentHours?: number | null; // masina ja haakeriista töötunnid sisestatakse korraga
  fuelLiters?: number | null;
  materials?: { id: string; name: string; unit: string; quantity: number; ratePerHa?: number | null; pria?: Partial<PriaAttrs> }[];
  harvestTonnes?: number | null; // lihtne saak (vana vorm)
  harvest?: { tonnes: number; ratePerHa: number | null; priaKind: string | null; priaSpec: string | null } | null;
  observations?: { label: string; quantity: number; unit: string; priaRegister: string | null }[];
}
```

`buildEntryLines` keha asenda:
```ts
export function buildEntryLines(q: EntryQuantities): LineDraft[] {
  const lines: LineDraft[] = [];
  const push = (l: Omit<LineDraft, 'sortOrder' | 'vehicleId' | 'implementId' | 'materialId' | 'ratePerHa' | keyof PriaAttrs> & Partial<LineDraft>) =>
    lines.push({ vehicleId: null, implementId: null, materialId: null, ratePerHa: null, ...EMPTY_PRIA_ATTRS, ...l, sortOrder: lines.length });

  if (positive(q.laborHours)) push({ kind: 'LABOR', label: q.workerName || 'Tööaeg', quantity: q.laborHours, unit: 'h' });
  if (positive(q.equipmentHours)) {
    if (q.vehicle) push({ kind: 'MACHINE', vehicleId: q.vehicle.id, label: q.vehicle.name, quantity: q.equipmentHours, unit: 'h' });
    if (q.implement) push({ kind: 'IMPLEMENT', implementId: q.implement.id, label: q.implement.name, quantity: q.equipmentHours, unit: 'h' });
  }
  if (positive(q.fuelLiters)) push({ kind: 'FUEL', label: 'Kütus', quantity: q.fuelLiters, unit: 'l' });
  for (const m of q.materials ?? []) {
    if (positive(m.quantity)) {
      push({ kind: 'MATERIAL', materialId: m.id, label: m.name, quantity: m.quantity, unit: m.unit, ratePerHa: m.ratePerHa ?? null, ...m.pria });
    }
  }
  if (q.harvest && positive(q.harvest.tonnes)) {
    push({ kind: 'HARVEST', label: 'Saak', quantity: q.harvest.tonnes, unit: 't', ratePerHa: q.harvest.ratePerHa, priaKind: q.harvest.priaKind, priaSpec: q.harvest.priaSpec });
  } else if (positive(q.harvestTonnes)) {
    push({ kind: 'HARVEST', label: 'Saak', quantity: q.harvestTonnes, unit: 't' });
  }
  // Seire leid salvestatakse ka koguseta (nt "Muu oluline sündmus")
  for (const o of q.observations ?? []) {
    if (o.label.trim()) push({ kind: 'OBSERVATION', label: o.label.trim(), quantity: o.quantity, unit: o.unit, priaRegister: o.priaRegister });
  }
  return lines;
}
```

`lineKey` asenda:
```ts
// Materjalita read (vaatlused) eristatakse nime järgi
const lineKey = (l: Pick<LineDraft, 'kind' | 'vehicleId' | 'implementId' | 'materialId' | 'label'>) =>
  `${l.kind}:${l.vehicleId ?? ''}:${l.implementId ?? ''}:${l.materialId ?? ''}:${l.kind === 'OBSERVATION' ? l.label : ''}`;
```

`mergeLines` sees muudatuse tuvastus: vaatlused ei mõjuta finantsi — asenda `changed` arvutus:
```ts
  const priced = (l: { kind: LineKind }) => l.kind !== 'OBSERVATION';
  const newKeys = new Set(lines.map(lineKey));
  const changed =
    oldLines.filter(priced).some((l) => !newKeys.has(lineKey(l))) ||
    lines.filter(priced).some((l) => l.confirmedQuantity === null || l.confirmedQuantity !== l.quantity);
```

`canConfirm` asenda:
```ts
// Kinnitada saab, kui igal hinnastataval real on ühiku kulu (ka 0 on lubatud). Vaatlustel hinda pole.
export function canConfirm(lines: (Pick<StoredLine, 'unitPrice'> & { kind?: LineKind })[]): boolean {
  const priced = lines.filter((l) => l.kind !== 'OBSERVATION');
  return priced.length > 0 && priced.every((l) => l.unitPrice !== null && Number.isFinite(l.unitPrice));
}
```

(`summarizeLines` juba ignoreerib tundmatut liiki — OBSERVATION ei lähe ühtegi summasse; test kinnitab.)

- [ ] **Step 4: Käivita, peab läbima** — sama käsk → PASS. Seejärel `npx tsc --noEmit -p tsconfig.app.json`: `fieldWorks.ts` `toStored` ei anna uusi välju → paranda `toStored` (`src/server/fieldWorks.ts`):

```ts
const toStored = (l: any): StoredLine => ({
  kind: l.kind,
  vehicleId: l.vehicleId,
  implementId: l.implementId,
  materialId: l.materialId,
  label: l.label,
  quantity: l.quantity,
  unit: l.unit,
  sortOrder: l.sortOrder,
  ratePerHa: l.ratePerHa ?? null,
  priaRegister: l.priaRegister ?? null,
  priaKind: l.priaKind ?? null,
  priaSpec: l.priaSpec ?? null,
  activeIngredient: l.activeIngredient ?? null,
  nKgHa: l.nKgHa ?? null,
  pKgHa: l.pKgHa ?? null,
  kKgHa: l.kKgHa ?? null,
  unitPrice: decimalToNumber(l.unitPrice),
  confirmedQuantity: l.confirmedQuantity
});
```
ja otsi `canConfirm(` kasutus `fieldWorks.ts`-is — kui talle antakse ridu ilma `kind`-ita, lisa `kind` valikusse (Prisma ridadel on `kind` olemas). Tüübikontroll peab olema puhas.

- [ ] **Step 5: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/fieldWorkRules.ts src/server/fieldWorkRules.test.ts src/server/fieldWorks.ts && git commit -m "Kande read: PRIA atribuudid, saagi tüübid ja seire leiud

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 4: Töötüüpide migratsioon PRIA tegevustele

**Files:**
- Create: `src/server/workTypeMigration.ts`
- Test: `src/server/workTypeMigration.test.ts`
- Create: `scripts/pria-work-types.mts`

**Interfaces:**
- Consumes: `PRIA_ACTIVITIES`, `LEGACY_WORK_TYPE_MAP` (`src/services/pria.ts`).
- Produces:
  - `splitRepeatedWork(work: { plannedCount: number; entries: { id: string; occurrenceNo: number | null }[] }): { entryIds: string[] }[]` — iga element = üks töö pärast jagamist (esimene jääb olemasolevaks tööks).
  - Andmebaasis: igal ettevõttel 29 töötüüpi `priaCode`-ga, vanad kustutatud; kataloogis sama.

- [ ] **Step 1: Kirjuta test** `src/server/workTypeMigration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { splitRepeatedWork } from './workTypeMigration';

describe('splitRepeatedWork', () => {
  it('ühekordne töö jääb üheks', () => {
    expect(splitRepeatedWork({ plannedCount: 1, entries: [{ id: 'a', occurrenceNo: null }, { id: 'b', occurrenceNo: null }] }))
      .toEqual([{ entryIds: ['a', 'b'] }]);
  });
  it('kordused jagatakse occurrenceNo järgi, puuduvad kordused kanneteta töödeks', () => {
    expect(splitRepeatedWork({
      plannedCount: 3,
      entries: [{ id: 'a', occurrenceNo: 1 }, { id: 'b', occurrenceNo: 2 }, { id: 'c', occurrenceNo: 2 }]
    })).toEqual([{ entryIds: ['a'] }, { entryIds: ['b', 'c'] }, { entryIds: [] }]);
  });
  it('kordumisnumbrita kanded lähevad esimesse töösse', () => {
    expect(splitRepeatedWork({ plannedCount: 2, entries: [{ id: 'a', occurrenceNo: null }, { id: 'b', occurrenceNo: 2 }] }))
      .toEqual([{ entryIds: ['a'] }, { entryIds: ['b'] }]);
  });
  it('rohkem kordi kui planeeritud → iga kord oma töö', () => {
    expect(splitRepeatedWork({ plannedCount: 1, entries: [{ id: 'a', occurrenceNo: 1 }, { id: 'b', occurrenceNo: 2 }] }))
      .toEqual([{ entryIds: ['a'] }, { entryIds: ['b'] }]);
  });
});
```

- [ ] **Step 2: Käivita, peab kukkuma** — `npx vitest run src/server/workTypeMigration.test.ts` → FAIL.

- [ ] **Step 3: Kirjuta** `src/server/workTypeMigration.ts`:

```ts
// src/server/workTypeMigration.ts — korduva töö jagamine eraldi töödeks (iga kord = üks töö).
// Puhas funktsioon; kasutab scripts/pria-work-types.mts.

export function splitRepeatedWork(work: { plannedCount: number; entries: { id: string; occurrenceNo: number | null }[] }): { entryIds: string[] }[] {
  const maxOccurrence = Math.max(0, ...work.entries.map((e) => e.occurrenceNo ?? 0));
  const count = Math.max(1, work.plannedCount, maxOccurrence);
  const groups: { entryIds: string[] }[] = Array.from({ length: count }, () => ({ entryIds: [] }));
  for (const e of work.entries) groups[(e.occurrenceNo ?? 1) - 1].entryIds.push(e.id);
  return groups;
}
```

- [ ] **Step 4: Käivita, peab läbima.**

- [ ] **Step 5: Kirjuta skript** `scripts/pria-work-types.mts`:

```ts
// scripts/pria-work-types.mts — töötüübid PRIA e-põlluraamatu 29 tegevuseks (ettevõtted + kataloog).
// Korduvkäivitatav. Käivitus omanikuna: npx tsx scripts/pria-work-types.mts [--dry-run]
// Vanad tüübid → LEGACY_WORK_TYPE_MAP; korduvad tööd jagatakse (iga kord = üks töö);
// mallide read liidetakse sama tüübi korral (plannedCount summa).
import { PrismaClient, type Prisma } from '@prisma/client';
import { PRIA_ACTIVITIES, LEGACY_WORK_TYPE_MAP } from '../src/services/pria.ts';
import { splitRepeatedWork } from '../src/server/workTypeMigration.ts';

const dryRun = process.argv.includes('--dry-run');
const url = process.env.MIGRATE_DATABASE_URL;
if (!url) throw new Error('MIGRATE_DATABASE_URL puudub');
const db = new PrismaClient({ datasources: { db: { url } } });

async function migrateTenant(tx: Prisma.TransactionClient, tenantId: string) {
  await tx.$executeRawUnsafe(`select set_config('app.tenant_id', $1, true)`, tenantId);
  const stats = { created: 0, worksMoved: 0, worksSplit: 0, itemsMerged: 0, typesDeleted: 0 };

  // 1. PRIA tüübid (olemasolev sama nimega tüüp saab priaCode)
  const byPria = new Map<string, string>();
  for (const a of PRIA_ACTIVITIES) {
    const existing = await tx.workType.findFirst({ where: { tenantId, OR: [{ priaCode: a.name }, { name: a.name }] } });
    const row = existing
      ? await tx.workType.update({ where: { id: existing.id }, data: { priaCode: a.name, name: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder, repeatMode: 'ONCE', maxRepeats: null, intervalDays: null, isActive: true } })
      : await tx.workType.create({ data: { tenantId, name: a.name, priaCode: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder } });
    if (!existing) stats.created++;
    byPria.set(a.name, row.id);
  }

  // 2. Vanade tüüpide tööd ja mallide read uutele tüüpidele
  const legacy = await tx.workType.findMany({ where: { tenantId, priaCode: null } });
  for (const old of legacy) {
    const target = LEGACY_WORK_TYPE_MAP[old.name];
    if (!target) throw new Error(`${tenantId}: töötüübil "${old.name}" puudub PRIA vaste`);
    const targetId = byPria.get(target)!;
    const works = await tx.fieldWork.findMany({ where: { workTypeId: old.id }, include: { entries: { select: { id: true, occurrenceNo: true } } } });
    for (const w of works) {
      const method = old.name === 'Leheväetamine' ? 'Pritsimine' : w.method;
      await tx.fieldWork.update({ where: { id: w.id }, data: { workTypeId: targetId, phase: w.phase, method, plannedCount: 1 } });
      stats.worksMoved++;
    }
    const items = await tx.workTemplateItem.findMany({ where: { workTypeId: old.id } });
    for (const it of items) {
      const dup = await tx.workTemplateItem.findFirst({ where: { templateId: it.templateId, workTypeId: targetId } });
      if (dup) {
        await tx.workTemplateItem.update({ where: { id: dup.id }, data: { plannedCount: (dup.plannedCount ?? 1) + (it.plannedCount ?? 1) } });
        await tx.workTemplateItem.delete({ where: { id: it.id } });
        stats.itemsMerged++;
      } else {
        await tx.workTemplateItem.update({ where: { id: it.id }, data: { workTypeId: targetId } });
      }
    }
    await tx.workType.delete({ where: { id: old.id } });
    stats.typesDeleted++;
  }

  // 3. Korduvad tööd (plannedCount > 1 või mitu kordumisnumbrit) → iga kord oma töö
  const works = await tx.fieldWork.findMany({ include: { entries: { select: { id: true, occurrenceNo: true } } } });
  for (const w of works) {
    const groups = splitRepeatedWork({ plannedCount: w.plannedCount, entries: w.entries });
    if (groups.length === 1) {
      if (w.plannedCount !== 1) await tx.fieldWork.update({ where: { id: w.id }, data: { plannedCount: 1 } });
      continue;
    }
    for (const [i, g] of groups.entries()) {
      const workId = i === 0
        ? w.id
        : (await tx.fieldWork.create({
            data: {
              tenantId, fieldSeasonId: w.fieldSeasonId, workTypeId: w.workTypeId, phase: w.phase, sortOrder: w.sortOrder,
              plannedText: w.plannedText, plannedCount: 1, fromTemplate: w.fromTemplate, method: w.method, notes: null
            }
          })).id;
      if (i > 0 && g.entryIds.length) await tx.workEntry.updateMany({ where: { id: { in: g.entryIds } }, data: { fieldWorkId: workId } });
      const n = g.entryIds.length;
      await tx.fieldWork.update({
        where: { id: workId },
        data: { plannedCount: 1, ...(i > 0 ? { status: n > 0 ? 'IN_PROGRESS' : 'PLANNED' } : {}) }
      });
    }
    stats.worksSplit++;
  }
  await tx.workEntry.updateMany({ data: { occurrenceNo: null } });
  return stats;
}

async function migrateCatalog(tx: Prisma.TransactionClient) {
  for (const a of PRIA_ACTIVITIES) {
    const existing = await tx.catalogWorkType.findFirst({ where: { OR: [{ priaCode: a.name }, { name: a.name }] } });
    if (existing) {
      await tx.catalogWorkType.update({ where: { id: existing.id }, data: { priaCode: a.name, name: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder, repeatMode: 'ONCE', maxRepeats: null, intervalDays: null, isActive: true } });
    } else {
      await tx.catalogWorkType.create({ data: { name: a.name, priaCode: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder } });
    }
  }
  const byName = new Map((await tx.catalogWorkType.findMany({ where: { priaCode: { not: null } } })).map((w) => [w.name, w.id]));
  for (const old of await tx.catalogWorkType.findMany({ where: { priaCode: null } })) {
    const targetId = byName.get(LEGACY_WORK_TYPE_MAP[old.name] ?? '');
    if (!targetId) throw new Error(`Kataloog: töötüübil "${old.name}" puudub PRIA vaste`);
    for (const it of await tx.catalogWorkTemplateItem.findMany({ where: { catalogWorkTypeId: old.id } })) {
      const dup = await tx.catalogWorkTemplateItem.findFirst({ where: { templateId: it.templateId, catalogWorkTypeId: targetId } });
      if (dup) {
        await tx.catalogWorkTemplateItem.update({ where: { id: dup.id }, data: { plannedCount: (dup.plannedCount ?? 1) + (it.plannedCount ?? 1) } });
        await tx.catalogWorkTemplateItem.delete({ where: { id: it.id } });
      } else {
        await tx.catalogWorkTemplateItem.update({ where: { id: it.id }, data: { catalogWorkTypeId: targetId } });
      }
    }
    await tx.catalogWorkType.delete({ where: { id: old.id } });
  }
}

class DryRun extends Error {}

async function main() {
  const tenants: { id: string }[] = await db.$queryRawUnsafe('select id from tenants order by id');
  for (const t of tenants) {
    try {
      await db.$transaction(async (tx) => {
        const s = await migrateTenant(tx, t.id);
        console.log(t.id, s);
        if (dryRun) throw new DryRun();
      }, { timeout: 120000 });
    } catch (e) {
      if (!(e instanceof DryRun)) throw e;
    }
  }
  try {
    await db.$transaction(async (tx) => {
      await migrateCatalog(tx);
      console.log('kataloog', await tx.catalogWorkType.count());
      if (dryRun) throw new DryRun();
    });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }
}

main().finally(() => db.$disconnect());
```

Märkus: `tenants` tabel võib olla teises andmebaasis (`PLATFORM_DATABASE_URL`). Kui `select id from tenants` annab õiguste/olemasolu vea, loe ettevõtted `select distinct tenant_id as id from work_types` päringuga (sama ühendus).

- [ ] **Step 6: Proovikäivitus**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && npx tsx scripts/pria-work-types.mts --dry-run'
```
Expected: iga ettevõtte kohta `{ created: 24, worksMoved: …, worksSplit: …, itemsMerged: …, typesDeleted: 9 }` — 5 vana tüüpi (Randaalimine, Libistamine, Rullimine, Väetamine, Seire) on juba PRIA nimega ja saavad ainult `priaCode`; ülejäänud 9 kustutatakse pärast tööde ja mallide ümbertõstmist. Viga = peatu ja uuri.

- [ ] **Step 7: Varukoopia + päris käivitus** — varukoopia käsk, siis sama käsk ilma `--dry-run`. Kontroll:

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "${MIGRATE_DATABASE_URL%%\?*}" -At -c "select tenant_id, count(*), count(\"priaCode\") from work_types group by 1" -c "select count(*) from catalog_work_types where \"priaCode\" is null"'
```
Expected: iga ettevõte `29|29`; kataloogis `0`.

- [ ] **Step 8: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/workTypeMigration.ts src/server/workTypeMigration.test.ts scripts/pria-work-types.mts && git commit -m "Töötüübid PRIA e-põlluraamatu tegevusteks: migratsioon ja korduvate tööde jagamine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 5: Tööde API — mall, plaan ja kande PRIA väljad

**Files:**
- Modify: `src/server/fieldWorkRules.ts` (uus `templateWorksToCreate`), `src/server/fieldWorkRules.test.ts`
- Modify: `src/server/fieldWorks.ts` (`applyCropTemplate`, `applyAutumnTemplate`, `resolveEntryInput`, `syncFieldWorkStatus`, `entryDto`, `ENTRY_INCLUDE`, `POST/PATCH /api/field-works`, field-works DTO)
- Modify: `src/types/fieldWork.ts`, `src/services/api.ts`

**Interfaces:**
- Consumes: Task 1 skeem, Task 3 `buildEntryLines`.
- Produces:
  - `templateWorksToCreate(items: { workTypeId: string; plannedCount: number | null }[], existingCounts: Map<string, number>): string[]` — tagastab loodavate tööde `workTypeId`-d järjekorras.
  - Tüübid (`src/types/fieldWork.ts`):
    ```ts
    export type WorkSource = 'MANUAL' | 'PRIA_IMPORT';
    export interface PriaLineFields { ratePerHa: number | null; priaRegister: string | null; priaKind: string | null; priaSpec: string | null; activeIngredient: string | null; nKgHa: number | null; pKgHa: number | null; kKgHa: number | null }
    export interface FieldWorkPlanLine extends PriaLineFields { id?: string; kind: 'MATERIAL' | 'HARVEST'; materialId: string | null; label: string; unit: string }
    export interface WorkEntryMaterial extends Partial<PriaLineFields> { materialId: string; name: string; unit: string; quantity: number }
    export interface WorkEntryObservation { label: string; quantity: number; unit: string; priaRegister: string | null }
    export interface WorkEntryHarvest { tonnes: number; ratePerHa: number | null; priaKind: string | null; priaSpec: string | null }
    ```
    `WorkEntry` lisaväljad: `dateTo: string | null; method: string | null; source: WorkSource; observations: WorkEntryObservation[]; harvest: WorkEntryHarvest | null`.
    `WorkEntryInput` lisaväljad: `dateTo?: string | null; method?: string | null; materials: { materialId: string; quantity: number; ratePerHa?: number | null; pria?: Partial<PriaLineFields> }[]; harvest?: WorkEntryHarvest | null; observations?: WorkEntryObservation[]`.
    `FieldWork` lisaväljad: `priaCode: string | null; plannedDateFrom: string | null; plannedDateTo: string | null; plannedAreaHa: number | null; method: string | null; plannedWorkerId: string | null; plannedWorkerName: string | null; source: WorkSource; lines: FieldWorkPlanLine[]`.
    `WorkType` lisaväli: `priaCode: string | null`.
    `FieldWorkPlanInput`:
    ```ts
    export interface FieldWorkPlanInput {
      plannedText?: string | null; plannedDateFrom?: string | null; plannedDateTo?: string | null; plannedAreaHa?: number | null;
      method?: string | null; plannedWorkerId?: string | null; notes?: string | null; lines?: FieldWorkPlanLine[];
    }
    ```
  - API (`src/services/api.ts`): `addFieldWork(data: { fieldSeasonId: number; workTypeId: string; sortOrder?: number | null } & FieldWorkPlanInput): Promise<FieldWork>`; `updateFieldWork(id, data: FieldWorkPlanInput & { status?: 'DONE' | 'REOPEN' })`.
  - Server: `planInput(b: any): Promise<{ data: Prisma.FieldWorkUncheckedUpdateInput; lines: Prisma.FieldWorkLineCreateWithoutFieldWorkInput[] | null }>` (sisemine), `fieldWorkDto(w)` (eksporditud, kasutab Task 8).

- [ ] **Step 1: Test** — `src/server/fieldWorkRules.test.ts` lõppu (ja impordi `templateWorksToCreate`):

```ts
describe('templateWorksToCreate', () => {
  it('loob malli kordi miinus olemasolevad sama tüübi tööd', () => {
    const items = [{ workTypeId: 'tkv', plannedCount: 3 }, { workTypeId: 'kund', plannedCount: null }];
    expect(templateWorksToCreate(items, new Map([['tkv', 1]]))).toEqual(['tkv', 'tkv', 'kund']);
    expect(templateWorksToCreate(items, new Map([['tkv', 5], ['kund', 1]]))).toEqual([]);
  });
});
```

- [ ] **Step 2: FAIL** — `npx vitest run src/server/fieldWorkRules.test.ts`.

- [ ] **Step 3: `templateWorksToCreate`** — `src/server/fieldWorkRules.ts` lõppu:

```ts
// Malli rakendamine: iga malli rea kohta plannedCount (vaikimisi 1) tööd, millest on maha arvatud
// selle tüübi juba olemasolevad tööd hooaja põllul. Iga töö = üks kord.
export function templateWorksToCreate(items: { workTypeId: string; plannedCount: number | null }[], existingCounts: Map<string, number>): string[] {
  const left = new Map(existingCounts);
  const out: string[] = [];
  for (const it of items) {
    for (let i = 0; i < Math.max(1, it.plannedCount ?? 1); i++) {
      const have = left.get(it.workTypeId) ?? 0;
      if (have > 0) left.set(it.workTypeId, have - 1);
      else out.push(it.workTypeId);
    }
  }
  return out;
}
```

PASS.

- [ ] **Step 4: Mallid** — `src/server/fieldWorks.ts`:
  - impordi `templateWorksToCreate`.
  - `applyCropTemplate`: asenda plokk alates `const existing = new Set(` kuni funktsiooni lõpuni:
    ```ts
    const existingCounts = new Map<string, number>();
    for (const w of await prisma.fieldWork.findMany({ where: { fieldSeasonId }, select: { workTypeId: true } })) {
      existingCounts.set(w.workTypeId, (existingCounts.get(w.workTypeId) ?? 0) + 1);
    }
    const items = [...template.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      // Taliviljal käesoleval koristusaastal kevadist ettevalmistust ja külvi ei tehta!
      .filter((it) => it.workType?.isActive && !(isWinter && (it.workType.phase === 'PREPARATION' || it.workType.phase === 'SOWING')));
    const byType = new Map(items.map((it) => [it.workTypeId, it]));
    for (const workTypeId of templateWorksToCreate(items, existingCounts)) {
      const item = byType.get(workTypeId)!;
      await prisma.fieldWork.create({
        data: { fieldSeasonId, workTypeId, phase: item.workType.phase, sortOrder: item.sortOrder, plannedText: item.typicalTiming, plannedCount: 1, fromTemplate: true }
      });
    }
    ```
  - `applyAutumnTemplate`: sama muster (`nextFieldSeasonId`, filter `isWinter || it.workType.phase === 'PREPARATION'` ja `plannedText: isAutumnPhase ? (item.typicalTiming ?? \`Sügis ${nextFs.year - 1}\`) : item.typicalTiming`, kus `isAutumnPhase` arvutatakse `item.workType.phase`-ist).

- [ ] **Step 5: Olek** — `syncFieldWorkStatus`: eemalda `workType: { select: { repeatMode: true } }` ja `repeatMode`; kasuta töö plaanitud pindala:
  ```ts
      select: { status: true, plannedAreaHa: true, fieldSeason: { select: { areaHa: true } }, _count: { select: { entries: true } } }
  ...
    const fieldArea = work.plannedAreaHa ?? work.fieldSeason?.areaHa ?? 0;
    const is100Percent = fieldArea > 0 && totalDoneArea >= fieldArea - 0.01;
  ```

- [ ] **Step 6: Kande sisend ja DTO** — `resolveEntryInput`:
  - materjalid: sisendis lisaks `ratePerHa`, `pria`:
    ```ts
    const materialsIn: { materialId?: unknown; quantity?: unknown; ratePerHa?: unknown; pria?: any }[] = Array.isArray(body?.materials) ? body.materials : [];
    ...
        return row && quantity !== null
          ? { ...row, quantity, ratePerHa: num(m.ratePerHa), pria: priaAttrsIn(m.pria) }
          : null;
    ```
    tüübifilter vastavalt (`{ id; name; unit; quantity; ratePerHa: number | null; pria: PriaAttrs }`).
  - faili ülaossa abifunktsioon:
    ```ts
    import { EMPTY_PRIA_ATTRS, type PriaAttrs } from '../services/pria.ts';
    const priaAttrsIn = (p: any): PriaAttrs => ({
      priaRegister: text(p?.priaRegister, 120), priaKind: text(p?.priaKind, 120), priaSpec: text(p?.priaSpec, 120),
      activeIngredient: text(p?.activeIngredient, 200), nKgHa: num(p?.nKgHa), pKgHa: num(p?.pKgHa), kKgHa: num(p?.kKgHa)
    });
    ```
  - saak ja vaatlused:
    ```ts
    const h = body?.harvest;
    const harvest = h && num(h.tonnes) !== null
      ? { tonnes: num(h.tonnes)!, ratePerHa: num(h.ratePerHa), priaKind: text(h.priaKind, 80), priaSpec: text(h.priaSpec, 80) }
      : null;
    const observations = (Array.isArray(body?.observations) ? body.observations : [])
      .map((o: any) => ({ label: text(o?.label, 200) ?? '', quantity: num(o?.quantity) ?? 0, unit: text(o?.unit, 40) ?? '', priaRegister: text(o?.priaRegister, 80) }))
      .filter((o: { label: string }) => o.label);
    ```
    ja `buildEntryLines({... harvestTonnes, harvest, observations })`.
  - `data` lisaväljad: `dateTo: dateOnly(body?.dateTo), method: text(body?.method, 80)`. `occurrenceNo` eemalda `data`-st.
  - `entryDto` lisaväljad:
    ```ts
    dateTo: isoDate(e.dateTo),
    method: e.method ?? null,
    source: e.source,
    materials: lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({
      materialId: l.materialId, name: l.label, unit: l.unit, quantity: l.quantity, ratePerHa: l.ratePerHa,
      priaRegister: l.priaRegister, priaKind: l.priaKind, priaSpec: l.priaSpec, activeIngredient: l.activeIngredient,
      nKgHa: l.nKgHa, pKgHa: l.pKgHa, kKgHa: l.kKgHa
    })),
    harvest: (() => { const l = lines.find((x) => x.kind === 'HARVEST'); return l ? { tonnes: l.quantity, ratePerHa: l.ratePerHa, priaKind: l.priaKind, priaSpec: l.priaSpec } : null; })(),
    observations: lines.filter((l) => l.kind === 'OBSERVATION').map((l) => ({ label: l.label, quantity: l.quantity, unit: l.unit, priaRegister: l.priaRegister })),
    ```
    (`materials` asendab olemasoleva rea, `harvestTonnes` jääb.) Finantsi `lines` kaardistuses jäta OBSERVATION read välja: `lines.filter((l) => l.kind !== 'OBSERVATION').map(...)`.

- [ ] **Step 7: Töö plaan** — `fieldWorks.ts`:
  - abifunktsioon (enne `handleFieldWorks`):
    ```ts
    // Töö plaani sisend (POST ja PATCH). Read asendatakse tervikuna, kui `lines` on kehas.
    async function planInput(b: any) {
      const data: Record<string, unknown> = {};
      if ('plannedText' in b) data.plannedText = text(b.plannedText, 80);
      if ('plannedDateFrom' in b) data.plannedDateFrom = dateOnly(b.plannedDateFrom);
      if ('plannedDateTo' in b) data.plannedDateTo = dateOnly(b.plannedDateTo);
      if ('plannedAreaHa' in b) data.plannedAreaHa = num(b.plannedAreaHa);
      if ('method' in b) data.method = text(b.method, 80);
      if ('plannedWorkerId' in b) data.plannedWorkerId = text(b.plannedWorkerId, 64);
      if ('notes' in b) data.notes = text(b.notes, 2000);
      const lines = Array.isArray(b?.lines)
        ? b.lines.map((l: any, i: number) => ({
            kind: l?.kind === 'HARVEST' ? 'HARVEST' : 'MATERIAL',
            materialId: text(l?.materialId, 64),
            label: text(l?.label, 200) ?? '',
            unit: text(l?.unit, 20) ?? '',
            ratePerHa: num(l?.ratePerHa),
            ...priaAttrsIn(l),
            sortOrder: i
          })).filter((l: { label: string }) => l.label)
        : null;
      return { data, lines };
    }

    const FIELD_WORK_INCLUDE = {
      workType: true,
      plannedWorker: { select: { name: true } },
      lines: { orderBy: { sortOrder: 'asc' as const } },
      entries: { orderBy: { date: 'desc' as const }, include: ENTRY_INCLUDE }
    };

    export function fieldWorkDto(w: any, withFinance: boolean) {
      return {
        id: w.id,
        fieldSeasonId: w.fieldSeasonId,
        workTypeId: w.workTypeId,
        workTypeName: w.workType.name,
        priaCode: w.workType.priaCode ?? null,
        phase: w.phase,
        repeatMode: 'ONCE' as const,
        intervalDays: null,
        usesMaterials: w.workType.usesMaterials,
        sortOrder: w.sortOrder,
        plannedText: w.plannedText,
        plannedCount: 1,
        plannedDateFrom: isoDate(w.plannedDateFrom),
        plannedDateTo: isoDate(w.plannedDateTo),
        plannedAreaHa: w.plannedAreaHa ?? null,
        method: w.method ?? null,
        plannedWorkerId: w.plannedWorkerId ?? null,
        plannedWorkerName: w.plannedWorker?.name ?? null,
        source: w.source,
        lines: (w.lines ?? []).map(({ fieldWorkId: _f, tenantId: _t, sortOrder: _s, ...l }: any) => l),
        status: w.status,
        finishedAt: isoDate(w.finishedAt),
        fromTemplate: w.fromTemplate,
        notes: w.notes,
        entries: (w.entries ?? []).map((e: any) => entryDto(e, withFinance))
      };
    }
    ```
    (`ENTRY_INCLUDE` peab olema defineeritud enne `FIELD_WORK_INCLUDE` — paiguta mõlemad `entryDto` järele.)
  - `GET /api/field-works`: mõlemas `findMany`-s asenda `include` → `FIELD_WORK_INCLUDE` (säilita `fieldSeason` select järgmise aasta päringus: `include: { ...FIELD_WORK_INCLUDE, fieldSeason: { select: {...} } }`) ja DTO-d `{ ...fieldWorkDto(w, finance), carriedOverFromYear: …, carriedOverToYear: …, seasonYear: …, isNextSeasonWinterSowing: … }` (järgmise aasta real ka `plannedText` ülekirjutus nagu praegu).
  - `POST /api/field-works`: asenda `try { … } catch` plokk:
    ```ts
    const { data: plan, lines } = await planInput(b);
    const saved = await prisma.fieldWork.create({
      data: {
        ...(plan as object),
        fieldSeasonId,
        workTypeId: workType.id,
        phase: workType.phase,
        sortOrder: preferredSortOrder !== null ? preferredSortOrder : (last?.sortOrder ?? -1) + 1,
        plannedCount: 1,
        ...(lines ? { lines: { create: lines } } : {})
      } as Prisma.FieldWorkUncheckedCreateInput,
      include: FIELD_WORK_INCLUDE
    });
    json(res, fieldWorkDto(saved, canSeeFinance(req)));
    ```
  - `PATCH /api/field-works/:id`: asenda kolm `if ('plannedText'…/'plannedCount'…/'notes'…)` rida:
    ```ts
    const { data: plan, lines } = await planInput(b);
    Object.assign(data, plan);
    if (lines) {
      await prisma.fieldWorkLine.deleteMany({ where: { fieldWorkId: id } });
      if (lines.length) await prisma.fieldWorkLine.createMany({ data: lines.map((l: object) => ({ ...l, fieldWorkId: id })) });
    }
    ```
    ja pärast `prisma.fieldWork.update` kutsu `await syncFieldWorkStatus(id, false, userId)`, kui `'plannedAreaHa' in b` ja `b.status` puudub.

- [ ] **Step 8: Kliendi tüübid ja API** — `src/types/fieldWork.ts`: lisa Interfaces-plokis loetletud tüübid ja väljad; `WorkEntryLineKind` lõppu `| 'OBSERVATION'`; `WorkEntryInput.occurrenceNo` muuda valikuliseks (`occurrenceNo?: number | null`). `src/services/api.ts`: `addFieldWork` ja `updateFieldWork` signatuurid nagu Interfaces-plokis (`addFieldWork` tagastab `FieldWork`: `return jsonOrThrow(...)`). Impordi `FieldWorkPlanInput`.

- [ ] **Step 9: Kontroll** — `npx tsc --noEmit -p tsconfig.app.json && npm test`. Tüübivead `FieldWorkEntryDialog.tsx`-is (`occurrenceNo`) ja `FieldWorksBoard.tsx`-is (`plannedCount`) paranda minimaalselt: dialoogis jäta `occurrenceNo` saatmata; tahvlis on `plannedCount` endiselt DTO-s (1). Käsitsi kontroll API-ga (logitud seanss brauseris): ava Põllutööd vaade 2026 — tööd laevad, kande lisamine ja muutmine töötab.

- [ ] **Step 10: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/fieldWorkRules.ts src/server/fieldWorkRules.test.ts src/server/fieldWorks.ts src/types/fieldWork.ts src/services/api.ts src/components/FieldWorkEntryDialog.tsx src/components/FieldWorksBoard.tsx && git commit -m "Tööde API: mall loob iga korra eraldi töö, töö plaan ja plaaniread, kande PRIA väljad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 6: Impordi sidumisreeglid

**Files:**
- Create: `src/server/fieldBookRules.ts`
- Test: `src/server/fieldBookRules.test.ts`

**Interfaces:**
- Consumes: `ParsedProduct`, `FieldBookImportOperation` (`src/types/fieldOperation.ts`); `PRIA_ACTIVITY`, `PriaAttrs`, `baseUnit`, `nameKey`, `daysApart`, `materialCategoryFor` (`src/services/pria.ts`); `MaterialCategory`.
- Produces:
  - `MATCH_TOLERANCE_DAYS = 2`
  - `interface ExistingWork { id: string; activity: string; plannedFrom: string | null; plannedTo: string | null; entries: { from: string; to: string | null }[]; productKeys: string[] }`
  - `findMatchingWork(op: { type: string; dateFrom: string; dateTo: string | null; products: { name: string | null }[] }, works: ExistingWork[], taken: Set<string>): ExistingWork | null`
  - `interface OperationLine extends PriaAttrs { kind: 'MATERIAL' | 'HARVEST' | 'OBSERVATION'; label: string; amount: number | null; unit: string; perHa: boolean; materialCategory: MaterialCategory | null }`
  - `operationLines(op: FieldBookImportOperation): OperationLine[]`

- [ ] **Step 1: Test** `src/server/fieldBookRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findMatchingWork, operationLines, type ExistingWork } from './fieldBookRules';
import type { FieldBookImportOperation, ParsedProduct } from '../types/fieldOperation';

const prod = (p: Partial<ParsedProduct>): ParsedProduct => ({
  category: null, name: null, kind: null, spec: null, amount: null, unit: null, nKgHa: null, pKgHa: null, kKgHa: null, activeIngredient: null, ...p
});
const op = (p: Partial<FieldBookImportOperation>): FieldBookImportOperation => ({
  type: 'Kündmine', dateFrom: '2026-04-27', dateTo: null, areaHa: 2.42, method: null, performerId: null, notes: null, products: [], ...p
});
const work = (p: Partial<ExistingWork>): ExistingWork => ({
  id: 'w1', activity: 'Kündmine', plannedFrom: null, plannedTo: null, entries: [], productKeys: [], ...p
});

describe('findMatchingWork', () => {
  it('sama tegevus, kuupäev kuni 2 päeva kaugusel kandest', () => {
    const w = work({ entries: [{ from: '2026-05-02', to: null }] });
    expect(findMatchingWork(op({ dateFrom: '2026-04-27', dateTo: '2026-04-30' }), [w], new Set())?.id).toBe('w1');
    expect(findMatchingWork(op({ dateFrom: '2026-04-27', dateTo: '2026-04-29' }), [w], new Set())).toBeNull();
  });
  it('plaani kuupäev arvestatakse, plaanita ja kanneteta töö ei sobi', () => {
    expect(findMatchingWork(op({}), [work({ plannedFrom: '2026-04-28', plannedTo: null })], new Set())?.id).toBe('w1');
    expect(findMatchingWork(op({}), [work({})], new Set())).toBeNull();
  });
  it('teine tegevus või juba seotud töö ei sobi', () => {
    const w = work({ plannedFrom: '2026-04-27' });
    expect(findMatchingWork(op({ type: 'Rullimine' }), [w], new Set())).toBeNull();
    expect(findMatchingWork(op({}), [w], new Set(['w1']))).toBeNull();
  });
  it('taimekaitsel peab olema ühine toode; mitme seast lähim', () => {
    const tkv = 'Taimekaitsevahendi kasutamine';
    const o = op({ type: tkv, dateFrom: '2026-05-26', products: [prod({ name: 'Tombo WG' })] });
    const a = work({ id: 'a', activity: tkv, plannedFrom: '2026-05-25', productKeys: ['moxa'] });
    const b = work({ id: 'b', activity: tkv, plannedFrom: '2026-05-24', productKeys: ['tombo wg'] });
    const c = work({ id: 'c', activity: tkv, plannedFrom: '2026-05-26', productKeys: ['tombo wg'] });
    expect(findMatchingWork(o, [a, b, c], new Set())?.id).toBe('c');
    expect(findMatchingWork(o, [a], new Set())).toBeNull();
  });
});

describe('operationLines', () => {
  it('väetis: materjal normi, NPK ja registriga', () => {
    const [l] = operationLines(op({
      type: 'Väetamine',
      products: [prod({ category: 'Väetis registrist', name: 'NPK 18-12-9', kind: 'NPK väetis', amount: 250, unit: 'kg/ha', nKgHa: 45, pKgHa: 13.08, kKgHa: 18.68 })]
    }));
    expect(l).toMatchObject({ kind: 'MATERIAL', label: 'NPK 18-12-9', amount: 250, unit: 'kg', perHa: true, priaRegister: 'Väetis registrist', priaKind: 'NPK väetis', nKgHa: 45, materialCategory: 'FERTILIZER' });
  });
  it('külv: sort, liik ja seemne kategooria', () => {
    const [l] = operationLines(op({
      type: 'Külvamine/istutamine',
      products: [prod({ category: 'Eesti sordiregister', name: 'Testsort', kind: 'Suvinisu', spec: 'C1', amount: 200, unit: 'kg/ha' })]
    }));
    expect(l).toMatchObject({ kind: 'MATERIAL', label: 'Testsort', priaSpec: 'C1', materialCategory: 'SEED' });
  });
  it('saagikoristus: HARVEST, kultuuri tüüp meetodist', () => {
    const [l] = operationLines(op({ type: 'Saagikoristus', method: 'Põhikultuur', products: [prod({ kind: 'Terad', amount: 4, unit: 't/ha' })] }));
    expect(l).toMatchObject({ kind: 'HARVEST', label: 'Saak', amount: 4, unit: 't', perHa: true, priaKind: 'Terad', priaSpec: 'Põhikultuur', materialCategory: null });
  });
  it('seire: OBSERVATION, kogus ei ole ha kohta', () => {
    const [l] = operationLines(op({ type: 'Seire', products: [prod({ category: 'Umbrohud', name: 'Põldsinep', amount: 7, unit: 'taime/m2' })] }));
    expect(l).toMatchObject({ kind: 'OBSERVATION', label: 'Põldsinep', amount: 7, unit: 'taime/m2', perHa: false, priaRegister: 'Umbrohud' });
  });
  it('nimetu toode jäetakse vahele (v.a saak)', () => {
    expect(operationLines(op({ type: 'Väetamine', products: [prod({ amount: 1, unit: 'kg/ha' })] }))).toEqual([]);
  });
});
```

- [ ] **Step 2: FAIL** — `npx vitest run src/server/fieldBookRules.test.ts`.

- [ ] **Step 3: Kirjuta** `src/server/fieldBookRules.ts`:

```ts
// src/server/fieldBookRules.ts — PRIA põlluraamatu rea sidumine Terise tööga ja rea tooted → read.
// Puhtad funktsioonid (andmebaasita), kasutab fieldBookImport.ts.
import type { FieldBookImportOperation } from '../types/fieldOperation';
import type { MaterialCategory } from '../types/fieldWork';
import { PRIA_ACTIVITY, baseUnit, daysApart, materialCategoryFor, nameKey, type PriaAttrs } from '../services/pria.ts';

export const MATCH_TOLERANCE_DAYS = 2;

// Tegevused, kus sama päeva lähedal võib olla mitu eri tööd — siis peab ühtima ka toode
const PRODUCT_MATCH_ACTIVITIES = new Set<string>([PRIA_ACTIVITY.PLANT_PROTECTION, PRIA_ACTIVITY.FERTILIZING]);

export interface ExistingWork {
  id: string;
  activity: string; // töötüübi priaCode
  plannedFrom: string | null;
  plannedTo: string | null;
  entries: { from: string; to: string | null }[];
  productKeys: string[]; // plaani- ja kanderidade materjalide nameKey
}

export function findMatchingWork(
  op: { type: string; dateFrom: string; dateTo: string | null; products: { name: string | null }[] },
  works: ExistingWork[],
  taken: Set<string>
): ExistingWork | null {
  const range = { from: op.dateFrom, to: op.dateTo };
  const opKeys = new Set(op.products.map((p) => nameKey(p.name)).filter(Boolean));
  let best: { work: ExistingWork; gap: number } | null = null;
  for (const w of works) {
    if (w.activity !== op.type || taken.has(w.id)) continue;
    if (PRODUCT_MATCH_ACTIVITIES.has(op.type) && !w.productKeys.some((k) => opKeys.has(k))) continue;
    const ranges = [...(w.plannedFrom ? [{ from: w.plannedFrom, to: w.plannedTo }] : []), ...w.entries];
    if (!ranges.length) continue;
    const gap = Math.min(...ranges.map((r) => daysApart(range, r)));
    if (gap <= MATCH_TOLERANCE_DAYS && (!best || gap < best.gap)) best = { work: w, gap };
  }
  return best?.work ?? null;
}

export interface OperationLine extends PriaAttrs {
  kind: 'MATERIAL' | 'HARVEST' | 'OBSERVATION';
  label: string;
  amount: number | null;
  unit: string;
  perHa: boolean; // kogus on hektari kohta (MATERIAL, HARVEST)
  materialCategory: MaterialCategory | null;
}

export function operationLines(op: FieldBookImportOperation): OperationLine[] {
  const out: OperationLine[] = [];
  for (const p of op.products) {
    const unit = p.unit ?? '';
    const common = {
      priaRegister: p.category, priaKind: p.kind, priaSpec: p.spec, activeIngredient: p.activeIngredient,
      nKgHa: p.nKgHa, pKgHa: p.pKgHa, kKgHa: p.kKgHa
    };
    if (op.type === PRIA_ACTIVITY.HARVEST) {
      out.push({ ...common, kind: 'HARVEST', label: 'Saak', amount: p.amount, unit: baseUnit(unit) || 't', perHa: unit.endsWith('/ha'), priaSpec: op.method, materialCategory: null });
    } else if (op.type === PRIA_ACTIVITY.MONITORING) {
      if (p.name) out.push({ ...common, kind: 'OBSERVATION', label: p.name, amount: p.amount, unit, perHa: false, materialCategory: null });
    } else if (p.name) {
      out.push({ ...common, kind: 'MATERIAL', label: p.name, amount: p.amount, unit: baseUnit(unit), perHa: unit.endsWith('/ha'), materialCategory: materialCategoryFor(op.type, p.category) });
    }
  }
  return out;
}
```

- [ ] **Step 4: PASS** — sama käsk.

- [ ] **Step 5: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/fieldBookRules.ts src/server/fieldBookRules.test.ts && git commit -m "PRIA põlluraamatu rea sidumine Terise tööga (±2 päeva, ühine toode)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 7: Import — kirjutaja, endpoint ja eelvaade

**Files:**
- Create: `src/server/fieldBookImport.ts`
- Modify: `src/server/apiHandler.ts` (asenda `POST /api/field-operations/import` plokk `POST /api/field-book/import`-iga)
- Modify: `src/types/fieldOperation.ts` (`FieldBookImportResult`, `FieldBookPreviewRow`)
- Modify: `src/services/api.ts` (`importFieldBook`), `src/services/fieldBookImport.ts`, `src/services/fieldBookImport.test.ts`, `src/components/FieldBookUploadModal.tsx`

**Interfaces:**
- Consumes: Task 6 `findMatchingWork`, `operationLines`; Task 2 `PRIA_ACTIVITIES`, `totalFromRate`, `nameKey`; `ensureSeasons` (`src/server/seasons.ts`); `syncFieldWorkStatus` — **eksportida** `src/server/fieldWorks.ts`-ist (lisa `export` ja valikuline `db` parameeter, vt Step 2).
- Produces:
  - `importFieldSeasonOperations(tx: Prisma.TransactionClient, fieldSeasonId: number, ops: FieldBookImportOperation[], opts: { userId: string | null; fieldAreaHa: number }): Promise<{ created: number; complemented: number }>`
  - `ensurePriaWorkTypes(tx): Promise<Map<string, { id: string; phase: WorkPhase }>>` (sama failis, eksporditud)
  - `FieldBookImportResult = { success: boolean; imported: number; created: number; complemented: number; skipped: { fieldCode: string; num: string; season: number; reason: string }[] }`

- [ ] **Step 1: `syncFieldWorkStatus` tehingus** — `src/server/fieldWorks.ts`: muuda signatuur `export async function syncFieldWorkStatus(fieldWorkId: string, finish: boolean, userId: string | null, db: Prisma.TransactionClient | typeof prisma = prisma)` ja asenda funktsiooni sees `prisma.` → `db.`. Kõik olemasolevad kutsed jäävad samaks.

- [ ] **Step 2: Kirjutaja** `src/server/fieldBookImport.ts`:

```ts
// src/server/fieldBookImport.ts — PRIA põlluraamatu väljavõtte rida → Terise töö (plaan) + kanne.
// Olemasolev sobiv töö (sama tegevus, ±2 päeva, taimekaitsel/väetamisel ühine toode) ainult täiendatakse:
// täidetakse tühjad plaaniväljad ja puuduvad plaaniread; kandeid ei looda ega muudeta.
import type { Prisma } from '@prisma/client';
import type { FieldBookImportOperation } from '../types/fieldOperation';
import type { WorkPhase } from '../types/fieldWork';
import { PRIA_ACTIVITIES, nameKey, totalFromRate } from '../services/pria.ts';
import { findMatchingWork, operationLines, type ExistingWork, type OperationLine } from './fieldBookRules.ts';
import { syncFieldWorkStatus } from './fieldWorks.ts';

type Tx = Prisma.TransactionClient;
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const asDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

export async function ensurePriaWorkTypes(tx: Tx): Promise<Map<string, { id: string; phase: WorkPhase }>> {
  const map = new Map<string, { id: string; phase: WorkPhase }>();
  for (const a of PRIA_ACTIVITIES) {
    const row = (await tx.workType.findFirst({ where: { priaCode: a.name } }))
      ?? (await tx.workType.create({ data: { name: a.name, priaCode: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder } }));
    map.set(a.name, { id: row.id, phase: row.phase as WorkPhase });
  }
  return map;
}

async function materialFor(tx: Tx, line: OperationLine, cache: Map<string, string>): Promise<string | null> {
  if (line.kind !== 'MATERIAL' || !line.materialCategory) return null;
  const key = `${line.materialCategory}:${nameKey(line.label)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const existing = await tx.material.findFirst({ where: { category: line.materialCategory, name: { equals: line.label, mode: 'insensitive' } } });
  const id = existing?.id ?? (await tx.material.create({ data: { name: line.label, category: line.materialCategory, unit: line.unit || 'kg' } })).id;
  cache.set(key, id);
  return id;
}

const planLine = (l: OperationLine, materialId: string | null, sortOrder: number) => ({
  kind: l.kind as 'MATERIAL' | 'HARVEST',
  materialId,
  label: l.label,
  unit: l.unit,
  ratePerHa: l.perHa ? l.amount : null,
  priaRegister: l.priaRegister, priaKind: l.priaKind, priaSpec: l.priaSpec, activeIngredient: l.activeIngredient,
  nKgHa: l.nKgHa, pKgHa: l.pKgHa, kKgHa: l.kKgHa,
  sortOrder
});

export async function importFieldSeasonOperations(
  tx: Tx,
  fieldSeasonId: number,
  ops: FieldBookImportOperation[],
  opts: { userId: string | null; fieldAreaHa: number }
): Promise<{ created: number; complemented: number }> {
  const types = await ensurePriaWorkTypes(tx);
  const typeById = new Map([...types].map(([name, t]) => [t.id, name]));
  const rows = await tx.fieldWork.findMany({
    where: { fieldSeasonId },
    include: { lines: true, entries: { include: { lines: true } } }
  });
  const existing: ExistingWork[] = rows.map((w) => ({
    id: w.id,
    activity: typeById.get(w.workTypeId) ?? '',
    plannedFrom: day(w.plannedDateFrom),
    plannedTo: day(w.plannedDateTo),
    entries: w.entries.map((e) => ({ from: day(e.date)!, to: day(e.dateTo) })),
    productKeys: [...w.lines.map((l) => nameKey(l.label)), ...w.entries.flatMap((e) => e.lines.filter((l) => l.kind === 'MATERIAL').map((l) => nameKey(l.label)))]
  }));
  const rowById = new Map(rows.map((w) => [w.id, w]));
  const taken = new Set<string>();
  const materials = new Map<string, string>();
  let created = 0;
  let complemented = 0;
  const last = await tx.fieldWork.findFirst({ where: { fieldSeasonId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
  let sortOrder = (last?.sortOrder ?? -1) + 1;

  for (const op of ops) {
    const type = types.get(op.type);
    if (!type) continue; // tundmatu tegevus (PRIA lisas uue) — jääb vahele
    const lines = operationLines(op);
    const match = findMatchingWork(op, existing, taken);

    if (match) {
      taken.add(match.id);
      const w = rowById.get(match.id)!;
      const patch: Prisma.FieldWorkUncheckedUpdateInput = {};
      if (!w.plannedDateFrom) { patch.plannedDateFrom = asDate(op.dateFrom); patch.plannedDateTo = asDate(op.dateTo); }
      if (w.plannedAreaHa == null && op.areaHa != null) patch.plannedAreaHa = op.areaHa;
      if (!w.method && op.method && op.type !== 'Saagikoristus') patch.method = op.method;
      if (!w.plannedWorkerId && op.performerId) patch.plannedWorkerId = op.performerId;
      if (!w.notes && op.notes) patch.notes = op.notes;
      if (Object.keys(patch).length) await tx.fieldWork.update({ where: { id: w.id }, data: patch });
      const have = new Set(w.lines.map((l) => `${l.kind}:${nameKey(l.label)}`));
      const add = lines.filter((l) => l.kind !== 'OBSERVATION' && !have.has(`${l.kind}:${nameKey(l.label)}`));
      for (const [i, l] of add.entries()) {
        await tx.fieldWorkLine.create({ data: { ...planLine(l, await materialFor(tx, l, materials), w.lines.length + i), fieldWorkId: w.id } });
      }
      complemented++;
      continue;
    }

    const area = op.areaHa ?? opts.fieldAreaHa;
    const planLines = [];
    const entryLines = [];
    for (const l of lines) {
      const materialId = await materialFor(tx, l, materials);
      if (l.kind !== 'OBSERVATION') planLines.push(planLine(l, materialId, planLines.length));
      const quantity = l.perHa ? totalFromRate(l.amount, area) : l.amount;
      entryLines.push({
        kind: l.kind, materialId, label: l.label, unit: l.unit, quantity: quantity ?? 0,
        ratePerHa: l.perHa ? l.amount : null,
        priaRegister: l.priaRegister, priaKind: l.priaKind, priaSpec: l.priaSpec, activeIngredient: l.activeIngredient,
        nKgHa: l.nKgHa, pKgHa: l.pKgHa, kKgHa: l.kKgHa,
        sortOrder: entryLines.length
      });
    }
    const method = op.type === 'Saagikoristus' ? null : op.method;
    const work = await tx.fieldWork.create({
      data: {
        fieldSeasonId, workTypeId: type.id, phase: type.phase, sortOrder: sortOrder++, plannedCount: 1, source: 'PRIA_IMPORT',
        plannedDateFrom: asDate(op.dateFrom), plannedDateTo: asDate(op.dateTo), plannedAreaHa: op.areaHa,
        method, plannedWorkerId: op.performerId, notes: op.notes,
        lines: { create: planLines },
        entries: {
          create: {
            date: asDate(op.dateFrom)!, dateTo: asDate(op.dateTo), areaHa: area, method, workerId: op.performerId,
            notes: op.notes, source: 'PRIA_IMPORT', createdById: opts.userId,
            lines: { create: entryLines }
          }
        }
      }
    });
    await syncFieldWorkStatus(work.id, true, opts.userId, tx);
    taken.add(work.id);
    created++;
  }
  return { created, complemented };
}
```

Märkus `performerId` puudumisel: eelvaade (Step 5) lisab märkustesse `Teostaja: <nimi>`, nii et server ei pea nime teadma.

- [ ] **Step 3: Endpoint** — `src/server/apiHandler.ts`: asenda kogu `if (pathname === '/api/field-operations/import' && method === 'POST') { … }` plokk:

```ts
    if (pathname === '/api/field-book/import' && method === 'POST') {
      if (!isAdmin(req)) return json(res, { error: IMPORT_FORBIDDEN }, 403);
      const body = await parseBody(req);
      const operatorId: string | undefined = body?.operatorId;
      const fieldsIn: any[] = Array.isArray(body?.fields) ? body.fields : [];
      if (!operatorId) return json(res, { error: 'operatorId on kohustuslik' }, 400);
      const userId = (sessionUserOf(req) as { id?: string } | null)?.id ?? null;

      const result = await tenantTransaction(
        async (tx) => {
          let imported = 0, created = 0, complemented = 0;
          const skipped: { fieldCode: string; num: string; season: number; reason: string }[] = [];
          const seasonIds = await ensureSeasons(fieldsIn.map((f) => f?.season), tx);

          for (const f of fieldsIn) {
            const field = await tx.field.findFirst({ where: { fieldCode: String(f.fieldCode), num: String(f.num), operatorId } });
            const fieldSeason = field
              ? await tx.fieldSeason.findUnique({
                  where: { fieldId_year: { fieldId: field.id, year: Number(f.season) } },
                  include: { season: { select: { isLocked: true } } }
                })
              : null;
            if (!fieldSeason) { skipped.push({ fieldCode: f.fieldCode, num: f.num, season: f.season, reason: 'põldu ei leitud' }); continue; }
            if (fieldSeason.season?.isLocked) { skipped.push({ fieldCode: f.fieldCode, num: f.num, season: f.season, reason: 'hooaeg on lukus' }); continue; }
            const seasonId = seasonIds.get(Number(f.season));
            if (seasonId && fieldSeason.seasonId !== seasonId) {
              await tx.fieldSeason.update({ where: { id: fieldSeason.id }, data: { seasonId } });
            }

            const r = await importFieldSeasonOperations(tx, fieldSeason.id, Array.isArray(f.operations) ? f.operations : [], {
              userId, fieldAreaHa: fieldSeason.areaHa
            });
            created += r.created;
            complemented += r.complemented;

            // Tühi väärtus failis ei kustuta olemasolevat.
            const seasonUpdate: Record<string, unknown> = {};
            if (f.targetYieldTonsHa != null) seasonUpdate.targetYieldTonsHa = Number(f.targetYieldTonsHa);
            if (f.actualYieldTonsHa != null) seasonUpdate.actualYieldTonsHa = Number(f.actualYieldTonsHa);
            if (f.seedingDate) seasonUpdate.seedingDate = new Date(f.seedingDate);
            if (f.harvestDate) seasonUpdate.harvestDate = new Date(f.harvestDate);
            if (Object.keys(seasonUpdate).length > 0) await tx.fieldSeason.update({ where: { id: fieldSeason.id }, data: seasonUpdate });
            imported++;
          }
          return { imported, created, complemented, skipped };
        },
        { timeout: 120000 }
      );
      return json(res, { success: true, ...result });
    }
```
Lisa importid: `import { importFieldSeasonOperations } from './fieldBookImport.ts';` ja `sessionUserOf`, kui seda failis veel pole (`import { sessionUserOf } from './authGate.ts';`). Kontrolli, kuidas `fieldWorks.ts` saab `userId` (otsi `userId` definitsiooni `handleFieldWorks` alguses) ja kasuta sama allikat.

- [ ] **Step 4: Tüübid ja klient** — `src/types/fieldOperation.ts`: asenda `FieldBookImportResult`:
```ts
export interface FieldBookImportResult {
  success: boolean;
  imported: number;
  created: number;      // uued tööd + kanded
  complemented: number; // olemasolevad tööd, mida täiendati
  skipped: { fieldCode: string; num: string; season: number; reason: string }[];
}
```
`FieldBookPreviewRow`: nimeta `existingOperationsCount` → `existingWorksCount` (kommentaar: "Terises sel hooajal juba olevad tööd (import sobitab, ei kustuta)"). `src/services/api.ts` `importFieldBook`: URL `'/api/field-book/import'`.

- [ ] **Step 5: Eelvaade** — `src/services/fieldBookImport.ts`:
  - `existingOperationsCount` → `existingWorksCount: field?.history.find((h) => h.year === s.season)?.worksCount ?? 0`. Kui `FieldYearlyRecord`-il `worksCount` puudub, lisa see `src/types/fieldRegister.ts`-i (`worksCount?: number`) ja `GET /api/master-fields` vastusesse (`apiHandler.ts:301-364`, kus praegu arvutatakse `operationsCount` — asenda `_count: { select: { fieldOperations: true } }` kõrvale `fieldWorks: true` ja kaardista `worksCount`).
  - Teostaja, keda registrist ei leitud, läheb märkustesse:
    ```ts
        notes: performer || !op.performerName ? op.notes : [op.notes, `Teostaja: ${op.performerName}`].filter(Boolean).join('\n'),
    ```
  - `src/services/fieldBookImport.test.ts`: uuenda ootused (`existingWorksCount`; lisa test, et leidmata teostaja nimi lisatakse märkustesse).
- `src/components/FieldBookUploadModal.tsx`: tekstid — veerg "Olemas" näitab `existingWorksCount`; hoiatus "import asendab tegevused" asendub tekstiga "Olemasolevad tööd jäävad alles; sama tegevus ±2 päeva sees seotakse, muud lisatakse uute töödena." Tulemuse teade: `Imporditud ${r.imported} põldu: ${r.created} uut tööd, ${r.complemented} täiendatud` + vahele jäetud põhjustega.

- [ ] **Step 6: Kontroll** — `npx tsc --noEmit -p tsconfig.app.json && npm test`. Käsitsi: 2027 hooajal pole PRIA andmeid; testi importi alles Task 10-s üleviimisskriptiga ja Task 11 järel failiga.

- [ ] **Step 7: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/fieldBookImport.ts src/server/apiHandler.ts src/server/fieldWorks.ts src/types/fieldOperation.ts src/types/fieldRegister.ts src/services/api.ts src/services/fieldBookImport.ts src/services/fieldBookImport.test.ts src/components/FieldBookUploadModal.tsx && git commit -m "PRIA väljavõtte import loob Terise tööd ja kanded, olemasolevaid täiendab

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 8: Põllu hooaja tööde päring

**Files:**
- Modify: `src/server/fieldWorks.ts` (uus route), `src/services/api.ts`, `src/types/fieldWork.ts`

**Interfaces:**
- Consumes: Task 5 `FIELD_WORK_INCLUDE`, `fieldWorkDto`.
- Produces:
  - `GET /api/field-season-works?fieldId=&year=` → `FieldSeasonWorks`
  - `export interface FieldSeasonWorks { fieldSeasonId: number | null; areaHa: number; targetYieldTonsHa: number | null; actualYieldTonsHa: number | null; works: FieldWork[] }`
  - `api.getFieldSeasonWorks(fieldId: number | string, year: number): Promise<FieldSeasonWorks>`

- [ ] **Step 1: Route** — `handleFieldWorks` sees, `GET /api/field-works` ploki järele:

```ts
  // Ühe põllu ühe hooaja tööd (põllu täisvaade)
  if (pathname === '/api/field-season-works' && method === 'GET') {
    const fieldId = int(url.searchParams.get('fieldId'));
    const year = int(url.searchParams.get('year'));
    if (!fieldId || !year) {
      json(res, { error: 'fieldId ja year on kohustuslikud' }, 400);
      return true;
    }
    const fs = await prisma.fieldSeason.findUnique({ where: { fieldId_year: { fieldId, year } } });
    if (!fs) {
      json(res, { fieldSeasonId: null, areaHa: 0, targetYieldTonsHa: null, actualYieldTonsHa: null, works: [] });
      return true;
    }
    const works = await prisma.fieldWork.findMany({
      where: { fieldSeasonId: fs.id },
      orderBy: [{ plannedDateFrom: 'asc' }, { sortOrder: 'asc' }],
      include: FIELD_WORK_INCLUDE
    });
    const finance = canSeeFinance(req);
    json(res, {
      fieldSeasonId: fs.id,
      areaHa: fs.areaHa,
      targetYieldTonsHa: fs.targetYieldTonsHa,
      actualYieldTonsHa: fs.actualYieldTonsHa,
      works: works.map((w) => fieldWorkDto(w, finance))
    });
    return true;
  }
```
Kontrolli, et `handleFieldWorks` saab selle tee kätte (vaata `apiHandler.ts:242` — kui suunamine toimub prefiksi `/api/field-works` või `/api/work-` järgi, lisa `/api/field-season-works` tingimusse).

- [ ] **Step 2: Tüüp ja klient** — `src/types/fieldWork.ts` lisa `FieldSeasonWorks`; `src/services/api.ts`:
```ts
  async getFieldSeasonWorks(fieldId: number | string, year: number): Promise<FieldSeasonWorks> {
    return jsonOrThrow(await apiFetch(`/api/field-season-works?fieldId=${encodeURIComponent(String(fieldId))}&year=${year}`), 'Põllu tööde laadimine ebaõnnestus');
  },
```

- [ ] **Step 3: Kontroll** — tüübikontroll; seejärel brauseri konsoolis (sisse logitud): `await (await fetch('/api/field-season-works?fieldId=7&year=2026')).json()` → `works` massiiv (praegu malli tööd; PRIA andmed tulevad Task 10).

- [ ] **Step 4: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/fieldWorks.ts src/server/apiHandler.ts src/services/api.ts src/types/fieldWork.ts && git commit -m "Põllu hooaja tööde päring täisvaate jaoks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 9: Põllu täisvaade

**Files:**
- Create: `src/components/FieldOverviewPanel.tsx`, `src/components/FieldWorksTimeline.tsx`, `src/components/FieldFullView.tsx`
- Modify: `src/App.tsx:1799-1810, 1902-1911` (+ import), `src/index.css` (lõppu)

**Interfaces:**
- Consumes: `api.getFieldSeasonWorks` (Task 8), `FieldWork`, `WorkEntry`, `FieldSeasonWorks`, `WORK_PHASE_META` (`src/types/fieldWork.ts`), `formatDate`, `formatDateRange` (`src/services/dateFormat.ts`), olemasolevad `FieldDetailsDrawer` propsid.
- Produces:
  - `FieldFullView` propsid = `FieldDetailsDrawer` propsid + `onEditField?: (fieldId: number) => void` + `onEditWork?: (work: FieldWork | null, phaseFilter?: WorkPhase) => void` + `onEditEntry?: (work: FieldWork, entry: WorkEntry | null) => void` + `reloadKey?: number`.
  - `FieldWorksTimeline` propsid: `{ data: FieldSeasonWorks | null; loading: boolean; canEdit: boolean; onAddWork: () => void; onEditWork: (w: FieldWork) => void; onAddEntry: (w: FieldWork) => void; onEditEntry: (w: FieldWork, e: WorkEntry) => void }`.
  - `FieldOverviewPanel` propsid: `{ shown: FieldFeature; soilSamples: SoilSample[]; satelliteDate: string | null }`.

- [ ] **Step 1: `FieldOverviewPanel`** — loo fail ja tõsta `FieldDetailsDrawer.tsx`-ist muutmata kujul kogu vasaku veeru JSX (alates statistika ruudustikust `PINDALA` kuni "Märkmed ja agrotehnika" plokini, ligikaudu read 158–387) koos selle vajatud olekuga (`showCoordsList`, `cadastralParcels`, `perimeterMeters`, `coordsList`, `pointsCount`, `totalTax`, `totalRent`, `progress`, `isSeasonLocked` ei kuulu siia) ja importidega. Komponendi päis:

```tsx
// src/components/FieldOverviewPanel.tsx — põllu üldandmed (statistika, katastrid, piirid, mullaproovid, NDVI, märkmed).
// Tõstetud FieldDetailsDrawer'ist; kasutab FieldFullView vasak veerg.
import React, { useState } from 'react';
// ... samad lucide ja teenuste impordid, mida tõstetud JSX kasutab
import type { FieldFeature } from '../types/field';
import type { SoilSample } from '../types/soilSample';

interface FieldOverviewPanelProps {
  shown: FieldFeature;
  soilSamples: SoilSample[];
  satelliteDate: string | null;
}

export const FieldOverviewPanel: React.FC<FieldOverviewPanelProps> = ({ shown, soilSamples, satelliteDate }) => {
  const [showCoordsList, setShowCoordsList] = useState(false);
  const props = shown.properties;
  // ... arvutused täpselt nagu FieldDetailsDrawer'is
  return <div className="field-overview">{/* tõstetud JSX */}</div>;
};
```
Lisa vasaku veeru lõppu kasutusõigus ja maakasutus, kui `props.rawProperties?.landUse` / `rawProperties?.usageRight` on olemas (kui neid väljanimesid andmetes pole, jäta see osa ära — need tulevad PRIA shp impordist; kontrolli `shpParser.ts`-is).

`FieldDetailsDrawer.tsx` muuda kasutama `<FieldOverviewPanel shown={shown} soilSamples={soilSamples} satelliteDate={satelliteDate} />` — popup peab nägema välja samasugune nagu enne (vaheetapp, et tõstmist kontrollida).

- [ ] **Step 2: Kontroll** — tüübikontroll; ava kaardil põld 10 → popup näeb välja nagu ekraanipildil. Commit:

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/FieldOverviewPanel.tsx src/components/FieldDetailsDrawer.tsx && git commit -m "Põllu üldandmete paneel eraldi komponendiks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

- [ ] **Step 3: `FieldWorksTimeline`**:

```tsx
// src/components/FieldWorksTimeline.tsx — põllu hooaja tööd ajajoonena: plaan + kanded (tegelik).
import React, { useMemo, useState } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight, FileInput } from 'lucide-react';
import { formatDate, formatDateRange } from '../services/dateFormat';
import { WORK_PHASE_META, WORK_PHASES, type FieldSeasonWorks, type FieldWork, type WorkEntry, type WorkPhase, type FieldWorkPlanLine, type WorkEntryMaterial } from '../types/fieldWork';

const num = (n: number | null | undefined, d = 2) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: d }));
const range = (from: string | null, to: string | null) => (from ? (to && to !== from ? formatDateRange(from, to) : formatDate(from)) : null);
const STATUS_LABEL = { PLANNED: 'Planeeritud', IN_PROGRESS: 'Töös', DONE: 'Tehtud' } as const;

type Filter = 'all' | WorkPhase | 'planned';

// Töö kuupäev ajajoone järjestuseks: esimene kanne, siis plaan
const sortKey = (w: FieldWork) => w.entries.map((e) => e.date).sort()[0] ?? w.plannedDateFrom ?? '9999';

const lineText = (l: Pick<FieldWorkPlanLine, 'label' | 'priaKind' | 'priaRegister' | 'priaSpec' | 'activeIngredient' | 'nKgHa' | 'pKgHa' | 'kKgHa' | 'ratePerHa' | 'unit'>, total?: number | null) =>
  [
    l.label,
    l.priaKind,
    l.priaSpec,
    l.ratePerHa != null ? `${num(l.ratePerHa)} ${l.unit}/ha` : null,
    total != null ? `= ${num(total)} ${l.unit}` : null,
    l.nKgHa != null || l.pKgHa != null || l.kKgHa != null ? `N ${num(l.nKgHa)} P ${num(l.pKgHa)} K ${num(l.kKgHa)}` : null,
    l.activeIngredient ? `toimeaine ${l.activeIngredient}` : null
  ].filter(Boolean).join(' · ');

const EntryRow: React.FC<{ work: FieldWork; entry: WorkEntry; onEdit?: () => void }> = ({ work, entry, onEdit }) => {
  const planByKey = new Map(work.lines.map((l) => [l.label.toLowerCase(), l]));
  return (
    <button type="button" className="fwt-entry" onClick={onEdit} disabled={!onEdit}>
      <span className="fwt-entry-head">
        <strong>{range(entry.date, entry.dateTo)}</strong>
        {entry.areaHa != null && <span>{num(entry.areaHa)} ha</span>}
        {entry.workerName && <span>{entry.workerName}</span>}
        {(entry.vehicleName || entry.implementName) && <span>{[entry.vehicleName, entry.implementName].filter(Boolean).join(' + ')}</span>}
        {entry.equipmentHours != null && <span>{num(entry.equipmentHours)} h</span>}
        {entry.fuelLiters != null && <span>{num(entry.fuelLiters, 1)} l</span>}
        {entry.source === 'PRIA_IMPORT' && <span className="fwt-badge" title="Imporditud PRIA põlluraamatust"><FileInput size={12} /> PRIA</span>}
      </span>
      {entry.materials.map((m: WorkEntryMaterial, i) => {
        const plan = planByKey.get(m.name.toLowerCase());
        const differs = plan?.ratePerHa != null && m.ratePerHa != null && Math.abs(plan.ratePerHa - m.ratePerHa) > 0.005;
        return (
          <span key={i} className="fwt-line">
            {lineText({ label: m.name, unit: m.unit, ratePerHa: m.ratePerHa ?? null, priaKind: m.priaKind ?? null, priaRegister: m.priaRegister ?? null, priaSpec: m.priaSpec ?? null, activeIngredient: m.activeIngredient ?? null, nKgHa: m.nKgHa ?? null, pKgHa: m.pKgHa ?? null, kKgHa: m.kKgHa ?? null }, m.quantity)}
            {differs && <span className="fwt-plan-diff"> (plaan {num(plan!.ratePerHa)} {m.unit}/ha)</span>}
          </span>
        );
      })}
      {entry.harvest && (
        <span className="fwt-line">Saak {num(entry.harvest.ratePerHa)} t/ha = {num(entry.harvest.tonnes)} t{entry.harvest.priaKind ? ` · ${entry.harvest.priaKind}` : ''}{entry.harvest.priaSpec ? ` · ${entry.harvest.priaSpec}` : ''}</span>
      )}
      {!entry.harvest && entry.harvestTonnes != null && <span className="fwt-line">Saak {num(entry.harvestTonnes)} t</span>}
      {entry.observations.map((o, i) => (
        <span key={`o${i}`} className="fwt-line">{o.priaRegister ? `${o.priaRegister}: ` : ''}{o.label}{o.unit ? ` · ${num(o.quantity)} ${o.unit}` : ''}</span>
      ))}
    </button>
  );
};

const WorkItem: React.FC<{ work: FieldWork; canEdit: boolean; onEditWork: () => void; onAddEntry: () => void; onEditEntry: (e: WorkEntry) => void }> = ({ work, canEdit, onEditWork, onAddEntry, onEditEntry }) => {
  const [showNotes, setShowNotes] = useState(false);
  const meta = WORK_PHASE_META[work.phase];
  const entries = [...work.entries].sort((a, b) => a.date.localeCompare(b.date));
  const planned = range(work.plannedDateFrom, work.plannedDateTo) ?? work.plannedText;
  return (
    <article className={`fwt-work ${work.status.toLowerCase()}`} style={{ borderLeftColor: meta.color }}>
      <header className="fwt-work-head">
        <span className="fwt-work-title">{work.workTypeName}{work.method ? <small> · {work.method}</small> : null}</span>
        <span className={`fwt-status ${work.status.toLowerCase()}`}>{STATUS_LABEL[work.status]}</span>
        {canEdit && (
          <span className="fwt-actions">
            <button type="button" className="icon-btn-ghost" title="Muuda plaani" onClick={onEditWork}><Pencil size={14} /></button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onAddEntry}><Plus size={13} /> Kanne</button>
          </span>
        )}
      </header>
      {(planned || work.lines.length > 0 || work.plannedWorkerName) && (
        <div className="fwt-plan">
          <span className="fwt-plan-label">Plaan</span>
          <span>
            {[planned, work.plannedAreaHa != null ? `${num(work.plannedAreaHa)} ha` : null, work.plannedWorkerName].filter(Boolean).join(' · ')}
          </span>
          {work.lines.map((l, i) => <span key={i} className="fwt-line">{lineText(l)}</span>)}
        </div>
      )}
      {entries.map((e) => <EntryRow key={e.id} work={work} entry={e} onEdit={canEdit ? () => onEditEntry(e) : undefined} />)}
      {work.notes && (
        <button type="button" className="fwt-notes-toggle" onClick={() => setShowNotes(!showNotes)}>
          {showNotes ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Märkused
        </button>
      )}
      {showNotes && <p className="fwt-notes">{work.notes}</p>}
    </article>
  );
};

interface FieldWorksTimelineProps {
  data: FieldSeasonWorks | null;
  loading: boolean;
  canEdit: boolean;
  onAddWork: () => void;
  onEditWork: (w: FieldWork) => void;
  onAddEntry: (w: FieldWork) => void;
  onEditEntry: (w: FieldWork, e: WorkEntry) => void;
}

export const FieldWorksTimeline: React.FC<FieldWorksTimelineProps> = ({ data, loading, canEdit, onAddWork, onEditWork, onAddEntry, onEditEntry }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const works = data?.works ?? [];
  const { done, plannedOnly, npk } = useMemo(() => {
    const npk = { n: 0, p: 0, k: 0 };
    for (const w of works) for (const e of w.entries) for (const m of e.materials) {
      const share = e.areaHa && data?.areaHa ? e.areaHa / data.areaHa : 1;
      npk.n += (m.nKgHa ?? 0) * share; npk.p += (m.pKgHa ?? 0) * share; npk.k += (m.kKgHa ?? 0) * share;
    }
    return {
      done: works.filter((w) => w.entries.length > 0).sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
      plannedOnly: works.filter((w) => w.entries.length === 0).sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
      npk
    };
  }, [works, data?.areaHa]);
  const match = (w: FieldWork) => filter === 'all' || (filter === 'planned' ? w.entries.length === 0 : w.phase === filter);

  return (
    <section className="fwt">
      <header className="fwt-head">
        <div className="fwt-summary">
          <span>{works.length} tööd · {works.filter((w) => w.status === 'DONE').length} tehtud</span>
          {(npk.n || npk.p || npk.k) ? <span>N {num(npk.n, 1)} P {num(npk.p, 1)} K {num(npk.k, 1)} kg/ha</span> : null}
          {(data?.targetYieldTonsHa != null || data?.actualYieldTonsHa != null) && (
            <span>saak {num(data?.targetYieldTonsHa) || '–'} / {num(data?.actualYieldTonsHa) || '–'} t/ha</span>
          )}
        </div>
        {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={onAddWork}><Plus size={14} /> Lisa töö</button>}
      </header>
      <div className="fwt-filters">
        {(['all', ...WORK_PHASES, 'planned'] as Filter[]).map((f) => (
          <button key={f} type="button" className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Kõik' : f === 'planned' ? 'Planeeritud' : WORK_PHASE_META[f].label}
          </button>
        ))}
      </div>
      {loading && <p className="fwt-empty">Laen…</p>}
      {!loading && works.length === 0 && <p className="fwt-empty">Sellel hooajal töid pole.</p>}
      {done.filter(match).map((w) => (
        <WorkItem key={w.id} work={w} canEdit={canEdit} onEditWork={() => onEditWork(w)} onAddEntry={() => onAddEntry(w)} onEditEntry={(e) => onEditEntry(w, e)} />
      ))}
      {plannedOnly.filter(match).length > 0 && <h4 className="fwt-group">Planeeritud</h4>}
      {plannedOnly.filter(match).map((w) => (
        <WorkItem key={w.id} work={w} canEdit={canEdit} onEditWork={() => onEditWork(w)} onAddEntry={() => onAddEntry(w)} onEditEntry={(e) => onEditEntry(w, e)} />
      ))}
    </section>
  );
};
```

- [ ] **Step 4: `FieldFullView`**:

```tsx
// src/components/FieldFullView.tsx — põllu täisvaade: päis + hooaeg, vasakul üldandmed, paremal tööde ajajoon.
// Asendab FieldDetailsDrawer'i. Kaart jääb taha alles; sulgemine ✕ või Esc.
import React, { useCallback, useEffect, useState } from 'react';
import { X, Crosshair, Lock, Pencil, CalendarDays } from 'lucide-react';
import type { FieldFeature } from '../types/field';
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import type { SoilSample } from '../types/soilSample';
import type { FieldSeasonWorks, FieldWork, WorkEntry } from '../types/fieldWork';
import { getFieldFeatureForYear } from '../types/fieldRegister';
import { api } from '../services/api';
import { FieldOverviewPanel } from './FieldOverviewPanel';
import { FieldWorksTimeline } from './FieldWorksTimeline';

interface FieldFullViewProps {
  field: FieldFeature | null;
  masterField?: MasterField | null;
  seasons?: FarmingSeason[];
  soilSamples?: SoilSample[];
  satelliteDate?: string | null;
  canEdit?: boolean;
  reloadKey?: number; // suureneb, kui töö/kanne salvestati väljaspool (dialoogid App'is)
  onClose: () => void;
  onFocusField: (field: FieldFeature) => void;
  onEditField?: (fieldId: number) => void;
  onEditWork?: (ctx: { fieldSeasonId: number; fieldLabel: string; fieldAreaHa: number; work: FieldWork | null }) => void;
  onEditEntry?: (ctx: { fieldLabel: string; fieldAreaHa: number; work: FieldWork; entry: WorkEntry | null }) => void;
}

export const FieldFullView: React.FC<FieldFullViewProps> = ({
  field, masterField = null, seasons = [], soilSamples = [], satelliteDate = null, canEdit = false, reloadKey = 0,
  onClose, onFocusField, onEditField, onEditWork, onEditEntry
}) => {
  const mapYear = field?.properties.year;
  const [viewYear, setViewYear] = useState<number | undefined>(mapYear);
  const [works, setWorks] = useState<FieldSeasonWorks | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setViewYear(mapYear), [field?.properties.id, mapYear]);

  useEffect(() => {
    if (!field) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [field, onClose]);

  const fieldId = field?.properties.id;
  const load = useCallback(() => {
    if (fieldId == null || viewYear == null) return;
    setLoading(true);
    api.getFieldSeasonWorks(fieldId, viewYear)
      .then(setWorks)
      .catch((e) => { console.error('Põllu tööde laadimine ebaõnnestus:', e); setWorks(null); })
      .finally(() => setLoading(false));
  }, [fieldId, viewYear]);
  useEffect(load, [load, reloadKey]);

  if (!field) return null;

  const years = masterField ? [...new Set(masterField.history.map((h) => h.year))].sort((a, b) => a - b) : [];
  const shown = masterField && viewYear !== undefined && viewYear !== mapYear && years.includes(viewYear)
    ? getFieldFeatureForYear(masterField, viewYear)
    : field;
  const p = shown.properties;
  const locked = seasons.find((s) => s.year === p.year)?.isLocked ?? false;
  const editable = canEdit && !locked && works?.fieldSeasonId != null;
  const fieldLabel = `Nr ${p.num ?? '–'} ${p.name} · ${p.crop} · ${(works?.areaHa ?? p.area ?? 0).toLocaleString('et-EE', { maximumFractionDigits: 2 })} ha · hooaeg ${p.year}`;
  const areaHa = works?.areaHa ?? 0;

  return (
    <div className="field-full-view" role="dialog" aria-label={`Põld ${p.name}`}>
      <header className="ffv-header">
        <div className="ffv-title">
          <span className="crop-indicator-dot" style={{ backgroundColor: p.cropColor || '#22c55e' }} />
          <h2>{p.name}</h2>
          <span className="ffv-badge">#{p.id}</span>
          {p.num && <span className="ffv-badge num">Nr {p.num}</span>}
          {p.fieldCode && <span className="ffv-code">{p.fieldCode}</span>}
          <span className="ffv-crop">{p.crop}</span>
        </div>
        <div className="ffv-actions">
          {canEdit && onEditField && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditField(Number(p.id))}><Pencil size={14} /> Muuda põldu</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onFocusField(shown); onClose(); }}><Crosshair size={14} /> Fookusta kaardil</button>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
      </header>
      {years.length > 1 && (
        <nav className="ffv-seasons">
          <CalendarDays size={14} /> <span>Hooaeg:</span>
          {years.map((y) => {
            const isLocked = seasons.find((s) => s.year === y)?.isLocked;
            return (
              <button key={y} type="button" className={`chip ${y === p.year ? 'active' : ''}`} onClick={() => setViewYear(y)}>
                {y}{isLocked && <Lock size={11} />}
              </button>
            );
          })}
        </nav>
      )}
      <div className="ffv-columns">
        <aside className="ffv-left">
          <FieldOverviewPanel shown={shown} soilSamples={soilSamples} satelliteDate={satelliteDate} />
        </aside>
        <main className="ffv-right">
          <FieldWorksTimeline
            data={works}
            loading={loading}
            canEdit={editable}
            onAddWork={() => works?.fieldSeasonId && onEditWork?.({ fieldSeasonId: works.fieldSeasonId, fieldLabel, fieldAreaHa: areaHa, work: null })}
            onEditWork={(w) => onEditWork?.({ fieldSeasonId: w.fieldSeasonId, fieldLabel, fieldAreaHa: areaHa, work: w })}
            onAddEntry={(w) => onEditEntry?.({ fieldLabel, fieldAreaHa: areaHa, work: w, entry: null })}
            onEditEntry={(w, e) => onEditEntry?.({ fieldLabel, fieldAreaHa: areaHa, work: w, entry: e })}
          />
        </main>
      </div>
    </div>
  );
};
```
Kontrolli `FieldFeature['properties']` väljanimesid (`name`, `num`, `fieldCode`, `crop`, `area`/`areaHa`, `cropColor`) failist `src/types/field.ts` ja kohanda.

Väike piirikaart (spets 4): lisa `FieldOverviewPanel`-i algusesse olemasolev `FieldShapeModal` eelvaate SVG, kui `FieldShapeModal.tsx`-is on taaskasutatav kujujoonistus (otsi `export`); kui pole, joonista lihtne SVG polügoon `shown.geometry` koordinaatidest (normaliseeri ümbritsevasse kasti, `viewBox="0 0 100 100"`). Hoia see eraldi väikese komponendina `FieldOutline` samas failis.

- [ ] **Step 5: Stiilid** — `src/index.css` lõppu:

```css
/* Põllu täisvaade */
.field-full-view { position: fixed; inset: var(--header-height, 56px) 0 0 0; z-index: 900; background: var(--bg-main, #fff); display: flex; flex-direction: column; overflow: hidden; }
.ffv-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border-color, #e5e7eb); }
.ffv-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ffv-title h2 { margin: 0; font-size: 1.35rem; }
.ffv-badge { padding: 2px 8px; border-radius: 6px; background: #f1f5f9; font-weight: 600; font-size: 0.85rem; }
.ffv-badge.num { border: 1.5px solid #15803d; color: #15803d; background: #fff; }
.ffv-code, .ffv-crop { color: var(--text-muted, #64748b); }
.ffv-actions { display: flex; align-items: center; gap: 8px; }
.ffv-seasons { display: flex; align-items: center; gap: 6px; padding: 8px 20px; border-bottom: 1px solid var(--border-color, #e5e7eb); flex-wrap: wrap; }
.ffv-columns { flex: 1; display: grid; grid-template-columns: minmax(320px, 1fr) 2fr; min-height: 0; }
.ffv-left, .ffv-right { overflow-y: auto; padding: 16px 20px; }
.ffv-left { border-right: 1px solid var(--border-color, #e5e7eb); }
.fwt-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
.fwt-summary { display: flex; gap: 14px; flex-wrap: wrap; color: var(--text-muted, #64748b); }
.fwt-filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.fwt-work { border: 1px solid var(--border-color, #e5e7eb); border-left-width: 4px; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; background: #fff; }
.fwt-work.planned { background: #fafafa; }
.fwt-work-head { display: flex; align-items: center; gap: 8px; }
.fwt-work-title { font-weight: 600; flex: 1; }
.fwt-work-title small { font-weight: 400; color: var(--text-muted, #64748b); }
.fwt-status { font-size: 0.75rem; padding: 1px 6px; border-radius: 4px; background: #f1f5f9; }
.fwt-status.done { background: #dcf5e4; color: #15803d; }
.fwt-status.in_progress { background: #fdf1d8; color: #9a5b00; }
.fwt-actions { display: flex; gap: 4px; }
.fwt-plan { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; padding: 6px 8px; background: #f8fafc; border-radius: 6px; color: #475569; font-size: 0.9rem; }
.fwt-plan-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
.fwt-entry { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; margin-top: 6px; padding: 6px 8px; border: 0; border-top: 1px dashed #e2e8f0; background: none; font: inherit; cursor: pointer; }
.fwt-entry:disabled { cursor: default; }
.fwt-entry:hover:not(:disabled) { background: #f8fafc; }
.fwt-entry-head { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.fwt-line { color: #334155; font-size: 0.9rem; }
.fwt-plan-diff { color: #94a3b8; }
.fwt-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem; padding: 0 5px; border-radius: 4px; background: #e8efff; color: #1d4ed8; }
.fwt-notes-toggle { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; border: 0; background: none; color: #15803d; cursor: pointer; font: inherit; font-size: 0.85rem; }
.fwt-notes { margin: 4px 0 0; white-space: pre-line; color: #475569; font-size: 0.9rem; }
.fwt-group { margin: 16px 0 8px; color: #64748b; font-size: 0.85rem; text-transform: uppercase; }
.fwt-empty { color: #94a3b8; }
@media (max-width: 900px) {
  .ffv-columns { grid-template-columns: 1fr; overflow-y: auto; }
  .ffv-left { order: 2; border-right: 0; border-top: 1px solid var(--border-color, #e5e7eb); overflow: visible; }
  .ffv-right { order: 1; overflow: visible; }
  .ffv-header { flex-wrap: wrap; padding: 10px 16px; }
}
```
Kontrolli `src/index.css`-is päise kõrguse muutuja nime (otsi `header-height` või `.app-header` kõrgust) ja kasuta seda; kontrolli, et `.chip` klass on olemas (kui mitte, kasuta `FieldWorksBoard` tahvli filtrinuppude klassi).

- [ ] **Step 6: App ühendamine** — `src/App.tsx`:
  - impordi `FieldFullView` (lazy nagu teised suured vaated) ja asenda mõlemad `<FieldDetailsDrawer … />` kasutused `<FieldFullView … />`-ga samade propsidega + `canEdit={true}` (kanded on kõigile kasutajatele lubatud nagu tahvlis) + `onEditField={(id) => { /* ava FieldEditDialog: sama, mida teeb Põllud vaade */ }}`. FieldEditDialog oleku jaoks lisa `const [editFieldId, setEditFieldId] = useState<number | null>(null)` ja renderda `FieldEditDialog` (vt `FieldsTableView.tsx:418` propsid: `field`, `selectedYear`, `seasons`, `parties`, `crops`, `onUpdateField={handleUpdateMasterField}`, `onClose`).
  - `onEditWork`/`onEditEntry` ühendatakse Task 11-s; seni jäta need propsid andmata (nupud kuvatakse, aga ei tee midagi — Task 11 lisab dialoogid). Selle vältimiseks anna Task 9-s `canEdit={false}`; Task 11 muudab `true`-ks.
  - `FieldDetailsDrawer` import eemaldub `App.tsx`-ist (fail ise kustutatakse Task 13-s).

- [ ] **Step 7: Kontroll** — `npx tsc --noEmit -p tsconfig.app.json`; brauseris: kaardil põld 10 → täisvaade, hooaja vahetus 2025/2026, Esc sulgeb, "Fookusta kaardil" töötab, Põllud vaate info-nupp avab sama vaate, mobiilivaade (DevTools 390 px) üks veerg. Parem veerg näitab praegu malli töid (PRIA andmed Task 10).

- [ ] **Step 8: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/FieldWorksTimeline.tsx src/components/FieldFullView.tsx src/components/FieldOverviewPanel.tsx src/App.tsx src/index.css && git commit -m "Põllu täisvaade asendab põllu popup'"'"'i: üldandmed ja tööde ajajoon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 10: Üleviimine — põld nr 10 (kontrollpunkt kasutajaga)

**Files:**
- Create: `scripts/pria-to-field-works.mts`

**Interfaces:**
- Consumes: `importFieldSeasonOperations` (Task 7), `FieldBookImportOperation`.
- Produces: põllu-hooaegade tööd + kanded `field_operations` andmetest.

- [ ] **Step 1: Skript** `scripts/pria-to-field-works.mts`:

```ts
// scripts/pria-to-field-works.mts — olemasolevad field_operations → Terise tööd + kanded (sama loogika mis import).
// npx tsx scripts/pria-to-field-works.mts --tenant <id> [--field-code X --num N] [--year Y] [--dry-run]
// Käivitus rakenduse rolliga (DATABASE_URL), ettevõtte kontekst seatakse tehingus (RLS).
import { PrismaClient } from '@prisma/client';
import type { FieldBookImportOperation } from '../src/types/fieldOperation.ts';
import { importFieldSeasonOperations } from '../src/server/fieldBookImport.ts';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const tenant = arg('tenant');
if (!tenant) throw new Error('--tenant on kohustuslik');
const fieldCode = arg('field-code');
const num = arg('num');
const year = arg('year') ? Number(arg('year')) : undefined;
const dryRun = process.argv.includes('--dry-run');
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const db = new PrismaClient();
class DryRun extends Error {}

async function main() {
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`select set_config('app.tenant_id', $1, true)`, tenant);
      const seasons = await tx.fieldSeason.findMany({
        where: {
          tenantId: tenant,
          ...(year ? { year } : {}),
          ...(fieldCode || num ? { field: { ...(fieldCode ? { fieldCode } : {}), ...(num ? { num } : {}) } } : {}),
          fieldOperations: { some: {} }
        },
        include: {
          field: { select: { num: true, name: true } },
          fieldOperations: { orderBy: [{ dateFrom: 'asc' }, { sortOrder: 'asc' }], include: { products: { orderBy: { sortOrder: 'asc' } } } }
        }
      });
      for (const fs of seasons) {
        const ops: FieldBookImportOperation[] = fs.fieldOperations.map((o) => ({
          type: o.type, dateFrom: day(o.dateFrom)!, dateTo: day(o.dateTo), areaHa: o.areaHa, method: o.method,
          performerId: o.performerId, notes: o.notes,
          products: o.products.map((p) => ({
            category: p.category, name: p.name, kind: p.kind, spec: p.spec, amount: p.amount, unit: p.unit,
            nKgHa: p.nKgHa, pKgHa: p.pKgHa, kKgHa: p.kKgHa, activeIngredient: p.activeIngredient
          }))
        }));
        const r = await importFieldSeasonOperations(tx, fs.id, ops, { userId: null, fieldAreaHa: fs.areaHa });
        console.log(`Nr ${fs.field.num} ${fs.year}: ${ops.length} PRIA rida → ${r.created} uut tööd, ${r.complemented} täiendatud`);
      }
      if (dryRun) throw new DryRun();
    }, { timeout: 300000 });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
    console.log('Proovikäivitus — muudatusi ei salvestatud.');
  }
}

main().finally(() => db.$disconnect());
```
NB: `fieldWorks.ts` impordib `prisma` (`./db.ts`) ja moodulitaseme sõltuvusi; kui skripti käivitus `fieldBookImport.ts` → `fieldWorks.ts` impordiahela tõttu nõuab serveri konteksti ja kukub, tõsta `syncFieldWorkStatus` eraldi faili `src/server/fieldWorkStatus.ts` (ainult `Prisma` tüübid, `db` parameeter kohustuslik) ja impordi see nii `fieldWorks.ts`-ist kui `fieldBookImport.ts`-ist.

- [ ] **Step 2: Proovikäivitus põllul 10**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && npx tsx scripts/pria-to-field-works.mts --tenant tenant-loisu-agro --field-code 60944386810 --num 10 --dry-run'
```
Expected:
```
Nr 10 2025: 10 PRIA rida → 10 uut tööd, 0 täiendatud
Nr 10 2026: 8 PRIA rida → 8 uut tööd, 0 täiendatud
Proovikäivitus — muudatusi ei salvestatud.
```
(Kui malli tööd on põllul juba olemas ilma kuupäevata, ei sobitu need — sobivus vajab kuupäeva. Kui arvud erinevad, uuri enne jätkamist.)

- [ ] **Step 3: Varukoopia + päris käivitus** (ilma `--dry-run`). Korduskäivitus peab andma `0 uut tööd, 10 täiendatud` / `0 uut tööd, 8 täiendatud` (idempotentsus) — käivita uuesti `--dry-run`-iga ja kontrolli.

- [ ] **Step 4: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add scripts/pria-to-field-works.mts && git commit -m "Skript: olemasolevad PRIA tegevused Terise töödeks ja kanneteks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

- [ ] **Step 5: KONTROLLPUNKT** — palu kasutajal avada põld nr 10 täisvaates (2025 ja 2026) ja üle vaadata. Ära jätka Task 11-ga enne kasutaja tagasisidet; paranda leitud vead (uus samm selles ülesandes).

---

### Task 11: Vormid — PRIA read, töö plaan ja kanne

**Files:**
- Create: `src/components/PriaLinesEditor.tsx`, `src/components/FieldWorkPlanDialog.tsx`
- Modify: `src/components/FieldWorkEntryDialog.tsx`, `src/App.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `src/services/pria.ts` klassifikaatorid ja `totalFromRate`/`rateFromTotal`; `FieldWork`, `FieldWorkPlanLine`, `Material`, `WorkType`, `WorkEntryObservation`, `WorkEntryHarvest`, `FieldWorkPlanInput`; `api.addFieldWork`, `api.updateFieldWork`, `api.saveWorkEntry`, `api.getMaterials`, `api.getWorkTypes`.
- Produces:
  - `type PriaRow = { materialId: string; label: string; unit: string; ratePerHa: string; total: string; priaRegister: string; priaKind: string; priaSpec: string; activeIngredient: string; nKgHa: string; pKgHa: string; kKgHa: string }`
  - `PriaLinesEditor` propsid: `{ activity: string; rows: PriaRow[]; onChange: (rows: PriaRow[]) => void; materials: Material[]; areaHa: number; showTotals: boolean }`
  - `emptyPriaRow(): PriaRow`, `rowToPlanLine(r: PriaRow): FieldWorkPlanLine | null`, `planLineToRow(l: FieldWorkPlanLine | WorkEntryMaterial, areaHa: number): PriaRow` (eksporditud samast failist)
  - `FieldWorkPlanDialog` propsid: `{ fieldSeasonId: number; fieldLabel: string; fieldAreaHa: number; work: FieldWork | null; workTypes: WorkType[]; materials: Material[]; workers: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }`

- [ ] **Step 1: `PriaLinesEditor`**:

```tsx
// src/components/PriaLinesEditor.tsx — PRIA materjaliread (seeme, väetis, lubi, taimekaitse) tegevuse järgi.
// Kogus ha kohta ja kokku arvutavad teineteist pindala järgi (PRIA reegel).
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { FieldWorkPlanLine, Material, WorkEntryMaterial } from '../types/fieldWork';
import {
  PRIA_ACTIVITY, SEED_REGISTERS, SEED_CATEGORIES, FERTILIZER_REGISTERS, LIMING_REGISTERS, PLANT_PROTECTION_REGISTERS,
  totalFromRate, rateFromTotal, materialCategoryFor
} from '../services/pria';

export interface PriaRow {
  materialId: string; label: string; unit: string; ratePerHa: string; total: string;
  priaRegister: string; priaKind: string; priaSpec: string; activeIngredient: string; nKgHa: string; pKgHa: string; kKgHa: string;
}

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};
const fmt = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: 3, useGrouping: false }));

export const emptyPriaRow = (): PriaRow => ({
  materialId: '', label: '', unit: 'kg', ratePerHa: '', total: '', priaRegister: '', priaKind: '', priaSpec: '', activeIngredient: '', nKgHa: '', pKgHa: '', kKgHa: ''
});

export const planLineToRow = (l: Partial<FieldWorkPlanLine & WorkEntryMaterial>, areaHa: number): PriaRow => ({
  materialId: l.materialId ?? '', label: l.label ?? l.name ?? '', unit: l.unit ?? 'kg',
  ratePerHa: fmt(l.ratePerHa ?? rateFromTotal(l.quantity ?? null, areaHa)),
  total: fmt(l.quantity ?? totalFromRate(l.ratePerHa ?? null, areaHa)),
  priaRegister: l.priaRegister ?? '', priaKind: l.priaKind ?? '', priaSpec: l.priaSpec ?? '', activeIngredient: l.activeIngredient ?? '',
  nKgHa: fmt(l.nKgHa), pKgHa: fmt(l.pKgHa), kKgHa: fmt(l.kKgHa)
});

export const rowPria = (r: PriaRow) => ({
  priaRegister: r.priaRegister || null, priaKind: r.priaKind || null, priaSpec: r.priaSpec || null,
  activeIngredient: r.activeIngredient || null, nKgHa: parseNum(r.nKgHa), pKgHa: parseNum(r.pKgHa), kKgHa: parseNum(r.kKgHa)
});

export const rowToPlanLine = (r: PriaRow): FieldWorkPlanLine | null =>
  r.label.trim() ? { kind: 'MATERIAL', materialId: r.materialId || null, label: r.label.trim(), unit: r.unit, ratePerHa: parseNum(r.ratePerHa), ...rowPria(r) } : null;

const registersFor = (activity: string): readonly string[] =>
  activity === PRIA_ACTIVITY.SOWING ? SEED_REGISTERS
    : activity === PRIA_ACTIVITY.FERTILIZING ? FERTILIZER_REGISTERS
    : activity === PRIA_ACTIVITY.LIMING ? LIMING_REGISTERS
    : activity === PRIA_ACTIVITY.PLANT_PROTECTION ? PLANT_PROTECTION_REGISTERS
    : [];

interface PriaLinesEditorProps {
  activity: string;
  rows: PriaRow[];
  onChange: (rows: PriaRow[]) => void;
  materials: Material[];
  areaHa: number;
  showTotals: boolean; // kandel kogus kokku, plaanil ainult norm
}

export const PriaLinesEditor: React.FC<PriaLinesEditorProps> = ({ activity, rows, onChange, materials, areaHa, showTotals }) => {
  const category = materialCategoryFor(activity);
  const options = materials.filter((m) => m.category === category && (m.isActive || rows.some((r) => r.materialId === m.id)));
  const isSeed = activity === PRIA_ACTIVITY.SOWING;
  const isFert = activity === PRIA_ACTIVITY.FERTILIZING || activity === PRIA_ACTIVITY.LIMING;
  const isTkv = activity === PRIA_ACTIVITY.PLANT_PROTECTION;
  const set = (i: number, patch: Partial<PriaRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setRate = (i: number, v: string) => set(i, { ratePerHa: v, total: fmt(totalFromRate(parseNum(v), areaHa)) });
  const setTotal = (i: number, v: string) => set(i, { total: v, ratePerHa: fmt(rateFromTotal(parseNum(v), areaHa)) });
  const pickMaterial = (i: number, id: string) => {
    const m = materials.find((x) => x.id === id);
    set(i, m ? { materialId: m.id, label: m.name, unit: m.unit } : { materialId: '', label: '' });
  };

  return (
    <div className="pria-lines">
      {rows.map((r, i) => (
        <div key={i} className="pria-line">
          <select className="form-input" aria-label="Register/materjal" value={r.priaRegister} onChange={(e) => set(i, { priaRegister: e.target.value })}>
            <option value="">– register/materjal –</option>
            {registersFor(activity).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select className="form-input" aria-label="Toode" value={r.materialId} onChange={(e) => pickMaterial(i, e.target.value)}>
            <option value="">{r.label && !r.materialId ? r.label : '– vali Kulumaterjalidest –'}</option>
            {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {!r.materialId && (
            <input className="form-input" aria-label="Toote nimi" placeholder="või kirjuta nimi" value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
          )}
          <input className="form-input" aria-label={isSeed ? 'Liik' : 'Liik/tüüp'} placeholder={isSeed ? 'Liik (nt Suvinisu)' : isTkv ? 'Liik (nt Herbitsiid)' : 'Väetise liik'} value={r.priaKind} onChange={(e) => set(i, { priaKind: e.target.value })} />
          {isSeed && (
            <select className="form-input" aria-label="Seemne kategooria" value={r.priaSpec} onChange={(e) => set(i, { priaSpec: e.target.value })}>
              <option value="">– kategooria –</option>
              {SEED_CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
          {isTkv && <input className="form-input" aria-label="Toimeaine" placeholder="Toimeaine" value={r.activeIngredient} onChange={(e) => set(i, { activeIngredient: e.target.value })} />}
          <input className="form-input num" aria-label="Kogus ha kohta" inputMode="decimal" placeholder={`${r.unit}/ha`} value={r.ratePerHa} onChange={(e) => setRate(i, e.target.value)} />
          {showTotals && <input className="form-input num" aria-label="Kogus kokku" inputMode="decimal" placeholder={`${r.unit} kokku`} value={r.total} onChange={(e) => setTotal(i, e.target.value)} />}
          {isFert && (
            <>
              <input className="form-input num" aria-label="N kg/ha" inputMode="decimal" placeholder="N kg/ha" value={r.nKgHa} onChange={(e) => set(i, { nKgHa: e.target.value })} />
              <input className="form-input num" aria-label="P kg/ha" inputMode="decimal" placeholder="P kg/ha" value={r.pKgHa} onChange={(e) => set(i, { pKgHa: e.target.value })} />
              <input className="form-input num" aria-label="K kg/ha" inputMode="decimal" placeholder="K kg/ha" value={r.kKgHa} onChange={(e) => set(i, { kKgHa: e.target.value })} />
            </>
          )}
          <button type="button" className="icon-btn-danger" title="Eemalda rida" aria-label="Eemalda rida" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...rows, emptyPriaRow()])}>
        <Plus size={13} /> Lisa {isSeed ? 'seeme' : 'materjal'}
      </button>
    </div>
  );
};
```

Saak ja seire (väikesed plokid samas failis, eksporditud):

```tsx
import { CROP_TYPES, YIELD_TYPES, OBSERVATION_UNITS } from '../services/pria';
import type { WorkEntryObservation } from '../types/fieldWork';

export interface HarvestRow { ratePerHa: string; total: string; priaKind: string; priaSpec: string }

export const HarvestEditor: React.FC<{ value: HarvestRow; onChange: (v: HarvestRow) => void; areaHa: number; showTotals: boolean }> = ({ value, onChange, areaHa, showTotals }) => (
  <div className="pria-line">
    <select className="form-input" aria-label="Kultuuri tüüp" value={value.priaSpec} onChange={(e) => onChange({ ...value, priaSpec: e.target.value })}>
      <option value="">– kultuuri tüüp –</option>
      {CROP_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
    <select className="form-input" aria-label="Saagi tüüp" value={value.priaKind} onChange={(e) => onChange({ ...value, priaKind: e.target.value })}>
      <option value="">– saagi tüüp –</option>
      {YIELD_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
    <input className="form-input num" aria-label="Saak t/ha" inputMode="decimal" placeholder="t/ha" value={value.ratePerHa}
      onChange={(e) => onChange({ ...value, ratePerHa: e.target.value, total: fmt(totalFromRate(parseNum(e.target.value), areaHa)) })} />
    {showTotals && (
      <input className="form-input num" aria-label="Saak kokku t" inputMode="decimal" placeholder="t kokku" value={value.total}
        onChange={(e) => onChange({ ...value, total: e.target.value, ratePerHa: fmt(rateFromTotal(parseNum(e.target.value), areaHa)) })} />
    )}
  </div>
);

export const ObservationsEditor: React.FC<{ rows: WorkEntryObservation[]; onChange: (rows: WorkEntryObservation[]) => void }> = ({ rows, onChange }) => (
  <div className="pria-lines">
    {rows.map((o, i) => {
      const set = (p: Partial<WorkEntryObservation>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
      return (
        <div key={i} className="pria-line">
          <select className="form-input" aria-label="Seire liik" value={o.priaRegister ?? ''} onChange={(e) => set({ priaRegister: e.target.value || null, unit: OBSERVATION_UNITS[e.target.value] ?? '' })}>
            <option value="">– seire liik –</option>
            {Object.keys(OBSERVATION_UNITS).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input className="form-input" aria-label="Leid" placeholder="Leid (nt Põldsinep)" value={o.label} onChange={(e) => set({ label: e.target.value })} />
          <input className="form-input num" aria-label="Kogus" inputMode="decimal" placeholder={o.unit || 'kogus'} value={fmt(o.quantity)} onChange={(e) => set({ quantity: parseNum(e.target.value) ?? 0 })} />
          <span className="work-entry-unit">{o.unit}</span>
          <button type="button" className="icon-btn-danger" aria-label="Eemalda rida" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      );
    })}
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...rows, { label: '', quantity: 0, unit: '', priaRegister: null }])}>
      <Plus size={13} /> Lisa leid
    </button>
  </div>
);
```
(Pane kõik impordid faili algusesse; `parseNum`/`fmt` on samas failis.)

- [ ] **Step 2: `FieldWorkPlanDialog`**:

```tsx
// src/components/FieldWorkPlanDialog.tsx — töö (plaani) lisamine ja muutmine: tegevus, kuupäevad, pindala, viis, teostaja, read.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DateInput } from './DateInput';
import { api } from '../services/api';
import { PRIA_ACTIVITY, FERTILIZING_METHODS, PRIA_ACTIVITIES } from '../services/pria';
import type { FieldWork, FieldWorkPlanLine, Material, WorkType } from '../types/fieldWork';
import { PriaLinesEditor, HarvestEditor, emptyPriaRow, planLineToRow, rowToPlanLine, type PriaRow, type HarvestRow } from './PriaLinesEditor';

interface FieldWorkPlanDialogProps {
  fieldSeasonId: number;
  fieldLabel: string;
  fieldAreaHa: number;
  work: FieldWork | null; // null = uus töö
  workTypes: WorkType[];
  materials: Material[];
  workers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};
const fmt = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: 2, useGrouping: false }));

export const FieldWorkPlanDialog: React.FC<FieldWorkPlanDialogProps> = ({ fieldSeasonId, fieldLabel, fieldAreaHa, work, workTypes, materials, workers, onClose, onSaved }) => {
  const ordered = [...workTypes].filter((w) => w.isActive && w.priaCode)
    .sort((a, b) => PRIA_ACTIVITIES.findIndex((p) => p.name === a.priaCode) - PRIA_ACTIVITIES.findIndex((p) => p.name === b.priaCode));
  const [workTypeId, setWorkTypeId] = useState(work?.workTypeId ?? '');
  const activity = workTypes.find((w) => w.id === workTypeId)?.priaCode ?? '';
  const [dateFrom, setDateFrom] = useState(work?.plannedDateFrom ?? '');
  const [dateTo, setDateTo] = useState(work?.plannedDateTo ?? '');
  const [plannedText, setPlannedText] = useState(work?.plannedText ?? '');
  const [areaHa, setAreaHa] = useState(fmt(work?.plannedAreaHa ?? fieldAreaHa));
  const [method, setMethod] = useState(work?.method ?? '');
  const [workerId, setWorkerId] = useState(work?.plannedWorkerId ?? '');
  const [notes, setNotes] = useState(work?.notes ?? '');
  const area = parseNum(areaHa) ?? fieldAreaHa;
  const [rows, setRows] = useState<PriaRow[]>(work?.lines.filter((l) => l.kind === 'MATERIAL').map((l) => planLineToRow(l, area)) ?? []);
  const harvestLine = work?.lines.find((l) => l.kind === 'HARVEST');
  const [harvest, setHarvest] = useState<HarvestRow>({ ratePerHa: fmt(harvestLine?.ratePerHa), total: '', priaKind: harvestLine?.priaKind ?? '', priaSpec: harvestLine?.priaSpec ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const usesMaterials = workTypes.find((w) => w.id === workTypeId)?.usesMaterials ?? false;
  const isHarvest = activity === PRIA_ACTIVITY.HARVEST;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!workTypeId) return setError('Vali tegevus');
    if (dateTo && dateFrom && dateTo < dateFrom) return setError('Lõpp ei saa olla enne algust');
    const lines: FieldWorkPlanLine[] = [
      ...(usesMaterials ? rows.map(rowToPlanLine).filter((l): l is FieldWorkPlanLine => l !== null) : []),
      ...(isHarvest && (harvest.ratePerHa || harvest.priaKind)
        ? [{ kind: 'HARVEST' as const, materialId: null, label: 'Saak', unit: 't', ratePerHa: parseNum(harvest.ratePerHa), priaRegister: null, priaKind: harvest.priaKind || null, priaSpec: harvest.priaSpec || null, activeIngredient: null, nKgHa: null, pKgHa: null, kKgHa: null }]
        : [])
    ];
    const plan = {
      plannedText: plannedText.trim() || null, plannedDateFrom: dateFrom || null, plannedDateTo: dateTo || null,
      plannedAreaHa: parseNum(areaHa), method: method || null, plannedWorkerId: workerId || null, notes: notes.trim() || null, lines
    };
    setBusy(true);
    try {
      if (work) await api.updateFieldWork(work.id, plan);
      else await api.addFieldWork({ fieldSeasonId, workTypeId, ...plan });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <form className="modal-content animate-scale-up work-entry-modal" onSubmit={save}>
        <div className="modal-header">
          <div>
            <h3>{work ? `Muuda tööd: ${work.workTypeName}` : 'Lisa töö'}</h3>
            <p className="modal-subtitle">{fieldLabel}</p>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body work-entry-body">
          <div className="work-entry-grid">
            <div className="form-group">
              <label htmlFor="wp-type">Tegevus *</label>
              <select id="wp-type" className="form-input" value={workTypeId} disabled={!!work} onChange={(e) => setWorkTypeId(e.target.value)}>
                <option value="">– vali –</option>
                {ordered.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Planeeritud algus</label><DateInput value={dateFrom} onChange={setDateFrom} className="form-input" /></div>
            <div className="form-group"><label>Planeeritud lõpp</label><DateInput value={dateTo} onChange={setDateTo} className="form-input" /></div>
            <div className="form-group">
              <label htmlFor="wp-text">Ligikaudne aeg</label>
              <input id="wp-text" className="form-input" placeholder="nt apr–mai" value={plannedText} onChange={(e) => setPlannedText(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="wp-area">Pindala, ha</label>
              <input id="wp-area" className="form-input num" inputMode="decimal" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
            </div>
            {activity === PRIA_ACTIVITY.FERTILIZING && (
              <div className="form-group">
                <label htmlFor="wp-method">Väetamisviis</label>
                <select id="wp-method" className="form-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="">– vali –</option>
                  {FERTILIZING_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            {activity === PRIA_ACTIVITY.PLANT_PROTECTION && (
              <div className="form-group">
                <label htmlFor="wp-worker">Teostaja</label>
                <select id="wp-worker" className="form-input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                  <option value="">– valimata –</option>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {usesMaterials && (
            <section className="work-entry-section">
              <h4>Planeeritud materjalid (norm ha kohta)</h4>
              <PriaLinesEditor activity={activity} rows={rows} onChange={setRows} materials={materials} areaHa={area} showTotals={false} />
            </section>
          )}
          {isHarvest && (
            <section className="work-entry-section">
              <h4>Planeeritud saak</h4>
              <HarvestEditor value={harvest} onChange={setHarvest} areaHa={area} showTotals={false} />
            </section>
          )}
          <div className="form-group">
            <label htmlFor="wp-notes">Märkused</label>
            <textarea id="wp-notes" rows={3} maxLength={1000} className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <div className="alert-box error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Loobu</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
        </div>
      </form>
    </div>,
    document.body
  );
};
```
(`emptyPriaRow` import pole vajalik, kui seda ei kasutata — eemalda, et tsc `noUnusedLocals` ei kukuks.)

- [ ] **Step 3: Kandevorm** — `src/components/FieldWorkEntryDialog.tsx`:
  - eemalda `isRepeating`, `nextOccurrence`, `occurrenceNo` olek, "Mitmes kord" väli ja `occurrenceNo` saatmine; `!isRepeating` tingimused muutuvad tõeseks (lihtsusta: `fieldAreaHa > 0`).
  - `activity = work.priaCode ?? ''`.
  - uued olekud: `dateTo` (`entry?.dateTo ?? (entry ? '' : work.plannedDateTo ?? '')`), `method` (`entry?.method ?? work.method ?? ''`), `rows: PriaRow[]` (olemasoleva `rows` asemel: `entry ? entry.materials.map((m) => planLineToRow(m, entry.areaHa ?? fieldAreaHa)) : work.lines.filter((l) => l.kind === 'MATERIAL').map((l) => planLineToRow(l, work.plannedAreaHa ?? fieldAreaHa))`), `harvest: HarvestRow` (kandest või plaanist), `observations` (`entry?.observations ?? []`).
  - uue kande vaikimisi: `date = work.plannedDateFrom ?? todayIso()`, `areaHa = fmt(work.plannedAreaHa ?? null)`, `workerId = work.plannedWorkerId ?? …`.
  - Kulumaterjalide sektsiooni asemel: `{(work.usesMaterials || rows.length > 0) && <section className="work-entry-section"><h4>Materjalid</h4><PriaLinesEditor activity={activity} rows={rows} onChange={setRows} materials={materials} areaHa={parseNum(areaHa) ?? fieldAreaHa} showTotals /></section>}`; Saagi välja asemel `isHarvest` korral `HarvestEditor showTotals`; `activity === PRIA_ACTIVITY.MONITORING` korral `ObservationsEditor`.
  - Kuupäeva kõrvale "Lõpp (kui mitu päeva)" `DateInput` (`dateTo`); väetamisel väetamisviisi valik (`FERTILIZING_METHODS`).
  - Taimekaitsel töötaja kohustuslik (juba on); kellaajad ja töötaja on kohustuslikud ainult `entry?.source !== 'PRIA_IMPORT'` korral (imporditud kandel neid pole): asenda kontrollid `if (!workerId && !imported)` ja `if ((!startTime || !endTime) && !imported)`, kus `const imported = entry?.source === 'PRIA_IMPORT'`; taimekaitsel `if (activity === PRIA_ACTIVITY.PLANT_PROTECTION && !workerId) return setError('Taimekaitsetöö teostaja on kohustuslik')`.
  - `save`: 
    ```ts
          dateTo: dateTo || null,
          method: method || null,
          materials: rows
            .map((r) => ({ materialId: r.materialId, quantity: parseNum(r.total) ?? 0, ratePerHa: parseNum(r.ratePerHa), pria: rowPria(r) }))
            .filter((r) => r.materialId && r.quantity > 0),
          harvest: isHarvest && parseNum(harvest.total) != null
            ? { tonnes: parseNum(harvest.total)!, ratePerHa: parseNum(harvest.ratePerHa), priaKind: harvest.priaKind || null, priaSpec: harvest.priaSpec || null }
            : null,
          harvestTonnes: null,
          observations: observations.filter((o) => o.label.trim()),
    ```
    NB: kandel peab materjal olema Kulumaterjalide registris (`materialId`); vabateksti nimega rida ilma `materialId`-ta kandel näita veana "Vali toode Kulumaterjalidest" (plaanis on vabatekst lubatud).

- [ ] **Step 4: App ühendamine** — `src/App.tsx`: olekud `planDialog` (`{ fieldSeasonId; fieldLabel; fieldAreaHa; work: FieldWork | null } | null`), `entryDialog` (`{ fieldLabel; fieldAreaHa; work; entry } | null`), `fullViewReloadKey` (number). Laadi `workTypes` ja `materials` (`api.getWorkTypes()`, `api.getMaterials()`) dialoogi avamisel, kui pole laetud. `FieldFullView` propsid: `canEdit={true}`, `onEditWork={setPlanDialog}`, `onEditEntry={setEntryDialog}`, `reloadKey={fullViewReloadKey}`. Renderda `FieldWorkPlanDialog` ja `FieldWorkEntryDialog` (propsid `workers` = `parties.filter((p) => p.roles.includes('DRIVER'))` nagu `FieldWorksBoard`-is, `vehicles`, `implementsList`, `telemetryEnabled={modules.telemetry}` — vaata, kuidas `FieldWorksBoard` neid App'ist saab, ja kasuta samu väärtusi). `onSaved`: sulge dialoog ja `setFullViewReloadKey((k) => k + 1)`.

- [ ] **Step 5: Stiilid** — `src/index.css` lõppu:
```css
.pria-lines { display: flex; flex-direction: column; gap: 6px; }
.pria-line { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.pria-line .form-input { flex: 1 1 140px; min-width: 0; }
.pria-line .form-input.num { flex: 0 1 90px; }
```

- [ ] **Step 6: Kontroll** — tüübikontroll + `npm test`; brauseris põld 10 / 2026:
  1. "Lisa töö" → Väetamine, kuupäev, NPK rida 250 kg/ha → salvesta → ajajoonel "Planeeritud" all, plaanis rida.
  2. "+ Kanne" sellel tööl → materjal eeltäidetud (250 kg/ha, kokku 605), salvesta → töö "Tehtud" (100% pindala).
  3. Imporditud taimekaitse kande muutmine (kellaaegadeta) salvestub.
  4. Seire kanne leiuga → kuvatakse ajajoonel.
  5. Lukus hooajal nupud puuduvad.

- [ ] **Step 7: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/PriaLinesEditor.tsx src/components/FieldWorkPlanDialog.tsx src/components/FieldWorkEntryDialog.tsx src/App.tsx src/index.css && git commit -m "Töö plaani ja kande vormid PRIA väljadega (materjalid, saak, seire); täisvaates muudetavad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 12: Põllutööde tahvel ja registrid ilma kordusteta

**Files:**
- Modify: `src/components/FieldWorksBoard.tsx`, `src/components/AddFieldWorkDialog.tsx`, `src/components/WorkRegisterModal.tsx`, `src/admin/CatalogView.tsx`, `src/server/platformApi.ts`, `src/server/fieldWorks.ts` (`POST /api/work-types`), `src/server/catalog.ts`, `src/components/FinanceModal.tsx`

**Interfaces:**
- Consumes: Task 5 DTO (`plannedDateFrom`, `plannedText`), Task 11 `FieldWorkPlanDialog`.
- Produces: kasutajaliides ilma kordumise mõisteta.

- [ ] **Step 1: Tahvel** — `FieldWorksBoard.tsx`:
  - `WorkCard`: `donePct` arvuta alati (`fieldAreaHa > 0 && doneHa > 0`), eemalda `repeatMode` kontrollid; kanneteta töö alamrida: `work.carriedOverFromYear ? … : work.status === 'DONE' ? … : (work.plannedDateFrom ? formatDayMonth(work.plannedDateFrom) : work.plannedText || 'planeerimata')`; pealkirja järele `work.method` väikselt, kui on.
  - Valitud töö paneel (~read 1189-1206): eemalda "kordi" plokk (`plannedCount` muutmine); `selected.repeatMode === 'ONCE' && activeArea > 0` → `activeArea > 0`. Lisa nupp "Muuda plaani", mis avab `FieldWorkPlanDialog` (sama olekumuster nagu `entryDialog`).
  - Kannete loendis eemalda `occurrenceNo` tekst (rida ~1231).
- [ ] **Step 2: Töö lisamine** — `AddFieldWorkDialog.tsx`: eemalda `existingIds`/`existingMap` blokeering (sama tüüpi tööd võib lisada mitu); olemasolevate arv näita vihjena ("põllul juba 2"). Tegevuste järjekord `priaCode` järgi `PRIA_ACTIVITIES` indeksiga.
- [ ] **Step 3: Registrid** — `WorkRegisterModal.tsx`: töötüübi vormist eemalda kordumise valik ja `repeatLabel` kuvamine; nimi on PRIA tegevus (uue töötüübi lisamise nupp peida, kuna tüübid = PRIA 29; muuta saab faasi ja `usesMaterials`); malli real "kordi" sisend jääb kõigile tüüpidele (`plannedCount`, vaikimisi 1). `CatalogView.tsx` ja `platformApi.ts:372-374`: eemalda `repeatMode`, `maxRepeats`, `intervalDays` väljad vormist/valideerimisest; malli rea `plannedCount` jääb. `catalog.ts`: kopeeri `priaCode` (`priaCode: w.priaCode`). `fieldWorks.ts` `POST /api/work-types`: säilita `priaCode` muutmisel (ära luba seda muuta), `repeatMode` alati `'ONCE'`.
- [ ] **Step 4: Finants** — `FinanceModal.tsx:546`: eemalda `occurrenceNo` kuvamine; OBSERVATION ridu finantsis ei kuvata (server ei saada neid, Task 5).
- [ ] **Step 5: Kontroll** — tüübikontroll + `npm test` (`catalog.test.ts` peab läbima — lisa ootus, et `priaCode` kopeeritakse); brauseris Põllutööd 2026: põllul 10 on kolm eraldi taimekaitse kaarti (2025) / kaks (2026), malli rakendamine uuel põllul loob kordi arvu järgi eraldi tööd.
- [ ] **Step 6: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/FieldWorksBoard.tsx src/components/AddFieldWorkDialog.tsx src/components/WorkRegisterModal.tsx src/admin/CatalogView.tsx src/server/platformApi.ts src/server/fieldWorks.ts src/server/catalog.ts src/server/catalog.test.ts src/components/FinanceModal.tsx && git commit -m "Põllutööde tahvel ja registrid: iga töö üks kord, sama tegevust võib olla mitu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 13: Ülejäänud põldude üleviimine ja `field_operations` eemaldamine

**Files:**
- Delete: `src/components/FieldDetailsDrawer.tsx`, `src/components/FieldOperationsSection.tsx`
- Modify: `src/server/apiHandler.ts` (eemalda `GET /api/field-operations`; `master-fields` `operationsCount`), `src/services/api.ts` (`getFieldOperations`), `src/types/fieldOperation.ts` (eemalda `FieldOperationProductDto`, `FieldOperationDto`, `FieldOperationsResponse`), `src/types/fieldRegister.ts` (`operationsCount`), `prisma/schema.prisma` (mudelid `FieldOperation`, `FieldOperationProduct` + tagasiseosed `FieldSeason.fieldOperations`, `RelatedParty` performer seos), `scripts/tenancy/02-rls.sql` (eemalda `'field_operations','field_operation_products'`), `src/server/fieldWorks.ts:2` (päisekommentaar), `src/help/helpRegistry.ts` (põllu akna abitekst)

- [ ] **Step 1: Kasutaja kinnitus** — küsi kasutajalt luba ülejäänud põldude ja ettevõtete üleviimiseks (Task 10 kontrollpunkt läbitud).

- [ ] **Step 2: Varukoopia + üleviimine kõigile**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && for t in $(psql "${MIGRATE_DATABASE_URL%%\?*}" -At -c "select distinct tenant_id from field_operations"); do npx tsx scripts/pria-to-field-works.mts --tenant "$t" --dry-run; done'
```
Kontrolli kokkuvõtet (iga põld: PRIA ridade arv = uued + täiendatud), siis sama ilma `--dry-run`. Kontroll: iga ettevõtte `field_operations` arv ≤ `field_works where source = 'PRIA_IMPORT'` arv + täiendatud.

- [ ] **Step 3: Koodi eemaldus** — kustuta failid ja tüübid Files-loendi järgi; `grep -rn "fieldOperation\|FieldOperation\|field-operations\|operationsCount" src` peab andma ainult parseri tüübid (`ParsedOperation`, `FieldBookImport*`). Uuenda `helpRegistry.ts` põllu vaate tekst (täisvaade, tööd ja kanded, PRIA import). `npx tsc --noEmit -p tsconfig.app.json && npm test`.

- [ ] **Step 4: Commit + release (kood enne tabelite kustutamist)**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add -A src/components/FieldDetailsDrawer.tsx src/components/FieldOperationsSection.tsx src/server/apiHandler.ts src/services/api.ts src/types/fieldOperation.ts src/types/fieldRegister.ts src/server/fieldWorks.ts src/help/helpRegistry.ts && git commit -m "Eemaldatud vana põllu popup ja PRIA tegevuste tabelite kasutus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

- [ ] **Step 5: Tabelite eemaldus** — varukoopia; eemalda mudelid skeemist ja `02-rls.sql` loendist; `npx prisma db push --accept-data-loss && npx prisma generate`; `psql … -f scripts/tenancy/02-rls.sql`; `npx tsx scripts/tenancy/05-tenant-fk-triggers.mts`; `npm test`.

- [ ] **Step 6: Commit + release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add prisma/schema.prisma scripts/tenancy/02-rls.sql && git commit -m "Skeem: field_operations tabelid eemaldatud (andmed on Terise töödes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```
