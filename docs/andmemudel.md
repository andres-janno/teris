# Andmemudel (ERD)

Genereeritud skriptiga `scripts/generate-erd.mts` failist `prisma/schema.prisma` (2026-10-26). Ära muuda käsitsi — käivita `npx tsx scripts/generate-erd.mts` pärast skeemimuudatust.

**Lugemisjuhend**
- `PK` primaarvõti, `FK` võõrvõti, `UK` unikaalne; kommentaar "valikuline" tähendab, et väli võib olla tühi.
- Seose sümbolid: `||` täpselt üks, `|o` null või üks, `o{` null või mitu. Seose nimi on võõrvõtme välja nimi.
- Iga ettevõttepõhise tabeli veerg `tenant_id` (ettevõte, Postgres RLS) ning auditiveerud `createdBy`/`updatedBy` on skeemidelt välja jäetud.
- Valdkonna skeemis on teise valdkonna tabelid kuvatud ainult võtmetega.

## Sisukord
1. [Põllud, hooajad ja kultuurid](#põllud-hooajad-ja-kultuurid)
2. [Põllutööd ja kanded](#põllutööd-ja-kanded)
3. [Masinapark, telemeetria ja objektid](#masinapark-telemeetria-ja-objektid)
4. [Isikud, kasutajad ja tugi](#isikud-kasutajad-ja-tugi)
5. [Platvorm (teenusepakkuja)](#platvorm-teenusepakkuja)
6. [Kõik seosed (ülevaade)](#kõik-seosed-ülevaade)
7. [Loendid (enum)](#loendid-enum)

## Põllud, hooajad ja kultuurid

Põld on püsiv kirje; iga hooaja andmed (pindala, kultuur, piir, saak) on eraldi hooaja põllu kirjes. Katastriüksused seotakse hooaja põlluga koos omandi ja kuludega.

| Mudel | Tabel | Ettevõttepõhine | Sisu |
|---|---|---|---|
| `Season` | `seasons` | jah | Hooaeg (aasta); lukustatud hooaja andmeid ei muudeta |
| `Field` | `fields` | jah | Põld (püsiv): PRIA põllu nr, massiiv, nimi, operaator |
| `FieldSeason` | `field_seasons` | jah | Põllu hooaja andmed: pindala, kultuur, sort, piir (GeoJSON), saak, staatus |
| `CadastralParcel` | `cadastral_parcels` | jah | Katastriüksus (tunnus, nimi) |
| `FieldCadastralParcel` | `field_cadastral_parcels` | jah | Hooaja põllu ja katastriüksuse seos: põllu osa pindala, omand/rent, maamaks, rent |
| `Crop` | `crops` | jah | Kultuur (ettevõtte register; PRIA kood, talivili, värv) |
| `CropVariety` | `crop_varieties` | jah | Sort kultuuri all |
| `SoilSample` | `soil_samples` | jah | Mullaproov (pH, P, K, Ca, Mg, Corg; asukoht) |

- Mullaproovid seotakse põlluga massiivi numbri järgi (`fieldCode`) ja kaardil asukoha järgi, mitte võõrvõtmega.

```mermaid
erDiagram
  Season {
    Int id PK
    Int year
    String name
    Boolean isLocked
    DateTime closedAt "valikuline"
    String closedBy "valikuline"
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  Field {
    Int id PK
    String num
    String name
    String fieldCode
    String cadastralCode "valikuline"
    String soilType "valikuline"
    Boolean drainageSystem
    String operatorId FK "valikuline"
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  FieldSeason {
    Int id PK
    Int fieldId FK
    Int seasonId FK "valikuline"
    Int year
    Float areaHa
    Float eligibleAreaHa "valikuline"
    String areaChangeReason "valikuline"
    String crop
    String cropVariety "valikuline"
    String cropColor
    String cropId FK "valikuline"
    String varietyId FK "valikuline"
    Float targetYieldTonsHa "valikuline"
    Float actualYieldTonsHa "valikuline"
    Float workedAreaHa
    Float workProgress
    FieldStatus status
    DateTime seedingDate "valikuline"
    DateTime harvestDate "valikuline"
    Int boundaryPointsCount "valikuline"
    Float perimeterM "valikuline"
    String notes "valikuline"
    Json geometry
    DateTime createdAt
    DateTime updatedAt
  }
  CadastralParcel {
    Int id PK
    String cadastralCode
    String name "valikuline"
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  FieldCadastralParcel {
    Int id PK
    Int fieldSeasonId FK
    Int cadastralParcelId FK
    Float fieldAreaHa
    OwnershipType ownershipType
    String ownerName "valikuline"
    String ownerPartyId FK "valikuline"
    Float landTaxEurHa "valikuline"
    Float landTaxEurYear "valikuline"
    Float rentFeeEurHa "valikuline"
    Float rentFeeEurYear "valikuline"
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  Crop {
    String id PK
    String name
    String scientificName "valikuline"
    CropGroup group
    String color
    String icon "valikuline"
    String priaCode "valikuline"
    Float defaultSeedRateKgHa "valikuline"
    Float defaultYieldTonsHa "valikuline"
    String description "valikuline"
    Boolean isWinterCrop
    DateTime createdAt
    DateTime updatedAt
  }
  CropVariety {
    String id PK
    String cropId FK
    String name
    String breeder "valikuline"
    String maturityDays "valikuline"
    String winterHardiness "valikuline"
    Float recommendedSeedRateKgHa "valikuline"
    Float potentialYieldTonsHa "valikuline"
    String qualityClass "valikuline"
    String notes "valikuline"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  SoilSample {
    Int id PK
    String sampleNumber
    String fieldCode
    Int year
    Float lat
    Float lng
    Float ph "valikuline"
    Float phosphorus "valikuline"
    Float potassium "valikuline"
    Float calcium "valikuline"
    Float magnesium "valikuline"
    Float copper "valikuline"
    Float manganese "valikuline"
    Float boron "valikuline"
    Float organicCarbon "valikuline"
    Float limeRequirement "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  RelatedParty {
    String id PK
  }
  Material {
    String id PK
    String cropVarietyId FK "valikuline"
  }
  WorkTemplate {
    String id PK
    String cropId FK "valikuline"
  }
  FieldWork {
    String id PK
    Int fieldSeasonId FK
    String workTypeId FK
    String finishedById FK "valikuline"
    String plannedWorkerId FK "valikuline"
  }
  RelatedParty |o--o{ Field : "operator"
  Field ||--o{ FieldSeason : "field"
  Season |o--o{ FieldSeason : "season"
  Crop |o--o{ FieldSeason : "cropEntity"
  CropVariety |o--o{ FieldSeason : "varietyEntity"
  FieldSeason ||--o{ FieldCadastralParcel : "fieldSeason"
  CadastralParcel ||--o{ FieldCadastralParcel : "cadastralParcel"
  RelatedParty |o--o{ FieldCadastralParcel : "ownerParty"
  Crop ||--o{ CropVariety : "crop"
  CropVariety |o--o{ Material : "cropVariety"
  Crop |o--o{ WorkTemplate : "crop"
  FieldSeason ||--o{ FieldWork : "fieldSeason"
```

## Põllutööd ja kanded

Töö on hooaja põllu planeeritud tegevus (PRIA tegevus), plaaniread on planeeritud materjalid normiga. Kanne on tegelikult tehtud töö osa; kande read on tööaeg, masin, kütus, materjalid, saak ja seire leiud.

| Mudel | Tabel | Ettevõttepõhine | Sisu |
|---|---|---|---|
| `WorkType` | `work_types` | jah | Töötüüp = PRIA tegevus (29), faas, lühinimi |
| `FieldWork` | `field_works` | jah | Töö (plaan) hooaja põllul: kuupäevad, pindala, viis, teostaja, staatus, allikas |
| `FieldWorkLine` | `field_work_lines` | jah | Töö plaanirida: planeeritud materjal (norm/ha, PRIA atribuudid) või saak |
| `WorkEntry` | `work_entries` | jah | Kanne = tehtud töö osa: kuupäev, töötaja, masin, haakeriist, tunnid, kütus, pindala, finantsi olek |
| `WorkEntryLine` | `work_entry_lines` | jah | Kande rida: tööaeg, masin, haakeriist, kütus, materjal, saak, seire leid (kogus, ühik, hind) |
| `Material` | `materials` | jah | Kulumaterjal (seeme, väetis, taimekaitsevahend, muu) |
| `WorkTemplate` | `work_templates` | jah | Tööde mall (kasutuseta) |
| `WorkTemplateItem` | `work_template_items` | jah | Tööde malli rida (kasutuseta) |

- Töötüübid = PRIA e-põlluraamatu 29 tegevust (`priaCode`); `shortName` on ettevõtte lühinimi.
- `WorkTemplate` ja `WorkTemplateItem` (tööde mallid) on andmebaasis alles, aga rakendus neid enam ei kasuta.

```mermaid
erDiagram
  WorkType {
    String id PK
    String name
    WorkPhase phase
    WorkRepeatMode repeatMode
    Int maxRepeats "valikuline"
    Int intervalDays "valikuline"
    Boolean usesMaterials
    String priaCode "valikuline"
    String shortName "valikuline"
    Int sortOrder
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  FieldWork {
    String id PK
    Int fieldSeasonId FK
    String workTypeId FK
    WorkPhase phase
    Int sortOrder
    String plannedText "valikuline"
    Int plannedCount
    FieldWorkStatus status
    DateTime finishedAt "valikuline"
    String finishedById FK "valikuline"
    Boolean fromTemplate
    String notes "valikuline"
    DateTime plannedDateFrom "valikuline"
    DateTime plannedDateTo "valikuline"
    Float plannedAreaHa "valikuline"
    String method "valikuline"
    String plannedWorkerId FK "valikuline"
    WorkSource source
    DateTime createdAt
    DateTime updatedAt
  }
  FieldWorkLine {
    String id PK
    String fieldWorkId FK
    WorkEntryLineKind kind
    String materialId FK "valikuline"
    String label
    Float ratePerHa "valikuline"
    String unit
    String priaRegister "valikuline"
    String priaKind "valikuline"
    String priaSpec "valikuline"
    String activeIngredient "valikuline"
    Float nKgHa "valikuline"
    Float pKgHa "valikuline"
    Float kKgHa "valikuline"
    Int sortOrder
  }
  WorkEntry {
    String id PK
    String fieldWorkId FK
    DateTime date
    String workerId FK "valikuline"
    Float areaHa "valikuline"
    Float telemetryAreaHa "valikuline"
    Int occurrenceNo "valikuline"
    String vehicleId FK "valikuline"
    String implementId FK "valikuline"
    Float equipmentHours "valikuline"
    Float fuelLiters "valikuline"
    Float laborHours "valikuline"
    String startTime "valikuline"
    String endTime "valikuline"
    String notes "valikuline"
    DateTime dateTo "valikuline"
    String method "valikuline"
    WorkSource source
    String createdById FK "valikuline"
    FinanceStatus financeStatus
    DateTime financeConfirmedAt "valikuline"
    String financeConfirmedById FK "valikuline"
    String financeNotes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  WorkEntryLine {
    String id PK
    String entryId FK
    WorkEntryLineKind kind
    String vehicleId FK "valikuline"
    String implementId FK "valikuline"
    String materialId FK "valikuline"
    String label
    Float quantity
    String unit
    Decimal unitPrice "valikuline"
    Float confirmedQuantity "valikuline"
    Float ratePerHa "valikuline"
    String priaRegister "valikuline"
    String priaKind "valikuline"
    String priaSpec "valikuline"
    String activeIngredient "valikuline"
    Float nKgHa "valikuline"
    Float pKgHa "valikuline"
    Float kKgHa "valikuline"
    Int sortOrder
  }
  Material {
    String id PK
    String name
    MaterialCategory category
    String unit
    String cropVarietyId FK "valikuline"
    Boolean isActive
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  WorkTemplate {
    String id PK
    String cropId FK "valikuline"
    Boolean isWinter
    DateTime createdAt
    DateTime updatedAt
  }
  WorkTemplateItem {
    String id PK
    String templateId FK
    String workTypeId FK
    Int sortOrder
    String typicalTiming "valikuline"
    Int plannedCount "valikuline"
  }
  FieldSeason {
    Int id PK
    Int fieldId FK
    Int seasonId FK "valikuline"
    String cropId FK "valikuline"
    String varietyId FK "valikuline"
  }
  User {
    String id PK
  }
  RelatedParty {
    String id PK
  }
  Vehicle {
    String id PK
    String assignedDriverId FK "valikuline"
    String assignedImplementId FK,UK "valikuline"
    String assignedDeviceId FK,UK "valikuline"
  }
  Implement {
    String id PK
    String assignedDeviceId FK,UK "valikuline"
  }
  CropVariety {
    String id PK
    String cropId FK
  }
  Crop {
    String id PK
  }
  FieldSeason ||--o{ FieldWork : "fieldSeason"
  WorkType ||--o{ FieldWork : "workType"
  User |o--o{ FieldWork : "finishedBy"
  RelatedParty |o--o{ FieldWork : "plannedWorker"
  FieldWork ||--o{ FieldWorkLine : "fieldWork"
  Material |o--o{ FieldWorkLine : "material"
  FieldWork ||--o{ WorkEntry : "fieldWork"
  RelatedParty |o--o{ WorkEntry : "worker"
  Vehicle |o--o{ WorkEntry : "vehicle"
  Implement |o--o{ WorkEntry : "implement"
  User |o--o{ WorkEntry : "createdByUser"
  User |o--o{ WorkEntry : "financeConfirmedBy"
  WorkEntry ||--o{ WorkEntryLine : "entry"
  Vehicle |o--o{ WorkEntryLine : "vehicle"
  Implement |o--o{ WorkEntryLine : "implement"
  Material |o--o{ WorkEntryLine : "material"
  CropVariety |o--o{ Material : "cropVariety"
  Crop |o--o{ WorkTemplate : "crop"
  WorkTemplate ||--o{ WorkTemplateItem : "template"
  WorkType ||--o{ WorkTemplateItem : "workType"
```

## Masinapark, telemeetria ja objektid

Masinad, haakeriistad ja telemeetriaseadmed. Seadme omand (ettevõttele kuulumise periood) ja paigaldus masinale/haakeriistale on ajaliste kirjetena; telemeetria mõõtmised ise on eraldi telemeetria andmebaasis.

| Mudel | Tabel | Ettevõttepõhine | Sisu |
|---|---|---|---|
| `Vehicle` | `vehicles` | jah | Masin (traktor, kombain jm): andmed, amortisatsioon, viimane asukoht, juht |
| `Implement` | `implements` | jah | Haakeriist (laius, tüüp) |
| `TelemetryDevice` | `telemetry_devices` | jah | Telemeetriaseade (IMEI vms) |
| `DeviceOwnership` | `device_ownerships` | jah | Seadme kuulumine ettevõttele ajavahemikus |
| `DeviceAssignment` | `device_assignments` | jah | Seadme paigaldus masinale/haakeriistale ajavahemikus |
| `ImplementAssignment` | `implement_assignments` | jah | Haakeriista ühendus masinaga ajavahemikus |
| `PointOfInterest` | `points_of_interest` | jah | Objekt (kuivati, ladu, töökoda jm): asukoht, raadius, kontakt |

- Telemeetria (GPS, süüde, kiirus jm) on eraldi TimescaleDB andmebaasis (`measurements`), seotud seadme IMEI kaudu.

```mermaid
erDiagram
  Vehicle {
    String id PK
    String name
    VehicleType type
    String category "valikuline"
    String manufacturer "valikuline"
    String model
    Float powerKw "valikuline"
    Float acquisitionCost "valikuline"
    DateTime acquisitionDate "valikuline"
    Float depreciationRate "valikuline"
    String depreciationMethod "valikuline"
    String regNumber "valikuline"
    String serialNumber "valikuline"
    Float workingWidthM
    String color
    Float fuelCapacityL "valikuline"
    String assignedDriverId FK "valikuline"
    String assignedImplementId FK,UK "valikuline"
    String assignedDeviceId FK,UK "valikuline"
    Float lastLatitude "valikuline"
    Float lastLongitude "valikuline"
    DateTime lastActiveAt "valikuline"
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  Implement {
    String id PK
    String name
    ImplementType type
    String category "valikuline"
    Float workingWidthM
    Float acquisitionCost "valikuline"
    DateTime acquisitionDate "valikuline"
    Float depreciationRate "valikuline"
    String depreciationMethod "valikuline"
    String manufacturer "valikuline"
    String model "valikuline"
    String serialNumber "valikuline"
    Int year "valikuline"
    String assignedDeviceId FK,UK "valikuline"
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  TelemetryDevice {
    String id PK
    DeviceConnectivity connectivityType
    String imei UK "valikuline"
    String macAddress UK "valikuline"
    String model
    String simNumber "valikuline"
    String firmware "valikuline"
    DateTime acquisitionDate "valikuline"
    DeviceStatus status
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  DeviceOwnership {
    String id PK
    DeviceIdentifierKind kind
    String identifier
    String deviceId "valikuline"
    DateTime validFrom
    DateTime validTo "valikuline"
    DateTime createdAt
  }
  DeviceAssignment {
    String id PK
    String deviceId FK
    String vehicleId FK "valikuline"
    String implementId FK "valikuline"
    DateTime startedAt
    DateTime endedAt "valikuline"
    Float lastLatitude "valikuline"
    Float lastLongitude "valikuline"
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  ImplementAssignment {
    String id PK
    String vehicleId FK
    String implementId FK
    DateTime startedAt
    DateTime endedAt "valikuline"
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  PointOfInterest {
    String id PK
    String name
    PoiCategory category
    Float latitude
    Float longitude
    Int radiusM
    String description "valikuline"
    String capacity "valikuline"
    String contactPerson "valikuline"
    String contactPartyId FK "valikuline"
    String phone "valikuline"
    String accessNotes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  RelatedParty {
    String id PK
  }
  WorkEntry {
    String id PK
    String fieldWorkId FK
    String workerId FK "valikuline"
    String vehicleId FK "valikuline"
    String implementId FK "valikuline"
    String createdById FK "valikuline"
    String financeConfirmedById FK "valikuline"
  }
  WorkEntryLine {
    String id PK
    String entryId FK
    String vehicleId FK "valikuline"
    String implementId FK "valikuline"
    String materialId FK "valikuline"
  }
  RelatedParty |o--o{ Vehicle : "assignedDriver"
  Implement |o--o| Vehicle : "assignedImplement"
  TelemetryDevice |o--o| Vehicle : "assignedDevice"
  TelemetryDevice |o--o| Implement : "assignedDevice"
  TelemetryDevice ||--o{ DeviceAssignment : "device"
  Vehicle |o--o{ DeviceAssignment : "vehicle"
  Implement |o--o{ DeviceAssignment : "implement"
  Vehicle ||--o{ ImplementAssignment : "vehicle"
  Implement ||--o{ ImplementAssignment : "implement"
  RelatedParty |o--o{ PointOfInterest : "contactParty"
  Vehicle |o--o{ WorkEntry : "vehicle"
  Implement |o--o{ WorkEntry : "implement"
  Vehicle |o--o{ WorkEntryLine : "vehicle"
  Implement |o--o{ WorkEntryLine : "implement"
```

## Isikud, kasutajad ja tugi

Seotud isikud (töötajad, omanikud, operaatorid, partnerid) ja rakenduse kasutajad. Tugiligipääs lubab teenusepakkujal ettevõtte andmeid ajutiselt vaadata.

| Mudel | Tabel | Ettevõttepõhine | Sisu |
|---|---|---|---|
| `RelatedParty` | `related_parties` | jah | Seotud isik/ettevõte: töötaja, omanik, operaator, partner |
| `User` | `users` | jah | Rakenduse kasutaja (ettevõtte), rollid |
| `Session` | `sessions` | – | Kasutaja sessioon |
| `PasswordToken` | `password_tokens` | – | Parooli seadmise / kutse token |
| `SupportGrant` | `support_grants` | jah | Ettevõtte antud tugiligipääs teenusepakkujale |
| `SupportAccessLog` | `support_access_log` | jah | Tugiligipääsu logi |

```mermaid
erDiagram
  RelatedParty {
    String id PK
    String name
    PartyType type
    String code "valikuline"
    String vatNumber "valikuline"
    PartyRole[] roles
    String phone "valikuline"
    String email "valikuline"
    String address "valikuline"
    String bankAccount "valikuline"
    String notes "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  User {
    String id PK
    String username UK
    String passwordHash
    String displayName "valikuline"
    String email UK "valikuline"
    Boolean isActive
    Boolean isAdmin
    Boolean mustChangePassword
    Boolean isFinanceManager
    DateTime lastLoginAt "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  Session {
    String id PK
    String userId FK
    String tokenHash UK
    DateTime expiresAt
    DateTime lastSeenAt
    String userAgent "valikuline"
    DateTime createdAt
  }
  PasswordToken {
    Int id PK
    String userId FK
    String purpose
    String tokenHash UK
    DateTime expiresAt
    DateTime usedAt "valikuline"
    DateTime createdAt
  }
  SupportGrant {
    String id PK
    String grantedByUserId FK
    DateTime validUntil
    DateTime revokedAt "valikuline"
    DateTime createdAt
  }
  SupportAccessLog {
    String id PK
    String supportGrantId FK
    String platformUsername
    DateTime startedAt
  }
  Field {
    Int id PK
    String operatorId FK "valikuline"
  }
  FieldCadastralParcel {
    Int id PK
    Int fieldSeasonId FK
    Int cadastralParcelId FK
    String ownerPartyId FK "valikuline"
  }
  PointOfInterest {
    String id PK
    String contactPartyId FK "valikuline"
  }
  Vehicle {
    String id PK
    String assignedDriverId FK "valikuline"
    String assignedImplementId FK,UK "valikuline"
    String assignedDeviceId FK,UK "valikuline"
  }
  FieldWork {
    String id PK
    Int fieldSeasonId FK
    String workTypeId FK
    String finishedById FK "valikuline"
    String plannedWorkerId FK "valikuline"
  }
  WorkEntry {
    String id PK
    String fieldWorkId FK
    String workerId FK "valikuline"
    String vehicleId FK "valikuline"
    String implementId FK "valikuline"
    String createdById FK "valikuline"
    String financeConfirmedById FK "valikuline"
  }
  User ||--o{ Session : "user"
  User ||--o{ PasswordToken : "user"
  User ||--o{ SupportGrant : "grantedBy"
  SupportGrant ||--o{ SupportAccessLog : "grant"
  RelatedParty |o--o{ Field : "operator"
  RelatedParty |o--o{ FieldCadastralParcel : "ownerParty"
  RelatedParty |o--o{ PointOfInterest : "contactParty"
  RelatedParty |o--o{ Vehicle : "assignedDriver"
  User |o--o{ FieldWork : "finishedBy"
  RelatedParty |o--o{ FieldWork : "plannedWorker"
  RelatedParty |o--o{ WorkEntry : "worker"
  User |o--o{ WorkEntry : "createdByUser"
  User |o--o{ WorkEntry : "financeConfirmedBy"
```

## Platvorm (teenusepakkuja)

Ettevõtted, litsentsid, platvormi kasutajad, algkataloog uue ettevõtte jaoks, abiartiklid ja landing-lehe andmed. Need tabelid ei ole ettevõttepõhised.

| Mudel | Tabel | Ettevõttepõhine | Sisu |
|---|---|---|---|
| `Tenant` | `tenants` | – | Ettevõte (klient) |
| `TenantLicense` | `tenant_licenses` | jah | Ettevõtte litsents ja moodulid |
| `PlatformUser` | `platform_users` | – | Teenusepakkuja (admin.teris.ee) kasutaja |
| `PlatformSession` | `platform_sessions` | – | Platvormi kasutaja sessioon |
| `PlatformAuditLog` | `platform_audit_log` | – | Platvormi tegevuste logi |
| `SupportSession` | `support_sessions` | – | Tugiligipääsu sessioon |
| `HelpArticle` | `help_articles` | – | Abiartikkel (kasutusjuhend) |
| `CatalogCrop` | `catalog_crops` | – | Algkataloogi kultuur (kopeeritakse uuele ettevõttele) |
| `CatalogCropVariety` | `catalog_crop_varieties` | – | Algkataloogi sort |
| `CatalogWorkType` | `catalog_work_types` | – | Algkataloogi töötüüp (PRIA tegevus) |
| `CatalogWorkTemplate` | `catalog_work_templates` | – | Algkataloogi mall (kasutuseta) |
| `CatalogWorkTemplateItem` | `catalog_work_template_items` | – | Algkataloogi malli rida (kasutuseta) |
| `LandingEvent` | `landing_events` | – | Landing-lehe külastuse sündmus |
| `InterestRequest` | `interest_requests` | – | Landing-lehe huvipäring |

```mermaid
erDiagram
  Tenant {
    String id PK
    String name
    String registryCode "valikuline"
    TenantStatus status
    String primaryPartyId "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  TenantLicense {
    String id PK
    DateTime validUntil
    LicenseModule[] modules
    DateTime updatedAt
  }
  PlatformUser {
    String id PK
    String username UK
    String passwordHash
    String totpSecretEnc
    Int totpLastStep
    Boolean isActive
    DateTime lastLoginAt "valikuline"
    DateTime createdAt
    DateTime updatedAt
  }
  PlatformSession {
    String id PK
    String platformUserId FK
    String tokenHash UK
    DateTime expiresAt
    String userAgent "valikuline"
    DateTime createdAt
  }
  PlatformAuditLog {
    String id PK
    String platformUserId "valikuline"
    String action
    String targetTenantId "valikuline"
    Json details "valikuline"
    DateTime createdAt
  }
  SupportSession {
    String id PK
    String targetTenantId
    String supportGrantId
    String platformUserId
    String handoffTokenHash UK "valikuline"
    DateTime handoffExpiresAt
    String sessionTokenHash UK "valikuline"
    DateTime expiresAt "valikuline"
    DateTime createdAt
  }
  HelpArticle {
    String key PK
    String html
    DateTime updatedAt
    DateTime createdAt
  }
  CatalogCrop {
    String id PK
    String name UK
    String scientificName "valikuline"
    CropGroup group
    String color
    String icon "valikuline"
    String priaCode "valikuline"
    Float defaultSeedRateKgHa "valikuline"
    Float defaultYieldTonsHa "valikuline"
    String description "valikuline"
    Boolean isWinterCrop
    DateTime createdAt
    DateTime updatedAt
  }
  CatalogCropVariety {
    String id PK
    String catalogCropId FK
    String name
    String breeder "valikuline"
    String maturityDays "valikuline"
    String winterHardiness "valikuline"
    Float recommendedSeedRateKgHa "valikuline"
    Float potentialYieldTonsHa "valikuline"
    String qualityClass "valikuline"
    String notes "valikuline"
    Boolean isActive
  }
  CatalogWorkType {
    String id PK
    String name UK
    WorkPhase phase
    WorkRepeatMode repeatMode
    Int maxRepeats "valikuline"
    Int intervalDays "valikuline"
    Boolean usesMaterials
    String priaCode UK "valikuline"
    Int sortOrder
    Boolean isActive
  }
  CatalogWorkTemplate {
    String id PK
    String catalogCropId FK "valikuline"
    Boolean isWinter
  }
  CatalogWorkTemplateItem {
    String id PK
    String templateId FK
    String catalogWorkTypeId FK
    Int sortOrder
    String typicalTiming "valikuline"
    Int plannedCount "valikuline"
  }
  LandingEvent {
    BigInt id PK
    DateTime ts
    String source
    String event
    String target "valikuline"
    String path
    String visitorClass
    String botName "valikuline"
    String referrerHost "valikuline"
    String utmSource "valikuline"
    String utmMedium "valikuline"
    String utmCampaign "valikuline"
    String device
    String visitorHash
  }
  InterestRequest {
    String id PK
    DateTime createdAt
    DateTime updatedAt
    String name
    String email
    String company "valikuline"
    String phone "valikuline"
    Float areaHa "valikuline"
    String message "valikuline"
    InterestStatus status
    String notes "valikuline"
    DateTime closedAt "valikuline"
    String utmSource "valikuline"
    String referrerHost "valikuline"
  }
  PlatformUser ||--o{ PlatformSession : "platformUser"
  CatalogCrop ||--o{ CatalogCropVariety : "crop"
  CatalogCrop |o--o{ CatalogWorkTemplate : "crop"
  CatalogWorkTemplate ||--o{ CatalogWorkTemplateItem : "template"
  CatalogWorkType ||--o{ CatalogWorkTemplateItem : "workType"
```

## Kõik seosed (ülevaade)

Kõik tabelid ja nende seosed ühel skeemil (ilma veergudeta).

```mermaid
erDiagram
  RelatedParty |o--o{ Field : "operator"
  Field ||--o{ FieldSeason : "field"
  Season |o--o{ FieldSeason : "season"
  Crop |o--o{ FieldSeason : "cropEntity"
  CropVariety |o--o{ FieldSeason : "varietyEntity"
  FieldSeason ||--o{ FieldCadastralParcel : "fieldSeason"
  CadastralParcel ||--o{ FieldCadastralParcel : "cadastralParcel"
  RelatedParty |o--o{ FieldCadastralParcel : "ownerParty"
  RelatedParty |o--o{ PointOfInterest : "contactParty"
  RelatedParty |o--o{ Vehicle : "assignedDriver"
  Implement |o--o| Vehicle : "assignedImplement"
  TelemetryDevice |o--o| Vehicle : "assignedDevice"
  TelemetryDevice |o--o| Implement : "assignedDevice"
  TelemetryDevice ||--o{ DeviceAssignment : "device"
  Vehicle |o--o{ DeviceAssignment : "vehicle"
  Implement |o--o{ DeviceAssignment : "implement"
  Vehicle ||--o{ ImplementAssignment : "vehicle"
  Implement ||--o{ ImplementAssignment : "implement"
  Crop ||--o{ CropVariety : "crop"
  CropVariety |o--o{ Material : "cropVariety"
  Crop |o--o{ WorkTemplate : "crop"
  WorkTemplate ||--o{ WorkTemplateItem : "template"
  WorkType ||--o{ WorkTemplateItem : "workType"
  FieldSeason ||--o{ FieldWork : "fieldSeason"
  WorkType ||--o{ FieldWork : "workType"
  User |o--o{ FieldWork : "finishedBy"
  RelatedParty |o--o{ FieldWork : "plannedWorker"
  FieldWork ||--o{ FieldWorkLine : "fieldWork"
  Material |o--o{ FieldWorkLine : "material"
  FieldWork ||--o{ WorkEntry : "fieldWork"
  RelatedParty |o--o{ WorkEntry : "worker"
  Vehicle |o--o{ WorkEntry : "vehicle"
  Implement |o--o{ WorkEntry : "implement"
  User |o--o{ WorkEntry : "createdByUser"
  User |o--o{ WorkEntry : "financeConfirmedBy"
  WorkEntry ||--o{ WorkEntryLine : "entry"
  Vehicle |o--o{ WorkEntryLine : "vehicle"
  Implement |o--o{ WorkEntryLine : "implement"
  Material |o--o{ WorkEntryLine : "material"
  User ||--o{ Session : "user"
  User ||--o{ SupportGrant : "grantedBy"
  SupportGrant ||--o{ SupportAccessLog : "grant"
  User ||--o{ PasswordToken : "user"
  PlatformUser ||--o{ PlatformSession : "platformUser"
  CatalogCrop ||--o{ CatalogCropVariety : "crop"
  CatalogCrop |o--o{ CatalogWorkTemplate : "crop"
  CatalogWorkTemplate ||--o{ CatalogWorkTemplateItem : "template"
  CatalogWorkType ||--o{ CatalogWorkTemplateItem : "workType"
```

## Loendid (enum)

| Loend | Väärtused |
|---|---|
| `FieldStatus` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` |
| `PoiCategory` | `DRYER`, `WATER_SOURCE`, `WORKSHOP`, `FUEL_STATION`, `FIELD_ENTRANCE`, `STORAGE`, `SCALE`, `OTHER` |
| `VehicleType` | `TRACTOR`, `COMBINE`, `SPRAYER`, `SPREADER`, `TRUCK`, `ATV`, `LOADER` |
| `ImplementType` | `CULTIVATOR`, `SEEDER`, `SPRAYER`, `HEADER`, `DISC_HARROW`, `PLOW`, `MOWER`, `TRAILER`, `FERTILIZER_SPREADER`, `ROLLER`, `OTHER` |
| `DeviceStatus` | `WORKING`, `MOVING`, `STOPPED`, `IDLING`, `OFFLINE` |
| `OwnershipType` | `OWNED`, `RENTED` |
| `PartyType` | `PERSON`, `LEGAL_ENTITY` |
| `PartyRole` | `LANDOWNER`, `DRIVER`, `OPERATOR`, `OTHER` |
| `DeviceConnectivity` | `CELLULAR`, `EYE_SENSOR` |
| `DeviceIdentifierKind` | `IMEI`, `MAC` |
| `CropGroup` | `CEREAL`, `OILSEED`, `LEGUME`, `FORAGE_GRASS`, `FALLOW`, `OTHER` |
| `WorkPhase` | `PREPARATION`, `SOWING`, `CARE`, `HARVEST` |
| `WorkRepeatMode` | `ONCE`, `UP_TO`, `INTERVAL` |
| `FieldWorkStatus` | `PLANNED`, `IN_PROGRESS`, `DONE` |
| `WorkEntryLineKind` | `LABOR`, `MACHINE`, `IMPLEMENT`, `FUEL`, `MATERIAL`, `HARVEST`, `OBSERVATION` |
| `FinanceStatus` | `PENDING`, `CONFIRMED`, `CHANGED` |
| `WorkSource` | `MANUAL`, `PRIA_IMPORT` |
| `MaterialCategory` | `SEED`, `FERTILIZER`, `PLANT_PROTECTION`, `OTHER` |
| `TenantStatus` | `ACTIVE`, `SUSPENDED` |
| `LicenseModule` | `TELEMETRY`, `SATELLITE`, `WEATHER` |
| `InterestStatus` | `NEW`, `CONTACTED`, `CLOSED` |
