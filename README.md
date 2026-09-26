# agro map

Põllumajandusettevõtte kaardirakendus: PRIA põllud ja külvikord, masinapark ja
Teltonika telemeetria, mullaproovid, e-PRIA põlluraamat, seotud isikud.

## Arhitektuur

    Brauser ──HTTPS──> Apache (agro.ventcap.ee)
                         └─> 127.0.0.1:8820  agro.service (node dist-server/prod.js)
                               ├─ /api/*  API + sisselogimine (src/server/apiHandler.ts, authGate.ts)
                               └─ muu     dist/ (React + Vite)
                             PostgreSQL: agro_db (Prisma), agro_tsdb (telemeetria)

- Kasutajaliides: React 19 + TypeScript + Vite, kaart Leaflet.
- Server: `node:http` ilma raamistikuta, Prisma 6. Sama API käsitleja töötab ka
  `npm run dev` puhul (Vite'i plugin `src/server/dbApiPlugin.ts`).
- Sisselogimine: kasutajad ja sessioonid andmebaasis (`users`, `sessions`),
  `HttpOnly` küpsis, paroolid `scrypt`.

## Arendusprotsess

Kood elab serveris `/home/debian/agro` (git remote `git.5dvision.ee:andresj/agro.git`,
haru `master`). Live (`agro.service`) jookseb **ehitatud** koodist (`dist/`, `dist-server/`),
seega faili muutmine live'i ei muuda — muudatus jõuab kasutajani alles `npm run release`
järel.

### Muudatuse tsükkel

1. **Muuda koodi** serveri kaustas (otse SSH-s või kohalikust masinast sshfs-mountiga;
   `npm`/`npx` käsud käivita alati serveris).
2. **Proovi arendusserveris** (valikuline, kasutajaliidese muudatuste puhul soovitatav):
   ```bash
   ssh -L 5173:127.0.0.1:5173 uvn-243-120.tll07.zonevs.eu
   cd /home/debian/agro && npm run dev
   ```
   Ava kohalikus brauseris `http://localhost:5173` ja logi sisse sama kontoga mis live'is
   (Chrome/Firefox; Safari ei pruugi `Secure` küpsist `http://localhost` peal salvestada).
   Vite laeb muudatused kohe (HMR). **NB:** arendusserver kasutab **sama andmebaasi** mis
   live — importimine, kustutamine jm muudavad päris andmeid.
3. **Kontrolli:** `npx tsc --noEmit -p tsconfig.app.json` ja `npm test`. Serveri- või
   sisselogimise muudatuse puhul ka `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts`
   (pärast releasi).
4. **Commit** (`git add <failid>`, mitte `git add -A` — vt „Failid, mis ei käi git'i“).
5. **Release:** `npm run release` (tüübikontroll + testid + ehitus + teenuse taaskäivitus;
   kui mõni samm kukub, teenust ei taaskäivitata ja live jääb vanale versioonile).
6. **Kontrolli live'i:** `systemctl is-active agro`, `journalctl -u agro -n 30 --no-pager`,
   brauseris https://agro.ventcap.ee (kõva värskendus Cmd+Shift+R).
7. **Push:** `git push origin master`.

### Andmebaasi skeemi muudatus

1. Varukoopia: `pg_dump "…" -Fc -f ~/db_backups/agro_db_$(date +%Y%m%d_%H%M%S).dump`.
2. Muuda `prisma/schema.prisma`, siis `npx prisma db push` ja `npx prisma generate`.
3. `npm run release`.

`db push` muudab live'i andmebaasi kohe, kuid live'i kood uueneb alles releasiga. Seetõttu
tee muudatused **lisavalt** (uus veerg/tabel, vaikeväärtusega või `NULL`-lubav);
veeru eemaldamine või ümbernimetamine tee eraldi sammuna pärast seda, kui kood seda enam
ei kasuta.

### Tagasipööramine

Kui release rikkus live'i: `git log --oneline` → `git revert <commit>` (või
`git checkout <eelmine> -- <failid>`) → `npm run release`. Skeemimuudatuse korral taasta
vajadusel varukoopia `pg_restore`-ga.

### Uus sõltuvus

`npm install <pakett>` serveris, commit'i ka `package.json` ja `package-lock.json`.
Kui arendusserver jookseb, taaskäivita see (Vite'i sõltuvuste vahemälu).

### Reeglid

- Isikuandmetega impordifailid ainult `._scratch/` kausta — mitte kunagi git'i.
- Paroole ei kirjutata faili, logisse ega vestlusesse; kasutaja määrab oma parooli ise
  käsuga `npm run user -- …`.
- Enne andmeid kustutavat või massilist muudatust tee andmebaasist varukoopia.

## Käsud (serveris `/home/debian/agro`)

| Käsk | Tegevus |
|---|---|
| `npm run release` | tüübikontroll, testid, ehitus, `agro` teenuse taaskäivitus |
| `npm run build` | kasutajaliides `dist/` + server `dist-server/` |
| `npm test` | ühiktestid (Vitest) |
| `npm run user -- add <nimi> [--display "Nimi"]` | uus kasutaja (parool küsitakse) |
| `npm run user -- passwd <nimi>` | parooli muutmine |
| `npm run user -- disable <nimi>` / `enable <nimi>` | keelamine / lubamine |
| `npm run user -- list` | kasutajad |
| `npm run user -- logout <nimi>` | lõpetab kasutaja sessioonid |
| `npm run dev` | Vite arendusserver `127.0.0.1:5173` (nt SSH tunneliga) |

Tüübikontroll: `npx tsc --noEmit -p tsconfig.app.json`.
Integratsioonitest töötava serveri vastu: `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts`.

## Teenus ja logid

- `sudo systemctl status|restart agro`, logid `journalctl -u agro -f`.
- Apache: `/etc/apache2/sites-available/agro.ventcap.ee.conf` (`*.ventcap.ee` sertifikaat).

## Andmebaas

- Ühendused `.env` failis (`DATABASE_URL`, `TSDB_DATABASE_URL`) — ei ole repos.
- Skeem: `prisma/schema.prisma`; muudatus: `npx prisma db push` + `npx prisma generate` + `npm run release`.
- **Enne ohtlikku muudatust varukoopia:** `pg_dump … -Fc -f ~/db_backups/agro_db_<aeg>.dump`.

## Failid, mis ei käi git'i

- `._scratch/` — impordifailid (PRIA, põlluraamat, mullaproovid); sisaldavad isikuandmeid.
- `.env`, `dist/`, `dist-server/`, `node_modules/`.
