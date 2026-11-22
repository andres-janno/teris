// src/server/mcp/tools/registers.ts — registrid: mullaproovid, seotud isikud, taristu, kultuurid/sordid, artiklid, tööliigid ja mallid.
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { defineTool, canSeeFinance } from '../context.ts';
import { pickOne, fieldLabel, round2, limitRows } from '../format.ts';

const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const });
const limit = z.number().int().min(1).max(1000).optional().describe('Ridade arv (vaikimisi 200)');

export const registerTools = [
  defineTool({
    name: 'list_soil_samples',
    title: 'Mullaproovid',
    description: 'Mullaproovid (pH, P, K, Ca, Mg, Cu, Mn, B, orgaaniline süsinik Corg, lubjatarve t/ha). Seotud põlluga PRIA massiivi numbri (fieldCode) kaudu.',
    input: {
      field: z.string().optional().describe('Põllu nimi või number'),
      year: z.number().int().min(1990).max(2100).optional().describe('Proovivõtu aasta'),
      limit
    },
    run: async (a) => {
      let fieldCode: string | undefined;
      if (a.field) {
        const fields = await prisma.field.findMany({ select: { id: true, num: true, name: true, fieldCode: true } });
        const hit = pickOne('Põld', a.field, fields.map((f) => ({ id: String(f.id), label: fieldLabel(f), keys: [f.num, f.name, f.fieldCode] })));
        fieldCode = fields.find((f) => String(f.id) === hit.id)?.fieldCode;
      }
      const [rows, allFields] = await Promise.all([
        prisma.soilSample.findMany({
          where: { ...(fieldCode ? { fieldCode } : {}), ...(a.year !== undefined ? { year: a.year } : {}) },
          orderBy: [{ year: 'desc' }, { sampleNumber: 'asc' }]
        }),
        prisma.field.findMany({ select: { num: true, name: true, fieldCode: true } })
      ]);
      const fieldsByCode = new Map<string, string[]>();
      for (const f of allFields) {
        const list = fieldsByCode.get(f.fieldCode) ?? [];
        list.push(fieldLabel(f));
        fieldsByCode.set(f.fieldCode, list);
      }
      const out = limitRows(rows, a.limit);
      return {
        total: out.total,
        shown: out.shown,
        rows: out.rows.map((s) => ({
          sampleNumber: s.sampleNumber,
          fieldCode: s.fieldCode,
          fields: fieldsByCode.get(s.fieldCode) ?? [],
          year: s.year,
          ph: round2(s.ph),
          p: round2(s.phosphorus),
          k: round2(s.potassium),
          ca: round2(s.calcium),
          mg: round2(s.magnesium),
          cu: round2(s.copper),
          mn: round2(s.manganese),
          b: round2(s.boron),
          cOrg: round2(s.organicCarbon),
          limeRequirementTHa: round2(s.limeRequirement)
        }))
      };
    }
  }),
  defineTool({
    name: 'list_related_parties',
    title: 'Seotud isikud',
    description: 'Isikud ja partnerid: töötajad (DRIVER), maaomanikud (LANDOWNER), operaatorid (OPERATOR), tarnijad (SUPPLIER), muud (OTHER). Finantsõigusega ka pangakonto ja tunnihind.',
    input: {
      role: z.enum(['LANDOWNER', 'DRIVER', 'OPERATOR', 'SUPPLIER', 'OTHER']).optional().describe('Roll'),
      search: z.string().optional().describe('Nimi või kood (osaline)'),
      limit
    },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const rows = await prisma.relatedParty.findMany({
        where: {
          ...(a.role ? { roles: { has: a.role } } : {}),
          ...(a.search ? { OR: [{ name: ci(a.search) }, { code: ci(a.search) }] } : {})
        },
        orderBy: { name: 'asc' },
        include: { serviceArticle: { select: { name: true } } }
      });
      const out = limitRows(rows, a.limit);
      return {
        total: out.total,
        shown: out.shown,
        rows: out.rows.map((p) => ({
          name: p.name,
          type: p.type,
          roles: p.roles,
          code: p.code,
          vatNumber: p.vatNumber,
          phone: p.phone,
          email: p.email,
          address: p.address,
          serviceArticle: p.serviceArticle?.name ?? null,
          notes: p.notes,
          ...(finance ? {
            bankAccount: p.bankAccount,
            hourlyRate: p.hourlyRate === null ? null : round2(Number(p.hourlyRate))
          } : {})
        }))
      };
    }
  }),
  defineTool({
    name: 'list_points_of_interest',
    title: 'Taristu ja huvipunktid',
    description: 'Ettevõtte objektid ja taristu: kuivatid, laod, tanklad, kaalud, töökojad, veevõtukohad, põllusissesõidud jm.',
    input: {
      category: z.enum(['DRYER', 'WATER_SOURCE', 'WORKSHOP', 'FUEL_STATION', 'FIELD_ENTRANCE', 'STORAGE', 'SCALE', 'OTHER']).optional().describe('Kategooria'),
      search: z.string().optional().describe('Nimi või kirjeldus (osaline)'),
      limit
    },
    run: async (a) => {
      const rows = await prisma.pointOfInterest.findMany({
        where: {
          ...(a.category ? { category: a.category } : {}),
          ...(a.search ? { OR: [{ name: ci(a.search) }, { description: ci(a.search) }] } : {})
        },
        orderBy: { name: 'asc' },
        include: { warehouse: { select: { name: true } } }
      });
      const out = limitRows(rows, a.limit);
      return {
        total: out.total,
        shown: out.shown,
        rows: out.rows.map((p) => ({
          name: p.name,
          category: p.category,
          description: p.description,
          capacity: p.capacity,
          contactPerson: p.contactPerson,
          phone: p.phone,
          accessNotes: p.accessNotes,
          warehouse: p.warehouse?.name ?? null
        }))
      };
    }
  }),
  defineTool({
    name: 'list_crops',
    title: 'Kultuurid ja sordid',
    description: 'Ettevõtte kultuuride ja sortide register: rühm, talivili, GDD baas, vaikenormid, PRIA kood/nimi ning sordid koos aretaja, talvekindluse ja kvaliteediklassiga.',
    input: { search: z.string().optional().describe('Kultuuri või sordi nimi (osaline)') },
    run: async (a) => {
      const rows = await prisma.crop.findMany({
        where: a.search ? { OR: [{ name: ci(a.search) }, { varieties: { some: { name: ci(a.search) } } }] } : {},
        orderBy: { name: 'asc' },
        include: { varieties: { orderBy: { name: 'asc' } } }
      });
      return {
        total: rows.length,
        rows: rows.map((c) => ({
          name: c.name,
          scientificName: c.scientificName,
          group: c.group,
          priaCode: c.priaCode,
          priaName: c.priaName,
          isWinterCrop: c.isWinterCrop,
          gddBaseC: c.gddBaseC,
          defaultSeedRateKgHa: round2(c.defaultSeedRateKgHa),
          defaultYieldTHa: round2(c.defaultYieldTonsHa),
          description: c.description,
          varieties: c.varieties.map((v) => ({
            name: v.name,
            breeder: v.breeder,
            maturityDays: v.maturityDays,
            winterHardiness: v.winterHardiness,
            recommendedSeedRateKgHa: round2(v.recommendedSeedRateKgHa),
            potentialYieldTHa: round2(v.potentialYieldTonsHa),
            qualityClass: v.qualityClass,
            isActive: v.isActive,
            notes: v.notes
          }))
        }))
      };
    }
  }),
  defineTool({
    name: 'list_articles',
    title: 'Artiklite register',
    description: 'Kõik artiklid (kaubad ja teenused, sh 0-laoseisuga): rühm (SERVICE/CONSUMABLE/PRODUCE/OTHER_GOODS), liik, ühik, tootja, koostis, toimeaine, NPK, PRIA väljad. Finantsõigusega ka teenuste ühikuhind.',
    input: {
      group: z.enum(['SERVICE', 'CONSUMABLE', 'PRODUCE', 'OTHER_GOODS']).optional().describe('Artikli rühm'),
      category: z.string().optional().describe('Liigi nimi (osaline)'),
      search: z.string().optional().describe('Artikli nimi, tootja või toimeaine (osaline)'),
      includeInactive: z.boolean().optional().describe('Kaasa ka mitteaktiivsed artiklid (vaikimisi false)'),
      limit
    },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const rows = await prisma.article.findMany({
        where: {
          ...(a.includeInactive ? {} : { isActive: true }),
          ...(a.group || a.category ? { category: { ...(a.group ? { group: a.group } : {}), ...(a.category ? { name: ci(a.category) } : {}) } } : {}),
          ...(a.search ? { OR: [{ name: ci(a.search) }, { manufacturer: ci(a.search) }, { activeIngredient: ci(a.search) }] } : {})
        },
        orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
        include: {
          category: { select: { name: true, group: true, systemKind: true } },
          crop: { select: { name: true } },
          cropVariety: { select: { name: true } },
          defaultWarehouse: { select: { name: true } }
        }
      });
      const out = limitRows(rows, a.limit);
      return {
        total: out.total,
        shown: out.shown,
        rows: out.rows.map((r) => ({
          name: r.name,
          group: r.category.group,
          category: r.category.name,
          systemKind: r.category.systemKind,
          unit: r.unit,
          manufacturer: r.manufacturer,
          composition: r.composition,
          crop: r.crop?.name ?? null,
          variety: r.cropVariety?.name ?? null,
          defaultWarehouse: r.defaultWarehouse?.name ?? null,
          isDefaultService: r.isDefaultService,
          priaRegister: r.priaRegister,
          priaKind: r.priaKind,
          priaSpec: r.priaSpec,
          activeIngredient: r.activeIngredient,
          nPct: round2(r.nPct),
          pPct: round2(r.pPct),
          kPct: round2(r.kPct),
          aliases: r.aliases,
          stockIssueCount: r.stockIssueCount,
          isActive: r.isActive,
          notes: r.notes,
          ...(finance ? { price: r.price === null ? null : round2(Number(r.price)) } : {})
        }))
      };
    }
  }),
  defineTool({
    name: 'list_work_types',
    title: 'Tööliigid ja mallid',
    description: 'Tööliikide register (faas, korduvus, kas küsib materjale, PRIA kood) ning tööde mallid (üldmallid ja kultuuride mallid).',
    input: {
      phase: z.enum(['PREPARATION', 'SOWING', 'CARE', 'HARVEST']).optional().describe('Töö faas'),
      includeInactive: z.boolean().optional().describe('Kaasa ka mitteaktiivsed tööliigid (vaikimisi false)')
    },
    run: async (a) => {
      const [workTypes, templates] = await Promise.all([
        prisma.workType.findMany({
          where: { ...(a.includeInactive ? {} : { isActive: true }), ...(a.phase ? { phase: a.phase } : {}) },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
        }),
        prisma.workTemplate.findMany({
          include: {
            crop: { select: { name: true } },
            items: { orderBy: { sortOrder: 'asc' }, include: { workType: { select: { name: true, shortName: true } } } }
          }
        })
      ]);
      return {
        workTypes: workTypes.map((w) => ({
          name: workTypeDisplayName(w),
          fullName: w.name,
          shortName: w.shortName,
          phase: w.phase,
          repeatMode: w.repeatMode,
          maxRepeats: w.maxRepeats,
          intervalDays: w.intervalDays,
          usesMaterials: w.usesMaterials,
          priaCode: w.priaCode,
          isActive: w.isActive
        })),
        templates: templates.map((t) => ({
          crop: t.crop?.name ?? null,
          isWinter: t.isWinter,
          label: t.crop ? t.crop.name : (t.isWinter ? 'Sügiskülvi üldmall' : 'Kevadkülvi üldmall'),
          items: t.items.map((i) => ({ work: workTypeDisplayName(i.workType), plannedCount: i.plannedCount }))
        }))
      };
    }
  })
];
