// Hooaja automaatne loomine: päris andmebaas, testaasta 1990 (kustutatakse pärast).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, runAsTenant } from './db';
import { ensureSeasons, isSeasonYear } from './seasons';

const LOISU = 'tenant-loisu-agro';
const YEAR = 1990;

const cleanup = async () => {
  await runAsTenant(LOISU, async () => {
    await prisma.season.deleteMany({ where: { year: YEAR } });
  });
};

beforeAll(cleanup);
afterAll(cleanup);

describe('ensureSeasons', () => {
  it('aasta piirid', () => {
    expect(isSeasonYear(1990)).toBe(true);
    expect(isSeasonYear(2100)).toBe(true);
    expect(isSeasonYear(1989)).toBe(false);
    expect(isSeasonYear(2026.5)).toBe(false);
    expect(isSeasonYear(NaN)).toBe(false);
  });

  it('loob puuduva hooaja, ei muuda olemasolevat ja jätab vigased aastad vahele', async () => {
    await runAsTenant(LOISU, async () => {
      const first = await ensureSeasons([YEAR, String(YEAR), 'x', 1500]);
      expect([...first.keys()]).toEqual([YEAR]);
      const row = await prisma.season.findFirst({ where: { year: YEAR } });
      expect(row?.name).toBe(`Hooaeg ${YEAR}`);

      await prisma.season.update({ where: { id: row!.id }, data: { name: 'Muudetud', notes: 'märge' } });
      const again = await ensureSeasons([YEAR]);
      expect(again.get(YEAR)).toBe(row!.id);
      const after = await prisma.season.findFirst({ where: { year: YEAR } });
      expect(after?.name).toBe('Muudetud');
      expect(after?.notes).toBe('märge');
    });
  });
});
