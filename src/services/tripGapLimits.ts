// src/services/tripGapLimits.ts — sõitude vahede hoiatuse piirid (server arvutab, UI kuvab sama piiri järgi).
export const GAP_LIMITS = {
  powerLostMinutes: 5, // toitepinge < 6 V kokku vähemalt
  silentMinutes: 180, // seade ei saatnud midagi vähemalt
  fuelDropPct: 5, // paagitase langes protsendipunkte vähemalt
  jumpM: 500, // asukoht eelmise sõidu lõpust järgmise alguseni vähemalt
  engineHoursGrowth: 2 // masina CAN mootoritunnid kasvasid vähemalt (näit täistundides)
} as const;

// Mootoritundide kasvu näidatakse alates sellest (kui vahe on muu märgi tõttu salvestatud)
export const ENGINE_HOURS_SHOWN_FROM = 1;
