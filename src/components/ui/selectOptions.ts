// src/components/ui/selectOptions.ts — Selecti valikute abifunktsioonid. Radix ei luba valikut väärtusega '',
// seega tühi valik („— vali —“, „Kõik“) kasutab sisemist sentinel-väärtust.
export interface SelectOption {
  value: string; // '' = tühi valik
  label: string;
  disabled?: boolean;
  group?: string; // järjestikused sama rühmaga valikud näidatakse rühmapealkirja all
}

export const EMPTY_SELECT_VALUE = '__empty__';

export function toRadixValue(value: string, options: SelectOption[]): string {
  return value === '' && options.some((o) => o.value === '') ? EMPTY_SELECT_VALUE : value;
}

export function fromRadixValue(value: string): string {
  return value === EMPTY_SELECT_VALUE ? '' : value;
}

export function groupOptions(options: SelectOption[]): { group?: string; options: SelectOption[] }[] {
  const out: { group?: string; options: SelectOption[] }[] = [];
  for (const o of options) {
    const last = out[out.length - 1];
    if (last && last.group === o.group) last.options.push(o);
    else out.push({ group: o.group, options: [o] });
  }
  return out;
}
