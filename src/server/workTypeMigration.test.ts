import { describe, expect, it } from 'vitest';
import { splitRepeatedWork } from './workTypeMigration';

describe('splitRepeatedWork', () => {
  it('ühekordne töö jääb üheks', () => {
    expect(splitRepeatedWork({ plannedCount: 1, entries: [{ id: 'a', occurrenceNo: null }, { id: 'b', occurrenceNo: null }] }))
      .toEqual([{ entryIds: ['a', 'b'] }]);
  });
  it('kordused jagatakse occurrenceNo järgi, puuduvad kordused kanneteta töödeks', () => {
    expect(splitRepeatedWork({
      plannedCount: 3,
      entries: [{ id: 'a', occurrenceNo: 1 }, { id: 'b', occurrenceNo: 2 }, { id: 'c', occurrenceNo: 2 }]
    })).toEqual([{ entryIds: ['a'] }, { entryIds: ['b', 'c'] }, { entryIds: [] }]);
  });
  it('kordumisnumbrita kanded lähevad esimesse töösse', () => {
    expect(splitRepeatedWork({ plannedCount: 2, entries: [{ id: 'a', occurrenceNo: null }, { id: 'b', occurrenceNo: 2 }] }))
      .toEqual([{ entryIds: ['a'] }, { entryIds: ['b'] }]);
  });
  it('rohkem kordi kui planeeritud → iga kord oma töö', () => {
    expect(splitRepeatedWork({ plannedCount: 1, entries: [{ id: 'a', occurrenceNo: 1 }, { id: 'b', occurrenceNo: 2 }] }))
      .toEqual([{ entryIds: ['a'] }, { entryIds: ['b'] }]);
  });
});
