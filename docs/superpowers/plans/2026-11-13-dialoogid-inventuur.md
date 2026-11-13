# Dialoogide inventuur (2026-11-13) — etapi 2.2 lähteandmed

Kaardistatud failidest (src/, v.a admin ja landing). Numbrid (#) viitavad sellele tabelile; plaan
`2026-11-13-dialoogid-ui-dialog.md` kasutab neid.

Faktid:
- Z-indeksid index.css: `.modal-backdrop` 2000, `.sub-modal` 2500, `.stacked` 3000, `.sub-modal.stacked` 3500,
  `.confirm-dialog-backdrop` 5000; date-picker-popup 3100 (inline 4000), help-hint-popup 3200, filter-select-list 9000.
- Kõigil `.modal-content`-idel on `animate-scale-up` (0,2 s, ilma fill-mode'ita → transform kaob lõpus). `.modal-backdrop`-il
  on `backdrop-filter: blur(8px)`.
- Taustaklõps sulgeb praegu ainult: #1, #3, #4 (v.a forced), #5, #16, #28, #29. Esc puudub: #3–#11, #13, #23, #24, #27.
- Esc on lahendatud 9 eri moel (document capture + stopPropagation; document bubbling; window bubbling; window capture).
- Kontrollimata viga: kui FieldEditDialog on avatud kaardilt (App.tsx:1961, mainView map), avanevad isikute/kultuuride
  register `stacked`-ita z 2000, dialoog ise 2500 → register jääb alla. Radixiga laheneb (DOM-järjekord).

## Modaalid

| # | fail:rida | nimi | sisu lisaklass | perekond | sees: DateInput / FilterSelect / Leaflet |
|---|---|---|---|---|---|
| 1 | UsersAdminModal.tsx:153 | Kasutajad | users-admin-modal | F3 | – |
| 2 | UsersAdminModal.tsx:281 | Kasutaja vorm (#1 sees) | users-edit-modal | F3 | – |
| 3 | WeatherCredentialModal.tsx:82 | Ilmaandmete ühendus | weather-credential-modal | üksik | – |
| 4 | ChangePasswordModal.tsx:56 | Muuda parooli / forced | change-password-modal (form) | üksik | – |
| 5 | AiConnectionModal.tsx:86 | AI ühendus | ai-connection-modal | üksik | – |
| 6 | WorkRegisterModal.tsx:86 | Tööde register | work-register-modal | F4 | – |
| 7 | WorkRegisterModal.tsx:156 | Muuda tööd (#6 sees) | work-form-modal | F4 | – |
| 8 | FieldUploadModal.tsx:177 | Impordi PRIA SHP | glass-card | üksik | – |
| 9 | SoilSampleUploadModal.tsx:91 | Impordi mullaproovid | glass-card | üksik | – |
| 10 | FieldBookUploadModal.tsx:105 | Impordi põlluraamat | glass-card | üksik | – |
| 11 | RelatedPartiesModal.tsx:700 | Seotud isikute register (overlay, `stacked`) | glass-card field-register-modal parties-register-modal | F1 | FilterSelect |
| 12 | RelatedPartiesModal.tsx:262 | Isiku vorm (#11 sees) | party-edit-modal | F1 | – |
| 13 | CropRegisterModal.tsx:983 | Kultuuride register (overlay, `stacked`) | glass-card field-register-modal | F1 | – |
| 14 | CropRegisterModal.tsx:441 | Kultuuri vorm (#13 sees) | crop-edit-modal | F1 | – |
| 15 | CropRegisterModal.tsx:649 | Sordi vorm (#13 sees) | crop-edit-modal | F1 | – |
| 16 | ConfirmDialog.tsx:50 | kinnitus/teade (oma React root) | confirm-dialog | kõige peal | – |
| 17 | SeasonManagerModal.tsx:150 | Hooaja vorm | season-edit-modal | F7 | – |
| 18 | PoiManagerModal.tsx:275 | Asukoha vorm | poi-edit-modal | F7 | – |
| 19 | VehicleTracker.tsx:920 | Masina vorm (form) | fleet-edit-modal | F5 | DateInput |
| 20 | VehicleTracker.tsx:1078 | Haakeriista vorm | fleet-edit-modal | F5 | DateInput |
| 21 | VehicleTracker.tsx:1197 | Telemeetriaseadme vorm | fleet-edit-modal | F5 | DateInput |
| 22 | VehicleTracker.tsx:1333 | Haakimise kirje vorm | fleet-edit-modal | F5 | DateInput |
| 23 | VehicleTracker.tsx:2185 | Seadme/haakeriista valik (swap) | glass-card swap-modal-card | F5 | – |
| 24 | DeviceAssignmentRegister.tsx:386 | Seadme seose kirje (form) | fleet-edit-modal | F5 | DateInput |
| 25 | TripDialog.tsx:150 | Sõidu detail | fleet-edit-modal trip-dialog | F5 | Leaflet |
| 26 | TripGapReviewDialog.tsx:43 | Märgi hoiatus kontrollituks | fleet-edit-modal | F5 | – |
| 27 | FinanceModal.tsx:403 | Põllutööde finantsid | finance-modal | F2 | FilterSelect |
| 28 | FieldShapeModal.tsx:62 | Põllu kuju kaardil | field-shape-modal | üksik (avatakse täislehtedelt) | Leaflet |
| 29 | FieldWorksBoard.tsx:1181 | Valitud töö paneel (portaal) | fw-work-modal | F2 | – |
| 30 | FieldWorksBoard.tsx:1260 | Muuda plaani (INLINE #29 sees) | work-entry-modal | F2 | DateInput, FilterSelect |
| 31 | FieldWorkEntryDialog.tsx:421 | Lisa/muuda kannet (ka App.tsx:1994 kaardilt) | (vt fail) | F2 | DateInput, FilterSelect |
| 32 | AddFieldWorkDialog.tsx:105 | Lisa põllule töid | add-work-modal | F2 | – |
| 33 | FieldEditDialog.tsx:329 | Muuda põldu (form) | field-edit-modal | F1 | – |
| 34 | ArticleFormDialog.tsx:138 | Lisa/muuda artiklit | work-form-modal article-form-modal | F6 | – |
| 35 | ArticleMergeDialog.tsx:66 | Asenda materjal | work-form-modal | F6 | – |
| 36 | ArticleCategoriesDialog.tsx:70 | Artikli kategooriad | article-categories-modal | F6 | – |
| 37 | ArticleStockCard.tsx:58 | Laokaart | stock-card-modal | F6 | FilterSelect |
| 38 | StockDocumentDialog.tsx:112 | Lao dokument | stock-doc-modal | F6 | DateInput |
| 39 | InventoryDialog.tsx:124 | Inventuur (Esc ainult kui !busy) | stock-doc-modal | F6 | DateInput |
| 40 | HarvestLotDialog.tsx:145 | Saagipartii (Esc ainult kui !busy) | stock-doc-modal harvest-lot-modal | F6 | DateInput |
| 41 | WarehousesPanel.tsx:120 | Lao vorm (form) | work-form-modal | F6 | – |

## Surnud overlay-harud (App kasutab ainult `isFullPage`)
SeasonManagerModal.tsx:366, FieldManagerModal.tsx:702, PoiManagerModal.tsx:532, VehicleTracker.tsx:2322 — `modal-backdrop`
haru ei renderdu kunagi (App.tsx:1648, 1688, 1776, 1745 annavad alati täislehe).

## Perekonnad (mis võivad olla üksteise peal)
- **F1** FieldEditDialog → RelatedPartiesModal (#11 → #12), FieldEditDialog → CropRegisterModal (#13 → #14/#15); App.tsx
  annab registritele `stacked={mainView === 'fields'}` (2058, 2075). Failid: FieldEditDialog, RelatedPartiesModal,
  CropRegisterModal, FieldsTableView, App.tsx.
- **F2** fw-work-modal #29 → Muuda plaani #30 (inline), FinanceModal #27, FieldWorkEntryDialog #31; tahvlilt otse ka
  FinanceModal, FieldShapeModal, AddFieldWorkDialog, FieldWorkEntryDialog. FieldWorksBoard Esc (window bubbling,
  232–240): esimene Esc lõpetab plaani muutmise, teine sulgeb; välja lülitatud, kui entryDialog või isFinanceOpen.
- **F3** UsersAdminModal #1 → #2. **F4** WorkRegisterModal #6 → #7. **F5** masinapark (ükski pole teise peal; vormidel
  ühine Esc VehicleTracker.tsx:584). **F6** laoseis (ükski ei ava teist). **F7** SeasonManager #17, PoiManager #18.
- Üksikud: #3, #4, #5, #8, #9, #10, #28; #16 alati peal.

## Hüpikvidinad
| vidin | portaal | outside-click | Esc |
|---|---|---|---|
| DateInput | body, z 4000 inline | document mousedown | document bubbling, EI peata |
| FilterSelect | body, z 9000 | document mousedown capture | window capture + stopPropagation |
| HelpHint | body, z 3200 (praegu ainult täislehtedel) | document pointerdown | document bubbling |
| FieldContextMenu | body, z 3000 (kaart) | – | document bubbling |
