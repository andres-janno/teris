// src/server/workTypeMigration.ts — korduva töö jagamine eraldi töödeks (iga kord = üks töö).
// Puhas funktsioon; kasutab scripts/pria-work-types.mts.

export function splitRepeatedWork(work: { plannedCount: number; entries: { id: string; occurrenceNo: number | null }[] }): { entryIds: string[] }[] {
  const maxOccurrence = Math.max(0, ...work.entries.map((e) => e.occurrenceNo ?? 0));
  const count = Math.max(1, work.plannedCount, maxOccurrence);
  const groups: { entryIds: string[] }[] = Array.from({ length: count }, () => ({ entryIds: [] }));
  for (const e of work.entries) groups[(e.occurrenceNo ?? 1) - 1].entryIds.push(e.id);
  return groups;
}
