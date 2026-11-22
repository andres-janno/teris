// src/help/guideChapters.ts — kasutusjuhendi peatükid (spec 2026-11-21). Võtmed, pealkirjad ja järjekord on koodis;
// uue peatüki lisamine = koodimuudatus. Tekst on andmebaasis (help_articles, võti = peatüki võti) ja seda muudab
// teenusepakkuja admin.teris.ee-s. Fail on ühine kliendile ja serverile.
import type { LicenseModule } from '../types/auth.ts';

interface GuideChapterDef {
  key: string;
  title: string;
  /** Litsentsimoodul, mida peatükk eeldab; mooduliga mitte ettevõttele peatükki ei näidata */
  module?: LicenseModule;
}

const DEFS = [
  { key: 'guide.getting-started', title: 'Alustamine' },
  { key: 'guide.onboarding', title: 'Juurutamine' },
  { key: 'guide.map', title: 'Kaart' },
  { key: 'guide.fields', title: 'Põllud' },
  { key: 'guide.crops', title: 'Kultuurid' },
  { key: 'guide.rotation', title: 'Külvikord' },
  { key: 'guide.works', title: 'Põllutööd' },
  { key: 'guide.stock', title: 'Laoarvestus' },
  { key: 'guide.fleet', title: 'Tehnika' },
  { key: 'guide.telemetry', title: 'GPS-seadmed ja sõidud', module: 'TELEMETRY' },
  { key: 'guide.infrastructure', title: 'Taristu' },
  { key: 'guide.parties', title: 'Isikud' },
  { key: 'guide.weather', title: 'Ilm', module: 'WEATHER' },
  { key: 'guide.seasons', title: 'Hooajad' },
  { key: 'guide.pria', title: 'PRIA' },
  { key: 'guide.settings', title: 'Kasutajad ja seaded' }
] as const satisfies readonly GuideChapterDef[];

export type GuideChapterKey = (typeof DEFS)[number]['key'];

export interface GuideChapter {
  key: GuideChapterKey;
  title: string;
  module?: LicenseModule;
}

export const GUIDE_CHAPTERS: readonly GuideChapter[] = DEFS;

/** Peatüki HTML-i suurim pikkus (märkides); kohtjuhendil `HELP_MAX_LENGTH` */
export const GUIDE_MAX_LENGTH = 100000;

/** Mooduli nimi, nagu see on kasutajale kirjas (märge „vajab moodulit …“) */
export const MODULE_LABELS: Record<LicenseModule, string> = {
  TELEMETRY: 'Telemeetria',
  SATELLITE: 'Satelliit',
  WEATHER: 'Ilm'
};

export const isGuideChapterKey = (key: string): key is GuideChapterKey => GUIDE_CHAPTERS.some((c) => c.key === key);

export const chapterByKey = (key: GuideChapterKey): GuideChapter => GUIDE_CHAPTERS.find((c) => c.key === key)!;

/** Peatüki järjekorranumber (1-põhine) */
export const chapterNumber = (key: GuideChapterKey): number => GUIDE_CHAPTERS.findIndex((c) => c.key === key) + 1;

/** Peatükid, mille mooduli ettevõttel on (või mis moodulit ei eelda) */
export const visibleChapters = (has: (m: LicenseModule) => boolean): GuideChapter[] =>
  GUIDE_CHAPTERS.filter((c) => !c.module || has(c.module));

/** Mustandi failinimi `docs/juhend/` all: `01-guide.getting-started.html` */
export const draftFileName = (key: GuideChapterKey): string => `${String(chapterNumber(key)).padStart(2, '0')}-${key}.html`;
