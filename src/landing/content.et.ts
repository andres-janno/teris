// src/landing/content.et.ts — landing'u ja privaatsuslehe kogu tekst (eesti keel).
// HTML, JSON-LD (FAQPage) ja llms.txt genereeritakse sellest, et need ei läheks lahku.
import { COPYRIGHT_TEXT } from '../copyright.ts';

export const CTA_TARGETS = ['header', 'header-login', 'hero', 'steps', 'footer'] as const;
export type CtaTarget = (typeof CTA_TARGETS)[number];

export interface LandingContent {
  lang: 'et';
  siteUrl: string;
  name: string;
  title: string;
  description: string;
  ogImage: string;
  organization: { name: string; email: string };
  nav: { features: string; audience: string; faq: string; login: string; cta: string };
  hero: { headline: string; lead: string; cta: string };
  // Valikuline: rakenduse eelvaate pilt hero all (puudumisel sektsiooni ei näidata)
  preview?: { title: string; imageAlt: string; image: string };
  featuresTitle: string;
  features: { id: string; title: string; text: string }[];
  // Valikuline: „Kellele“ sektsioon (puudumisel sektsiooni ega menüülinki ei näidata)
  audience?: { title: string; items: { title: string; text: string }[] };
  stepsTitle: string;
  steps: { title: string; text: string }[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  interest: {
    title: string;
    lead: string;
    labels: { name: string; email: string; company: string; phone: string; areaHa: string; message: string };
    submit: string;
    sending: string;
    privacyNote: string;
    success: string;
    error: string;
  };
  footer: { copyright: string; privacy: string };
  privacy: { title: string; updated: string; sections: { title: string; paragraphs: string[] }[] };
}

export const CONTENT_ET: LandingContent = {
  lang: 'et',
  siteUrl: 'https://teris.ee',
  name: 'TERIS',
  title: 'TERIS — põllumajanduse infosüsteem',
  description:
    'TERIS on põllumajanduse info haldamiseks mõeldud veebirakendus.',
  ogImage: '/og-teris.png',
  organization: { name: 'VentCap OÜ', email: 'info@teris.ee' },
  nav: { features: 'Võimalused', audience: 'Kellele', faq: 'KKK', login: 'Logi sisse', cta: 'Tunnen huvi' },
  hero: {
    headline: 'Põllumajanduse infosüsteem',
    lead: 'TERIS koondab põllumajanduse igapäevase info ühte veebirakendusse. Rakenduse keskseks ankruks on erinevate kihtidega kaart.',
    cta: 'Tunnen huvi'
  },
  featuresTitle: 'Mida TERIS teeb',
  features: [
    { id: 'fields', title: 'Põllud ja külvikord', text: 'Impordi põllud PRIA shp-failist, vaata külvikorda hooaegade kaupa ja põllumasiive Maa-ameti aluskaartidel.' },
    { id: 'fleet', title: 'Tehnika ja telemeetria', text: 'Tehnika ja haakeriistade asukoht ning liikumise/kasutamise jälgimine ja ajalugu.' },
    { id: 'field-works', title: 'Põllutööde tahvel', text: 'Planeeri tööd kultuuri ja mallide järgi, märgi tehtud tööd ja näe, mis on igal põllul veel tegemata.' },
    { id: 'field-book', title: 'Kuluarvestus', text: 'Pea kuluarvestust tööde, väetiste ja taimekaitse üle ühes kohas.' },
    { id: 'soil', title: 'Mullaproovid', text: 'Laadi üles mullaproovide tulemused METK mullaportaali shp-failist ja vaata tulemusi otse põldudel.' },
    { id: 'satellite', title: 'Satelliidipildid ja NDVI', text: 'Sentinel-2 satelliidipiltide põhjal taimiku seisund (NDVI) põllu kaupa, pilvisuse kontrolliga.' },
    { id: 'weather', title: 'Ilmaradar', text: 'Sademete radar sinu põldudest lähtudes, et töid paremini ajastada.' },
    { id: 'team', title: 'Peakasutaja ja operaatorid', text: 'Peakasutaja on üks ettevõte, operaatorid aga seotud ettevõtted. Rollipõhised kasutajakontod.' }
  ],
  stepsTitle: 'Kuidas alustada',
  steps: [
    { title: 'Anna teada', text: 'Täida „Tunnen huvi“ vorm — see ei kohusta sind millekski.' },
    { title: 'Seadistame koos', text: 'Loome sinu ettevõtte keskkonna ja impordime põllud PRIA andmetest.' },
    { title: 'Alusta', text: 'Logi sisse ja alusta — TERIS töötab brauseris, eraldi programmi pole vaja paigaldada.' }
  ],
  faqTitle: 'Korduma kippuvad küsimused',
  faq: [
    { q: 'Kuidas andmed TERIS-esse saavad?', a: 'Andmed imporditakse nii palju kui võimalik välistest registritest, näiteks PRIA põllumassiivide või METK mullaproovide shp-failidest.' },
    { q: 'Kus minu andmeid hoitakse?', a: 'Andmed asuvad Eestis asuvas serveris. Iga ettevõtte andmed on teistest eraldatud ning teised ettevõtted neid ei näe.' },
    { q: 'Kas teenusepakkuja näeb minu andmeid?', a: 'Ainult siis, kui sinu ettevõtte admin annab selleks ajutise loa. Ligipääs on ainult lugemiseks ja iga sisenemine on sulle nähtav.' },
    { q: 'Millist tehnikat saab jälgida?', a: 'Vanemaid masinaid jälgitakse neile lisaks paigaldatud telemeetriaseadmete abil, haakeriistad annavad infot samuti lisaseadmega, aga seda läbi masinale paigaldatud nn peaseadme. Uuema tehnika jälgimiseks on plaan liidestada tootjate portaalid.' },
    { q: 'Mis TERIS maksab?', a: 'Momendil on TERIS veel arendamisel ning tasuta kasutatav kindlates nn testettevõtetes. Anna „Tunnen huvi“ vormiga teada, kui oled ka huvitatud testimisest.' }
  ],
  interest: {
    title: 'Anna teada, kui TERIS sind huvitab — võtame ühendust',
    lead: 'Räägime läbi, mida su ettevõte vajab ja näitame TERIS-t sinu enda põldude peal.',
    labels: { name: 'Nimi', email: 'E-post', company: 'Ettevõte', phone: 'Telefon', areaHa: 'Põllupind (ha)', message: 'Mis sind huvitab?' },
    submit: 'Tunnen huvi',
    sending: 'Saadan…',
    privacyNote: 'Kasutame andmeid ainult sinuga ühenduse võtmiseks.',
    success: 'Aitäh! Võtame peagi ühendust.',
    error: 'Saatmine ebaõnnestus, proovi hiljem uuesti.'
  },
  footer: { copyright: COPYRIGHT_TEXT, privacy: 'Privaatsus' },
  privacy: {
    title: 'Privaatsusteade',
    updated: '19.10.2026',
    sections: [
      { title: 'Vastutav töötleja', paragraphs: ['VentCap OÜ, e-post info@teris.ee.'] },
      {
        title: '„Tunnen huvi“ vorm',
        paragraphs: [
          'Vormi kaudu saadetud andmeid (nimi, e-post ning soovi korral ettevõte, telefon, põllupind ja sõnum) kasutame ainult sinuga ühenduse võtmiseks ja TERIS-e tutvustamiseks. Õiguslik alus on sinu päringule vastamine.',
          'Kui kliendisuhet ei teki, kustutame päringu hiljemalt 24 kuud pärast selle viimast käsitlemist. Päringu teavitus jõuab ka meie e-postkasti; ka see kustutatakse sinu soovil.'
        ]
      },
      {
        title: 'Külastuste statistika',
        paragraphs: [
          'Loendame lehe külastusi oma serveris ilma küpsisteta ja kolmandate osapoolteta. IP-aadresse ei salvestata; unikaalsete külastajate loendamiseks kasutame igapäevaselt vahetuvat räsi, mille abil ei saa sind eri päevadel ära tunda.',
          'Statistikat hoitakse 13 kuud.'
        ]
      },
      {
        title: 'Andmete asukoht',
        paragraphs: ['Andmed asuvad Eestis asuvas serveris ning neid ei edastata kolmandatele osapooltele. Lehe fondid ja pildid laaditakse samuti meie oma serverist.']
      },
      {
        title: 'Sinu õigused',
        paragraphs: [
          'Sul on õigus tutvuda oma andmetega, neid parandada, nõuda nende kustutamist või töötlemise piiramist ning esitada töötlemisele vastuväiteid. Kirjuta selleks info@teris.ee — vastame hiljemalt ühe kuu jooksul.',
          'Kui leiad, et rikume sinu õigusi, võid pöörduda Andmekaitse Inspektsiooni poole (www.aki.ee).'
        ]
      }
    ]
  }
};
