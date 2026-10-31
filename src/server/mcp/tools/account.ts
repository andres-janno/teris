// src/server/mcp/tools/account.ts — kes ma olen ja millised hooajad on olemas.
import { prisma } from '../../db.ts';
import { defineTool, canSeeFinance } from '../context.ts';
import { tallinnYear } from '../format.ts';

export const accountTools = [
  defineTool({
    name: 'whoami',
    title: 'Kasutaja ja õigused',
    description: 'Sisselogitud kasutaja, ettevõte, finantsõigus (kas näeb hindu, kulusid ja laokandeid), litsentsi moodulid ja jooksev aasta. Kutsu esimesena.',
    input: {},
    run: async (_args, ctx) => ({
      user: ctx.user.displayName || ctx.user.username,
      username: ctx.user.username,
      company: ctx.tenantName,
      financeAccess: canSeeFinance(ctx),
      modules: ctx.license.modules,
      licenseReadOnly: ctx.license.readOnly,
      currentYear: tallinnYear()
    })
  }),
  defineTool({
    name: 'list_seasons',
    title: 'Hooajad',
    description: 'Kõik hooajad (aastad) uuemad eespool; locked = hooaeg on suletud.',
    input: {},
    run: async () => {
      const rows = await prisma.season.findMany({ orderBy: { year: 'desc' }, select: { year: true, name: true, isLocked: true } });
      return rows.map((s) => ({ year: s.year, name: s.name, locked: s.isLocked }));
    }
  })
];
