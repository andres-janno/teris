# UI ühtlustamise etapp 3b „viimased ühiskomponendid“ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kõik nähtavad nupud ja valitavad kaardid tulevad ühisest komplektist `src/components/ui` ja on näha `/ui` galeriis; toorest `<button` (tsx) väljaspool `src/components/ui` on 0 (v.a kaks põhjendatud erandit).

**Architecture:** Neli järjestikust ülesannet, iga = eraldi commit + release + pildid hele/tume enne/pärast. (1) `HelpHint` kolib `ui/`-sse ja ui-audit saab rea „Tooreid nuppe (tsx)“; (2) uus `CardButton` + kaks Card varianti (`item`, `option`) valitavatele kaartidele; (3) kolm uut Button varianti (`dashed`, `bare`, `text`), uus suurus `add-slot` ja uus `ChipButton` (andmevärviga kiip); (4) uus `NavSwitch` peamenüüle. Nähtav välimus jääb samaks: vanad olekureeglid jäävad `index.css`-i `!important`-iga, ui annab põhiilme.

**Tech Stack:** React 19 + TS, Tailwind v4 (skaneerib AINULT `src/components/ui`), Radix (`radix-ui`), class-variance-authority, tailwind-merge (`cn`), vitest (node keskkond, ainult `*.test.ts`), oxlint, Playwright (`scripts/shot.mts`).

**Spec:** `docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md` · eelmine etapp: `docs/superpowers/plans/2026-11-16-koristus-ui.md` (vorm, lõksud) · `src/components/ui/README.md`.

## Global Constraints

**Kasutaja otsused (2026-11-16), siduvad:**

1. Kõik nähtavad UI elemendid tulevad ühisest komplektist `src/components/ui` ja on näha `/ui` galeriis (`src/components/ui/UiGallery.tsx`). Iga uus komponent/variant saab galeriisse näite.
2. **Nähtav välimus jääb samaks** (piksli täpsusega võimalikult lähedal): peamenüü, tahvli kaardid, valikkaardid. Erinevus lubatud ainult ühtlustamiseks väikesel määral (≤2px, sama värv); suurem muutus või värvimuutus = väljas toodud jaotises „Küsimused kasutajale“.
3. Valitud olek = `--selection-bg` (#16a34a, heledam roheline, kasutaja otsus — **ÄRA tumenda**), valge tekst. Põhinupu gradient (#16a34a → #22c55e) jääb. Muid tokeneid (`--tone-*-text`) ei puututa.
4. Erandid jäävad: `LoginPage` `login-forgot-link`, `MapView.tsx` ~787 Leafleti popup-HTML-string (pole React).
5. Pärast etappi: `npm run ui-audit` rida „Tooreid nuppe (tsx)“ = **0**.

**Tehnilised reeglid:**

- Tailwind skaneerib ainult `src/components/ui` (`@source` failis `src/styles/app.css`). **Vaadetes Tailwindi klasse ei saa**; välimus tuleb ui komponendi prop'idest/variantidest või `index.css` klassist.
- `index.css` on kihis `legacy` (enne `utilities`): legacy reegel, mis peab ui utiliidi üle võitma, vajab `!important`. `src/admin/admin.css` on kihistamata ja võidab utiliite ise.
- Audit keelab `text-[…]`, `p-[…]`, `bg-[…]`, `border-[…]`, `rounded-[…]` jm suvalised väärtused ja `x-(--muutuja)` kirjaviisi nendel eesliidetel (`src/tooling/uiAudit.ts` `ARBITRARY`); `ring-(--x)`, `w-[…]`, `before:…` ja olekuvariandid (`aria-[current=page]:`) on lubatud. Andmevärvist sõltuvad ilmed tehakse `@utility`-dena `src/styles/app.css`-is (Task 3).
- Vahed ainult skaalast (0, px, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8); kirjasuurused `2xs 11 / xs 12 / sm 13 / base 14 / lg 16 / xl 20`; nurgad `sm 6 / md 10 / lg 16 / full`.
- Ingliskeelsed identifikaatorid (klassid, muutujad, failid, URL-id), eestikeelsed kommentaarid ja UI-tekst. Numbrid paremale (`className="num"`), kuupäevad pp.kk.aaaa.
- Preflight puudub: toores `<button>` on hall brauserinupp — ui-s kasutatavad `<button>`-id peavad ise kogu ilme andma.

**Keskkond ja kontrollid:**

- Kood on serveris: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Kohalik `/Users/andresj/Progemine/teris` on sshfs-mount: Read/Write/Edit töötavad; **git ja grep jooksuta serveris**. Grep: `--include` ENNE mustrit, muster `-e`-ga: `grep -rn --include='*.tsx' --include='*.ts' -e 'muster' src`.
- Kontrollid iga ülesande lõpus (serveris):
  - `NODE_OPTIONS=--max-old-space-size=1500 npx tsc --noEmit -p tsconfig.app.json`
  - `npx vitest run src/tooling src/components/ui`
  - `npx oxlint <muudetud failid>`
  - `npm run ui-audit -- --details` (oodatav väärtus iga ülesande lõpus on kirjas)
- **Commit + release iga ülesande lõpus:** commit masteril, failid nime järgi (`git add <failid>`, mitte `-A`), sõnum lõpeb reaga `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Seejärel `NODE_OPTIONS=--max-old-space-size=1500 npm run release > /tmp/rel.log 2>&1; echo EXIT=$?` → `EXIT=0` ja `systemctl is-active teris` → `active`.
- **Pildid (kohustuslik, enne/pärast):** enne muudatusi (Step 1) ja pärast release'i samad käsud, erinevad `--out` kaustad:
  ```bash
  ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && rm -rf /tmp/shots-before /tmp/shots-after && npx tsx scripts/shot.mts --user andresj --height 1400 --out /tmp/shots-before <ülesande --do argumendid> <tee>'
  scp -rq -o BatchMode=yes 'debian@uvn-243-120.tll07.zonevs.eu:/tmp/shots-before' <scratch>/
  ```
  Skript teeb iga pildi heledas ja tumedas. Vaata enne/pärast pilte Read-tööriistaga paarikaupa; lõika vajadusel `sips -c H W --cropOffset Y X`. Peavaated: `--do 'click:.main-view-switch >> text=<Nimi>'` (Kaart, Põllud, Kultuurid, Külvikord, Põllutööd, Laoarvestus, Tehnika, Taristu, Isikud, Ilm, Hooajad). Admin: `--platform '*'`. Kui `click:` selektor ei leia elementi, leia õige `grep`-iga (nupu tekst/`title`) ja kirjuta raportisse nii kasutatud käsk kui ka põhjus. **Viga** on: hall brauseri vaikenupp, nihkunud paigutus (>2px), kadunud olekuvärv (valitud, aktiivne, staatuse ääris), nähtamatu tekst, valge plokk tumedas teemas. Raportisse: millised paarid vaatasid ja mida nägid.

**Peamenüü selektor:** `.main-view-switch` jääb `<nav>` paigutusklassiks (Task 4), seega kõik olemasolevad `--do 'click:.main-view-switch >> text=<Nimi>'` käsud ja `docs/`-i viited kehtivad edasi — muutmist pole vaja.

---

## Inventuur: toored nupud ja otsus iga kohta

Seis HEAD `765a9f9` (grep `<button`, reanumbrid nihkuvad — otsi klassinime järgi). Toorest `<button` on 34 kohta; 2 on erandid, 1 kolib ui-sse, 31 vahetatakse.

| # | Fail (rida) | Vana | Otsus | Uus | Task |
|---|---|---|---|---|---|
| 1 | `Header.tsx` 87–179 (11 tk) | `.main-view-switch button`, `.active`, `aria-current` | ühtne peamenüü | `NavSwitch` + `NavSwitchItem current` | 4 |
| 2 | `HelpHint.tsx` 92 | `<button {...triggerProps}>` | kolib ui-sse | `ui/HelpHint.tsx` (nupp ui sees) | 1 |
| 3 | `FieldWorksBoard.tsx` 129 | `.fw-card` + `.selected/.in_progress/.done/.unplanned` | valitav kaart | `CardButton variant="item" padding="none" selected` | 2 |
| 4 | `FieldWorksBoard.tsx` 952, 963, 980, 992, 1009, 1026, 1036, 1055, 1072, 1095 (**10** tk, mitte 5) | `.fw-add` (30×40, katkendjoon, hõljudes täisroheline) | **mahub Buttoni alla**: uus `variant="dashed"` + `size="add-slot"` | `AddWorkButton` (kohalik komponent) | 3 |
| 5 | `FieldWorksBoard.tsx` 1278 | `.fw-finance-chip-btn` (märki ümbritsev nupp) | ui Button | `Button variant="bare" size="inline"` | 3 |
| 6 | `FieldManagerModal.tsx` 330 | `.register-crop-stat` (kultuuri värviga toonitud kiip) | valitav kiip | `ChipButton variant="tint"` | 3 |
| 7 | `FieldManagerModal.tsx` 353, 363 | `.reg-stat-pill.is-filter` (omandivorm) | valitav kiip | `ChipButton variant="outline"` | 3 |
| 8 | `AddFieldWorkDialog.tsx` 124 | `.add-work-option` (rida, mida saab valida) | valitav kaart | `CardButton variant="option" padding="none"` | 2 |
| 9 | `FieldWorkEntryDialog.tsx` 457 | `.telemetry-suggestion-pill` | valitav kaart | `CardButton variant="option" padding="none"` | 2 |
| 10 | `FinanceModal.tsx` 489 | `<Card asChild …><button>` | valitav kaart | `CardButton variant="tile" padding="sm" selected` | 2 |
| 11 | `admin/HelpView.tsx` 125 | `<Card asChild …><button>` | valitav kaart | `CardButton variant="tile" padding="none" selected` | 2 |
| 12 | `TripDialog.tsx` 237 | `.trip-dialog-entry` (kahe reaga tekstilink) | ui Button | `Button variant="text" size="inline"` | 3 |
| 13 | `LoginPage.tsx` 80 | `.login-forgot-link` | **erand** (kasutaja otsus) | — | — |
| 14 | `MapView.tsx` 787 | Leafleti popup-HTML-string | **erand** (pole React) | — | — |

**`fw-add` põhjendus (punkt 4):** vorm = nupp ikooniga, ilma tekstita, katkendjoonega äärisega, hõljudes täisroheline valge ikooniga. Kõik see on nupu enda olek, mitte kaart; ainus erinevus olemasolevatest on katkendjoon ja 30×40 mõõt. Uus variant `dashed` annab katkendjoone ja hõljumise, uus suurus `add-slot` mõõdu ja 6px nurga (muidu annaks Button 10px nurga, +4px). Eraldi komponenti pole vaja ning kõigil 10 kohal on sama `onClick`-kuju, seepärast võtab üks kohalik `AddWorkButton` need kokku.

**Teadlikud väikesed erinevused (≤2px / sama värv / ainult hover; kasutajalt ei küsita):**

- Valikkaardid (`fw-card`, `add-work-option`, `telemetry-suggestion-pill`, `finance-entry-card`) saavad ui `interactive` Tab-fookuse rõnga (ainult klaviatuuriga) — ilma selleta nad praegu fookust ei näita.
- `add-work-option` saab hõljudes õrna rohelist äärist (ühtne teiste valikkaartidega); vana polnud hõljumist.
- `reg-stat-pill.is-filter` ja `register-crop-stat` saavad `aria-pressed` (valitud olek kuuldavaks) — välimust ei mõjuta.
- `fw-card` valitud rõnga paksus: vana 2px väljaspool, uus 1px äärisel + 1px väljaspool (kokku 2px, ≤2px). Värv: vt „Küsimused kasutajale“.
- `telemetry-suggestion-pill`: `transition: all` asemel ui `transition-colors` — hõljudes tõus (translateY) ilmub hetkega, mitte 150 ms jooksul.
- `bare` (finantsmärgi nupp): hõljumise vari `shadow-sm` (vana `0 2px 5px rgba(0,0,0,.12)`), ainult hover.

## File Structure

| Fail | Vastutus |
|---|---|
| `src/components/ui/HelpHint.tsx` (uus, Task 1) | `HelpHint` (andmega) + `HelpHintPopover` (ainult esitus, galeriile) |
| `src/components/ui/Card.tsx`, `variants.ts` (Task 2) | `CardButton`, Card variandid `item`, `option` |
| `src/components/ui/Button.tsx`-i variandid `variants.ts`-is (Task 3) | `dashed`, `bare`, `text`, suurus `add-slot` |
| `src/components/ui/ChipButton.tsx` (uus, Task 3) | andmevärviga valitav kiip (`tint`, `outline`) |
| `src/components/ui/NavSwitch.tsx` (uus, Task 4) | peamenüü: `NavSwitch`, `NavSwitchItem` |
| `src/styles/app.css` | `--color-selection` token (Task 4), `@utility chip-*` (Task 3) |
| `src/tooling/uiAudit.ts`, `scripts/ui-audit.mts`, `uiAudit.test.ts` (Task 1) | rida „Tooreid nuppe (tsx)“ |
| `src/components/ui/index.ts`, `UiGallery.tsx`, `README.md`, `variants.test.ts` | eksport, näited, reeglid, testid (igas ülesandes) |

---

### Task 1: HelpHint ui-sse ja auditi rida „Tooreid nuppe“

**Files:**
- Move: `src/components/HelpHint.tsx` → `src/components/ui/HelpHint.tsx` (`git mv`)
- Modify: `src/components/ui/index.ts`, `src/components/FieldManagerModal.tsx:20`, `src/components/FieldsTableView.tsx:17`, `src/components/ui/UiGallery.tsx`, `src/components/ui/README.md`
- Modify: `src/tooling/uiAudit.ts`, `scripts/ui-audit.mts`, `src/tooling/uiAudit.test.ts`, `src/components/ui/variants.test.ts`

**Interfaces:**
- Produces: `HelpHint: React.FC<{ helpKey: HelpKey; inline?: boolean }>` (sama signatuur nagu praegu); `HelpHintPopover: React.FC<{ label: string; html: string; inline?: boolean }>` (`html` peab olema juba puhastatud `sanitizeHelp`-iga); `RAW_BUTTON_ALLOWED`; `AuditReport.rawButtonFiles: { path: string; count: number }[]`; `auditTsx(...).rawButtons: number`.
- Auditi oodatav tulemus pärast tasku: „Tooreid nuppe (tsx)“ = **31** (34 toorest − 1 kolinud HelpHint − 2 erandit).

- [ ] **Step 1: Pildid enne**

Peamised kohad, kus abi-ikoon on: Põllud (`FieldsTableView`) ja põllude haldur. Käivita (serveris):
`npx tsx scripts/shot.mts --user andresj --height 1400 --out /tmp/shots-before --do 'click:.main-view-switch >> text=Põllud' --do 'wait:1500' /`
Leia abi-ikooni asukoht: `grep -rn --include='*.tsx' -e '<HelpHint' src`. Kopeeri pildid kohalikku scratch-kausta.

- [ ] **Step 2: Failiga seotud test (auditi rida) — kirjuta kukkuv test**

Lisa `src/tooling/uiAudit.test.ts` lõppu (import `summarize` on juba olemas):

```ts
describe('toored nupud', () => {
  it('loeb <button, mitte <Button; ui kaust ja lubatud erandid välja', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<button type="button">a</button><Button>b</Button><button\n  type="button">c</button>' },
      { path: 'src/components/ui/X.tsx', content: '<button type="button" />' },
      { path: 'src/components/LoginPage.tsx', content: '<button type="button" className="login-forgot-link">' },
      { path: 'src/components/MapView.tsx', content: '`<button type="button" class="map-popup-btn">`' },
    ]);
    expect(r.rawButtonFiles).toEqual([{ path: 'src/components/A.tsx', count: 2 }]);
  });
  it('erand lubab ainult nimetatud arvu: teine toores nupp samas failis loeb', () => {
    const r = summarize([{ path: 'src/components/LoginPage.tsx', content: '<button type="button"><button type="button">' }]);
    expect(r.rawButtonFiles).toEqual([{ path: 'src/components/LoginPage.tsx', count: 1 }]);
  });
});
```

- [ ] **Step 3: Käivita test — peab kukkuma**

Run: `npx vitest run src/tooling/uiAudit.test.ts`
Expected: FAIL (`rawButtonFiles` puudub / `undefined`).

- [ ] **Step 4: Implementeeri auditi rida**

`src/tooling/uiAudit.ts`: lisa `rawButtonFiles: { path: string; count: number }[];` liidesesse `AuditReport` (lõppu), ja konstandid `LEGACY_CARD_TSX` lähedale:

```ts
// Toored <button (etapp 3b): kõik nupud tulevad ui komponentidest. ui/ kausta ei loeta. Lubatud erandid
// (failitee lõpp → mitu tohib olla): jääb alles valvurina, väljaspool erandeid peab olema 0.
const RAW_BUTTON = /<button(?=[\s>])/g;
export const RAW_BUTTON_ALLOWED: Readonly<Record<string, number>> = {
  'components/LoginPage.tsx': 1, // login-forgot-link: tekstilink sisselogimislehel (kasutaja otsus)
  'components/MapView.tsx': 1, // Leafleti popup-HTML-string, pole React
};
const rawButtonsOverAllowed = (path: string, count: number): number => {
  const key = Object.keys(RAW_BUTTON_ALLOWED).find((k) => path.endsWith(k));
  return key ? Math.max(0, count - RAW_BUTTON_ALLOWED[key]) : count;
};
```

`auditTsx` tagastusobjekti lisa: `rawButtons: (src.match(RAW_BUTTON) ?? []).length,`

`summarize` tagastusse lisa (pärast `legacyCardFiles`):

```ts
    rawButtonFiles: tsx
      .filter((t) => !t.path.includes('components/ui/'))
      .map((t) => ({ path: t.path, count: rawButtonsOverAllowed(t.path, t.rawButtons) }))
      .filter((f) => f.count > 0),
```

`scripts/ui-audit.mts`: pärast rida „Vanu kaarte“ lisa

```ts
row('Tooreid nuppe (tsx)', r.rawButtonFiles.reduce((s, f) => s + f.count, 0), r.rawButtonFiles.map((f) => `${f.path}: ${f.count}`));
```

- [ ] **Step 5: Käivita test — peab läbima**

Run: `npx vitest run src/tooling/uiAudit.test.ts`
Expected: PASS.

- [ ] **Step 6: Tõsta HelpHint ui-sse ja eralda esitus**

`git mv src/components/HelpHint.tsx src/components/ui/HelpHint.tsx`. Uus sisu (andmeosa jääb, popover-osa läheb eraldi esitus-komponenti, et galerii saaks näidata ilma teenuseta):

```tsx
// src/components/ui/HelpHint.tsx — küsimärgi ikoon, mis avab teenusepakkuja koostatud juhendi (admin.teris.ee „Juhendid“).
// Hiirega üle liikudes avaneb (150 ms), lahkudes sulgub (200 ms); klõps kinnitab lahti, uus klõps sulgeb;
// klaviatuuriga fookus avab, blur sulgeb (kui pole kinnitatud); Esc sulgeb ainult vihje. Tühja juhendi korral ikooni pole.
// HelpHint võtab juhendi teenusest; HelpHintPopover on ainult esitus (galerii ja testid).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { HELP_SPOTS, type HelpKey } from '../../help/helpRegistry';
import { useHelpArticle } from '../../help/helpStore';
import { sanitizeHelp } from '../../help/sanitizeHelp';
import { cn } from './cn';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { helpHintContentClass, helpHintInlineClass, helpHintTitleClass, helpHintTriggerClass } from './variants';

const OPEN_DELAY = 150;
const CLOSE_DELAY = 200;

/** inline: ikoon on teise nupu sees (span rolliga button, klõps ei käivita välimist nuppu) */
export const HelpHint: React.FC<{ helpKey: HelpKey; inline?: boolean }> = ({ helpKey, inline = false }) => {
  const html = useHelpArticle(helpKey);
  const safe = useMemo(() => (html ? sanitizeHelp(html) : ''), [html]);
  if (!safe) return null;
  return <HelpHintPopover label={HELP_SPOTS[helpKey].label} html={safe} inline={inline} />;
};

/** Ikoon + hüpik valmis (puhastatud) sisuga; `html` peab olema läbinud `sanitizeHelp`. */
export const HelpHintPopover: React.FC<{ label: string; html: string; inline?: boolean }> = ({ label, html, inline = false }) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const schedule = useCallback((next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), delay);
  }, []);

  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPinned(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const isMouse = (e: React.PointerEvent) => e.pointerType === 'mouse';

  const toggle = () => {
    window.clearTimeout(timer.current);
    if (pinned) close();
    else {
      setPinned(true);
      setOpen(true);
    }
  };

  const triggerProps = {
    className: cn(helpHintTriggerClass, inline && helpHintInlineClass),
    'aria-label': `Juhend: ${label}`,
    onPointerEnter: (e: React.PointerEvent) => isMouse(e) && !pinned && schedule(true, OPEN_DELAY),
    onPointerLeave: (e: React.PointerEvent) => isMouse(e) && !pinned && schedule(false, CLOSE_DELAY),
    // klaviatuuri fookus avab; hiirega klõpsu fookus mitte (klõps kinnitab ise)
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(':focus-visible')) {
        window.clearTimeout(timer.current);
        setOpen(true);
      }
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (!pinned && !(next instanceof Element && next.closest('[data-help-hint-content]'))) schedule(false, 0);
    },
    onClick: (e: React.MouseEvent) => {
      // ära lase klõpsul jõuda välimise nuppuni (inline) ega selle vanemateni; Radixi enda lülitus jääb ära
      e.stopPropagation();
      e.preventDefault();
      toggle();
    },
  };

  return (
    <Popover open={open} onOpenChange={(next) => !next && close()}>
      {inline ? (
        <PopoverTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            {...triggerProps}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              toggle();
            }}
          >
            <CircleHelp size={15} />
          </span>
        </PopoverTrigger>
      ) : (
        <PopoverTrigger asChild>
          <button type="button" {...triggerProps}>
            <CircleHelp size={15} />
          </button>
        </PopoverTrigger>
      )}
      <PopoverContent
        data-help-hint-content=""
        className={helpHintContentClass}
        aria-label={label}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={(e) => isMouse(e) && window.clearTimeout(timer.current)}
        onPointerLeave={(e) => isMouse(e) && !pinned && schedule(false, CLOSE_DELAY)}
        // portaali sündmused jõuaksid React-puus välimise nuppuni
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={helpHintTitleClass}>{label}</div>
        <div className="help-content" dangerouslySetInnerHTML={{ __html: html }} />
      </PopoverContent>
    </Popover>
  );
};
```

Sisu on vana faili kood muutmata, ainsad muudatused: `label` tuleb propist ja `__html: html` (enne `safe`). Hookide arv on `HelpHint`-is konstantne (kaks hooki enne `if (!safe)`), mistõttu reegel ei rikne. Toores `<button type="button" {...triggerProps}>` jääb siia faili (ui sees lubatud).

`src/components/ui/index.ts`: asenda rida helpHint-klassidega:

```ts
export { HelpHint, HelpHintPopover } from './HelpHint';
export { helpHintTriggerClass, helpHintInlineClass, helpHintContentClass, helpHintTitleClass } from './variants';
```

Imporditsüklite kontroll: `grep -n "import" src/help/helpRegistry.ts src/help/helpStore.ts src/help/sanitizeHelp.ts` — ükski ei tohi importida `components/ui`. Kui helpStore impordib midagi `components/`-ist, too see käsitsi ümber.

Importijad (`grep -rn --include='*.tsx' -e "from './HelpHint'" src`):
- `FieldManagerModal.tsx:20`: kustuta `import { HelpHint } from './HelpHint';` ja lisa `HelpHint` olemasolevasse `from './ui'` importi.
- `FieldsTableView.tsx:17`: sama.

`src/help/helpStore.ts` 1. rea kommentaar nimetab `HelpHint`-i — jätab. Kui keegi viitab teel `components/HelpHint` kommentaarides/dokides: `grep -rn -e 'components/HelpHint' src docs --include='*.ts' --include='*.tsx' --include='*.md'` ja uuenda (ajaloolisi plaane `docs/superpowers/plans/` ei muuda).

- [ ] **Step 7: Galerii näide ja README**

`UiGallery.tsx`: lisa `HelpHintPopover` impordi ja uus sektsioon enne „Menüüd“ (või pärast „Popover“ sektsiooni):

```tsx
        <Section title="Abi-ikoon (HelpHint)">
          <HelpHintPopover label="Põllu kood" html="<p>Põllu kood on <strong>PRIA põllu number</strong>. Hõlju või klõpsa ikoonil.</p>" />
          <Button variant="secondary">
            Nupp koos ikooniga
            <HelpHintPopover inline label="Nupu sees" html="<p>Ikoon nupu sees (<code>inline</code>): klõps ei käivita nuppu.</p>" />
          </Button>
        </Section>
```

`README.md` jaotisesse „Menüüd, hüpikud, vihjed“ lisa punkt: „Abi-ikoon: `<HelpHint helpKey="…" />` (`ui/HelpHint.tsx`); `inline` kui ikoon on teise nupu sees. Tühja juhendi korral ikooni ei ole. `HelpHintPopover` on sama ilma teenuseta (galerii).“

- [ ] **Step 8: Test klassidele**

`variants.test.ts` lõppu:

```ts
describe('abi-ikoon', () => {
  it('päästik: 24px ümmargune, abi-kursor; inline kitsam (20px)', () => {
    expect(v.helpHintTriggerClass).toContain('size-6');
    expect(v.helpHintTriggerClass).toContain('cursor-help');
    expect(v.helpHintTriggerClass).toContain('rounded-full');
    expect(v.helpHintInlineClass).toContain('size-5');
  });
  it('hüpik on 320px laiune ja kõrguse piiriga', () => {
    expect(v.helpHintContentClass).toContain('w-80');
    expect(v.helpHintContentClass).toContain('max-h-');
  });
});
```
ja lisa `v.helpHintTriggerClass, v.helpHintInlineClass, v.helpHintContentClass, v.helpHintTitleClass` massiivi `allClassStrings` lõppu (keelatud-väärtuste test).

- [ ] **Step 9: Kontrollid**

`tsc`, `npx vitest run src/tooling src/components/ui`, `npx oxlint src/components/ui src/components/FieldManagerModal.tsx src/components/FieldsTableView.tsx src/tooling scripts/ui-audit.mts`, `npm run ui-audit -- --details`. Oodatav: kõik rohelised; „Tooreid nuppe (tsx)“ = **31**; `Vanu menüüsid/hüpikuid (tsx)` jääb 0 (fail on nüüd ui-s).

- [ ] **Step 10: Commit, release, pildid pärast**

```bash
git add src/components/ui/HelpHint.tsx src/components/ui/index.ts src/components/ui/UiGallery.tsx src/components/ui/README.md src/components/ui/variants.test.ts src/components/FieldManagerModal.tsx src/components/FieldsTableView.tsx src/tooling/uiAudit.ts src/tooling/uiAudit.test.ts scripts/ui-audit.mts
git add -u src/components/HelpHint.tsx
git commit -m "refactor(ui): HelpHint ui kausta ja auditi rida tooreste nuppude kohta" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Release (vt Global Constraints). Pildid pärast samade käskudega kausta `/tmp/shots-after`; võrdle abi-ikooni paari (hover ja avatud hüpik: lisa `--do 'click:[aria-label^="Juhend:"]'`) ning `/ui` galerii (`--platform '*'`, sektsioon „Abi-ikoon“).

---

### Task 2: Valitav kaart `CardButton` (variandid `item`, `option`)

**Files:**
- Modify: `src/components/ui/variants.ts` (cardVariants, `CardVariant`), `src/components/ui/Card.tsx`, `src/components/ui/index.ts`, `src/components/ui/UiGallery.tsx`, `src/components/ui/README.md`, `src/components/ui/variants.test.ts`
- Modify: `src/components/FieldWorksBoard.tsx` (~129), `src/components/AddFieldWorkDialog.tsx` (~124), `src/components/FieldWorkEntryDialog.tsx` (~457), `src/components/FinanceModal.tsx` (~489, closing ~521), `src/admin/HelpView.tsx` (~125)
- Modify: `src/index.css` (`.fw-card*`, `.add-work-option*`, `.telemetry-suggestion-pill*`)

**Interfaces:**
- Produces: `CardButton: React.FC<React.ComponentProps<'button'> & Omit<VariantProps<typeof cardVariants>, 'interactive'>>` — rendereerib `<button type="button" data-slot="card">` (vaikimisi `type="button"`), `interactive` alati sees; `selected?: boolean`, `variant?: 'surface'|'floating'|'tile'|'item'|'option'`, `padding?: 'none'|'sm'|'md'`. Card variandid: `item` = `rounded-sm bg-popover` (6px, nagu vana `.fw-card`), `option` = `rounded-md bg-popover` (10px, nagu `.add-work-option`, `.telemetry-suggestion-pill`).
- Auditi oodatav tulemus: „Tooreid nuppe (tsx)“ = **26** (31 − `fw-card`, `add-work-option`, telemeetria soovitus, `FinanceModal`, `HelpView`).

- [ ] **Step 1: Pildid enne**

1. Põllutööd: `--do 'click:.main-view-switch >> text=Põllutööd' --do 'wait:2000' /` ja sama valitud töökaardiga `--do 'click:.fw-card' --do 'wait:800'` (valitud rõngas, in_progress roheline ääris, planeerimata kollane katkendjoon: otsi tahvlilt).
2. „Lisa töö“ dialoog (AddFieldWorkDialog): `grep -n "AddFieldWorkDialog" src/components/FieldWorksBoard.tsx`; ava tahvlil `.fw-add`-i klõpsuga: `--do 'click:.fw-add' --do 'wait:800'`; pildista ka ühe valitud valikuga (`click:.add-work-option`).
3. Põllutöö kande dialoog telemeetria soovitustega (FieldWorkEntryDialog): tahvlil kande lisamise nupp (`grep -n "FieldWorkEntryDialog\|setEntryDialog" src/components/FieldWorksBoard.tsx`), pildista kui soovitused olemas (kui andmeid pole, kirjuta raportisse).
4. Finants: töö kande finantsi dialoog (FinanceModal) — tahvlil `.fw-finance-chip-btn` klõps; pildista valitud kanne.
5. Admin: `--platform '*'` ja Juhendid vaade (`grep -n "HelpView" src/admin/*.tsx` annab menüünime), valitud kirje.

- [ ] **Step 2: Kirjuta kukkuvad testid**

`variants.test.ts`: muuda `allClassStrings` kaardi rida `(['surface', 'floating', 'tile'] as const)` → `(['surface', 'floating', 'tile', 'item', 'option'] as const)` ja lisa `describe('kaart')` plokki:

```ts
  it('item: 6px nurk (vana fw-card), option: 10px; mõlemad bg-popover, ei muuda hõljudes tausta', () => {
    const item = v.cardVariants({ variant: 'item', padding: 'none', interactive: true });
    const option = v.cardVariants({ variant: 'option', padding: 'none', interactive: true });
    expect(item.split(/\s+/)).toContain('rounded-sm');
    expect(option.split(/\s+/)).toContain('rounded-md');
    for (const c of [item, option]) {
      expect(c.split(/\s+/)).toContain('bg-popover');
      expect(c.split(/\s+/)).toContain('hover:bg-popover');
      expect(c).not.toContain('hover:bg-card-hover');
    }
  });
  it('item hõljudes täisroheline ääris (vana .fw-card:hover), option õrn', () => {
    expect(v.cardVariants({ variant: 'item', interactive: true })).toContain('hover:border-primary');
    expect(v.cardVariants({ variant: 'item', interactive: true })).not.toContain('hover:border-primary/50');
    expect(v.cardVariants({ variant: 'option', interactive: true })).toContain('hover:border-primary/50');
  });
  it('item/option padding none ei anna polstriklassi (vaate CSS-i polster kehtib)', () => {
    expect(v.cardVariants({ variant: 'item', padding: 'none' })).not.toMatch(/(^|\s)p-\d/);
  });
```
Märkus: `cn(...)`-ga (tailwind-merge) liidetud tulemus on see, mis brauserisse jõuab — testi `cn(v.cardVariants(...))`, kui `cva` ise ei sulanda kokku (`hover:bg-card-hover` ja `hover:bg-popover` mõlemad tulevad `cva` väljundis). Seepärast kasuta testis `cn(v.cardVariants({...}))` kolmes ülaltoodud `it`-is ja kontrolli seal, et `hover:bg-card-hover` on **kadunud** (twMerge jätab viimase). Kui `cn` ei sulata neid (kontrolli), tõsta `hover:bg-popover` asemel interaktiivne variant: `interactive` compound `{ variant: ['surface','floating','tile'], interactive: true, class: 'hover:bg-card-hover' }` ja võta `hover:bg-card-hover` `interactive.true` baasist välja.

- [ ] **Step 3: Käivita testid — peavad kukkuma**

`npx vitest run src/components/ui/variants.test.ts` → FAIL (variant `item` puudub).

- [ ] **Step 4: Implementeeri variandid ja CardButton**

`variants.ts`: `export type CardVariant = 'surface' | 'floating' | 'tile' | 'item' | 'option';` ja `cardVariants.variants.variant` lisa:

```ts
      // Valitav tahvlikaart (töökaart): 6px nurk, tahke taust nagu dialoog. Tegelik kuju (polster, laius) tuleb vaate CSS-ist.
      item: 'rounded-sm bg-popover',
      // Valitav rida/valik (lisatava töö valik, soovitus): 10px nurk, tahke taust.
      option: 'rounded-md bg-popover',
```
`compoundVariants` lisa (pärast olemasolevat):

```ts
    // item/option: hõljudes taust ei muutu (vanad kaardid ei muutnud); item'il täisroheline ääris nagu vana .fw-card:hover.
    { variant: ['item', 'option'], interactive: true, class: 'hover:bg-popover' },
    { variant: 'item', interactive: true, selected: false, class: 'hover:border-primary' },
```
Kontrolli, et lõplik `cn(cardVariants(...))` annab item'ile `hover:border-primary` (mitte `/50`) — `cn` jätab viimase; kui ei, vaata testi märkust.

`Card.tsx` lõppu (või `Card` järele):

```tsx
export type CardButtonProps = React.ComponentProps<'button'> & Omit<VariantProps<typeof cardVariants>, 'interactive'>;

/** Valitav kaart nupuna (kogu kaart on klõpsatav): kaardi välimus, klaviatuur ja `type="button"` ühes. Valitud = `selected`. */
export const CardButton: React.FC<CardButtonProps> = ({ className, variant, padding, selected, type = 'button', ...props }) => (
  <button
    type={type}
    data-slot="card"
    data-selected={selected ? '' : undefined}
    className={cn(cardVariants({ variant, padding, interactive: true, selected }), className)}
    {...props}
  />
);
```
`data-slot="card"` aktiveerib `app.css` base-reegli (`font: inherit; text-align:left; color`). `index.ts`: `export { Card, CardButton, CardHeader, CardTitle, CardActions, Panel, type CardProps, type CardButtonProps } from './Card';`

- [ ] **Step 5: Testid läbi**

`npx vitest run src/components/ui/variants.test.ts` → PASS.

- [ ] **Step 6: Vaated ja CSS**

**FieldWorksBoard.tsx (~129)** — vana:
```tsx
      <button
        type="button"
        className={`fw-card ${work.status.toLowerCase()} ${unplanned ? 'unplanned' : ''} ${selected ? 'selected' : ''}`}
        onClick={onSelect}
        aria-label={…}
      >
```
uus (sulgev `</button>` → `</CardButton>`; impordi `CardButton` olemasolevast `./ui` impordist):
```tsx
      <CardButton
        variant="item"
        padding="none"
        selected={selected}
        className={`fw-card ${work.status.toLowerCase()} ${unplanned ? 'unplanned' : ''}`}
        onClick={onSelect}
        aria-label={…}
      >
```
`index.css` `.fw-card` plokid (~4892–4937) kujule (välimus läheb ui-sse; allesjäävad on mõõdud ja staatuse tähendus):

```css
.fw-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;
  max-width: 180px;
  padding: 6px 8px;
}

/* Staatuse ääris peab ui Card-i äärise üle võitma (!important: ui utiliidid on legacy kihist kõrgemal) */
.fw-card.in_progress {
  border: 1.5px solid #16a34a !important;
}

.fw-card.done {
  color: var(--text-secondary);
}

/* Planeerimata töö: kollane katkendjoon ja märgis, et see paistaks tahvlil silma */
.fw-card.unplanned {
  border: 1.5px dashed var(--amber-500) !important;
  background: rgba(245, 158, 11, 0.08) !important;
}

.fw-card.unplanned:hover {
  border-color: var(--amber-400) !important;
}
```
Kustuta `.fw-card:hover` ja `.fw-card.selected` reeglid (annab Card `item` + `selected`); `.fw-card.unplanned .fw-status-dot` jääb.

**AddFieldWorkDialog.tsx (~124)** — `<button key={w.id} type="button" className={optionClass} aria-pressed={isAdding} title=… onClick=…>` → `<CardButton key={w.id} variant="option" padding="none" className={optionClass} aria-pressed={isAdding} title=… onClick=…>`, sulgev `</CardButton>`; **ära anna** `selected` (vana „valitud“ on roheline tooni taust, mitte ääris+rõngas). `index.css`:

```css
.add-work-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 14px;
}

.add-work-option.picked {
  border-color: #16a34a !important;
  background: rgba(22, 163, 74, 0.08) !important;
}

.add-work-option.on-field {
  border-color: rgba(22, 163, 74, 0.35) !important;
  background: rgba(22, 163, 74, 0.04) !important;
}
```
`.add-work-option.disabled` jätta; enne kustutamist `grep -n "add-work-option\|optionClass" src` ja kui `disabled` klassi tsx ei kasuta, jäta see audit-valvurile.

**FieldWorkEntryDialog.tsx (~457)** — `<button type="button" className={`telemetry-suggestion-pill ${isSelected ? 'selected' : ''}`} onClick={() => applySuggestion(s)}>` → `<CardButton variant="option" padding="none" className=… onClick=…>` … `</CardButton>` (leia sulgev `</button>` selle bloki lõpust; `selected` prop'i ei anna, roheline identiteet jääb CSS-i). `index.css` kaks `.telemetry-suggestion-pill` plokki (~5513 ja ~5588) üheks:

```css
.telemetry-suggestion-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 12px;
  /* roheline identiteet peab ui Card-i neutraalse äärise üle võitma */
  border-color: rgba(16, 185, 129, 0.35) !important;
}

.telemetry-suggestion-pill:hover {
  background: rgba(16, 185, 129, 0.12) !important;
  border-color: #10b981 !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);
}

.telemetry-suggestion-pill.selected {
  background: #ecfdf5 !important;
  border-color: #059669 !important;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
}

.telemetry-suggestion-pill > .trip-route {
  flex-basis: 100%;
}
```
(`.telemetry-suggestion-pill > .trip-route` oli teises plokis — säilita.)

**FinanceModal.tsx (~489–522)** — vana `<Card key={e.id} asChild variant="tile" padding="sm" interactive selected={isSelected}><button type="button" className={…} onClick={…}> … </button></Card>` → `<CardButton key={e.id} variant="tile" padding="sm" selected={isSelected} className={…} onClick={…}> … </CardButton>`; kustuta `Card` import, kui see pole enam kasutusel (`oxlint` ütleb).

**admin/HelpView.tsx (~125)** — vana `<Card key={s.key} asChild variant="tile" padding="none" interactive selected={s.key === selected} className="admin-help-item"><button type="button" onClick={() => open(s)}> … </button></Card>` → `<CardButton key={s.key} variant="tile" padding="none" selected={s.key === selected} className="admin-help-item" onClick={() => open(s)}> … </CardButton>`; `Card` jääb (kasutatakse mujal failis).

- [ ] **Step 7: Galerii ja README**

`UiGallery.tsx`: lisa `CardButton` impordile ja sektsiooni „Kaardid“ asenda `Card asChild … <button>` näide ning lisa variantide näited:

```tsx
            <CardButton variant="tile" padding="sm" selected={pickedCard === 'c'} onClick={() => setPickedCard('c')}>
              Plaat nupuna (CardButton tile)
            </CardButton>
            <CardButton variant="item" padding="none" selected={pickedCard === 'd'} onClick={() => setPickedCard('d')} className="px-2 py-1.5 text-sm">
              Tahvlikaart (item, 6px nurk)
            </CardButton>
            <CardButton variant="option" padding="none" selected={pickedCard === 'e'} onClick={() => setPickedCard('e')} className="px-3 py-2 text-sm">
              Valikurida (option, 10px nurk)
            </CardButton>
```
(galeriis on Tailwindi klassid lubatud, sest fail on `ui/` all).

`README.md` „Kaart“: lisa `CardButton` kirjeldus („kogu kaart on klõpsatav; ei kasuta `Card asChild` + `<button>`; `variant`: `tile` (loendikirje), `item` (tahvlikaart 6px), `option` (valikurida 10px); `selected` = roheline ääris + rõngas; vaate olekuäärised `!important`-iga“); asenda `asChild`-reas näide `<button>` mõistliku `<form>`/`<section>`-iga; eemalda „Erandid“ nimekirjast `fw-card`, ja märgi, et `register-crop-stat`/`reg-stat-pill` kiibid on `ChipButton` (Task 3).

- [ ] **Step 8: Kontrollid**

tsc, vitest, oxlint (muudetud failid), `npm run ui-audit -- --details` — oodatav „Tooreid nuppe (tsx)“ = **26**; „Vanu kaarte“ = 0.

- [ ] **Step 9: Commit, release, pildid pärast**

```bash
git add src/components/ui/variants.ts src/components/ui/Card.tsx src/components/ui/index.ts src/components/ui/UiGallery.tsx src/components/ui/README.md src/components/ui/variants.test.ts src/components/FieldWorksBoard.tsx src/components/AddFieldWorkDialog.tsx src/components/FieldWorkEntryDialog.tsx src/components/FinanceModal.tsx src/admin/HelpView.tsx src/index.css
git commit -m "feat(ui): CardButton ja kaardivariandid item/option valitavatele kaartidele" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Release; pildid pärast samade käskudega nagu Step 1 (kaustas `/tmp/shots-after`); võrdle paarikaupa. **Viga**: kadunud rohelise `in_progress` ääris, kadunud kollane katkendjoon, valitud kaardi rõngas puudub, telemeetria soovitus valge/hall tumedas teemas, `add-work-option` valitud taust kadunud. Lisa pilt `/ui` galeriist (`--platform '*'`, sektsioon „Kaardid“).

---

### Task 3: Nupuvariandid (`dashed`, `bare`, `text`, `add-slot`) ja `ChipButton`

**Files:**
- Modify: `src/components/ui/variants.ts` (`buttonVariantSizes`, `buttonVariants`, uus `chipVariants`), `src/components/ui/index.ts`, `src/components/ui/UiGallery.tsx`, `src/components/ui/README.md`, `src/components/ui/variants.test.ts`
- Create: `src/components/ui/ChipButton.tsx`
- Modify: `src/styles/app.css` (`@utility chip-*`)
- Modify: `src/components/FieldWorksBoard.tsx` (10 × `fw-add` + ~1278 `fw-finance-chip-btn`), `src/components/TripDialog.tsx` (~237), `src/components/FieldManagerModal.tsx` (~330, 353, 363)
- Modify: `src/index.css` (`.fw-add*`, `.fw-finance-chip-btn*`, `.trip-dialog-entry*`, `.register-crop-stat*`, `.reg-stat-pill.is-filter*`)

**Interfaces:**
- Produces: `Button` variandid `dashed`, `bare`, `text`; `Button` suurus `add-slot` (30×40, 6px nurk); `ChipButton: React.FC<React.ComponentProps<'button'> & { variant?: 'tint' | 'outline'; accent?: string; selected?: boolean; dimmed?: boolean }>` — `accent` on CSS värv (`'#16a34a'` või `'var(--emerald-500)'`), pannakse CSS-muutujaks `--chip-accent`; `selected` annab `aria-pressed` ja `data-selected`; `chipVariants({ variant, dimmed })`.
- Auditi oodatav tulemus: „Tooreid nuppe (tsx)“ = **11** (26 − 10 `fw-add` − finantsmärk − TripDialog − 3 kiipi).

- [ ] **Step 1: Pildid enne**

1. Põllutööd: `--do 'click:.main-view-switch >> text=Põllutööd' --do 'wait:2000' /` — tühjad lahtrid katkendjoonega „+“, ja `--do 'hover:.fw-add'` kui skript toetab (muidu `eval:document.querySelector('.fw-add').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`; kui hover pole pildistatav, kirjuta raportisse).
2. Põllutöö külgpaneel kande finantsmärgiga (`.fw-finance-chip-btn`): `--do 'click:.fw-card' --do 'wait:800'`.
3. Sõidu dialoog (TripDialog): `grep -n "TripDialog" src/components/*.tsx` → ava Tehnika → Sõidud → sõit, kus on seotud kande link (`.trip-dialog-entry`); pildista.
4. Põllud → põllude register: `--do 'click:.main-view-switch >> text=Põllud' --do 'wait:1500'`, ava põllude haldur (`grep -n "FieldManagerModal" src/components/*.tsx`) — kultuurikiibid ja omandivormi kiibid; pildista ka ühe valitud kiibiga (`click:.register-crop-stat`, `click:.reg-stat-pill.is-filter`).

- [ ] **Step 2: Kirjuta kukkuvad testid**

`variants.test.ts`: lisa `buttonVariants` kombinatsioonide loendisse (`allClassStrings` esimene plokk) variandid `'dashed', 'bare', 'text'` ja suurus `'add-slot'`; lisa lõppu:

```ts
describe('nupuvariandid etapp 3b', () => {
  it('dashed: katkendjoon, hõljudes täisroheline valge ikooniga (vana .fw-add)', () => {
    const t = v.buttonVariants({ variant: 'dashed', size: 'add-slot' }).split(/\s+/);
    expect(t).toContain('border-dashed');
    expect(t).toContain('enabled:hover:border-solid');
    expect(t).toContain('enabled:hover:bg-primary');
    expect(t).toContain('enabled:hover:text-white');
    expect(t).toContain('text-subtle');
  });
  it('add-slot: 30×40px, 6px nurk, polstrita', () => {
    const t = v.buttonVariants({ variant: 'dashed', size: 'add-slot' }).split(/\s+/);
    expect(t).toContain('w-7.5');
    expect(t).toContain('min-h-10');
    expect(t).toContain('rounded-sm');
    expect(t).not.toContain('h-8');
  });
  it('bare: nähtamatu nupp märgi ümber, hõljudes tõuseb ja tumeneb', () => {
    const t = v.buttonVariants({ variant: 'bare', size: 'inline' }).split(/\s+/);
    expect(t).toContain('bg-transparent');
    expect(t).toContain('rounded-full');
    expect(t).toContain('enabled:hover:-translate-y-px');
    expect(t).toContain('enabled:hover:brightness-92');
  });
  it('text: roheline tavakaalus tekst ilma allajoonimiseta', () => {
    const t = v.buttonVariants({ variant: 'text', size: 'inline' }).split(/\s+/);
    expect(t).toContain('text-primary');
    expect(t).toContain('font-normal');
    expect(t).not.toContain('underline');
  });
});

describe('kiip (ChipButton)', () => {
  it('tint: andmevärviga toon, 6px nurk, 14px kiri', () => {
    const t = v.chipVariants({ variant: 'tint' }).split(/\s+/);
    expect(t).toContain('chip-tint');
    expect(t).toContain('rounded-sm');
    expect(t).toContain('text-base');
  });
  it('outline: ääris ja vasak riba, 10px nurk, 13px kiri', () => {
    const t = v.chipVariants({ variant: 'outline' }).split(/\s+/);
    expect(t).toContain('chip-outline');
    expect(t).toContain('border-l-3');
    expect(t).toContain('rounded-md');
    expect(t).toContain('text-sm');
  });
  it('dimmed: poolläbipaistev, hõljudes heledam', () => {
    expect(v.chipVariants({ variant: 'tint', dimmed: true })).toContain('opacity-50');
    expect(v.chipVariants({ variant: 'tint', dimmed: false })).not.toContain('opacity-50');
  });
  it('ei kasuta keelatud suvalisi väärtusi', () => {
    for (const variant of ['tint', 'outline'] as const)
      for (const dimmed of [true, false]) expect(auditTsx(`className="${v.chipVariants({ variant, dimmed })}"`).arbitrary).toEqual([]);
  });
});
```
Ja `allClassStrings` lõppu lisa `v.chipVariants({ variant: 'tint', dimmed: true }), v.chipVariants({ variant: 'outline' })`. Olemasolevate nuputestide (`variants.test.ts` rida ~94–115: „nupu äärevärv on täpselt üks variandis“, „keelatud nupp jääb hõljutatavaks“) tsüklid käivad `variant`/`size` loenditel — lisa uued variandid sinna ka ja kontrolli: `dashed` peab sisaldama ühte äärevärvi (`border-border`), `bare`/`text` `border-transparent`; baasis äärevärvi ei ole.

- [ ] **Step 3: Testid peavad kukkuma**

`npx vitest run src/components/ui/variants.test.ts` → FAIL.

- [ ] **Step 4: Implementeeri variandid**

`variants.ts` `buttonVariantSizes` lisa:

```ts
  // Tahvli tühja lahtri „lisa töö“-ruut (vana .fw-add): 30×40px, 6px nurk.
  'add-slot': 'min-h-10 w-7.5 rounded-sm p-0',
```
`buttonVariants.variants.variant` lisa:

```ts
        // Katkendjoonega „lisa“-ruut: hõljudes täisroheline valge ikooniga (vana .fw-add). Kasuta size="add-slot".
        dashed:
          'border-dashed border-border bg-transparent font-normal text-subtle enabled:hover:border-solid enabled:hover:border-primary enabled:hover:bg-primary enabled:hover:text-white',
        // Nupp, mis ümbritseb muud ui elementi (klõpsatav märk): ise nähtamatu, hõljudes tõuseb ja tumeneb. Kasuta size="inline".
        bare:
          'rounded-full border-transparent bg-transparent font-normal enabled:hover:-translate-y-px enabled:hover:brightness-92 enabled:hover:shadow-sm',
        // Tekst nupuna: tavakaalus roheline tekst, ilma allajoonimiseta (hõljumise vihje on vaate asi). Kasuta size="inline".
        text: 'border-transparent bg-transparent font-normal whitespace-normal text-primary',
```
Uus `chipVariants` (faili lõppu, `cva` on juba imporditud):

```ts
// --- Kiip (etapp 3b): valitav, andmevärviga. `chip-*` on @utility-d src/styles/app.css-is (taust ja riba tulevad
// CSS-muutujast --chip-accent, mida ChipButton seab; suvalisi väärtusi audit ei luba). ---
export type ChipVariant = 'tint' | 'outline';
export const chipVariants = cva(
  `inline-flex shrink-0 cursor-pointer items-center gap-1.5 transition-colors disabled:cursor-default ${focusRing}`,
  {
    variants: {
      variant: {
        // Andmevärviga toonitud kiip (kultuur): taust ja vasak riba värvist, valituna ümber 2px rõngas.
        tint: 'chip-tint rounded-sm border-0 px-3 py-1 text-base text-foreground',
        // Äärisega kiip (omandivorm): vasak serv 3px värvitud, valituna ümber 2px rõngas.
        outline: 'chip-outline rounded-md border border-l-3 border-border bg-field px-3 py-1.5 text-sm text-foreground enabled:hover:border-subtle',
      },
      dimmed: { true: 'opacity-50 enabled:hover:opacity-85', false: '' },
    },
    defaultVariants: { variant: 'tint', dimmed: false },
  }
);
```
`src/styles/app.css` lisa (`@theme inline` ploki järele):

```css
/* Kiip (ui/ChipButton): värv tuleb CSS-muutujast --chip-accent. Utiliidid, sest audit keelab suvalised bg-/border-[…] väärtused.
   --crop-tint(-hover) on index.css-i :root-is. Valitud = [data-selected]. */
@utility chip-tint {
  background: color-mix(in srgb, var(--chip-accent, #94a3b8) var(--crop-tint), transparent);
  box-shadow: inset 3px 0 0 var(--chip-accent, #94a3b8);
  &:hover:enabled {
    background: color-mix(in srgb, var(--chip-accent, #94a3b8) var(--crop-tint-hover), transparent);
  }
  &[data-selected] {
    box-shadow: inset 3px 0 0 var(--chip-accent, #94a3b8), 0 0 0 2px var(--chip-accent, #94a3b8);
  }
}
@utility chip-outline {
  border-left-color: var(--chip-accent, var(--border-card));
  &[data-selected] {
    box-shadow: 0 0 0 2px var(--chip-accent, var(--border-card));
  }
}
```
`ChipButton.tsx`:

```tsx
// src/components/ui/ChipButton.tsx — valitav kiip andmevärviga (kultuuri filter, omandivormi filter). Välimus: chipVariants;
// värv tuleb `accent` prop'ist. Valitud olek on `selected` (aria-pressed + data-selected), mitte `.active`.
import React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { chipVariants } from './variants';

export type ChipButtonProps = React.ComponentProps<'button'> &
  Pick<VariantProps<typeof chipVariants>, 'variant' | 'dimmed'> & {
    /** CSS värv (`#16a34a` või `var(--emerald-500)`): toon, riba ja valitud rõngas. */
    accent?: string;
    selected?: boolean;
  };

export const ChipButton: React.FC<ChipButtonProps> = ({ className, variant, dimmed, accent, selected = false, type = 'button', style, ...props }) => (
  <button
    type={type}
    data-slot="chip"
    aria-pressed={selected}
    data-selected={selected ? '' : undefined}
    style={accent ? ({ '--chip-accent': accent, ...style } as React.CSSProperties) : style}
    className={cn(chipVariants({ variant, dimmed }), className)}
    {...props}
  />
);
```
`index.ts`: `export { ChipButton, type ChipButtonProps } from './ChipButton';`

- [ ] **Step 5: Testid läbi**

`npx vitest run src/components/ui/variants.test.ts` → PASS.

- [ ] **Step 6: Vaated ja CSS**

**FieldWorksBoard.tsx — `AddWorkButton`.** Lisa faili ülaossa (komponentide juurde) ja impordi `Button` (on juba olemas, kontrolli):

```tsx
/** Tahvli tühja lahtri „Lisa töö“ ruut (katkendjoon, hõljudes roheline). */
const AddWorkButton: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <Button variant="dashed" size="add-slot" aria-label="Lisa töö" title="Lisa töö" onClick={onAdd}>
    <Plus size={13} />
  </Button>
);
```
Asenda kõik 10 `fw-add` nuppu (rida järgi: PREV PREPARATION, PREV SOWING, PREV CARE, PREPARATION, SOWING, CARE, HARVEST, next PREP, next SOWING, next CARE), säilitades `onClick`-i sisu, nt:

```tsx
{!locked && !row.undetermined && (
  <AddWorkButton onAdd={() => setAddDialog({ row, phase: 'PREPARATION', plannedText: `Sügis ${year - 1}` })} />
)}
```
Tingimused (`!locked && …`, `row.nextRec?.fieldSeasonId`) jäävad täpselt nagu on. Pärast `grep -n "fw-add" src/components/FieldWorksBoard.tsx` peab tulemus olema 0.

**~1278 finantsmärk:** `<button type="button" className="fw-finance-chip-btn" title=… onClick=…>…</button>` → `<Button variant="bare" size="inline" title="Ava kande finants ja määra ühikuhinnad" onClick={…}>…</Button>` (Badge sisu jääb). Märkus: `title` ilma `icon-*` suuruseta jääb natiivseks.

**TripDialog.tsx (~237):** `<button key={e.id} type="button" className="trip-dialog-entry" title=… disabled=… onClick=…>` → `<Button key={e.id} variant="text" size="inline" className="trip-dialog-entry" title=… disabled=… onClick=…>` … `</Button>`.

**FieldManagerModal.tsx:** impordi `ChipButton` (`./ui`). Kultuurikiip (~330):

```tsx
              <ChipButton
                key={c.crop}
                variant="tint"
                accent={c.color}
                selected={cropFilter === c.crop}
                dimmed={cropFilter !== 'all' && cropFilter !== c.crop}
                onClick={() => setCropFilter(cropFilter === c.crop ? 'all' : c.crop)}
                title={…sama…}
              >
                <span>{c.crop}</span>
                <strong>{c.areaHa.toFixed(2)} ha</strong>
              </ChipButton>
```
Omandivormi kiibid (~353, ~363):

```tsx
        <ChipButton
          variant="outline"
          accent="var(--emerald-500)"
          selected={tenureFilter === 'OWNED'}
          onClick={() => setTenureFilter(tenureFilter === 'OWNED' ? 'all' : 'OWNED')}
          title={…sama…}
        >
          <span className="lbl">🏛️ Oma maa:</span> … (sisu muutmata)
        </ChipButton>
```
Rendimaa: `accent="var(--blue-500)"`, `selected={tenureFilter === 'RENTED'}`, `disabled={…sama…}`.

**index.css puhastus:**
- Kustuta `.fw-add` ja `.fw-add:hover` (~5058–5077) ning `.fw-finance-chip-btn`, `:focus-visible`, `:hover` (~5366–5386).
- `.trip-dialog-entry` (~6871) kujule:
```css
.trip-dialog-entry {
  /* !important: ui Button annab inline-flex/center/gap, siin on kahe reaga plokk vasakul */
  display: flex; flex-direction: column; align-items: flex-start !important; justify-content: flex-start !important;
  gap: 0 !important; text-align: left;
}
.trip-dialog-entry:hover span:first-child { text-decoration: underline; }
.trip-dialog-entry:disabled { color: inherit !important; cursor: default !important; opacity: 1 !important; }
.trip-dialog-entry:disabled:hover span:first-child { text-decoration: none; }
```
- Kustuta kogu `.register-crop-stat*` blokk (~2509–2540; `:root { --crop-tint… }` JÄÄB).
- `.reg-stat-pill` ploki all jäta `.reg-stat-pill` (kasutab ka `RelatedPartiesModal` div-idena), `.lbl`, `strong`, `.highlight`, `.tenure-owned`, `.tenure-rented`, `.sub-val`; kustuta `.reg-stat-pill.is-filter`, `.is-filter:hover:not(:disabled)`, `.is-filter:disabled`, `.tenure-owned.active`, `.tenure-rented.active`. Kiibi sisu tüpograafia (`.lbl`, `strong`, `.sub-val`) tuleb nüüd `[data-slot="chip"]` all — lisa:
```css
[data-slot="chip"] .lbl { color: var(--text-secondary); }
[data-slot="chip"] strong { color: var(--text-primary); font-weight: 700; }
[data-slot="chip"] .sub-val { font-size: 11px; margin-left: 4px; }
```
Kiibi sees olev `<strong>` kultuurikiibil (`<strong>{ha}</strong>`) pärib samast reeglist ainult värvi/kaalu — vana `.register-crop-stat` ei seadnud `strong`-ile midagi, aga brauseri `strong` on bold; `color: text-primary` on sama mis kiibi värv, seega nähtav erinevus puudub.

- [ ] **Step 7: Galerii ja README**

`UiGallery.tsx`: impordi `ChipButton`; lisa sektsioon „Nupud: erivariandid ja kiibid“:

```tsx
        <Section title="Nupud: erivariandid ja kiibid">
          <Button variant="dashed" size="add-slot" aria-label="Lisa töö" title="Lisa töö"><Plus size={13} /></Button>
          <Button variant="bare" size="inline" title="Ava finants"><Badge tone="success" variant="solid">Kinnitatud</Badge></Button>
          <Button variant="text" size="inline">Tekstina nupp (text)</Button>
          <ChipButton variant="tint" accent="#a16207" selected={chip === 'a'} dimmed={chip !== 'none' && chip !== 'a'} onClick={() => setChip(chip === 'a' ? 'none' : 'a')}>
            <span>Talinisu</span><strong>120,50 ha</strong>
          </ChipButton>
          <ChipButton variant="tint" accent="#0369a1" selected={chip === 'b'} dimmed={chip !== 'none' && chip !== 'b'} onClick={() => setChip(chip === 'b' ? 'none' : 'b')}>
            <span>Suvioder</span><strong>40,00 ha</strong>
          </ChipButton>
          <ChipButton variant="outline" accent="var(--emerald-500)" selected={tenure} onClick={() => setTenure(!tenure)}>
            <span className="lbl">Oma maa:</span><strong>312 ha</strong>
          </ChipButton>
        </Section>
```
ja `useState`: `const [chip, setChip] = useState('none'); const [tenure, setTenure] = useState(false);`. Kontrolli, et `Plus` on juba imporditud (on).

README „Nupud: vana → uus“ tabelisse lisa read: `fw-add` → `<Button variant="dashed" size="add-slot">`; klõpsatav märk nupuna → `<Button variant="bare" size="inline">`; tekstilink kahe reaga → `<Button variant="text" size="inline">`; „Kiip“ jaotis: `ChipButton` (`tint`/`outline`, `accent`, `selected`, `dimmed`).

- [ ] **Step 8: Kontrollid**

tsc, vitest, oxlint, `npm run ui-audit -- --details` — oodatav „Tooreid nuppe (tsx)“ = **11**, `style={{…}} kohti` väheneb 1 võrra, „Defineerimata CSS-muutujaid“ jääb 0 (`--chip-accent` on tsx style-võti; kui audit kurdab, lisa `'--chip-accent'` literaal — see on juba `ChipButton.tsx`-is), „Kasuta­seta klasse (CSS)“ ei tohi kasvada (kontrolli, et kustutatud klasside tsx-viited on kadunud: `grep -rn --include='*.tsx' -e 'fw-add' -e 'register-crop-stat' -e 'is-filter' -e 'fw-finance-chip-btn' src` → 0).

- [ ] **Step 9: Commit, release, pildid pärast**

```bash
git add src/components/ui/variants.ts src/components/ui/ChipButton.tsx src/components/ui/index.ts src/components/ui/UiGallery.tsx src/components/ui/README.md src/components/ui/variants.test.ts src/styles/app.css src/components/FieldWorksBoard.tsx src/components/TripDialog.tsx src/components/FieldManagerModal.tsx src/index.css
git commit -m "feat(ui): Button dashed/bare/text/add-slot ja ChipButton valitavatele kiipidele" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Release; pildid pärast nagu Step 1. **Viga**: „+“ ruut on täis/hall või vale suurusega (peab olema 30×40px), kadunud katkendjoon, kultuurikiibi toon/vasak riba kadunud, valitud kiibil pole rõngast, hajutatud (dimmed) kiip pole poolläbipaistev, omandivormi kiibi vasak riba kadunud, TripDialogi kande link on hall nupp või keskjoondatud. Hover-kontroll: `+` hõljudes täisroheline valge ikooniga.

---

### Task 4: Peamenüü `NavSwitch`

**Files:**
- Create: `src/components/ui/NavSwitch.tsx`
- Modify: `src/components/ui/variants.ts`, `src/components/ui/index.ts`, `src/components/ui/UiGallery.tsx`, `src/components/ui/README.md`, `src/components/ui/variants.test.ts`, `src/styles/app.css` (`--color-selection`), `src/components/Header.tsx`, `src/index.css` (`.main-view-switch`)

**Interfaces:**
- Produces: `NavSwitch: React.FC<React.ComponentProps<'nav'> & { 'aria-label': string }>` (renderdab `<nav data-slot="nav-switch">`); `NavSwitchItem: React.FC<React.ComponentProps<'button'> & { current?: boolean }>` (renderdab `<button type="button" aria-current={current ? 'page' : undefined}>`); `navSwitchClass`, `navSwitchItemClass`; Tailwindi värv `bg-selection` / `bg-selection-hover` (`--color-selection`).
- Auditi oodatav tulemus: „Tooreid nuppe (tsx)“ = **0**.

**Miks eraldi komponent, mitte `Tabs`/`ToggleGroup`:** peamenüü on navigatsioon (vahetab vaadet, `aria-current="page"`), mitte sakid ega raadiovalik. Radix `Tabs` nõuab `TabsContent` paneele ja annab `role="tablist"/"tab"`; `ToggleGroup` annab `role="radio"` roving-fookusega. Praegune käitumine (iga nupp Tab-järjekorras, Enter/tühik, `aria-current`) on õige navigatsioonimuster ja jääb; `NavSwitch` annab sama välimuse ühes kohas.

- [ ] **Step 1: Pildid enne**

Päis kõigil vaadetel, kus aktiivne sakk muutub: `--do 'click:.main-view-switch >> text=Kaart'`, samuti `text=Põllud`, `text=Põllutööd`, `text=Hooajad` (neli pilti) heledas/tumedas; lisa hover-pilt kui skript lubab (`--do 'hover:.main-view-switch >> text=Isikud'`). Mõõda päise nupuriba kõrgus ja laius: `--do 'eval:JSON.stringify(document.querySelector(".main-view-switch").getBoundingClientRect())'` (kui `eval` tulemust ei prindi, võrdle pildilt). Kirjuta mõõt raportisse.

- [ ] **Step 2: Kirjuta kukkuvad testid**

`variants.test.ts`:

```ts
describe('peamenüü (NavSwitch)', () => {
  it('riba: hall raam, 10px nurk, 2px vahe ja polster', () => {
    const t = v.navSwitchClass.split(/\s+/);
    for (const c of ['flex', 'shrink-0', 'gap-0.5', 'p-0.5', 'rounded-md', 'border', 'border-border', 'bg-muted']) expect(t).toContain(c);
  });
  it('kirje: 13px poolpaks, 6/12px polster, 6px nurk', () => {
    const t = v.navSwitchItemClass.split(/\s+/);
    for (const c of ['text-sm', 'font-semibold', 'px-3', 'py-1.5', 'rounded-sm', 'gap-1.5']) expect(t).toContain(c);
  });
  it('aktiivne (aria-current=page): heledam roheline --selection-bg, valge tekst', () => {
    const t = v.navSwitchItemClass.split(/\s+/);
    expect(t).toContain('aria-[current=page]:bg-selection');
    expect(t).toContain('aria-[current=page]:text-white');
  });
  it('hõljumine ainult aktiivsele mitte: aktiivne jääb rohelisena', () => {
    const t = v.navSwitchItemClass.split(/\s+/);
    expect(t).toContain('not-aria-[current=page]:enabled:hover:bg-muted-hover');
    expect(t).toContain('not-aria-[current=page]:enabled:hover:text-foreground');
  });
  it('ei kasuta keelatud suvalisi väärtusi', () => {
    expect(auditTsx(`className="${v.navSwitchClass} ${v.navSwitchItemClass}"`).arbitrary).toEqual([]);
  });
});
```
Lisa `v.navSwitchClass, v.navSwitchItemClass` ka `allClassStrings` lõppu.

- [ ] **Step 3: Testid peavad kukkuma**

`npx vitest run src/components/ui/variants.test.ts` → FAIL (`navSwitchClass` puudub).

- [ ] **Step 4: Implementeeri**

`app.css` `@theme inline` plokki lisa (`--color-primary-to` järele):

```css
  /* Valitud olek (peamenüü sakk jt): heledam roheline, kasutaja otsus 2026-11-16 — ära tumenda */
  --color-selection: var(--selection-bg);
  --color-selection-hover: var(--selection-bg-hover);
```
`variants.ts` (tabeli/saki ploki lähedale):

```ts
// --- Peamenüü (etapp 3b): navigatsioonirida, aktiivne = aria-current="page" (mitte Radix Tabs/ToggleGroup). ---
// Aktiivne on heledam roheline --selection-bg (kasutaja otsus 2026-11-16: jääb, kontrastist hoolimata).
export const navSwitchClass = 'flex shrink-0 gap-0.5 rounded-md border border-border bg-muted p-0.5';
export const navSwitchItemClass = `inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-sm border-0 bg-transparent px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors not-aria-[current=page]:enabled:hover:bg-muted-hover not-aria-[current=page]:enabled:hover:text-foreground aria-[current=page]:bg-selection aria-[current=page]:text-white ${focusRing}`;
```
`NavSwitch.tsx`:

```tsx
// src/components/ui/NavSwitch.tsx — peamenüü: navigatsioonirida, kus praegune vaade on `current` (aria-current="page").
// Iga kirje on tavaline nupp (Tab, Enter, tühik). Paigutus (veerised, kerimine) on kasutaja klassis.
import React from 'react';
import { cn } from './cn';
import { navSwitchClass, navSwitchItemClass } from './variants';

export const NavSwitch: React.FC<React.ComponentProps<'nav'> & { 'aria-label': string }> = ({ className, ...props }) => (
  <nav data-slot="nav-switch" className={cn(navSwitchClass, className)} {...props} />
);

export const NavSwitchItem: React.FC<React.ComponentProps<'button'> & { current?: boolean }> = ({ className, current = false, type = 'button', ...props }) => (
  <button type={type} aria-current={current ? 'page' : undefined} className={cn(navSwitchItemClass, className)} {...props} />
);
```
`index.ts`: `export { NavSwitch, NavSwitchItem } from './NavSwitch';`

- [ ] **Step 5: Testid läbi**

`npx vitest run src/components/ui/variants.test.ts` → PASS.

- [ ] **Step 6: Header ja CSS**

`Header.tsx`: kustuta 11 kordavat `<button>`-it ja asenda ühe loendiga. Lisa impordid (`type LucideIcon` ja `NavSwitch, NavSwitchItem` `./ui`-st) ning moodulitasemel:

```tsx
// Peamenüü kirjed järjekorras; Ilm näidatakse ainult siis, kui `showWeather`.
const NAV_ITEMS: { view: MainView; label: string; Icon: LucideIcon }[] = [
  { view: 'map', label: 'Kaart', Icon: MapIcon },
  { view: 'fields', label: 'Põllud', Icon: Layers },
  { view: 'crops', label: 'Kultuurid', Icon: Sprout },
  { view: 'rotation', label: 'Külvikord', Icon: Repeat },
  { view: 'works', label: 'Põllutööd', Icon: SquareKanban },
  { view: 'stock', label: 'Laoarvestus', Icon: Package },
  { view: 'fleet', label: 'Tehnika', Icon: Tractor },
  { view: 'infrastructure', label: 'Taristu', Icon: MapPin },
  { view: 'parties', label: 'Isikud', Icon: Users },
  { view: 'weather', label: 'Ilm', Icon: CloudSun },
  { view: 'seasons', label: 'Hooajad', Icon: CalendarDays },
];
```
(`import type { LucideIcon } from 'lucide-react';` eraldi real.) `<nav className="main-view-switch" …>` plokk (rida 87–179) asendus:

```tsx
        {onChangeMainView && (
          <NavSwitch className="main-view-switch" aria-label="Põhivaade">
            {NAV_ITEMS.filter((item) => item.view !== 'weather' || showWeather).map(({ view, label, Icon }) => (
              <NavSwitchItem key={view} current={mainView === view} onClick={() => onChangeMainView(view)}>
                <Icon size={15} />
                <span>{label}</span>
              </NavSwitchItem>
            ))}
          </NavSwitch>
        )}
```
`index.css` (~4052–4087): jäta ainult paigutus, kustuta `.main-view-switch button`, `:hover:not(.active)`, `.active` reeglid:

```css
.main-view-switch {
  /* auto-veerised tsentreerivad; ruumipuudusel jääb algus nähtavaks ja keritavaks (ui NavSwitch annab ilme) */
  margin: 0 auto;
}
```
(`display:flex`, `flex-shrink`, `gap`, `padding`, `background`, `border`, `border-radius` tulevad `navSwitchClass`-ist.)

Kõrguse kontroll: legacy nupp päris `line-height` (`font: inherit`), `text-sm` annab 18px. Kui pärast pildimõõtu (Step 1 võrdlus) riba kõrgus erineb >1px, lisa `navSwitchItemClass` lõppu `leading-[normal]` (`leading-` pole auditi keelatud eesliidete seas) ja korda testi. Fookusrõngas (`focus-visible`) on uus klaviatuurinäitaja; `.header-nav-slot` kerib `overflow-x: auto`, seega kontrolli, et rõngas pole riba servas ära lõigatud (Tab-klahviga esimene ja viimane kirje); kui lõikub, tee `ring-inset` (`focus-visible:ring-inset` lisa `navSwitchItemClass` lõppu).

- [ ] **Step 7: Galerii ja README**

`UiGallery.tsx`: impordi `NavSwitch, NavSwitchItem`, lisa ikoonid olemasolevatest (nt `Search`) või `Map`/`Layers` lucide-st; lisa sektsioon:

```tsx
        <Section title="Peamenüü (NavSwitch)">
          <NavSwitch aria-label="Näidisvaated">
            {[['map', 'Kaart'], ['fields', 'Põllud'], ['works', 'Põllutööd']].map(([id, label]) => (
              <NavSwitchItem key={id} current={nav === id} onClick={() => setNav(id)}>
                <Eye size={15} />
                <span>{label}</span>
              </NavSwitchItem>
            ))}
          </NavSwitch>
        </Section>
```
ja `const [nav, setNav] = useState('map');`. README „Märk, sakk, valikurida“ lõppu: „Peamenüü/navigatsioonirida: `NavSwitch` + `NavSwitchItem current` (`aria-current="page"`, aktiivne heledam roheline `--selection-bg`); sakid ja valikurida (Tabs/ToggleGroup) on sisu sees vahetamiseks, mitte vaadete vahetamiseks.“ Lisa README „Nupud“ ette lõik: „**Toored `<button` on keelatud** väljaspool `ui/` (ui-audit „Tooreid nuppe“ = 0). Erandid: `LoginPage` `login-forgot-link`, `MapView` Leafleti popup-string (`RAW_BUTTON_ALLOWED` failis `src/tooling/uiAudit.ts`).“

- [ ] **Step 8: Kontrollid**

tsc, vitest, oxlint (`src/components/Header.tsx src/components/ui`), `npm run ui-audit -- --details` — oodatav „Tooreid nuppe (tsx)“ = **0**; „Vanu nupuklasse“, „Vanu märke/sakke“ jäävad 0. `grep -rn --include='*.tsx' --include='*.ts' -e 'main-view-switch' src scripts` → ainult `Header.tsx` (className) ja index.css.

- [ ] **Step 9: Commit, release, pildid pärast**

```bash
git add src/components/ui/NavSwitch.tsx src/components/ui/variants.ts src/components/ui/index.ts src/components/ui/UiGallery.tsx src/components/ui/README.md src/components/ui/variants.test.ts src/styles/app.css src/components/Header.tsx src/index.css
git commit -m "feat(ui): NavSwitch peamenüüle, toorest nuppu enam pole" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Release; pildid pärast samade käskudega nagu Step 1 (sama selektor `.main-view-switch >> text=…` töötab edasi). Võrdle päiseid paarikaupa: sakkide asukohad ≤2px, aktiivne roheline täpselt sama (#16a34a, valge tekst) mõlemas teemas, hover-toon sama. Klaviatuuri kontroll: `--do 'key:Tab'` kordustega päise kohal ja nupu `aria-current`: `--do 'eval:document.querySelector(".main-view-switch [aria-current=page]").textContent'`. Viimane käsk: `npm run ui-audit -- --details` näitab „Tooreid nuppe (tsx)“ = 0 — kirjuta raportisse.

---

## Küsimused kasutajale

**1. Tahvli töökaardi valitud rõnga värv tumedas teemas.**
Praegu on valitud töökaardi (`fw-card`) rõngas mõlemas teemas sama tumeroheline `#15803d`. Ühise `CardButton selected` rõngas kasutab teema põhivärvi: heledas teemas `#15803d` (täpselt sama), tumedas teemas `#22c55e` (heledam roheline). Kõik teised valitud kaardid (finantskanne, juhendi kirje, tavakaart) on juba nii.
- **A (soovitus):** kasuta ühist rõngast — tumedas teemas on valitud töökaart heledama rohelisega, nagu kõik teised valitud kaardid. Üks reegel, vähem erandeid.
- **B:** jäta tahvli töökaardile oma tumeroheline rõngas mõlemas teemas (`.fw-card.selected { box-shadow: 0 0 0 2px #15803d !important }` index.css-is). Välimus jääb täpselt sama, aga tahvel on ainus koht, kus valitud kaart tumedas teemas teist värvi on.
Kui vastust pole, teeb implementeerija A.

---

## Self-Review

**Spec coverage.**
- Peamenüü ühiskomponendile (Task 4: `NavSwitch`, `aria-current`, klaviatuur, `--selection-bg` ei muutu, põhjendus miks mitte Tabs/ToggleGroup) ✓.
- Valitav kaart/kiip (Task 2 `CardButton` + `item`/`option`; Task 3 `ChipButton`); iga toore nupu otsus on inventuuri tabelis (14 rida), kaasa arvatud `fw-add` põhjendus (mahub `Button variant="dashed" size="add-slot"` alla) ✓. `FieldWorksBoard` ridade nimekiri on parandatud: tegelikult on 10 `fw-add`, mitte 5, ja 1009/1036/1055/1072/1095 on samuti `fw-add`, mitte kaardid; kaart on ainult 129; 1278 on finantsmärgi nupp ✓.
- `HelpHint` ui-sse, eksport, importijad, galerii näide (Task 1; `HelpHintPopover` selleks, et näide ei sõltuks teenusest) ✓.
- Ui-audit rida „Tooreid nuppe (tsx)“ koos erandite loeteluga, test, oodatud arvud iga ülesande lõpus 31 → 26 → 11 → 0 ✓.
- Galeriisse näited kõigist uutest variantidest/komponentidest (Task 1–4) ✓.
- Välimus samaks: iga ülesande lõpus enne/pärast pildid hele+tume; väikesed erinevused loetletud; värvimuutus ainult üks (Küsimus 1) ✓.
- Peamenüü selektor: `.main-view-switch` jääb klassiks, shot-käsud ja `docs` ei muutu ✓.

**Placeholder scan.** Vaadete asendused (Task 2 Step 6, Task 3 Step 6) on näidatud vana→uus koodiga; kordusvormid (10 × `fw-add`, 3 kiipi) on loetletud rida-realt ja nende `onClick`-id säilivad vaates, mitte plaanis. Muid „TBD/hiljem“ kohti ei ole.

**Type consistency.** `CardButton` (`variant`, `padding`, `selected`) kasutatud kõigis Task 2 kohtades samade nimedega; `ChipButton` prop'id `variant/accent/selected/dimmed` samad Task 3 koodis, testis ja galeriis; `chipVariants({ variant, dimmed })` testis = komponendis; `NavSwitchItem current` Header'is = liideses; `RAW_BUTTON_ALLOWED`/`rawButtonFiles` Task 1 definitsioon = auditi skripti kasutus.

**Teadlikud riskid (implementeerijale):** (1) `cn`/tailwind-merge peab `hover:bg-popover` ja `hover:border-primary` item/option variantidel eelmise `hover:*` asemele panema — Task 2 Step 2 märkus annab varuplaani; (2) `@utility` pesastatud `&[data-selected]` Tailwind v4-s: kui `npm run release` (Vite build) kurdab, kirjuta samad reeglid `@layer components { .chip-tint {…} }` kujul — ilme jääb; (3) `NavSwitch` kõrgus (`leading-[normal]`) ja fookusrõnga lõikumine (`ring-inset`) on Task 4 Step 6 kontrollid.
