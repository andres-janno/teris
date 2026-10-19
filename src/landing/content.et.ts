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
  hero: { headline: string; lead: string; cta: string; previewTitle: string; imageAlt: string; image: string };
  featuresTitle: string;
  features: { id: string; title: string; text: string }[];
  audienceTitle: string;
  audience: { title: string; text: string }[];
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
  name: 'Teris',
  title: 'Teris — teraviljakasvataja põllud, masinad ja põlluraamat ühel kaardil',
  description:
    'Teris on Eesti teraviljakasvatajale mõeldud veebirakendus: PRIA põllud ja külvikord, masinapargi GPS-telemeetria, põllutööde planeerimine, põlluraamat, mullaproovid, ilmaradar ja satelliidipildid ühes kohas.',
  ogImage: '/og-teris.png',
  organization: { name: 'VentCap OÜ', email: 'info@teris.ee' },
  nav: { features: 'Võimalused', audience: 'Kellele', faq: 'KKK', login: 'Logi sisse', cta: 'Tunnen huvi' },
  hero: {
    headline: 'Põllud, masinad ja põlluraamat ühel kaardil',
    lead: 'Teris koondab teraviljakasvataja igapäevase info — PRIA põllud, külvikorra, masinate liikumise ja tehtud tööd — ühte veebirakendusse, mis töötab kontoris ja põllul.',
    cta: 'Tunnen huvi',
    previewTitle: 'Selline näeb Teris välja',
    imageAlt: 'Terise kaardivaade: põllud Maa-ameti aluskaardil, külvikord värvidega ja masinate asukohad',
    image: '/landing/hero.svg'
  },
  featuresTitle: 'Mida Teris teeb',
  features: [
    { id: 'fields', title: 'PRIA põllud ja külvikord', text: 'Impordi põllud PRIA SHP-failist, vaata külvikorda hooaegade kaupa ja põlluplokke Maa-ameti aluskaartidel.' },
    { id: 'fleet', title: 'Masinapark ja GPS-telemeetria', text: 'Traktorite ja haakeriistade asukoht ning liikumise ajalugu kaardil telemeetriaseadmete abil, harimise jäljed põllu kaupa.' },
    { id: 'field-works', title: 'Põllutööde tahvel', text: 'Planeeri tööd kultuuri ja töömallide järgi, märgi tehtud tööd ja näe, mis on igal põllul veel tegemata.' },
    { id: 'field-book', title: 'Põlluraamat', text: 'Impordi olemasolev põlluraamat ja pea tööde, väetiste ja taimekaitse arvestust ühes kohas.' },
    { id: 'soil', title: 'Mullaproovid', text: 'Laadi üles mullaproovide tulemused ja vaata neid põllu juures.' },
    { id: 'satellite', title: 'Satelliidipildid ja NDVI', text: 'Sentinel-2 satelliidipiltide põhjal taimiku seisund (NDVI) põllu kaupa, pilvisuse kontrolliga.' },
    { id: 'weather', title: 'Ilmaradar', text: 'Sademete radar otse põllukaardil, et tööd paremini ajastada.' },
    { id: 'team', title: 'Meeskond ja partnerid', text: 'Mitu kasutajat rollidega, seotud isikute register ning ajutine ainult lugemiseks ligipääs nõustajale.' }
  ],
  audienceTitle: 'Kellele',
  audience: [
    { title: 'Teraviljakasvatajad', text: 'Väikesest pereettevõttest suure tootjani — kõik põllud, masinad ja tööd ühes vaates.' },
    { title: 'Nõustajad ja teenusepakkujad', text: 'Kliendi loal ajutine ligipääs tema andmetele, ilma paroole jagamata.' }
  ],
  stepsTitle: 'Kuidas alustada',
  steps: [
    { title: 'Anna teada', text: 'Täida „Tunnen huvi“ vorm — see ei kohusta sind millekski.' },
    { title: 'Seadistame koos', text: 'Loome sinu ettevõtte keskkonna ja impordime põllud PRIA andmetest.' },
    { title: 'Alusta', text: 'Logi sisse ja kutsu meeskond — Teris töötab brauseris, eraldi programmi pole vaja paigaldada.' }
  ],
  faqTitle: 'Korduma kippuvad küsimused',
  faq: [
    { q: 'Kus minu andmeid hoitakse?', a: 'Andmed asuvad Eestis asuvas serveris. Iga ettevõtte andmed on teistest eraldatud ning teised ettevõtted neid ei näe.' },
    { q: 'Kas teenusepakkuja näeb minu andmeid?', a: 'Ainult siis, kui sinu ettevõtte admin annab selleks ajutise loa. Ligipääs on ainult lugemiseks ja iga sisenemine on sulle nähtav.' },
    { q: 'Kuidas põllud Terisesse saavad?', a: 'Põllud imporditakse PRIA põllumassiivide SHP-failist. Hiljem saab põlde ka käsitsi muuta.' },
    { q: 'Milliseid masinaid saab jälgida?', a: 'Masinaid jälgitakse neile paigaldatud telemeetriaseadmete abil — nii traktoreid kui haakeriistu. Küsi meilt, kas sinu seade sobib või milline seade valida.' },
    { q: 'Kas Teris töötab telefonis?', a: 'Teris on veebirakendus ja avaneb brauseris nii arvutis, tahvlis kui telefonis.' },
    { q: 'Mis Teris maksab?', a: 'Hind sõltub ettevõtte suurusest ja vajalikest moodulitest. Anna „Tunnen huvi“ vormiga teada ja räägime läbi.' }
  ],
  interest: {
    title: 'Anna teada, kui Teris sind huvitab — võtame ühendust',
    lead: 'Kohustusteta. Räägime läbi, mida su ettevõte vajab, ja näitame Terist sinu põldude peal.',
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
          'Vormi kaudu saadetud andmeid (nimi, e-post ning soovi korral ettevõte, telefon, põllupind ja sõnum) kasutame ainult sinuga ühenduse võtmiseks ja Terise tutvustamiseks. Õiguslik alus on sinu päringule vastamine.',
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
