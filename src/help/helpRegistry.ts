// src/help/helpRegistry.ts — kõik kohad, kus rakenduses on juhendi (?) ikoon.
// Uus koht: lisa siia kirje ja pane komponenti <HelpHint helpKey="…" />. Admin.teris.ee „Juhendid“
// vaade näitab kõiki siinseid kohti; tekst ise on andmebaasis (help_articles) ja seda muudab teenusepakkuja.

export interface HelpSpot {
  /** Rakenduse ala, mille järgi admin-vaade kohad rühmitab */
  area: string;
  /** Lühinimi (nupu või välja nimi) */
  label: string;
  /** Kus see koht täpselt asub */
  where: string;
}

export const HELP_SPOTS = {
  'fields.register.export-csv': { area: 'Põllud', label: 'CSV eksport', where: 'Põldude register → tööriistariba' },
  'fields.register.import-soil-samples': { area: 'Põllud', label: 'Impordi mullaproovid', where: 'Põldude register → tööriistariba' },
  'fields.register.import-field-book': { area: 'Põllud', label: 'Impordi põlluraamat', where: 'Põldude register → tööriistariba' },
  'fields.register.import-pria-zip': { area: 'Põllud', label: 'Impordi PRIA ZIP', where: 'Põldude register → tööriistariba' }
} as const satisfies Record<string, HelpSpot>;

export type HelpKey = keyof typeof HELP_SPOTS;

export const isHelpKey = (key: string): key is HelpKey => Object.prototype.hasOwnProperty.call(HELP_SPOTS, key);

/** Juhendi HTML-i suurim pikkus (märkides) */
export const HELP_MAX_LENGTH = 20000;
