# Server ja Release / Deployment info

- **Server:** `debian@uvn-243-120.tll07.zonevs.eu`
- **Kataloog:** `/home/debian/teris`
- **Teenus:** `teris` (`teris.service`)
- **Release:** Serveris kataloogis `/home/debian/teris` käsk `NODE_OPTIONS=--max-old-space-size=2048 npm run release` (või `sudo systemctl restart teris`).
- **„Live“ / „tee live“:** Tähendab täistsüklit serveris: `git commit` → `git push` → `NODE_OPTIONS=--max-old-space-size=2048 npm run release` (sh `tsc`, `npm test`, `npm run build` ja `sudo systemctl restart teris`).
- **Live URL:** https://teris.ee

## Arenduskeskkond (SSHFS)

- Maci töökaust `/Users/andresj/Progemine/teris` on serveri kataloogi `/home/debian/teris` külge ühendatud üle **sshfs-i** (failid on samad, `node_modules` on Linuxi binaaridega).
- **Kõik käsud** (`npm test`, `vitest`, `npm run lint`, `npm run build`, `tsc`, `prisma`, `git` jne) tuleb käivitada **serveris üle SSH**:
  `ssh debian@uvn-243-120.tll07.zonevs.eu "cd /home/debian/teris && <käsk>"`
- **Mälupiirang:** `tsc`, `npm run build` ja `npm run release` käivitamisel serveris kasuta alati `NODE_OPTIONS=--max-old-space-size=2048` (vaikimisi ~1 GB Node'i heap saab `tsc`-l otsa).
- **macOS `._*` failid:** Kui faile on muudetud üle sshfs-i, eemalda enne `npm test` / `npm run release` käivitamist AppleDouble failid (`find src .gemini -name '._*' -delete`), muidu proovib `vitest` käivitada `._*.test.ts` faile.
- Ära käivita `vitest`, `oxlint`, `npm run build` ega `prisma` kohalikul Macil.
