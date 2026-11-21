# Kasutusjuhend rakenduses — disain

Kuupäev: 2026-11-21. Seotud: olemasolev kohtjuhendite süsteem (`src/help/helpRegistry.ts`, `HelpHint`, admin „Juhendid“,
tabel `help_articles`, `GET /api/help`, `/api/platform/help*`).

## Eesmärk

Terises on terviklik kasutusjuhend ettevõtte juhile ja agronoomile: peatükid peamenüü vaadete kaupa, ülesandepõhised
sammud ja juurutamise juhis nullist. Juhend on rakenduse sees, „?“-ikoonid viivad õigesse kohta. Teksti hoiab ja parandab
teenusepakkuja admin.teris.ee-s ilma uue versioonita; iga muudatus jätab eelmise versiooni alles.

## Kasutaja otsused (2026-11-21)

| Küsimus | Otsus |
|---|---|
| Vorm | Rakenduse sisene juhend (peatükid) + „?“-ikoonid, mis viivad peatükki |
| Lugeja | Ettevõtte juht ja agronoom; ülesandepõhine („Kuidas …“) |
| Teksti autor | Claude teeb mustandi koodi ja vaadete põhjal, kasutaja parandab |
| Hoidmine | Andmebaasis, muudetav admin.teris.ee-s (variant A) + versioonide ajalugu |
| Lisapeatükk | Juurutamine: Teris nullist kasutusele, andmete sisestamise/impordi järjekord |

## Peatükid (15, järjekord ja pealkirjad koodis)

| # | Võti | Pealkiri | Sisu |
|---|---|---|---|
| 1 | `guide.getting-started` | Alustamine | Mis on Teris, sisselogimine, hooaja valik, menüü, otsing, „?“-ikoonid |
| 2 | `guide.onboarding` | Juurutamine | Järjekord: seaded ja kasutajad → hooaeg → põllud (PRIA ZIP) → kultuurid ja sordid → külvikord (varasemad + käesolev aasta) → isikud, omand ja rent → tehnika ja seadmed → laod ja algsaldod (inventuur) → põlluraamatu import → mullaproovid. Iga samm: miks siin, mida ette valmistada, kuidas kontrollida. Lõpus kontrollnimekiri „Valmis igapäevatööks“ |
| 3 | `guide.map` | Kaart | Kihid, aasta valik, põllu kaart ja paremklõpsu menüü, satelliit, sõidud kaardil |
| 4 | `guide.fields` | Põllud | Register, import (PRIA ZIP, põlluraamat, mullaproovid), piiri muutmine, omand/rent |
| 5 | `guide.crops` | Kultuurid | Kultuuride ja sortide register, PRIA nimetus |
| 6 | `guide.rotation` | Külvikord | Aastaplaan, kultuur põllule, CSV eksport |
| 7 | `guide.works` | Põllutööd | Tahvel, planeerimine, kanne (tegelik), seos sõitudega, põlluraamat |
| 8 | `guide.stock` | Laoarvestus | Laod, laokanded, inventuur, saagipartiid, põllu laod ja koristus |
| 9 | `guide.fleet` | Tehnika | Masinad ja seadmed, sõitude register, seadme määramine, kütus |
| 10 | `guide.infrastructure` | Taristu | Kuivatid, hoidlad, objektid kaardil |
| 11 | `guide.parties` | Isikud | Töötajad, rendileandjad, partnerid |
| 12 | `guide.weather` | Ilm | Ilmaandmed põllu kaupa, aastate võrdlus |
| 13 | `guide.seasons` | Hooajad | Hooaja loomine ja sulgemine |
| 14 | `guide.pria` | PRIA | Mis andmed PRIA-sse lähevad ja kust |
| 15 | `guide.settings` | Kasutajad ja seaded | Kasutajate kutsumine, rollid, AI ühendus |

Peatüki ülesehitus: 2–3 lauset „milleks see vaade on“ → 3–6 ülesannet nummerdatud sammudena (vahepealkiri „Kuidas …“)
→ „Hea teada“ (lõksud, nipid). Vahepealkirjad (`h3`) saavad ankru (pealkirjast tuletatud lühinimi), et neile saaks
viidata. Ekraanipilte esimeses versioonis ei ole.

## Rakenduse pool

- **Avamine:** päises kasutajamenüü kõrval nupp „Juhend“ (raamatu ikoon) → täislehe vaade `guide` (sama kest kui
  teistel täislehe vaadetel, `boardViewClass` jt).
- **Vaade:** vasakul peatükkide loend, paremal peatüki tekst (`help-content` vorming). Ülal otsing üle kõigi peatükkide —
  tabamused peatüki ja lõigu katkendiga, klõps viib kohale. Kitsal ekraanil loend → rippmenüü.
- **Sügavlink:** vaade avaneb peatüki ja valikulise ankruga (nt `guide.fields#import`); URL/olek nii, et tagasi-nupp töötab
  nagu teistel vaadetel.
- **„?“-ikoonid:** igale peamenüü vaatele pealkirja kõrvale `HelpHint` (uued kohtjuhendid `view.<vaade>`); hüpikus lühike
  tekst + link „Loe juhendist →“, kui kohtjuhendil on seotud peatükk. Olemasolevad 4 kohta saavad sama lingi.
- **Peatükkide vahelised lingid:** juhendi HTML-is link kujul `#guide.fields#import`, mille vaade püüab kinni ja avab
  peatüki (sanitizeHelp peab selle kuju lubama).
- **Tühi peatükk:** tavakasutaja näeb „Juhend on koostamisel“; peatükk on loendis näha.

## Haldus (admin.teris.ee „Juhendid“)

- Kaks jaotist: **Peatükid** (15 järjekorras) ja **Kohtjuhendid** (praegused 4 + üks iga peamenüü vaate kohta).
- Sama `RichTextEditor`, lisanupud: vahepealkiri (`h3`), nummerdatud loend, link peatükki (valik loendist + ankur).
- Kohtjuhendil valik „Seotud peatükk“ (+ valikuline ankur).
- Peatükkide võtmed, pealkirjad ja järjekord on koodis (register nagu `HELP_SPOTS`); uue peatüki lisamine = koodimuudatus.

## Andmed

- `help_articles` jääb (võti, html). Lisandub `guide_link` (tekst, null lubatud) kohtjuhendile: `guide.<peatükk>[#ankur]`.
- Uus tabel `help_article_versions`: id, võti, html, guide_link, kes salvestas, millal. Iga salvestus (ka taastamine)
  lisab rea; alles 50 viimast versiooni võtme kohta, vanemad kustuvad salvestamisel.
- Admin: „Ajalugu“ → versioonide loend (kuupäev pp.kk.aaaa HH:MM Tallinna ajas, autor), eelvaade, „Taasta see versioon“
  (= uus salvestus vana sisuga).
- Juhendid on platvormi ühised (kõigile ettevõtetele sama tekst), nagu praegu `help_articles`.
- `GET /api/help` tagastab ka peatükid ja `guide_link`-id; teksti suurim pikkus peatükile suurem kui kohtjuhendil
  (peatükk kuni 100 000 märki).

## Mustandid

- Claude kirjutab peatükid failidena `docs/juhend/<nr>-<võti>.html` (üks fail peatüki kohta) vaadete, koodi ja
  andmemudeli põhjal; kasutaja loeb üle.
- Laadimisskript (`scripts/load-guide-drafts.mts`): kirjutab ainult tühjadesse peatükkidesse, mitte kunagi olemasolevale
  tekstile; iga kirjutis teeb ka versioonirea (autor „mustand“). Live'is käivitatakse alles kasutaja „jah“ järel.
- Mustandite kirjutamine ei sõltu koodist ja võib alata kohe.

## Väljas (hiljem, kui vaja)

Ekraanipildid, mitu keelt, ettevõttepõhine juhend, PDF/printimine, versioonide võrdlus (diff).

## Tööjärjekord

1. Mustandid (kohe, paralleelselt 4g stiilitööga — ei puuduta koodi).
2. Kood (andmed + API + admin + juhendi vaade + „?“-lingid) — oma plaan; pärast 4g-d või vaheldumisi nii, et samu faile
   (Header, App, variants.ts, admin) ei muudeta korraga.
3. Mustandite laadimine live'i kasutaja loal.

## Kontroll

`tsc`, täis `vitest`, `oxlint`, `npm run ui-audit -- --details`; testid: versioonide piir 50, taastamine teeb uue versiooni,
laadimisskript ei kirjuta olemasolevale, sügavlingi parsimine, sanitizeHelp lubab peatükilinki ja `h3` ankrut; pildid
`scripts/shot.mts` (juhendi vaade mõlemas teemas 1440 ja kitsas, admin `--platform`).
