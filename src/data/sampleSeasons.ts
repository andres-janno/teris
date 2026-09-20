// src/data/sampleSeasons.ts
import type { FarmingSeason } from '../types/season';

/**
 * Normaliseeritud Hooaegade tabel (Prisma: model Season)
 */
export const INITIAL_SEASONS: FarmingSeason[] = [
  {
    "id": 1,
    "year": 2027,
    "name": "Hooaeg 2027",
    "status": "planning",
    "isLocked": false,
    "preparationStartDate": "2026-08-15",
    "seedingStartDate": "2026-09-01",
    "harvestStartDate": "2027-08-01",
    "harvestEndDate": "2027-09-30",
    "closedAt": null,
    "closedBy": null,
    "totalAreaHa": 298.5,
    "fieldsCount": 32,
    "targetYieldTons": 1850,
    "actualYieldTons": null,
    "notes": "2027. a külvikorra ja maaharimise eelplaneerimine. Uute sortide katsetused."
  },
  {
    "id": 2,
    "year": 2026,
    "name": "Hooaeg 2026",
    "status": "active",
    "isLocked": false,
    "preparationStartDate": "2025-08-20",
    "seedingStartDate": "2025-09-05",
    "harvestStartDate": "2026-08-05",
    "harvestEndDate": "2026-09-25",
    "closedAt": null,
    "closedBy": null,
    "totalAreaHa": 298.5,
    "fieldsCount": 32,
    "targetYieldTons": 1780,
    "actualYieldTons": null,
    "notes": "Käimasolev 2026. a hooaeg. Talinisu, taliraps ja suviviljad heas seisukorras."
  },
  {
    "id": 3,
    "year": 2025,
    "name": "Hooaeg 2025",
    "status": "closed",
    "isLocked": true,
    "preparationStartDate": "2024-08-15",
    "seedingStartDate": "2024-09-01",
    "harvestStartDate": "2025-08-01",
    "harvestEndDate": "2025-09-12",
    "closedAt": "2025-09-15",
    "closedBy": "Rein Janno",
    "totalAreaHa": 304.2,
    "fieldsCount": 32,
    "targetYieldTons": 1650,
    "actualYieldTons": 1720,
    "notes": "Hooaeg edukalt koristatud ja suletud. Keskmine teravilja saagikus 5.8 t/ha."
  },
  {
    "id": 4,
    "year": 2024,
    "name": "Hooaeg 2024",
    "status": "closed",
    "isLocked": true,
    "preparationStartDate": "2023-08-20",
    "seedingStartDate": "2023-09-05",
    "harvestStartDate": "2024-08-05",
    "harvestEndDate": "2024-09-18",
    "closedAt": "2024-09-20",
    "closedBy": "Rein Janno",
    "totalAreaHa": 295,
    "fieldsCount": 32,
    "targetYieldTons": 1580,
    "actualYieldTons": 1610,
    "notes": "2024. a saak koristatud, PRIA aruandlus lõpetatud ja hooaeg arhiveeritud."
  },
  {
    "id": 5,
    "year": 2023,
    "name": "Hooaeg 2023",
    "status": "closed",
    "isLocked": true,
    "preparationStartDate": "2022-08-25",
    "seedingStartDate": "2022-09-10",
    "harvestStartDate": "2023-08-01",
    "harvestEndDate": "2023-09-08",
    "closedAt": "2023-09-10",
    "closedBy": "Rein Janno",
    "totalAreaHa": 289.4,
    "fieldsCount": 32,
    "targetYieldTons": 1500,
    "actualYieldTons": 1550,
    "notes": "2023. a hooaeg arhiveeritud. Suurepärane proteiinisisaldus toidunisul."
  }
];
