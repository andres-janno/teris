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
  it('kirjasuurustes ja nurkades jätab välja muutujad, inherit ja 0, lõikab nurga lühendi tükkideks', () => {
    const r = auditCss(
      '.a{font-size:var(--x);font-size:inherit;font-size:0.8rem;border-radius:6px 6px 0 0;border-radius:50%}'
    );
    expect(r.fontSizes).toEqual(['0.8rem']);
    expect(r.radii).toEqual(['6px', '6px', '50%']);
  });
  it('eemaldab kirjasuuruse ja nurga väärtusest !important', () => {
    const r = auditCss('.a{font-size:13px !important;border-radius:4px!important}');
    expect(r.fontSizes).toEqual(['13px']);
    expect(r.radii).toEqual(['4px']);
  });
  it('kogub rgba, rgb ja hsl värvid normaliseeritult (väikesed tähed, tühikud välja) ja järjekorras', () => {
    expect(auditCss('.a{color:rgba(0, 0, 0, 0.5);background:#FFF;border-color:hsl(0 0% 50%)}').colors).toEqual([
      'rgba(0,0,0,0.5)',
      '#fff',
      'hsl(00%50%)',
    ]);
  });
  it('ei loe värvina muutujaga määratud värvi', () => {
    expect(auditCss('.a{color:rgb(var(--r) 0 0)}').colors).toEqual([]);
  });
  it('ei loe HTML-i numbrilist võrdlusmärki (&#8212;) värvina ka CSS-is', () => {
    expect(auditCss('.a{content:"&#8212;";color:#fff}').colors).toEqual(['#fff']);
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
  it('ei loe HTML-i numbrilist võrdlusmärki (&#8212;) värvina', () => {
    expect(auditTsx('<p>a&#8212;b</p>').colors).toBe(0);
  });
  it('keelatud klassid: negatiivsed ja loogilised vahed, ei võta w-, max-w- ega data- klasse', () => {
    const r = auditTsx(
      '<p className="text-[13px] -mt-[4px] -m-[2px] ps-[3px] -ms-[1px] max-w-[640px] w-[min(640px,94vw)] md:p-[3px] data-[state=open]:bg-muted" />'
    );
    expect(r.arbitrary).toEqual(['text-[13px]', '-mt-[4px]', '-m-[2px]', 'ps-[3px]', '-ms-[1px]', 'p-[3px]']);
  });
});

describe('auditTsx: skaalaväline vahe', () => {
  it('märgib skaalavälised vahe-klassid (ka negatiivsed ja variandiga)', () => {
    const r = auditTsx('<p className="p-5 -mt-3.5 md:gap-x-7 hover:px-9 m-0 p-px gap-2.5 py-8 -mb-px pl-12" />');
    expect(r.offScaleSpacing).toEqual(['p-5', '-mt-3.5', 'gap-x-7', 'px-9', 'pl-12']);
  });
  it('ei märgi suurusi ega muid klasse', () => {
    const r = auditTsx('<p className="size-7 h-7 w-72 min-w-40 translate-x-0.5 -mb-px top-5 inset-3 max-h-96" />');
    expect(r.offScaleSpacing).toEqual([]);
  });
});

describe('auditTsx: keelatud suvalised, v4 muutujasüntaks', () => {
  it('püüab text-(--x), bg-(--x), p-(--x), rounded-(--x) ja border-x-[…], lubab min-w-(--radix-…)', () => {
    const r = auditTsx(
      '<p className="text-(--x) bg-(--y) p-(--z) border-(--b) rounded-(--r) border-t-[3px] border-x-[1px] min-w-(--radix-select-trigger-width) w-[10px] max-h-[60vh]" />'
    );
    expect(r.arbitrary).toEqual([
      'text-(--x)', 'bg-(--y)', 'p-(--z)', 'border-(--b)', 'rounded-(--r)', 'border-t-[3px]', 'border-x-[1px]',
    ]);
  });
});

describe('auditTsx: inline kirjasuurused ja värvid failis', () => {
  it('kogub fontSize väärtused pikslitena', () => {
    const r = auditTsx("<p style={{ fontSize: 13 }} /><p style={{ fontSize: '11px' }} /><p style={{ fontSize: '0.8rem' }} />");
    expect(r.inlineFontSizes).toEqual(['13px', '11px', '0.8rem']);
  });
  it('summarize annab värvid failide kaupa ja kordumatud inline-kirjasuurused', () => {
    const r = summarize([
      { path: 'a.tsx', content: "const c = '#fff'; const d = '#000'; <p style={{ fontSize: 13 }} />" },
      { path: 'b.tsx', content: "const c = '#fff'; <p style={{ fontSize: 13 }} />" },
      { path: 'c.tsx', content: '<p />' },
    ]);
    expect(r.tsxColorFiles).toEqual([{ path: 'a.tsx', count: 2 }, { path: 'b.tsx', count: 1 }]);
    expect(r.inlineFontSizes).toEqual(['13px']);
  });
});

describe('vanad komponendiklassid CSS-is', () => {
  it('loeb eri klassiselektorid', () => {
    const r = auditCss('.btn{} .btn:hover{} .btn-primary{} .modal-overlay .badge{} .data-table td{} .other{} .tabs-x{}');
    expect(r.componentClasses).toEqual(['.btn', '.btn-primary', '.modal-overlay', '.badge', '.data-table', '.tabs-x']);
  });
  it('summarize annab kordumatu arvu', () => {
    const r = summarize([
      { path: 'a.css', content: '.btn{}' },
      { path: 'b.css', content: '.btn{} .pill-x{}' },
    ]);
    expect(r.legacyComponentClasses).toEqual(['.btn', '.pill-x']);
  });
});

describe('summarize', () => {
  it('annab skaalaväliste vahede loendi failidega', () => {
    const r = summarize([{ path: 'c.tsx', content: '<p className="p-5 p-2" />' }]);
    expect(r.offScaleSpacing).toEqual([{ path: 'c.tsx', cls: 'p-5' }]);
  });
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
  it('loeb tühikuga ja tühikuta kirjutatud sama rgba värvi üheks', () => {
    const r = summarize([
      { path: 'a.css', content: '.a{color:rgba(0, 0, 0, 0.5)}' },
      { path: 'b.css', content: '.b{color:rgba(0,0,0,0.5)}' },
    ]);
    expect(r.cssColors).toEqual(['rgba(0,0,0,0.5)']);
  });
});

describe('auditTsx: vanad nupuklassid', () => {
  it('loeb üldised nupuklassid klassistringides', () => {
    const src = `<button className="btn btn-primary btn-sm">a</button>
<button className={\`btn btn-sm \${x ? 'btn-primary' : 'btn-secondary'}\`}>b</button>
<button className="icon-btn-ghost">c</button><button className="icon-btn-danger" /><button className="icon-btn" />
<button className="icon-btn-ghost-sm" /><button className="btn btn-secondary btn-xs btn-icon-only" />
<button className="icon-btn-ghost-xs btn-disabled" />`;
    expect(auditTsx(src).legacyButtons).toEqual([
      'btn', 'btn-primary', 'btn-sm', 'btn', 'btn-sm', 'btn-primary', 'btn-secondary',
      'icon-btn-ghost', 'icon-btn-danger', 'icon-btn', 'icon-btn-ghost-sm',
      'btn', 'btn-secondary', 'btn-xs', 'btn-icon-only',
      'icon-btn-ghost-xs', 'btn-disabled',
    ]);
  });
  it('ei loe erinuppe, btn-full ega modifikaatoreid', () => {
    const src = `<button className="basemap-btn active" /><button className="btn-full fw-crop-delete-btn" />
<button className="year-widget-btn locked-btn" /><span className="has-corner-btn" />`;
    expect(auditTsx(src).legacyButtons).toEqual([]);
  });
  it('summarize annab failid, kus vanu nupuklasse on', () => {
    const r = summarize([
      { path: 'a.tsx', content: '<button className="btn btn-ghost" />' },
      { path: 'b.tsx', content: '<Button variant="ghost" />' },
    ]);
    expect(r.legacyButtonFiles).toEqual([{ path: 'a.tsx', count: 2 }]);
  });
});

describe('auditTsx: vanad modaaliklassid', () => {
  it('loeb vanad modaali osad', () => {
    const src = `<div className="modal-backdrop sub-modal"><div className="modal-content animate-scale-up x">
<div className="modal-header"><div className="modal-title-group"><p className="modal-subtitle" /></div></div>
<div className="modal-body" /><div className="modal-footer" /></div></div>
<div className="modal-backdrop confirm-dialog-backdrop" /><span className="modal-title-with-icon modal-icon-badge" />`;
    expect(auditTsx(src).legacyModals).toEqual([
      'modal-backdrop', 'sub-modal', 'modal-content', 'modal-header', 'modal-title-group', 'modal-subtitle',
      'modal-body', 'modal-footer', 'modal-backdrop', 'confirm-dialog-backdrop', 'modal-title-with-icon', 'modal-icon-badge',
    ]);
  });
  it('ei loe vaatepõhiseid klasse ega ui komponente', () => {
    const src = `<DialogContent className="finance-modal fleet-edit-modal" /><div className="finance-modal-body season-modal-body" />`;
    expect(auditTsx(src).legacyModals).toEqual([]);
  });
  it('summarize annab failid', () => {
    const r = summarize([
      { path: 'a.tsx', content: '<div className="modal-backdrop"><div className="modal-content" /></div>' },
      { path: 'b.tsx', content: '<DialogContent size="md" />' },
    ]);
    expect(r.legacyModalFiles).toEqual([{ path: 'a.tsx', count: 2 }]);
  });
});

describe('auditTsx: vanad tabelid', () => {
  it('loeb toored tabelielemendid ja vanad tabeliklassid', () => {
    const r = auditTsx(
      '<table className="register-table"><thead><tr><th className="num">A</th></tr></thead><tbody><tr className="clickable-row"><td className="actions-col"><div className="row-actions" /></td></tr></tbody></table>'
    );
    expect(r.legacyTables).toEqual([
      '<table>', 'register-table', '<thead>', '<tr>', '<th>', '<tbody>', '<tr>', 'clickable-row', '<td>', 'actions-col', 'row-actions',
    ]);
  });
  it('ei loe ui komponente', () => {
    expect(auditTsx('<Table><TableHeader><TableRow><TableHead numeric>A</TableHead></TableRow></TableHeader></Table>').legacyTables).toEqual([]);
  });
  it('summarize jätab ui kausta välja', () => {
    const r = summarize([
      { path: 'src/components/ui/Table.tsx', content: '<table>' },
      { path: 'src/components/X.tsx', content: '<td>' },
    ]);
    expect(r.legacyTableFiles).toEqual([{ path: 'src/components/X.tsx', count: 1 }]);
  });
});
