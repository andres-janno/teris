// Galerii näidiste pealdised tuletatakse näidise propidest: iga pealdis peab olema loenduse kombinatsioonivõtme
// vormingus ja arv peab klappima loendusega (sama andmestik, mida galerii näitab).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import usageData from 'virtual:ui-usage';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { comboCount, comboKey, isStaticCombo } from '../../tooling/uiUsage';

// Node-keskkonnas pole document'it; hüpiku portaali vaikekonteiner vajab document.body-t (serveris ei renderdata midagi).
let captions: { name: string; key: string; text: string; unused: boolean }[] = [];
beforeAll(async () => {
  vi.stubGlobal('document', { body: {} });
  const { UiGallery } = await import('./UiGallery');
  const { TooltipProvider } = await import('./Popover');
  const html = renderToStaticMarkup(React.createElement(TooltipProvider, null, React.createElement(UiGallery)));
  captions = [...html.matchAll(/<span class="[^"]*" data-usage-caption="([^"]+)" data-usage-key="([^"]*)"( data-usage-unused="true")?>(.*?)<\/span>/g)].map(
    (m) => ({ name: m[1], key: m[2], unused: !!m[3], text: m[4].replace(/<!-- -->/g, '').replace(/&#x27;/g, "'") })
  );
});

describe('galerii pealdised', () => {
  it('on olemas Button, Badge, Alert ja ChipButton näidistel', () => {
    for (const n of ['Button', 'Badge', 'Alert', 'ChipButton']) {
      expect(captions.filter((c) => c.name === n).length, n).toBeGreaterThan(0);
    }
  });

  it('iga pealdis = kombinatsioonivõti + loenduse täpne arv', () => {
    for (const c of captions) {
      const u = usageData.components.find((x) => x.name === c.name)!;
      expect(u, c.name).toBeTruthy();
      const parts = c.key.split(' · ');
      expect(parts.length, c.text).toBe(u.comboProps.length);
      expect(c.text).toBe(`${c.key} · ${comboCount(u, c.key)}`);
    }
  });

  it('pealdise võti vastab näidise tegelikele propidele (Button ghost + icon-xs)', () => {
    expect(captions.some((c) => c.name === 'Button' && c.key === 'ghost · icon-xs')).toBe(true);
    expect(captions.some((c) => c.name === 'Button' && c.key === 'vaikimisi · vaikimisi')).toBe(true);
  });

  it('iga kombinatsioon, mida rakenduses kasutatakse 2+ korda, on galeriis näidisega', () => {
    const missing: string[] = [];
    for (const name of new Set(captions.map((c) => c.name))) {
      const u = usageData.components.find((x) => x.name === name)!;
      for (const combo of u.combos) {
        if (combo.count < 2 || !isStaticCombo(combo.values)) continue;
        const key = comboKey(combo.values);
        if (!captions.some((c) => c.name === name && c.key === key)) missing.push(`${name}: ${key} (${combo.count})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('0 kasutusega näidised on „Kasutamata variandid“ real ja ainult need', () => {
    const wrong = captions.filter((c) => (comboCount(usageData.components.find((x) => x.name === c.name)!, c.key) === 0) !== c.unused);
    expect(wrong.map((c) => `${c.text}${c.unused ? ' (kasutamata real)' : ''}`)).toEqual([]);
  });
});
