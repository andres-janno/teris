import { describe, it, expect } from 'vitest';
import { parseSatiladuDates, validateSatiladuQuery } from './satiladu';

describe('parseSatiladuDates', () => {
  it('loeb kuupäevad ISO kujule, uusim ees, kordusteta', () => {
    const html = `
      <h3 class="mb-0 mt-0"><span class="inim-kuup">05.08.2026</span> <small>Sentinel-2 RGB</small></h3>
      <h3 class="mb-0 mt-0"><span class="inim-kuup">11.08.2026</span></h3>
      <h3 class="mb-0 mt-0"><span class="inim-kuup">05.08.2026</span></h3>
      <span class="inim-kuup">29.06.2026</span>`;
    expect(parseSatiladuDates(html)).toEqual(['2026-08-11', '2026-08-05', '2026-06-29']);
  });

  it('tühi tulemus', () => {
    expect(parseSatiladuDates('<html><body>Tulemusi ei leitud</body></html>')).toEqual([]);
  });
});

describe('validateSatiladuQuery', () => {
  const base = { from: '2026-01-01', to: '2026-10-09' };

  it('lubab korrektse päringu', () => {
    expect(validateSatiladuQuery(base)).toBeNull();
  });

  it('keelab vigased kuupäevad', () => {
    expect(validateSatiladuQuery({ ...base, from: '2026-1-1' })).not.toBeNull();
    expect(validateSatiladuQuery({ ...base, from: '2026-10-10' })).not.toBeNull();
  });
});
