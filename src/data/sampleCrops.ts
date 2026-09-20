// src/data/sampleCrops.ts
import type { Crop } from '../types/crop';

export const INITIAL_CROPS: Crop[] = [
  {
    id: 'crop-talinisu',
    name: 'Talinisu',
    scientificName: 'Triticum aestivum',
    group: 'CEREAL',
    color: '#eab308',
    icon: '🌾',
    priaCode: 'TNS',
    defaultSeedRateKgHa: 220,
    defaultYieldTonsHa: 7.2,
    description: 'Peamine toiduviljakultuur. Nõuab head talvekindlust ja varajast külvi septembris.',
    varieties: [
      {
        id: 'var-skagen',
        cropId: 'crop-talinisu',
        name: 'Skagen',
        breeder: 'Nordic Seed',
        maturityDays: 'Hilissügisene / Keskvalmiv',
        winterHardiness: 'Väga hea',
        recommendedSeedRateKgHa: 210,
        potentialYieldTonsHa: 9.5,
        qualityClass: 'Toiduvili (E/I)',
        notes: 'Eesti enimkasvatatud talinisu, suurepärane talvekindlus ja stabiilne langemisarv.'
      },
      {
        id: 'var-creator',
        cropId: 'crop-talinisu',
        name: 'Creator',
        breeder: 'Secobra',
        maturityDays: 'Keskvalmiv',
        winterHardiness: 'Hea',
        recommendedSeedRateKgHa: 220,
        potentialYieldTonsHa: 9.8,
        qualityClass: 'Toiduvili (I)',
        notes: 'Väga kõrge saagipotentsiaaliga lühikõrreline toidunisu.'
      },
      {
        id: 'var-rotax',
        cropId: 'crop-talinisu',
        name: 'Rotax',
        breeder: 'KWS',
        maturityDays: 'Keskvalmiv',
        winterHardiness: 'Hea',
        recommendedSeedRateKgHa: 225,
        potentialYieldTonsHa: 9.0,
        qualityClass: 'Sööda-/Toiduvili',
        notes: 'Vastupidav lehehaigustele, tugev kõrs.'
      },
      {
        id: 'var-kws-spencer',
        cropId: 'crop-talinisu',
        name: 'KWS Spencer',
        breeder: 'KWS',
        maturityDays: 'Varajane',
        winterHardiness: 'Väga hea',
        recommendedSeedRateKgHa: 230,
        potentialYieldTonsHa: 9.2,
        qualityClass: 'Toiduvili (I)',
        notes: 'Uus varajane sort, sobib hästi varaseks koristuseks enne talirapsi külvi.'
      },
      {
        id: 'var-emil',
        cropId: 'crop-talinisu',
        name: 'Emil',
        breeder: 'Lantmännen SW',
        maturityDays: 'Hilissügisene',
        winterHardiness: 'Väga hea',
        recommendedSeedRateKgHa: 200,
        potentialYieldTonsHa: 8.8,
        qualityClass: 'Toiduvili (E)',
        notes: 'Kõrge proteiinisisaldus ja mahukaal.'
      }
    ]
  },
  {
    id: 'crop-suvioder',
    name: 'Suvioder',
    scientificName: 'Hordeum vulgare',
    group: 'CEREAL',
    color: '#d97706',
    icon: '🌾',
    priaCode: 'SOD',
    defaultSeedRateKgHa: 200,
    defaultYieldTonsHa: 6.0,
    description: 'Sööda- ja pruulioder, lühike kasvuea pikkus ja hea põuataluvus.',
    varieties: [
      {
        id: 'var-planet',
        cropId: 'crop-suvioder',
        name: 'Planet (RGT)',
        breeder: 'RAGT',
        maturityDays: 'Keskvalmiv (95 päeva)',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 195,
        potentialYieldTonsHa: 8.5,
        qualityClass: 'Õlleoder / Sööt',
        notes: 'Euroopa tuntuim ja saagikaim õlleodrasort.'
      },
      {
        id: 'var-flair',
        cropId: 'crop-suvioder',
        name: 'Flair',
        breeder: 'Secobra',
        maturityDays: 'Varajane (88 päeva)',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 200,
        potentialYieldTonsHa: 7.8,
        qualityClass: 'Söödavili',
        notes: 'Varajane valmimine, sobib jahedamatele muldadele.'
      },
      {
        id: 'var-laureate',
        cropId: 'crop-suvioder',
        name: 'Laureate',
        breeder: 'Syngenta',
        maturityDays: 'Keskvalmiv',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 205,
        potentialYieldTonsHa: 8.2,
        qualityClass: 'Õlleoder',
        notes: 'Kõrge ekstraktiivsus ja madal valgusisaldus linnaseks.'
      },
      {
        id: 'var-kws-irina',
        cropId: 'crop-suvioder',
        name: 'KWS Irina',
        breeder: 'KWS',
        maturityDays: 'Keskvalmiv',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 200,
        potentialYieldTonsHa: 8.0,
        qualityClass: 'Õlleoder / Sööt',
        notes: 'Tugeva kõrrega, lamandumiskindel.'
      }
    ]
  },
  {
    id: 'crop-taliraps',
    name: 'Taliraps',
    scientificName: 'Brassica napus',
    group: 'OILSEED',
    color: '#10b981',
    icon: '🌼',
    priaCode: 'TRS',
    defaultSeedRateKgHa: 3.2,
    defaultYieldTonsHa: 4.2,
    description: 'Väärtuslik õlikultuur ja külvikorra parandaja sügava juurestikuga.',
    varieties: [
      {
        id: 'var-mercedes',
        cropId: 'crop-taliraps',
        name: 'Mercedes',
        breeder: 'NPZ / Saaten-Union',
        maturityDays: 'Keskvalmiv hübriid',
        winterHardiness: 'Väga hea',
        recommendedSeedRateKgHa: 3.0,
        potentialYieldTonsHa: 5.5,
        qualityClass: 'Õlisisaldus >48%',
        notes: 'Eesti põldudel end tõestanud legend, erakordselt talvekindel.'
      },
      {
        id: 'var-lg-architect',
        cropId: 'crop-taliraps',
        name: 'LG Architect',
        breeder: 'Limagrain',
        maturityDays: 'Keskvalmiv hübriid',
        winterHardiness: 'Väga hea',
        recommendedSeedRateKgHa: 3.2,
        potentialYieldTonsHa: 5.8,
        qualityClass: 'Õlisisaldus >49%',
        notes: 'Kaunade avanemiskindel ja naeri-kollaviiruse (TuYV) resistentne.'
      },
      {
        id: 'var-duke',
        cropId: 'crop-taliraps',
        name: 'Duke',
        breeder: 'Rapool',
        maturityDays: 'Varajane hübriid',
        winterHardiness: 'Hea',
        recommendedSeedRateKgHa: 3.5,
        potentialYieldTonsHa: 5.2,
        qualityClass: 'Õlisisaldus >47%',
        notes: 'Kiire sügisene areng, sobib hilisemaks külviks.'
      }
    ]
  },
  {
    id: 'crop-poldhernes',
    name: 'Põldhernes',
    scientificName: 'Pisum sativum',
    group: 'LEGUME',
    color: '#84cc16',
    icon: '🌱',
    priaCode: 'HRP',
    defaultSeedRateKgHa: 260,
    defaultYieldTonsHa: 4.5,
    description: 'Proteiinirikas liblikõieline, seob mullas õhulämmastikku.',
    varieties: [
      {
        id: 'var-astronaute',
        cropId: 'crop-poldhernes',
        name: 'Astronaute',
        breeder: 'NPZ',
        maturityDays: 'Keskvalmiv (90-95 päeva)',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 260,
        potentialYieldTonsHa: 6.0,
        qualityClass: 'Kollane toiduhernes',
        notes: 'Kõrge saagikus ja väga hea lamandumiskindlus koristusel.'
      },
      {
        id: 'var-ingrid',
        cropId: 'crop-poldhernes',
        name: 'Ingrid',
        breeder: 'Lantmännen SW',
        maturityDays: 'Varajane',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 270,
        potentialYieldTonsHa: 5.4,
        qualityClass: 'Sööda-/Toiduhernes',
        notes: 'Kiire algareng ja ühtlane valmimine.'
      }
    ]
  },
  {
    id: 'crop-polduba',
    name: 'Põlduba',
    scientificName: 'Vicia faba',
    group: 'LEGUME',
    color: '#06b6d4',
    icon: '🌱',
    priaCode: 'UBA',
    defaultSeedRateKgHa: 240,
    defaultYieldTonsHa: 4.2,
    description: 'Kõrge valgusisaldusega kaunvili, nõuab viljakat ja niiskemat mulda.',
    varieties: [
      {
        id: 'var-tiffany',
        cropId: 'crop-polduba',
        name: 'Tiffany',
        breeder: 'NPZ',
        maturityDays: 'Keskvalmiv (110 päeva)',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 240,
        potentialYieldTonsHa: 5.8,
        qualityClass: 'Madala vitsiini/konvitsiiniga',
        notes: 'Sobib hästi monogastriliste loomade söödaks ja toiduks.'
      },
      {
        id: 'var-louhi',
        cropId: 'crop-polduba',
        name: 'Louhi',
        breeder: 'Boreal',
        maturityDays: 'Varajane',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 250,
        potentialYieldTonsHa: 5.0,
        qualityClass: 'Söödavili',
        notes: 'Põhjamaine varajane sort, jõuab kindlalt valmida.'
      }
    ]
  },
  {
    id: 'crop-kaer',
    name: 'Kaer',
    scientificName: 'Avena sativa',
    group: 'CEREAL',
    color: '#f59e0b',
    icon: '🌾',
    priaCode: 'KAER',
    defaultSeedRateKgHa: 180,
    defaultYieldTonsHa: 5.5,
    description: 'Vähenõudlik teravili, sobib kergematele ja happelisematele muldadele.',
    varieties: [
      {
        id: 'var-symphony',
        cropId: 'crop-kaer',
        name: 'Symphony',
        breeder: 'Nordsaat',
        maturityDays: 'Keskvalmiv',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 180,
        potentialYieldTonsHa: 7.2,
        qualityClass: 'Toidukaer (helvesteks)',
        notes: 'Suur tera, madal kestasus ja kõrge mahukaal.'
      },
      {
        id: 'var-meeri',
        cropId: 'crop-kaer',
        name: 'Meeri',
        breeder: 'ETKI (Jõgeva)',
        maturityDays: 'Keskvalmiv',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 190,
        potentialYieldTonsHa: 6.5,
        qualityClass: 'Toidu- ja söödakaer',
        notes: 'Eesti kohalik vastupidav sort.'
      }
    ]
  },
  {
    id: 'crop-rukis',
    name: 'Rukis',
    scientificName: 'Secale cereale',
    group: 'CEREAL',
    color: '#a16207',
    icon: '🌾',
    priaCode: 'RUK',
    defaultSeedRateKgHa: 85,
    defaultYieldTonsHa: 7.0,
    description: 'Talirukis on parima talvekindlusega teravili leivaviljaks.',
    varieties: [
      {
        id: 'var-kws-bono',
        cropId: 'crop-rukis',
        name: 'KWS Bono',
        breeder: 'KWS',
        maturityDays: 'Hübriidrukis',
        winterHardiness: 'Väga hea',
        recommendedSeedRateKgHa: 80,
        potentialYieldTonsHa: 9.5,
        qualityClass: 'Leivavili',
        notes: 'Väga kõrge saagikus ja stabiilne langemisarv.'
      },
      {
        id: 'var-kws-serafino',
        cropId: 'crop-rukis',
        name: 'KWS Serafino',
        breeder: 'KWS',
        maturityDays: 'Hübriidrukis',
        winterHardiness: 'Väga hea',
        recommendedSeedRateKgHa: 85,
        potentialYieldTonsHa: 9.8,
        qualityClass: 'Leivavili / Piiritus',
        notes: 'Suur vastupidavus tungalterale tänu PollenPlus tehnoloogiale.'
      }
    ]
  },
  {
    id: 'crop-mais',
    name: 'Mais (silo)',
    scientificName: 'Zea mays',
    group: 'FORAGE_GRASS',
    color: '#e11d48',
    icon: '🌽',
    priaCode: 'MAIS',
    defaultSeedRateKgHa: 25,
    defaultYieldTonsHa: 38.0,
    description: 'Kõrge energiasisaldusega silokultuur piimakarjale.',
    varieties: [
      {
        id: 'var-pioneer-p7524',
        cropId: 'crop-mais',
        name: 'Pioneer P7524',
        breeder: 'Corteva (Pioneer)',
        maturityDays: 'FAO 170 (Väga varajane)',
        winterHardiness: 'Kevadine',
        recommendedSeedRateKgHa: 25,
        potentialYieldTonsHa: 45.0,
        qualityClass: 'Kõrge tärklisega silo',
        notes: 'Eesti oludesse ideaalselt sobiv varajane hübriid.'
      }
    ]
  },
  {
    id: 'crop-ristik',
    name: 'Punane ristik / Rohumaa',
    scientificName: 'Trifolium pratense',
    group: 'FORAGE_GRASS',
    color: '#22c55e',
    icon: '☘️',
    priaCode: 'RST',
    defaultSeedRateKgHa: 14,
    defaultYieldTonsHa: 22.0,
    description: 'Mitmeaastane söödakultuur, liblikõielise ja kõrreliste segu.',
    varieties: [
      {
        id: 'var-ilte',
        cropId: 'crop-ristik',
        name: 'Ilte',
        breeder: 'ETKI (Jõgeva)',
        maturityDays: 'Hiline tetraploidne',
        winterHardiness: 'Väga hea',
        recommendedSeedRateKgHa: 12,
        potentialYieldTonsHa: 28.0,
        qualityClass: 'Kvaliteetsilo',
        notes: 'Vastupidav talvistele seenhaigustele ja põuale.'
      },
      {
        id: 'var-varte',
        cropId: 'crop-ristik',
        name: 'Varte',
        breeder: 'ETKI',
        maturityDays: 'Varajane diploidne',
        winterHardiness: 'Hea',
        recommendedSeedRateKgHa: 14,
        potentialYieldTonsHa: 24.0,
        qualityClass: 'Silo / Haljasmass',
        notes: 'Annab tugeva esimese niite.'
      }
    ]
  },
  {
    id: 'crop-mustkesa',
    name: 'Mustkesa',
    scientificName: '',
    group: 'FALLOW',
    color: '#64748b',
    icon: '🍂',
    priaCode: 'KESA',
    defaultSeedRateKgHa: 0,
    defaultYieldTonsHa: 0,
    description: 'Taimkatteta haritav maa umbrohutõrjeks ja mulla ettevalmistamiseks.',
    varieties: []
  }
];

/**
 * Abifunktsioon: eraldab vanast liitsõnast "Talinisu (Skagen)" puhta kultuuri ja sordi.
 */
export function extractCropAndVariety(inputCropString: string): { crop: string; variety: string } {
  if (!inputCropString) {
    return { crop: 'Talinisu', variety: 'Skagen' };
  }

  // Regex otsib nt "Talinisu (Skagen)" või "Suvioder (Planet)"
  const match = inputCropString.match(/^([^(]+)(?:\(([^)]+)\))?$/);
  if (match) {
    const cropName = match[1].trim();
    const varietyName = match[2] ? match[2].trim() : '';
    return {
      crop: cropName,
      variety: varietyName
    };
  }

  return { crop: inputCropString.trim(), variety: '' };
}
