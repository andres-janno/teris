# Kasutajaliidese ühtlustamine (shadcn/ui + Tailwind) — disain

Kuupäev: 2026-11-12
Staatus: kinnitatud arutelus, ootab ülevaatust

## Eesmärk

Teris UI on visuaalselt ebaühtlane: iga vaade on teinud oma nupud, dialoogid, tabelid ja märgid. Eesmärk on viia kogu
rakendus ühiste komponentide ja kokkulepitud skaalade peale, **säilitades praeguse visuaalse identiteedi** (roheline
põhivärv, klaasikaardid, ümarad nurgad, hele ja tume teema). Kasutaja jaoks: „sama, aga korras“.

Ulatusest väljas (kasutaja otsus 2026-11-12): paigutus, navigatsioon, info hierarhia ja vaadete ülesehitus. Need on
võimalik järgmine etapp.

## Lähteseis (mõõdetud 2026-11-12)

- Stiil: `src/index.css` 11 343 rida (+ `App.css` 184, `admin.css` 128, `landing.css` 249).
- `style={{…}}` komponentides: 226 kohta.
- Erinevaid väärtusi `index.css`-is: kirjasuurusi 40, nurgaraadiusi 22, padding-väärtusi 105, värvikoode 91;
  komponentides otse värve (hex/rgba) ~93.
- Klasside hulk mustri kaupa: nupud 40+, modal/dialog 55, table 26, badge 33, pill 28, tab 36, menu 17, segment 4.
- 91 `.tsx` faili; suurimad VehicleTracker (2 386), FieldWorksBoard (1 494), MapView (1 133), FinanceModal (1 046).

Põhjus: ühist komponentide kihti pole, iga vaade on loonud oma klassid.

## Otsused

| Küsimus | Otsus |
|---|---|
| Mida ühtlustame | välimus (komponendid, skaalad); paigutus mitte |
| Identiteet | säilib (värvid, klaas, nurgad, fondid) |
| Teemad | hele ja tume jäävad mõlemad |
| Alus | shadcn/ui (kood projektis) + Radix primitiivid + Tailwind v4 |
| Tagasi lükatud | frappe-ui (Vue), oma CSS ilma Tailwindita (skaala jääks distsipliini peale), Mantine/MUI/Chakra (tugev oma ilme, identiteedi säilitamine = pidev ülekirjutamine) |

## 1. Skaalad

### Kirjasuurused (6)

| Token | Suurus | Kasutus | Koondub siia |
|---|---|---|---|
| `text-2xs` | 11px | väikesed märgised, tabeli päised, ühikud | 0.68–0.7rem |
| `text-xs` | 12px | tabeli sisu, abitekstid, filtrid | 0.72–0.76rem |
| `text-sm` | 13px | põhitekst, vormiväljad, nupud | 0.78–0.82rem, 13px |
| `text-base` | 14px | dialoogi alapealkirjad, rõhutatud tekst | 0.84–0.9rem |
| `text-lg` | 16px | dialoogi/paneeli pealkiri | |
| `text-xl` | 20px | vaate pealkiri | |

Tihedus jääb samaks; üksikutes kohtades muutub tekst kuni 1px.

### Vahed

Lubatud: 2, 4, 6, 8, 10, 12, 16, 24, 32 px (Tailwindi `0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8`). Harvad vaheväärtused
(3, 5, 7, 14, 18 px jne) ümardatakse lähimale.

### Nurgad (4)

| Token | Väärtus | Kasutus |
|---|---|---|
| `rounded-sm` | 6px | väljad (nagu praegune .form-input), sakid, menüükirjed |
| `rounded-md` | 10px | nupud, menüüd, hüpikud |
| `rounded-lg` | 16px | kaardid ja paneelid (nagu praegune .glass-card), dialoogid |
| `rounded-full` | 9999px | märgid (Badge), ümmargused ikoonnupud |

2, 4 ja 8 px koonduvad nende alla. Väärtused vastavad praegustele `--radius-sm/md/lg` muutujatele.

### Värvid

Praegused CSS-muutujad (`:root` ja `[data-theme="dark"]`) jäävad väärtuste allikaks; nende peale tulevad tähenduspõhised
nimed, mida Tailwind ja komponendid kasutavad:

| Tähendus | Tailwindi nimi | Praegune muutuja |
|---|---|---|
| lehe taust | `background` | `--bg-dark` |
| kaart | `card` | `--bg-card` |
| modaal | `popover` | `--bg-modal` |
| äär | `border` | `--border-card` |
| väli | `input` | `--input-bg`, `--input-border` |
| tekst põhi / teisene / summutatud | `foreground` / `muted-foreground` / `subtle` | `--text-primary` / `--text-secondary` / `--text-muted` |
| põhitegevus | `primary` | `--emerald-500` |
| info | `info` | `--blue-500` |
| hoiatus | `warning` | `--amber-500` |
| oht | `destructive` | `--rose-500` |
| aktsent | `accent` | `--purple-500` |

Täpne nimekiri lõplikult paika 0. sammus. Komponentidesse kirjutatud värvikoodid asendatakse nimedega. **Erand:**
kaardikihtide ja kultuuride värvid on andmed, need jäävad dünaamiliseks.

### Fondid

Jäävad nagu praegu: põhitekst süsteemifondiga (`Tahoma, Verdana, 'Segoe UI', …` `body`-l), Outfit ainult
logosõnas. (Parandus 2026-11-12: algselt oli siin ekslikult Plus Jakarta Sans — see pakett on paigaldatud, aga
rakenduses kasutamata.)

## 2. Ühised komponendid (`src/components/ui/`)

| Komponent | Variandid | Asendab |
|---|---|---|
| Button | `primary`, `secondary`, `ghost`, `danger`; `sm`, `md`; ikooniga ja ainult ikoon | 40+ nupuklassi |
| Dialog, ConfirmDialog | päis, sisu, jalus; laius `sm`/`md`/`lg` | 55 modaali/dialoogi klassi, eri portaalilahendused |
| Table | päis, read, numbriveerg (paremale, `formatQty`), valitud/hover, kokkuvõtterida | 26 tabeliklassi |
| Badge | `success`, `info`, `warning`, `danger`, `neutral` | badge + pill klassid |
| Tabs | tavaline, segmenteeritud | tab + segment klassid |
| Input, Textarea, Select, Checkbox, Radio, Switch | ühtne kõrgus, äär, fookuse rõngas | 56 select, 21 checkbox, 17 textarea jne |
| Field | silt + abitekst + veateade | käsitsi ladumine vormides |
| DropdownMenu, ContextMenu | | kasutajamenüü, põllu paremklõps (17 menu klassi) |
| Popover, Tooltip | | HelpHint, kuupäevavalija hüpik |
| Card, Panel | klaasikaart, päisega paneel | kaartide variatsioonid |

**Omad, mis jäävad** (käitumine sama, alus ja välimus uued): DateInput (pp.kk.aaaa, Tallinna aeg), NumberInput,
FilterSelect, FilterClear.

**Ulatusest väljas:** Leaflet kaart ja selle hüpikud, ilmagraafikud — ainult värvinimed.

**Näidiste leht:** ainult adminile nähtav leht kõigi komponentide ja variantidega, mõlemas teemas.

### Reeglid edaspidiseks

- Vaadetes ei looda uusi CSS-klasse nuppude, dialoogide, tabelite, märkide, sakkide ega väljade jaoks — kasuta `ui/`.
- `style={{…}}` ainult dünaamiliste väärtuste jaoks (kultuuri värv, arvutatud laius/asukoht).
- Ainult skaala väärtused; suvalisi Tailwindi väärtusi (`text-[13px]`, `p-[7px]`) ei kasutata.
- Uus muster, mida `ui/` ei kata → lisatakse `ui/` komponent või variant, mitte vaate-klass.

## 3. Üleminek

Komponendi **tüübi kaupa läbi kogu rakenduse**, mitte vaate kaupa (vaate kaupa oleks rakendus pikalt pool vana, pool
uus). Iga samm = commit + release.

0. **Alus** — Tailwind v4 (`@tailwindcss/vite`), **preflight välja lülitatud**, et vana CSS ei muutuks; Radix paketid,
   `cn()` abifunktsioon; skaalad ja värvinimed `@theme`-s seotud praeguste muutujatega. Nähtav muutus: puudub.
1. **Komponendid + näidiste leht** — kõik `ui/` komponendid. Kasutajale nähtav muutus: puudub (v.a adminileht).
2. **Üleviimine tüüpide kaupa** (iga punkt eraldi release):
   1. nupud
   2. dialoogid
   3. tabelid
   4. märgid ja sakid
   5. vormiväljad (sh DateInput, NumberInput, FilterSelect uue aluse peale)
   6. menüüd, hüpikud, vihjed
   7. kaardid ja paneelid

   Pärast iga sammu kustutatakse `index.css`-ist kasutuseta klassid.
3. **Koristus** — `style={{…}}` ja värvikoodid → skaala/nimed; ülejäänud kirjasuurused 6 peale. Eesmärk: `index.css`
   ~2 000 rida (kaart, Leaflet, erijuhud).

## Kontroll

- Igal sammul: `tsc`, testid (release teeb), muudetud vaadete ülevaatus mõlemas teemas.
- **Mõõtmisskript** (`scripts/ui-audit`): loeb kokku erinevad kirjasuurused, vahed, nurgad, otse kirjutatud värvikoodid
  ja `style={{` kohad CSS- ja `.tsx`-failides. Väljund iga sammu järel; lõpus kasutatakse kontrollina, et vanu väärtusi
  tagasi ei tule.
- Lõpu edukriteeriumid: kirjasuurusi ≤ 6, nurki ≤ 4, vaheväärtused ainult skaalast, värvikoodid komponentides ainult
  andmevärvid, vanad nupu/dialoogi/tabeli klassid kustutatud.

## Riskid ja lahtised asjad

- Tailwindi ja vana CSS-i kooselu: preflight väljas. Kihistamata CSS võidab alati kihis olevat, seega `index.css`
  (mis sisaldab nt `* { margin: 0; padding: 0 }`) pannakse kihti `legacy`, mis on enne `utilities`-kihti — muidu
  ei mõjuks ükski Tailwindi vahe. Leafleti CSS läheb kihti `vendor` PÄRAST `legacy`-t: kihtide vahel võidab
  hilisem kiht olenemata spetsiifilisusest, seega muidu tühistaks `index.css`-i `*`-reegel Leafleti veerised ja
  polsterdused. `index.css`-i Leafleti ülekirjutused on `!important` ja nende puhul võidab varasem kiht (`legacy`),
  seega need kehtivad endiselt.
- Suured failid (VehicleTracker, FieldWorksBoard, MapView) võivad sisaldada erilahendusi; kui `ui/` vajab uut varianti,
  kooskõlastatakse kasutajaga enne lisamist.
- Radix Select ei toeta otsingut; otsinguga valikud jäävad FilterSelect peale.
- Leafleti hüpikud renderdatakse väljaspool Reacti puud — neis ainult värvinimed, mitte `ui/` komponendid.
