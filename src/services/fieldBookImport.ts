// src/services/fieldBookImport.ts
// Põlluraamatu parsitud lehtede sobitamine registriga ja impordi API keha koostamine.
import type { MasterField } from '../types/fieldRegister';
import type { RelatedParty } from '../types/party';
import type { FarmingSeason } from '../types/season';
import type {
  FieldBookImportPayload,
  FieldBookPreviewRow,
  FieldBookSheetResult
} from '../types/fieldOperation';

const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// PRIA võib nime anda kujul "Perenimi Eesnimi"; proovime ka pööratud järjekorda.
export function matchPartyByName(name: string, parties: RelatedParty[]): RelatedParty | null {
  const n = normalizeName(name);
  if (!n) return null;
  const parts = n.split(' ');
  const candidates = new Set([
    n,
    [...parts.slice(1), parts[0]].join(' '),
    [parts[parts.length - 1], ...parts.slice(0, -1)].join(' ')
  ]);
  return parties.find((p) => candidates.has(normalizeName(p.name))) ?? null;
}

export function buildFieldBookImport(
  results: FieldBookSheetResult[],
  ctx: { masterFields: MasterField[]; parties: RelatedParty[]; seasons: FarmingSeason[]; operatorId: string }
): { rows: FieldBookPreviewRow[]; payload: FieldBookImportPayload } {
  const rows: FieldBookPreviewRow[] = [];
  const payload: FieldBookImportPayload = { operatorId: ctx.operatorId, fields: [] };

  for (const result of results) {
    const s = result.sheet;
    if (!s) {
      rows.push({
        sheetName: result.sheetName, fieldCode: null, num: null, season: null, fieldName: null,
        matched: false, operationsCount: 0, productsCount: 0, unmatchedPerformers: [],
        seasonLocked: false, error: result.error
      });
      continue;
    }

    const field = ctx.masterFields.find(
      (f) =>
        f.fieldCode === s.fieldCode &&
        (f.num || '') === s.num &&
        f.operatorId === ctx.operatorId &&
        f.history.some((h) => h.year === s.season)
    );

    const unmatched = new Set<string>();
    const operations = s.operations.map((op) => {
      const performer = op.performerName ? matchPartyByName(op.performerName, ctx.parties) : null;
      if (op.performerName && !performer) unmatched.add(op.performerName);
      return {
        type: op.type,
        dateFrom: op.dateFrom,
        dateTo: op.dateTo,
        areaHa: op.areaHa,
        method: op.method,
        performerId: performer?.id ?? null,
        notes: op.notes,
        products: op.products
      };
    });

    rows.push({
      sheetName: s.sheetName,
      fieldCode: s.fieldCode,
      num: s.num,
      season: s.season,
      fieldName: field?.name ?? null,
      matched: Boolean(field),
      operationsCount: operations.length,
      productsCount: operations.reduce((n, o) => n + o.products.length, 0),
      unmatchedPerformers: [...unmatched],
      seasonLocked: ctx.seasons.find((x) => x.year === s.season)?.isLocked ?? false,
      error: null
    });

    if (field) {
      payload.fields.push({
        fieldCode: s.fieldCode,
        num: s.num,
        season: s.season,
        targetYieldTonsHa: s.targetYieldTonsHa,
        actualYieldTonsHa: s.actualYieldTonsHa,
        seedingDate: s.seedingDate,
        harvestDate: s.harvestDate,
        operations
      });
    }
  }

  return { rows, payload };
}
