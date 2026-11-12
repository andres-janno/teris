import { describe, expect, it } from 'vitest';
import { auditCss, auditTsx, summarize } from './uiAudit';

describe('auditCss', () => {
  it('kogub kirjasuurused, nurgad, vahed ja värvid', () => {
    const r = auditCss('.a{font-size:12px;padding:8px 10px;border-radius:6px;color:#fff}');
    expect(r.fontSizes).toEqual(['12px']);
    expect(r.spacing).toEqual(['8px', '10px']);
    expect(r.radii).toEqual(['6px']);
    expect(r.colors).toEqual(['#fff']);
  });
  it('vahedes ignoreerib 0, auto ja muutujaid', () => {
    expect(auditCss('.a{margin:0 auto;gap:var(--x);padding-left:0}').spacing).toEqual([]);
  });
  it('loeb ka margin-top ja column-gap', () => {
    expect(auditCss('.a{margin-top:-4px;column-gap:0.5rem}').spacing).toEqual(['-4px', '0.5rem']);
  });
});

describe('auditTsx', () => {
  it('loeb inline-stiilid, värvikoodid ja keelatud suvalised klassid', () => {
    const r = auditTsx(
      '<div style={{ a: 1 }} className="text-[13px] p-2 bg-[#fff] w-[min(640px,94vw)] data-[state=open]:bg-muted" color="#123456" />'
    );
    expect(r.inlineStyles).toBe(1);
    expect(r.arbitrary).toEqual(['text-[13px]', 'bg-[#fff]']);
    expect(r.colors).toBe(2);
  });
  it('loeb rgba ja rgb', () => {
    expect(auditTsx("const c = 'rgba(0,0,0,.5)'; const d = 'rgb(1,2,3)';").colors).toBe(2);
  });
});

describe('summarize', () => {
  it('ühendab failid ja eemaldab korduvad väärtused', () => {
    const r = summarize([
      { path: 'a.css', content: '.a{font-size:12px}' },
      { path: 'b.css', content: '.b{font-size:12px;font-size:13px}' },
      { path: 'c.tsx', content: '<p style={{}} className="m-[3px]" />' },
    ]);
    expect(r.fontSizes).toEqual(['12px', '13px']);
    expect(r.inlineStyles).toBe(1);
    expect(r.arbitrary).toEqual([{ path: 'c.tsx', cls: 'm-[3px]' }]);
  });
});
