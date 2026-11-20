// src/admin/adminUi.ts — teenusepakkuja admini ühised klassikonstandid (ainult admin; põhirakendus kasutab src/components/ui/variants.ts).
// Välimus (nupp, tabel, kaart, märk) tuleb ui komponentidest; siin on admini oma paigutus ja tekstiread.
import type { BadgeTone } from '../types/badgeTone';
import { tableMutedClass } from '../components/ui/variants';

/** Märgi toon vanade `.admin-badge.ok/.off/.neutral` asemel. */
export const adminBadgeTone = (tone: 'ok' | 'off' | 'neutral'): BadgeTone => (tone === 'ok' ? 'success' : tone === 'off' ? 'danger' : 'neutral');

// --- Kest ja päis ---
/** Lehe kest; lingid (tugivaate link, huviliste e-post) on infosinised (vana `.admin-shell a`). */
export const adminShellClass = 'mx-auto min-h-screen max-w-325 px-6 pb-8 pt-4 [&_a]:text-info-text';
export const adminTitleClass = 'text-xl font-semibold leading-natural';
export const adminNavClass = 'mb-4 flex gap-2';

// --- Kaart ja selle osad (Card className) ---
export const adminCardClass = 'mb-4';
/** Päis/tööriistariba: pealkiri vasakul, tegevused paremal. */
export const adminToolbarClass = 'mb-3 flex flex-wrap items-center justify-between gap-3';
/** Pealkirjad kaardi sees. `adminH2Class` on kaardi enda pealkiri (12px alla); tööriistaribal hoiab see sama 12px, nagu vana CSS. */
export const adminH2Class = 'mb-3 text-lg font-semibold leading-natural';
export const adminH2FlushClass = 'text-lg font-semibold leading-natural';
export const adminH3Class = 'mb-2 mt-4 text-base font-semibold leading-natural';
/** Alamosa (nt sortide paneel): joon üleval. */
export const adminSubpanelClass = 'mt-4 border-t border-border pt-3';
export const adminCardFootClass = `${adminSubpanelClass} flex justify-end gap-2`;

// --- Vormid ---
export const adminFormClass = 'grid gap-3';
/** Kaks veergu; kitsal ekraanil üks (vana `@media (max-width: 640px)`). */
export const adminFormGridClass = 'grid grid-cols-2 gap-3 max-[641px]:grid-cols-1';
export const adminLicenseGridClass = 'grid grid-cols-[minmax(180px,240px)_1fr] items-start gap-x-8 gap-y-4 max-[641px]:grid-cols-1';
export const adminFieldClass = 'flex flex-col gap-2';
export const adminFieldLabelClass = 'text-2xs font-semibold uppercase leading-natural tracking-wide text-muted-foreground';
export const adminChecksClass = 'flex flex-wrap gap-4';
export const adminSplitClass = 'flex flex-wrap items-center justify-between gap-4';
export const adminActionsClass = 'flex flex-wrap items-center gap-2';
export const adminRowActionsClass = 'flex gap-1.5 whitespace-nowrap';
export const adminFilterRowClass = 'mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 [&_[data-slot=input-group]]:w-auto';

// --- Tekstid ---
export const adminHintClass = 'mt-1.5 text-sm leading-normal text-subtle';
/** Sama mis `tableMutedClass` (variants.ts). */
export const adminMutedClass = tableMutedClass;

// --- Ruudustikud ---
export const adminMetaGridClass = 'mb-2 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3';
export const adminMetaLabelClass = 'block text-2xs font-semibold uppercase leading-natural text-muted-foreground';
export const adminStatRowClass = 'mb-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3';
export const adminTwoColClass = 'grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';
