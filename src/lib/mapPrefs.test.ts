// Kaardi valikute taastamine: vanad salvestused, tundmatud võtmed, mooduli piirang, paneelide ahendatud olek
import { describe, it, expect } from 'vitest';
import type { LayerVisibility } from '../types/map';
import { applyModuleLimits, parseCollapsedPanels, restoreLayerVisibility, restoreSoilMetric } from './mapPrefs';

const DEFAULTS: LayerVisibility = {
  baseMap: 'maaamet-pohikaart', cadastre: false, fields: true, vehicles: false, cultivation: false, poi: false,
  fieldLabels: false, blockLabels: false, swathTrails: true, soilSamples: false, weatherRadar: false, satellite: false
};
const BASE_MAPS = ['maaamet-pohikaart', 'maaamet-foto'];
const restore = (saved: string | null) => restoreLayerVisibility(saved, DEFAULTS, BASE_MAPS);

describe('restoreLayerVisibility', () => {
  it('salvestust pole → vaikevalik', () => {
    expect(restore(null)).toEqual(DEFAULTS);
  });

  it('taastab kõik kihtide lülitid ja aluskaardi', () => {
    const saved = { ...DEFAULTS, baseMap: 'maaamet-foto', cadastre: true, fields: false, vehicles: true, cultivation: true, poi: true,
      fieldLabels: true, blockLabels: true, swathTrails: false, soilSamples: true, weatherRadar: true, satellite: true };
    expect(restore(JSON.stringify(saved))).toEqual(saved);
  });

  it('vana salvestus (ainult mõned võtmed) täiendatakse vaikeväärtustega', () => {
    expect(restore(JSON.stringify({ baseMap: 'maaamet-foto', fieldLabels: true }))).toEqual({ ...DEFAULTS, baseMap: 'maaamet-foto', fieldLabels: true });
  });

  it('eemaldatud aluskaart (hübriid) → põhikaart', () => {
    expect(restore(JSON.stringify({ baseMap: 'maaamet-hybriid' })).baseMap).toBe('maaamet-pohikaart');
  });

  it('tundmatud võtmed jäetakse välja ja valed tüübid saavad vaikeväärtuse', () => {
    const out = restore(JSON.stringify({ legacyLayer: true, fields: 'yes', swathTrails: 0, vehicles: true }));
    expect(out).toEqual({ ...DEFAULTS, vehicles: true });
    expect('legacyLayer' in out).toBe(false);
  });

  it('vigane JSON ja mitte-objekt → vaikevalik', () => {
    expect(restore('{katki')).toEqual(DEFAULTS);
    expect(restore('[1,2]')).toEqual(DEFAULTS);
    expect(restore('null')).toEqual(DEFAULTS);
    expect(restore('"tekst"')).toEqual(DEFAULTS);
  });

  it('ei muuda vaikeväärtuste objekti', () => {
    const copy = { ...DEFAULTS };
    restore(JSON.stringify({ fields: false }));
    expect(DEFAULTS).toEqual(copy);
  });
});

describe('applyModuleLimits', () => {
  const all: LayerVisibility = { ...DEFAULTS, vehicles: true, cultivation: true, satellite: true, weatherRadar: true, poi: true };

  it('mooduliteta kihid jäävad väljas, ka siis, kui salvestuses olid sees', () => {
    const restored = restore(JSON.stringify(all));
    const out = applyModuleLimits(restored, { telemetry: false, satellite: false, weather: false });
    expect(out).toMatchObject({ vehicles: false, cultivation: false, satellite: false, weatherRadar: false, poi: true });
    expect(restored.satellite).toBe(true); // salvestatud valik jääb alles
  });

  it('moodulitega kihid jäävad sisse', () => {
    expect(applyModuleLimits(all, { telemetry: true, satellite: true, weather: true })).toEqual(all);
  });

  it('moodulid töötavad kihtide kaupa', () => {
    const out = applyModuleLimits(all, { telemetry: true, satellite: false, weather: true });
    expect(out).toMatchObject({ vehicles: true, cultivation: true, satellite: false, weatherRadar: true });
  });
});

describe('restoreSoilMetric', () => {
  const valid = ['ph', 'phosphorus', 'age'];
  it('taastab kehtiva näitaja', () => expect(restoreSoilMetric('phosphorus', valid, 'ph')).toBe('phosphorus'));
  it('tundmatu või puuduv → vaikeväärtus', () => {
    expect(restoreSoilMetric('boor', valid, 'ph')).toBe('ph');
    expect(restoreSoilMetric(null, valid, 'ph')).toBe('ph');
  });
});

describe('parseCollapsedPanels', () => {
  it('loeb ahendatud paneelid', () => {
    expect(parseCollapsedPanels('{"layers":true,"year":false}')).toEqual({ layers: true, year: false });
  });
  it('tundmatud võtmed ja valed tüübid jäetakse välja', () => {
    expect(parseCollapsedPanels('{"layers":"jah","other":true,"year":true}')).toEqual({ year: true });
  });
  it('puuduv, vigane või mitte-objekt → kõik lahti', () => {
    expect(parseCollapsedPanels(null)).toEqual({});
    expect(parseCollapsedPanels('{katki')).toEqual({});
    expect(parseCollapsedPanels('[true]')).toEqual({});
    expect(parseCollapsedPanels('null')).toEqual({});
  });
});
