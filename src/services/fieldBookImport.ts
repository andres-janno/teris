// src/services/fieldBookImport.ts
// Põlluraamatu parsitud lehtede sobitamine registriga ja impordi API keha koostamine.
import type { MasterField } from '../types/fieldRegister';
import { normalizeFieldNum } from './fieldIdentity';
import { matchPartyByName } from './partyMatch';
import type { RelatedParty } from '../types/party';
import type { FarmingSeason } from '../types/season';
import type {
  FieldBookImportPayload,
  FieldBookPreviewRow,
  FieldBookSheetResult
} from '../types/fieldOperation';

export { matchPartyByName };

export function buildFieldBookImport(
  results: FieldBookSheetResult[],
  ctx: { masterFields: MasterField[]; parties: RelatedParty[]; seasons: FarmingSeason[]; operatorId: string; createMissingPerformers?: boolean }
): { rows: FieldBookPreviewRow[]; payload: FieldBookImportPayload } {
  const rows: FieldBookPreviewRow[] = [];
  const payload: FieldBookImportPayload = { operatorId: ctx.operatorId, fields: [] };
  if (ctx.createMissingPerformers) payload.createMissingPerformers = true;

  for (const result of results) {
    const s = result.sheet;
    if (!s) {
      rows.push({
        sheetName: result.sheetName, fieldCode: null, num: null, season: null, fieldName: null,
        matched: false, operationsCount: 0, existingWorksCount: 0, productsCount: 0, unmatchedPerformers: [],
        seasonLocked: false, error: result.error
      });
      continue;
    }

    // Selle aasta hooaja number (kirjapildist sõltumata) ja operaator — need muutuvad aastati
    const field = ctx.masterFields.find((f) => {
      if (f.fieldCode !== s.fieldCode) return false;
      const h = f.history.find((x) => x.year === s.season);
      return !!h && normalizeFieldNum(h.num ?? f.num) === normalizeFieldNum(s.num) && (h.operatorId ?? f.operatorId) === ctx.operatorId;
    });

    const unmatched = new Set<string>();
    const operations = s.operations.map((op) => {
      const performer = op.performerName ? matchPartyByName(op.performerName, ctx.parties) : null;
      if (op.performerName && !performer) unmatched.add(op.performerName);
      // Puuduva teostaja lisamisel loob server isiku nime järgi ja seob töö temaga (märkusesse nime ei lisata)
      const createPerformer = !!ctx.createMissingPerformers && !!op.performerName && !performer;
      return {
        type: op.type,
        dateFrom: op.dateFrom,
        dateTo: op.dateTo,
        areaHa: op.areaHa,
        method: op.method,
        performerId: performer?.id ?? null,
        ...(createPerformer ? { performerName: op.performerName as string } : {}),
        notes: performer || !op.performerName || createPerformer ? op.notes : [op.notes, `Teostaja: ${op.performerName}`].filter(Boolean).join('\n'),
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
      existingWorksCount: field?.history.find((h) => h.year === s.season)?.worksCount ?? 0,
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
