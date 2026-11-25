# Release Notes ja kliendikommunikatsioon (`changelog/unreleased.jsonl`)

- Iga **kliendile nähtava** muudatuse või paranduse (`feat`, `fix`, nähtav parendus kasutajaliideses, aruannetes, laos, kaartidel või AI/MCP tööriistades) juures lisa **üks lühike eestikeelne inimkeelne rida** faili `changelog/unreleased.jsonl`.
- Sisemisi muudatusi (`chore`, `test`, `refactor`, `.gemini/rules`, sisemine `docs`) **ära lisa**.
- Rea lisamine serveris (või otse JSONL-reana enne/koos commitiga):
  ```bash
  npm run note -- --type <feature|improvement|fix> --area "<Valdkond>" "<Inimkeelne eestikeelne kirjeldus>"
  ```
  Näide:
  ```json
  {"commit":"e4ced14","date":"2026-11-25","type":"FEATURE","area":"Põllud","text":"Põldude tabelis kuvatakse uuendatud veerud ja külvikuupäev arvutatakse automaatselt külvikannetest."}
  ```
- `npm run release` käivitab lõpus automaatselt `npm run release:draft -- --include-git-fallback --tag`, mis:
  1. korjab kokku `changelog/unreleased.jsonl` read (ja varuvariandina katmata `feat`/`fix` commitid alates viimasest tag'ist või mustandi `toCommit`-ist),
  2. täiendab olemasolevat `DRAFT` mustandit (või loob uue, kui avaldamata mustandit pole),
  3. tühjendab `changelog/unreleased.jsonl` faili ja loob git tagi `vYYYY.MM.DD` (vajadusel `-2`, `-3`).
- Teenusepakkuja vaatab mustandi üle ja avaldab selle aadressil `admin.teris.ee` → **Uuendused**.
