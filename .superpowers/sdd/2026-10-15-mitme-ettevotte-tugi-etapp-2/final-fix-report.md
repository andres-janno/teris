# Etapi 2 lõppülevaatuse parandused
1. license.ts: hasModule tagastab true, kui user.license puudub (vana server); licenseBannerText(undefined) -> null; LicenseBanner kasutab user.license?.readOnly. Testid lisatud. Muid otseseid user.license. kasutusi src/-s polnud.
2. Spetsi 3.3 /api/auth/me täpsustatud (tenantName, license{...}, supportView etapis 5).
3. Plaan: "Enne etappi 3 / hiljem" nimekiri ja globaalne piirang (npm run build ainult release'il).
Kontroll: tsc --noEmit -p tsconfig.app.json puhas; npm test 205/205 läbitud. Builde ei käivitatud.
