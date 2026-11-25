import { describe, it, expect } from 'vitest';
import {
  buildDraftItems,
  mergeDraftItems,
  mergeSourceCommits,
  nextDateVersion,
  normalizeChangelogType,
  parseChangelogJsonl,
  parseConventionalCommit
} from './releaseDraft';

describe('normalizeChangelogType', () => {
  it('teeb tüübid kanooniliseks', () => {
    expect(normalizeChangelogType('feat')).toBe('FEATURE');
    expect(normalizeChangelogType('feature')).toBe('FEATURE');
    expect(normalizeChangelogType('fix')).toBe('FIX');
    expect(normalizeChangelogType('improvement')).toBe('IMPROVEMENT');
    expect(normalizeChangelogType('chore')).toBeNull();
  });
});

describe('parseChangelogJsonl', () => {
  it('parsib kehtivad read ja kogub vead', () => {
    const content = [
      '# kommentaar',
      '{"commit":"abc1234","type":"feature","area":"Ladu","text":"Koguväärtus lisatud"}',
      '{"type":"fix","text":"Parandatud viga"}',
      '{"type":"unknown","text":"Vale tüüp"}',
      'vigane json'
    ].join('\n');
    const { entries, errors } = parseChangelogJsonl(content);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ commit: 'abc1234', type: 'FEATURE', area: 'Ladu', text: 'Koguväärtus lisatud' });
    expect(entries[1]).toMatchObject({ type: 'FIX', text: 'Parandatud viga' });
    expect(errors).toHaveLength(2);
  });
});

describe('nextDateVersion', () => {
  it('genereerib YYYY.MM.DD ja kokkupõrkel -2, -3', () => {
    const d = new Date('2026-11-24T12:00:00Z');
    expect(nextDateVersion([], d)).toBe('2026.11.24');
    expect(nextDateVersion(['2026.11.24'], d)).toBe('2026.11.24-2');
    expect(nextDateVersion(['2026.11.24', '2026.11.24-2'], d)).toBe('2026.11.24-3');
  });
});

describe('parseConventionalCommit & buildDraftItems', () => {
  it('tuvastab feat/fix commitid ja jätab sisemised vahele', () => {
    expect(parseConventionalCommit({ hash: '1111111', subject: 'feat(stock): lisa koguväärtus' })).toMatchObject({
      category: 'FEATURE',
      area: 'stock',
      text: 'Lisa koguväärtus'
    });
    expect(parseConventionalCommit({ hash: '2222222', subject: 'fix(test): paranda test' })).toBeNull();
    expect(parseConventionalCommit({ hash: '3333333', subject: 'chore: uuenda pakette' })).toBeNull();
  });

  it('tuvastab katmata commitid ja sorteerib kategooriad FEATURE → IMPROVEMENT → FIX', () => {
    const entries = [
      { commit: 'aaa1111', type: 'FIX' as const, text: 'Parandus' },
      { commit: 'bbb2222', type: 'FEATURE' as const, area: 'Ladu', text: 'Uus võimalus' }
    ];
    const commits = [
      { hash: 'aaa1111', subject: 'fix(ui): parandus' },
      { hash: 'ccc3333', subject: 'feat(kaart): uus filter' }
    ];
    const withoutFallback = buildDraftItems(entries, commits, false);
    expect(withoutFallback.items.map((i) => i.category)).toEqual(['FEATURE', 'FIX']);
    expect(withoutFallback.uncoveredCommits).toHaveLength(1);
    expect(withoutFallback.uncoveredCommits[0].hash).toBe('ccc3333');

    const withFallback = buildDraftItems(entries, commits, true);
    expect(withFallback.items).toHaveLength(3);
  });
});

describe('mergeDraftItems & mergeSourceCommits', () => {
  it('ühendab punktid ilma duplikaatideta ja sorteerib kategooriad', () => {
    const existing = [
      { id: '1', category: 'FIX' as const, text: 'Parandus A' }
    ];
    const incoming = [
      { id: '2', category: 'FIX' as const, text: 'parandus a' },
      { id: '3', category: 'FEATURE' as const, area: 'Põllud', text: 'Uus veerg' }
    ];
    const merged = mergeDraftItems(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.map((m) => m.category)).toEqual(['FEATURE', 'FIX']);
  });

  it('ühendab commitid unikaalse hashi järgi (uusimad ees)', () => {
    const merged = mergeSourceCommits(
      [{ hash: 'aaa1111', subject: 'vana' }],
      [{ hash: 'bbb2222', subject: 'uus' }, { hash: 'aaa1111', subject: 'vana' }]
    );
    expect(merged.map((c) => c.hash)).toEqual(['bbb2222', 'aaa1111']);
  });
});
