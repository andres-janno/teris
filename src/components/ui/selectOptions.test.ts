import { describe, expect, it } from 'vitest';
import { EMPTY_SELECT_VALUE, fromRadixValue, groupOptions, toRadixValue } from './selectOptions';

describe('select valikud', () => {
  const withEmpty = [{ value: '', label: '— vali —' }, { value: 'a', label: 'A' }];
  it('tühi väärtus tühja valikuga → sentinel, ilma → tühi (placeholder)', () => {
    expect(toRadixValue('', withEmpty)).toBe(EMPTY_SELECT_VALUE);
    expect(toRadixValue('', [{ value: 'a', label: 'A' }])).toBe('');
    expect(toRadixValue('a', withEmpty)).toBe('a');
  });
  it('sentinel tagasi tühjaks', () => {
    expect(fromRadixValue(EMPTY_SELECT_VALUE)).toBe('');
    expect(fromRadixValue('a')).toBe('a');
  });
  it('järjestikused sama rühmaga valikud ühte rühma, järjekord säilib', () => {
    const g = groupOptions([
      { value: '', label: 'Kõik' },
      { value: '1', label: 'Üks', group: 'Laod' },
      { value: '2', label: 'Kaks', group: 'Laod' },
      { value: '3', label: 'Kolm', group: 'Põllud' },
    ]);
    expect(g.map((x) => [x.group, x.options.map((o) => o.value)])).toEqual([
      [undefined, ['']],
      ['Laod', ['1', '2']],
      ['Põllud', ['3']],
    ]);
  });
});
