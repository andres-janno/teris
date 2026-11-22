// src/help/helpRegistry.ts — kõik kohad, kus rakenduses on juhendi (?) ikoon.
// Uus koht: lisa siia kirje ja pane komponenti <HelpHint helpKey="…" />. Admin.teris.ee „Juhendid“
// vaade näitab kõiki siinseid kohti; tekst ise on andmebaasis (help_articles) ja seda muudab teenusepakkuja.

import { GUIDE_MAX_LENGTH, isGuideChapterKey } from './guideChapters.ts';

export interface HelpSpot {
  /** Rakenduse ala, mille järgi admin-vaade kohad rühmitab */
  area: string;
  /** Lühinimi (nupu või välja nimi) */
  label: string;
  /** Kus see koht täpselt asub */
  where: string;
  /** Vaikimisi seotud peatükk (`guide.<peatükk>[#ankur]`): mustandite laadija paneb selle kohtjuhendile, kui seos on tühi */
  guideLink?: string;
}

export const HELP_SPOTS = {
  'fields.register.export-csv': { area: 'Külvikord', label: 'CSV eksport', where: 'Külvikord → tööriistariba', guideLink: 'guide.rotation' },
  'fields.register.import-soil-samples': { area: 'Põllud', label: 'Impordi mullaproovid', where: 'Põllud → tööriistariba', guideLink: 'guide.fields' },
  'fields.register.import-field-book': { area: 'Põllud', label: 'Impordi põlluraamat', where: 'Põllud → tööriistariba', guideLink: 'guide.fields' },
  'fields.register.import-pria-zip': { area: 'Põllud', label: 'Impordi PRIA ZIP', where: 'Põllud → tööriistariba', guideLink: 'guide.fields' },
  'view.map': { area: 'Vaated', label: 'Kaart', where: 'Kaart → kaardikihtide paneeli pealkiri', guideLink: 'guide.map' },
  'view.fields': { area: 'Vaated', label: 'Põllud', where: 'Põllud → vaate pealkiri', guideLink: 'guide.fields' },
  'view.crops': { area: 'Vaated', label: 'Kultuurid', where: 'Kultuurid → vaate pealkiri', guideLink: 'guide.crops' },
  'view.rotation': { area: 'Vaated', label: 'Külvikord', where: 'Külvikord → vaate pealkiri', guideLink: 'guide.rotation' },
  'view.works': { area: 'Vaated', label: 'Põllutööd', where: 'Põllutööd → vaate pealkiri', guideLink: 'guide.works' },
  'view.stock': { area: 'Vaated', label: 'Laoarvestus', where: 'Laoarvestus → vaate pealkiri', guideLink: 'guide.stock' },
  'view.fleet': { area: 'Vaated', label: 'Tehnika', where: 'Tehnika → vaate pealkiri', guideLink: 'guide.fleet' },
  'view.infrastructure': { area: 'Vaated', label: 'Taristu', where: 'Taristu → vaate pealkiri', guideLink: 'guide.infrastructure' },
  'view.parties': { area: 'Vaated', label: 'Isikud', where: 'Isikud → vaate pealkiri', guideLink: 'guide.parties' },
  'view.weather': { area: 'Vaated', label: 'Ilm', where: 'Ilm → vaate pealkiri', guideLink: 'guide.weather' },
  'view.seasons': { area: 'Vaated', label: 'Hooajad', where: 'Hooajad → vaate pealkiri', guideLink: 'guide.seasons' }
} as const satisfies Record<string, HelpSpot>;

export type HelpKey = keyof typeof HELP_SPOTS;

export const isHelpKey = (key: string): key is HelpKey => Object.prototype.hasOwnProperty.call(HELP_SPOTS, key);

/** Juhendi HTML-i suurim pikkus (märkides) */
export const HELP_MAX_LENGTH = 20000;

/** Teksti suurim pikkus võtme kohta: peatükk kuni 100 000, kohtjuhend 20 000 märki */
export const helpMaxLength = (key: string): number => (isGuideChapterKey(key) ? GUIDE_MAX_LENGTH : HELP_MAX_LENGTH);
