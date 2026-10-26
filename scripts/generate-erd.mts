// scripts/generate-erd.mts — andmemudeli dokumentatsioon (Mermaid ER-skeemid) Prisma skeemist.
// Käivitus: npx tsx scripts/generate-erd.mts  → kirjutab docs/andmemudel.md
// Skeemid jagatakse valdkondade kaupa; teise valdkonna tabel kuvatakse viitena (ainult võti).
import { writeFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';

type Model = (typeof Prisma.dmmf.datamodel.models)[number];
type Field = Model['fields'][number];

const models = Prisma.dmmf.datamodel.models;
const byName = new Map(models.map((m) => [m.name, m]));
const tableName = (m: Model) => m.dbName ?? m.name;

interface Domain {
  title: string;
  intro: string;
  models: string[];
  notes?: string[];
}

const DOMAINS: Domain[] = [
  {
    title: 'Põllud, hooajad ja kultuurid',
    intro: 'Põld on püsiv kirje; iga hooaja andmed (pindala, kultuur, piir, saak) on eraldi hooaja põllu kirjes. Katastriüksused seotakse hooaja põlluga koos omandi ja kuludega.',
    models: ['Season', 'Field', 'FieldSeason', 'CadastralParcel', 'FieldCadastralParcel', 'Crop', 'CropVariety', 'SoilSample'],
    notes: ['Mullaproovid seotakse põlluga massiivi numbri järgi (`fieldCode`) ja kaardil asukoha järgi, mitte võõrvõtmega.']
  },
  {
    title: 'Põllutööd ja kanded',
    intro: 'Töö on hooaja põllu planeeritud tegevus (PRIA tegevus), plaaniread on planeeritud materjalid normiga. Kanne on tegelikult tehtud töö osa; kande read on tööaeg, masin, kütus, materjalid, saak ja seire leiud.',
    models: ['WorkType', 'FieldWork', 'FieldWorkLine', 'WorkEntry', 'WorkEntryLine', 'Material', 'WorkTemplate', 'WorkTemplateItem'],
    notes: [
      'Töötüübid = PRIA e-põlluraamatu 29 tegevust (`priaCode`); `shortName` on ettevõtte lühinimi.',
      '`WorkTemplate` ja `WorkTemplateItem` (tööde mallid) on andmebaasis alles, aga rakendus neid enam ei kasuta.'
    ]
  },
  {
    title: 'Masinapark, telemeetria ja objektid',
    intro: 'Masinad, haakeriistad ja telemeetriaseadmed. Seadme omand (ettevõttele kuulumise periood) ja paigaldus masinale/haakeriistale on ajaliste kirjetena; telemeetria mõõtmised ise on eraldi telemeetria andmebaasis.',
    models: ['Vehicle', 'Implement', 'TelemetryDevice', 'DeviceOwnership', 'DeviceAssignment', 'ImplementAssignment', 'PointOfInterest'],
    notes: ['Telemeetria (GPS, süüde, kiirus jm) on eraldi TimescaleDB andmebaasis (`measurements`), seotud seadme IMEI kaudu.']
  },
  {
    title: 'Isikud, kasutajad ja tugi',
    intro: 'Seotud isikud (töötajad, omanikud, operaatorid, partnerid) ja rakenduse kasutajad. Tugiligipääs lubab teenusepakkujal ettevõtte andmeid ajutiselt vaadata.',
    models: ['RelatedParty', 'User', 'Session', 'PasswordToken', 'SupportGrant', 'SupportAccessLog']
  },
  {
    title: 'Platvorm (teenusepakkuja)',
    intro: 'Ettevõtted, litsentsid, platvormi kasutajad, algkataloog uue ettevõtte jaoks, abiartiklid ja landing-lehe andmed. Need tabelid ei ole ettevõttepõhised.',
    models: ['Tenant', 'TenantLicense', 'PlatformUser', 'PlatformSession', 'PlatformAuditLog', 'SupportSession', 'HelpArticle', 'CatalogCrop', 'CatalogCropVariety', 'CatalogWorkType', 'CatalogWorkTemplate', 'CatalogWorkTemplateItem', 'LandingEvent', 'InterestRequest']
  }
];

// Tabelite lühikirjeldused (Prismas pole /// kommentaare)
const DESCRIPTIONS: Record<string, string> = {
  Season: 'Hooaeg (aasta); lukustatud hooaja andmeid ei muudeta',
  Field: 'Põld (püsiv): PRIA põllu nr, massiiv, nimi, operaator',
  FieldSeason: 'Põllu hooaja andmed: pindala, kultuur, sort, piir (GeoJSON), saak, staatus',
  CadastralParcel: 'Katastriüksus (tunnus, nimi)',
  FieldCadastralParcel: 'Hooaja põllu ja katastriüksuse seos: põllu osa pindala, omand/rent, maamaks, rent',
  Crop: 'Kultuur (ettevõtte register; PRIA kood, talivili, värv)',
  CropVariety: 'Sort kultuuri all',
  SoilSample: 'Mullaproov (pH, P, K, Ca, Mg, Corg; asukoht)',
  WorkType: 'Töötüüp = PRIA tegevus (29), faas, lühinimi',
  FieldWork: 'Töö (plaan) hooaja põllul: kuupäevad, pindala, viis, teostaja, staatus, allikas',
  FieldWorkLine: 'Töö plaanirida: planeeritud materjal (norm/ha, PRIA atribuudid) või saak',
  WorkEntry: 'Kanne = tehtud töö osa: kuupäev, töötaja, masin, haakeriist, tunnid, kütus, pindala, finantsi olek',
  WorkEntryLine: 'Kande rida: tööaeg, masin, haakeriist, kütus, materjal, saak, seire leid (kogus, ühik, hind)',
  Material: 'Kulumaterjal (seeme, väetis, taimekaitsevahend, muu)',
  WorkTemplate: 'Tööde mall (kasutuseta)',
  WorkTemplateItem: 'Tööde malli rida (kasutuseta)',
  Vehicle: 'Masin (traktor, kombain jm): andmed, amortisatsioon, viimane asukoht, juht',
  Implement: 'Haakeriist (laius, tüüp)',
  TelemetryDevice: 'Telemeetriaseade (IMEI vms)',
  DeviceOwnership: 'Seadme kuulumine ettevõttele ajavahemikus',
  DeviceAssignment: 'Seadme paigaldus masinale/haakeriistale ajavahemikus',
  ImplementAssignment: 'Haakeriista ühendus masinaga ajavahemikus',
  PointOfInterest: 'Objekt (kuivati, ladu, töökoda jm): asukoht, raadius, kontakt',
  RelatedParty: 'Seotud isik/ettevõte: töötaja, omanik, operaator, partner',
  User: 'Rakenduse kasutaja (ettevõtte), rollid',
  Session: 'Kasutaja sessioon',
  PasswordToken: 'Parooli seadmise / kutse token',
  SupportGrant: 'Ettevõtte antud tugiligipääs teenusepakkujale',
  SupportAccessLog: 'Tugiligipääsu logi',
  Tenant: 'Ettevõte (klient)',
  TenantLicense: 'Ettevõtte litsents ja moodulid',
  PlatformUser: 'Teenusepakkuja (admin.teris.ee) kasutaja',
  PlatformSession: 'Platvormi kasutaja sessioon',
  PlatformAuditLog: 'Platvormi tegevuste logi',
  SupportSession: 'Tugiligipääsu sessioon',
  HelpArticle: 'Abiartikkel (kasutusjuhend)',
  CatalogCrop: 'Algkataloogi kultuur (kopeeritakse uuele ettevõttele)',
  CatalogCropVariety: 'Algkataloogi sort',
  CatalogWorkType: 'Algkataloogi töötüüp (PRIA tegevus)',
  CatalogWorkTemplate: 'Algkataloogi mall (kasutuseta)',
  CatalogWorkTemplateItem: 'Algkataloogi malli rida (kasutuseta)',
  LandingEvent: 'Landing-lehe külastuse sündmus',
  InterestRequest: 'Landing-lehe huvipäring'
};

const covered = new Set(DOMAINS.flatMap((d) => d.models));
const missing = models.filter((m) => !covered.has(m.name)).map((m) => m.name);
if (missing.length) throw new Error(`Valdkonnata mudelid: ${missing.join(', ')}`);

const isTenantModel = (m: Model) => m.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar');
const fkFields = (m: Model) => new Set(m.fields.flatMap((f) => (f.kind === 'object' ? f.relationFromFields ?? [] : [])));
const mermaidType = (f: Field) => (f.kind === 'enum' ? f.type : f.type).replace(/[^A-Za-z0-9_]/g, '');

function attributes(m: Model, keysOnly: boolean): string[] {
  const fks = fkFields(m);
  return m.fields
    .filter((f) => f.kind !== 'object')
    .filter((f) => f.name !== 'tenantId' && f.name !== 'createdBy' && f.name !== 'updatedBy')
    .filter((f) => !keysOnly || f.isId || fks.has(f.name))
    .map((f) => {
      const keys = [f.isId ? 'PK' : null, fks.has(f.name) ? 'FK' : null, f.isUnique ? 'UK' : null].filter(Boolean).join(',');
      // Mermaid ei luba nimes "?"; valikuline väli märgitakse kommentaariga
      const comment = f.isRequired ? '' : ' "valikuline"';
      return `    ${mermaidType(f)}${f.isList ? '[]' : ''} ${f.name}${keys ? ` ${keys}` : ''}${comment}`;
    });
}

// Seos mudeli A väljast (võõrvõti A-s) mudelisse B
interface Rel { from: string; to: string; label: string; optional: boolean; list: boolean }
function relationsOf(m: Model): Rel[] {
  const out: Rel[] = [];
  for (const f of m.fields) {
    if (f.kind !== 'object' || !f.relationFromFields?.length) continue;
    const target = byName.get(f.type)!;
    const back = target.fields.find((x) => x.kind === 'object' && x.relationName === f.relationName && x.type === m.name);
    out.push({ from: m.name, to: target.name, label: f.name, optional: !f.isRequired, list: back?.isList ?? true });
  }
  return out;
}

// Mermaid: B (üks) ||--o{ A (mitu); valikuline võõrvõti → |o
const relLine = (r: Rel) => `  ${r.to} ${r.optional ? '|o' : '||'}--${r.list ? 'o{' : 'o|'} ${r.from} : "${r.label}"`;

function domainDiagram(d: Domain): string {
  const inDomain = new Set(d.models);
  const rels = d.models.flatMap((n) => relationsOf(byName.get(n)!));
  // Teise valdkonna tabelid, millele selle valdkonna tabelid viitavad (või mis viitavad siia)
  const incoming = models.filter((m) => !inDomain.has(m.name)).flatMap(relationsOf).filter((r) => inDomain.has(r.to));
  const refs = new Set([...rels.map((r) => r.to), ...incoming.map((r) => r.from)].filter((n) => !inDomain.has(n)));
  const lines = ['```mermaid', 'erDiagram'];
  for (const n of d.models) {
    const m = byName.get(n)!;
    lines.push(`  ${n} {`, ...attributes(m, false), '  }');
  }
  for (const n of refs) {
    const m = byName.get(n)!;
    lines.push(`  ${n} {`, ...attributes(m, true), '  }');
  }
  for (const r of [...rels, ...incoming]) lines.push(relLine(r));
  lines.push('```');
  return lines.join('\n');
}

function overview(): string {
  const lines = ['```mermaid', 'erDiagram'];
  for (const m of models) for (const r of relationsOf(m)) lines.push(relLine(r));
  lines.push('```');
  return lines.join('\n');
}

function tableIndex(d: Domain): string {
  const rows = d.models.map((n) => {
    const m = byName.get(n)!;
    return `| \`${n}\` | \`${tableName(m)}\` | ${isTenantModel(m) ? 'jah' : '–'} | ${DESCRIPTIONS[n] ?? m.documentation?.replace(/\n/g, ' ') ?? ''} |`;
  });
  return ['| Mudel | Tabel | Ettevõttepõhine | Sisu |', '|---|---|---|---|', ...rows].join('\n');
}

const enumsUsed = Prisma.dmmf.datamodel.enums
  .map((e) => `| \`${e.name}\` | ${e.values.map((v) => `\`${v.name}\``).join(', ')} |`)
  .join('\n');

const doc = [
  '# Andmemudel (ERD)',
  '',
  `Genereeritud skriptiga \`scripts/generate-erd.mts\` failist \`prisma/schema.prisma\` (${new Date().toISOString().slice(0, 10)}). Ära muuda käsitsi — käivita \`npx tsx scripts/generate-erd.mts\` pärast skeemimuudatust.`,
  '',
  'Millised vaated ja komponendid neid tabeleid loevad ja muudavad, vaata [vaated-ja-andmed.md](vaated-ja-andmed.md).',
  '',
  '**Lugemisjuhend**',
  '- `PK` primaarvõti, `FK` võõrvõti, `UK` unikaalne; kommentaar \"valikuline\" tähendab, et väli võib olla tühi.',
  '- Seose sümbolid: `||` täpselt üks, `|o` null või üks, `o{` null või mitu. Seose nimi on võõrvõtme välja nimi.',
  '- Iga ettevõttepõhise tabeli veerg `tenant_id` (ettevõte, Postgres RLS) ning auditiveerud `createdBy`/`updatedBy` on skeemidelt välja jäetud.',
  '- Valdkonna skeemis on teise valdkonna tabelid kuvatud ainult võtmetega.',
  '',
  '## Sisukord',
  ...DOMAINS.map((d, i) => `${i + 1}. [${d.title}](#${d.title.toLowerCase().replace(/[^a-zõäöüšž0-9 ]/g, '').trim().replace(/ +/g, '-')})`),
  `${DOMAINS.length + 1}. [Kõik seosed (ülevaade)](#kõik-seosed-ülevaade)`,
  `${DOMAINS.length + 2}. [Loendid (enum)](#loendid-enum)`,
  '',
  ...DOMAINS.flatMap((d) => [
    `## ${d.title}`,
    '',
    d.intro,
    '',
    tableIndex(d),
    '',
    ...(d.notes?.length ? [...d.notes.map((n) => `- ${n}`), ''] : []),
    domainDiagram(d),
    ''
  ]),
  '## Kõik seosed (ülevaade)',
  '',
  'Kõik tabelid ja nende seosed ühel skeemil (ilma veergudeta).',
  '',
  overview(),
  '',
  '## Loendid (enum)',
  '',
  '| Loend | Väärtused |',
  '|---|---|',
  enumsUsed,
  ''
].join('\n');

writeFileSync('docs/andmemudel.md', doc);
console.log(`docs/andmemudel.md: ${models.length} mudelit, ${DOMAINS.length} valdkonda`);
