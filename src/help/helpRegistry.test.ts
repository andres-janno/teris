// Juhendiregistri väikesed reeglid: pikkuse piir võtme kohta.
import { describe, it, expect } from 'vitest';
import { HELP_MAX_LENGTH, helpMaxLength } from './helpRegistry';

describe('helpMaxLength', () => {
  it('peatükk on suurem kui kohtjuhend', () => {
    expect(helpMaxLength('guide.fields')).toBe(100000);
    expect(helpMaxLength('fields.register.export-csv')).toBe(HELP_MAX_LENGTH);
    expect(helpMaxLength('tundmatu')).toBe(HELP_MAX_LENGTH);
  });
});
