// src/server/mcp/tools/weather.ts — ilmakokkuvõte (ERA5-Land): aastate võrdlus 01.04–31.08 või põllu hooaeg külvist koristuseni.
import { z } from 'zod';
import { defineTool, type McpContext } from '../context.ts';
import { tallinnYear } from '../format.ts';
import { resolveFieldSeason } from './fields.ts';
import { yearsReport, seasonReport } from '../../weather/weatherApi.ts';

const SOURCE = 'Copernicus Climate Change Service, ERA5-Land';
const REASON_MESSAGES = {
  NO_SEEDING: 'Hooajal pole külvikuupäeva, ilmakokkuvõtet ei saa arvutada.',
  NO_POINT: 'Põllul pole kuju, ilmapunkti ei saa siduda.',
  LOADING: 'Selle põllu ilmaandmeid alles laetakse.'
} as const;

const hasWeather = (ctx: McpContext) => ctx.license.modules.includes('WEATHER');

export const weatherTools = [
  defineTool({
    name: 'weather_summary',
    title: 'Ilmakokkuvõte',
    description: 'Ilm ERA5-Landi järgi (Copernicus, ruut ~9 km, andmed 2015-st, ~1 nädala viitega). Ilma põlluta: kõik aastad 01.04–31.08 majandi keskmisena — sademed mm, temperatuurisumma GDD (baas °C), veebilanss (sademed − potentsiaalne aurumine), pikim kuiv periood, kuumapäevad (>28 °C), öökülmad apr–juuni — koos pikaajalise keskmise ja standardhälbega. Põlluga: selle põllu hooaja kokkuvõte külvist koristuseni (või tänaseni) kultuuri GDD baasiga.',
    input: {
      field: z.string().optional().describe('Põllu nimi või number — siis põllu hooaja kokkuvõte'),
      year: z.number().int().min(2015).max(2100).optional().describe('Põllu hooaja aasta (vaikimisi jooksev); ilma põlluta piirab väljundi selle aastaga'),
      base: z.number().min(0).max(15).optional().describe('GDD baastemperatuur majandi vaates (vaikimisi 5)')
    },
    when: hasWeather,
    run: async (a) => {
      if (a.field) {
        const fs = await resolveFieldSeason(a.field, a.year ?? tallinnYear());
        const rep = await seasonReport(fs.id);
        return { field: fs.label, ...rep, ...(rep.reason ? { message: REASON_MESSAGES[rep.reason] } : {}), source: SOURCE };
      }
      const r = await yearsReport('all', a.base ?? 5);
      return { ...r, years: a.year ? r.years.filter((y) => y.year === a.year) : r.years, source: SOURCE };
    }
  })
];
