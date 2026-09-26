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
