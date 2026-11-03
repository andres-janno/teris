# Põllu laod ja punkrid

Kuupäev: 2026-11-03. Seotud: saagipartiid (2026-11-02-saagipartiid), laoarvestus (2026-10-28-laoarvestus).

## Töövoog

Koristus võtab punkrid põllu lattu. Sealt viiakse need kas kuivatisse või Rõngusse (võõras hoidla, vili jääb meile).
Rõngus kaalutakse ja selgub kaal tonnides. Kuivati kaudu minnes viiakse punkrid kuivatisse ja sealt edasi Rõngusse, kus tonnid selguvad.

## Otsused (kasutaja, 2026-11-03)

- **Iga põld = oma ladu.** `Warehouse.fieldId` (unikaalne). Ladu luuakse automaatselt esimesel koristusel põllu nimega
  (nime kokkupõrkel `‹nimi› (põld ‹nr›)`). Põllu ladu ei saa olla põhiladu, partii ladu, artikli vaikimisi ladu ega kulumaterjali ladu
  ja seda ei kustutata. Põllu kustutamisel jääb ladu alles tavalise laona (SetNull).
- **Punkrid = eraldi artikkel.** Süsteemne kategooria `BUNKERS` („Punkrid“, grupp Toodang). Kultuuri kohta „‹kultuur› punkrid“, ühik `punker`.
- **Koristuskanne** (partiis, tonnid lukustamata, punkreid > 0) = hinnata IN põllu lattu kande kuupäeval. Käsitsi tonnidega kanne lattu ei lähe.
- **Vedu** = tavaline laokande ülekanne punkrites (põllu ladu → kuivati / Rõngu, kuivati → Rõngu). Kuivati ja Rõngu on kasutaja loodud laod.
- **Punkri kaal marsruudi järgi:** iga marsruudi jaoks on eraldi saagipartii (nt „Kaer 2026 kuivati“, „Kaer 2026 otse“).
  Kui kultuuril on mitu lahtist partiid, peab koristuskandel partii valima (`CHOOSE_LOT_ERROR`).
- **Kaalumine** jääb tonnide hinnata IN-iks partii laos. **Partii sulgemine** kannab partii kõik punkrid partii laost maha (OUT);
  kuupäev on viimane kaalumine, selle puudumisel sulgemise päev. Uuesti avamine võtab mahakandmise tagasi.

## Teostus

- Liikumised arvutatakse (ei salvestata eraldi kannetena): `loadBunkerMovements` failis `src/server/stock.ts`, viited `harvest:<kanne>` ja `lotclose:<partii>`.
- Ümberarvutus: koristuskande lisamine/muutmine/kustutamine, partii sulgemine/avamine ja partii lao muutus (`lotBunkerArticleIds`).
- Algseis: `scripts/field-warehouses-init.mts`.

## Teadlikult tegemata

- Lahtise partii puhul on Rõngus kuni sulgemiseni nii kaalutud tonnid kui ka nende punkrid (koorma kaupa teisendust ei tehta).
- Põllu ümbernimetamine ei nimeta põllu ladu ümber.
