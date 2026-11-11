// PRIA impordi "Asenda olemasolevad põllud": imporditud aasta muutub täpselt faili sisuks.
// Puhas loogika — kasutab nii klient (eelvaade) kui server (eemaldamine).

export interface ReplaceCandidateField {
  id: number | string;
  num?: string | null;
  name: string;
  fieldCode?: string | null;
  operatorId?: string | null;
  history: { year: number; worksCount?: number; operatorId?: string | null }[];
}

export interface ReplaceRemoved { fieldId: number; num: string; name: string }
export interface ReplaceSkipped extends ReplaceRemoved { works: number }
export interface YearReplacementPlan { removed: ReplaceRemoved[]; skipped: ReplaceSkipped[] }

// Asendamise ulatus (selle aasta operaatori järgi — operaator võib aastati muutuda): operaatoriga impordil ainult selle operaatori põllud; operaatorita
// impordil ainult operaatorita põllud. Teise operaatori põlde ei puututa kunagi —
// operaatorita import ei tohi eemaldada operaatoriga põldude aastakirjeid.
// (Impordil seotud operaatorita põld saab impordi operaatori ja on niikuinii alles jäetavate seas.)
export function inReplaceScope(fieldOperatorId: string | null | undefined, importOperatorId: string | null | undefined): boolean {
  return importOperatorId ? fieldOperatorId === importOperatorId : !fieldOperatorId;
}

// Millised ulatusse jäävad, failis puuduvad põllud kaotavad aasta kirje (removed)
// ja millised jäetakse alles, sest neil on sel aastal töid (skipped).
export function planYearReplacement(
  fields: ReplaceCandidateField[],
  year: number,
  importOperatorId: string | null | undefined,
  keepFieldIds: Iterable<number | string>
): YearReplacementPlan {
  const keep = new Set([...keepFieldIds].map((id) => String(id)));
  const removed: ReplaceRemoved[] = [];
  const skipped: ReplaceSkipped[] = [];
  for (const f of fields) {
    if (keep.has(String(f.id))) continue;
    const season = f.history.find((h) => h.year === year);
    if (!season || !inReplaceScope(season.operatorId !== undefined ? season.operatorId : f.operatorId, importOperatorId)) continue;
    const item = { fieldId: Number(f.id), num: f.num || '', name: f.name };
    const works = season.worksCount ?? 0;
    if (works > 0) skipped.push({ ...item, works });
    else removed.push(item);
  }
  const byNum = (a: ReplaceRemoved, b: ReplaceRemoved) => a.num.localeCompare(b.num, 'et', { numeric: true }) || a.name.localeCompare(b.name, 'et');
  return { removed: removed.sort(byNum), skipped: skipped.sort(byNum) };
}
