# Ühised komponendid (`src/components/ui/`)

Spec: `docs/superpowers/specs/2026-11-12-ui-uhtlustamine-design.md`. Näidised: `/ui` (admin).

## Reeglid

- Nupud, dialoogid, tabelid, märgid, sakid, väljad, menüüd, hüpikud — ainult siit (`ui/`). Vaates ei looda neile uusi CSS-klasse.
- Kui vajalikku pole: lisa variant `variants.ts`-i (ja test) või uus komponent siia — mitte vaate-klass.
- Skaalad: kirjasuurus `text-2xs|xs|sm|base|lg|xl` (11/12/13/14/16/20 px); vahed 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8;
  nurgad `rounded-sm|md|lg|full`.
- Suvalised väärtused `text-[…]`, `p-[…]`, `m-[…]`, `gap-[…]`, `rounded-[…]`, `bg-[…]`, `border-[…]` on keelatud
  (`npm run ui-audit` näitab). Suurused (`w-[…]`, `max-h-[…]`) on lubatud.
- Värvid ainult nimedega (`bg-card`, `text-muted-foreground`, `text-warning` …) — need järgivad heledat/tumedat teemat
  ise, `dark:` pole tavaliselt vaja. Erand: andmevärvid (kultuur, kaardikiht) `style={{ … }}` kaudu.
- `style={{ … }}` ainult dünaamiliste väärtuste jaoks.
- Kuupäev: `DateInput` (pp.kk.aaaa); arv: `NumberInput`; otsinguga valik: `FilterSelect`; filtri X: `FilterClear`.
  Need neli asuvad väljaspool `ui/` (`src/components/`), aga on samuti kohustuslikud.
- Numbriveerg tabelis: `numeric` (paremale joondus); kogused `formatQty`.
- Klassid liida `cn()`-ga (mitte template-stringiga) — see lahendab Tailwindi konfliktid.
- `!`-utiliit (nt `!p-0`) ei võida vana CSS-i `!important` reeglit (`!important` puhul võidab varasem kiht, `legacy` on
  `utilities`-ist ees) — eemalda vana reegel.

## Tailwindi skaneerimine

Tailwind genereerib utiliite ainult kataloogist `src/components/ui` (`@source` failis `src/styles/app.css`).
Üleviidud fail lisa `app.css`-i `@source`-i; enne kontrolli, et failis pole vanu klassinimesid, mis kattuvad
Tailwindi utiliitidega (nt `text-muted`, `text-secondary`, `hidden`, `flex`) — muidu saavad need ootamatu stiili.

## Vana muutuja -> Tailwindi nimi

HOIATUS: vanad klassi- ja muutujanimed `text-muted` / `text-secondary` EI tähenda Tailwindi `text-muted` /
`text-secondary` utiliite. Tailwindi `text-muted` on taust (`--stat-bg`), mitte hall tekst. Hall abitekst on
`text-muted-foreground` või `text-subtle`.

| Vana muutuja (index.css) | Tailwindi nimi | Kasutus |
| --- | --- | --- |
| `--bg-dark` | `bg-background` | lehe taust |
| `--text-primary` | `text-foreground` | põhitekst |
| `--bg-card` | `bg-card` | kaart |
| `--bg-card-hover` | `bg-card-hover` | kaardi hover |
| `--bg-modal` | `bg-popover` | dialoog, menüü, hüpik |
| `--stat-bg` | `bg-muted` | vaikne taust, tabeli hover |
| `--stat-bg-hover` | `bg-muted-hover` | vaikse tausta hover |
| `--text-secondary` | `text-muted-foreground` | abitekst, päised |
| `--text-muted` | `text-subtle` | kõige hallim tekst, placeholder |
| `--border-card` | `border-border` | kaardi/tabeli joon |
| `--input-border` | `border-input` | välja ääris |
| `--input-bg` | `bg-field` | välja taust |
| `--btn-sec-bg` | `bg-secondary` | teisene nupp |
| `--btn-sec-hover` | `bg-secondary-hover` | teisene nupp hover |
| `--btn-sec-border` | `border-secondary-border` | teisene nupp ääris |
| `--emerald-500` | `text-primary` / `bg-primary` | põhivärv |
| `--emerald-600` | `bg-primary-strong` | põhivärv tugevam |
| `--blue-500` | `text-info` | info |
| `--amber-500` | `text-warning` | hoiatus |
| `--rose-500` | `text-destructive` | viga |
| `--purple-500` | `text-accent` | rõhk (PRIA) |
| `--shadow-glass` | `shadow-card` | kaardi vari |
| `--shadow-modal` | `shadow-dialog` | dialoogi vari |

Kindlad värvid: `white`, `black`, `danger-solid` (#dc2626), `primary-from` / `primary-to` (põhinupu gradient),
`overlay` (dialoogi taust).
