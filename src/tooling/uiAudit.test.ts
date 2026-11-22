import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  auditCss,
  auditTsx,
  disallowedFontWeights,
  legacyCardRules,
  offByOneBreakpoints,
  offScaleCss,
  SOURCE_GUARD_ALLOWED,
  sourcedPaths,
  summarize,
  undefinedCssVars,
  unsourcedUtilityFiles,
  unusedCssClasses,
} from './uiAudit';

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

describe('auditTsx: vanad märgid ja sakid', () => {
  it('loeb vanad märgi-, saki- ja segmendiklassid', () => {
    const r = auditTsx(
      '<div className="category-filter-tabs"><button className="filter-tab active">A <span className="count-pill">2</span></button></div><span className="status-badge status-working" /><div className="year-tabs"><button className="year-tab" /></div>'
    );
    expect(r.legacyBadgeTabs).toEqual(['category-filter-tabs', 'filter-tab', 'count-pill', 'status-badge', 'year-tabs', 'year-tab']);
  });
  it('ei loe ui komponente ega sarnaseid nimesid', () => {
    expect(auditTsx('<Badge tone="success" /><TabsTrigger value="a" /><span className="fw-status-dot" />').legacyBadgeTabs).toEqual([]);
  });
  it('summarize jätab ui kausta välja', () => {
    const r = summarize([
      { path: 'src/components/ui/UiGallery.tsx', content: 'className="mini-badge"' },
      { path: 'src/components/X.tsx', content: 'className="mini-badge"' },
    ]);
    expect(r.legacyBadgeTabFiles).toEqual([{ path: 'src/components/X.tsx', count: 1 }]);
  });
  it('loeb tooreid vormielemente ja vanu vormiklasse, jätab file/range/color ja ui kausta vahele', () => {
    const src = '<input className="form-input" /><select>\n</select><textarea />' +
      '<input type="file" /><input type="range" /><input type="color" /><div className="form-group"><div className="form-grid">';
    expect(auditTsx('<input type="color" />').legacyFormFields).toEqual([]);
    expect(auditTsx('<input id="a" className="x" type="color" value={v} />').legacyFormFields).toEqual([]);
    expect(auditTsx(src).legacyFormFields).toEqual(['<input>', 'form-input', '<select>', '<textarea>', 'form-group', 'form-grid']);
    const r = summarize([
      { path: 'src/components/A.tsx', content: src },
      { path: 'src/components/ui/Input.tsx', content: '<input className="x" />' },
    ]);
    expect(r.legacyFormFieldFiles).toEqual([{ path: 'src/components/A.tsx', count: 6 }]);
  });
  it('loeb vanu menüü- ja hüpikuklasse, rolle ja aria-haspopup, ei loe sarnaseid nimesid', () => {
    const src = '<div className="user-menu-dropdown" role="menu"><button aria-haspopup="menu" className="operator-selector-trigger" />' +
      '<div role="tooltip" className="help-hint-popup" /><div className="usermenu" /><div role="listbox" />';
    expect(auditTsx(src).legacyMenuPopups).toEqual(['user-menu-dropdown', 'menu', 'aria-haspopup', 'operator-selector-trigger', 'tooltip', 'help-hint-popup']);
    const r = summarize([
      { path: 'src/components/A.tsx', content: 'role="menu"' },
      { path: 'src/components/ui/Menu.tsx', content: 'role="menu"' },
    ]);
    expect(r.legacyMenuPopupFiles).toEqual([{ path: 'src/components/A.tsx', count: 1 }]);
  });
});

describe('vanad kaardid', () => {
  it('loeb tsx-is glass-card klassi, ei loe sarnaseid nimesid', () => {
    const src = '<div className="add-poi-banner glass-card"><div className="glass-cards x-glass-card" />';
    expect(auditTsx(src).legacyCards).toEqual(['glass-card']);
  });
  it('loeb CSS-is kaardiklassi reegli, mis seab välimuse; ei loe olekuid, !important-i, asetust ega teisi klasse', () => {
    const css = `/* .glass-card kommentaaris */
.empty-register-state { padding: 14px; display: flex; }
.admin-login,
.history-filter-bar { background: var(--bg-card); border: 1px solid var(--border-card); }
.empty-register-state.selected { border-color: green; box-shadow: 0 0 1px red; }
.admin-stat { position: absolute; border-radius: var(--radius-md) !important; }
.add-poi-banner { border-color: pink !important; }
.glass-card { -webkit-backdrop-filter: blur(16px); }
.other-card { background: red; }
@media (max-width: 600px) { .trip-tile { border-radius: 10px; } }`;
    expect(legacyCardRules(css)).toEqual(['.admin-login', '.history-filter-bar', '.glass-card', '.trip-tile']);
  });
  it('summarize annab tsx ja css failid, ui kaust välja', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div className="glass-card" />' },
      { path: 'src/components/ui/Gallery.tsx', content: '<div className="glass-card" />' },
      { path: 'src/styles/map.css', content: '.glass-card { background: red; }' },
    ]);
    expect(r.legacyCardFiles).toEqual([
      { path: 'src/components/A.tsx', count: 1 },
      { path: 'src/styles/map.css', count: 1 },
    ]);
  });
});

describe('defineerimata CSS-muutujad', () => {
  it('leiab var(--x), mida pole üheski CSS-is ega tsx-i style-võtmes; radix/tw muutujad ei loe', () => {
    const css = [
      ':root { --a: 1px; } .x { --local: 2px; color: var(--a); margin: var(--local); border: var(--missing); }',
      '.y { height: var(--radix-popover-content-available-height); width: var(--tw-x); background: var(--from-tsx); gap: var(--gone, 4px); }',
    ];
    const tsx = ["<div style={{ '--from-tsx': c } as React.CSSProperties} />"];
    expect(undefinedCssVars(css, tsx)).toEqual(['--gone', '--missing']);
  });
});

describe('kasutuseta klassid', () => {
  it('leiab klassi, mida lähtekoodis pole; kommentaar, url(), string ja leaflet-* ei loe', () => {
    const css = `/* .old-comment {} */
.used { a: 1 }
.dead, .used:hover { b: 2 }
.leaflet-x { c: 3 }
.bg { background: url("http://www.w3.org/x.svg"); content: ".fake"; }
.tone-3 { d: 4 }
[data-slot="table"] .row-dead { e: 5 }`;
    const r = unusedCssClasses(css, ['<div className="used bg" />', 'const c = `tone-${n}`;']);
    expect(r.unused).toEqual(['dead', 'row-dead']);
    expect(r.dynamic).toEqual(['tone-3']);
  });
  it('kommentaaris olev nimi lähtekoodis ei loe kasutuseks', () => {
    expect(unusedCssClasses('.gone { a: 1 }', ['// gone oli vana klass\n/* gone */ const x = 1;']).unused).toEqual(['gone']);
  });
  it("dünaamiline eesliide ka 'prefix-' + x kujul", () => {
    expect(unusedCssClasses('.weather-wet { a: 1 }', ["const c = 'weather-' + level;"]).dynamic).toEqual(['weather-wet']);
  });
});

describe('skaalavälised väärtused CSS-is', () => {
  it('kirjasuurus ja vahe väljaspool skaalat; muutujad, 0, auto ja negatiivne skaala ei loe', () => {
    const r = offScaleCss('.a{font-size:13px;font-size:0.8rem;font-size:15px;padding:4px 14px;margin:-8px 0 auto;gap:var(--g)}');
    expect(r.fontSizes).toEqual(['0.8rem', '15px']);
    expect(r.spacing).toEqual(['14px']);
  });
});

describe('toored nupud', () => {
  it('loeb <button, mitte <Button; ui kaust ja lubatud erandid välja', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<button type="button">a</button><Button>b</Button><button\n  type="button">c</button>' },
      { path: 'src/components/ui/X.tsx', content: '<button type="button" />' },
      { path: 'src/components/LoginPage.tsx', content: '<button type="button" className="login-forgot-link">' },
      { path: 'src/components/MapView.tsx', content: '`<button type="button" class="map-popup-btn">`' },
    ]);
    expect(r.rawButtonFiles).toEqual([{ path: 'src/components/A.tsx', count: 2 }]);
  });
  it('kommentaarides olev <button ei loe, URL ja string jäävad', () => {
    const src = '// <button a\n/* <button b */\n{/* <button c */}\nconst u = "https://x"; <button type="button">d</button>';
    const r = summarize([{ path: 'src/components/B.tsx', content: src }]);
    expect(r.rawButtonFiles).toEqual([{ path: 'src/components/B.tsx', count: 1 }]);
  });
  it('erand kehtib ainult täisteele (src/components/…), mitte samanimelisele failile mujal', () => {
    const r = summarize([{ path: 'src/admin/components/LoginPage.tsx', content: '<button type="button">' }]);
    expect(r.rawButtonFiles).toEqual([{ path: 'src/admin/components/LoginPage.tsx', count: 1 }]);
  });
  it('erand lubab ainult nimetatud arvu: teine toores nupp samas failis loeb', () => {
    const r = summarize([{ path: 'src/components/LoginPage.tsx', content: '<button type="button"><button type="button">' }]);
    expect(r.rawButtonFiles).toEqual([{ path: 'src/components/LoginPage.tsx', count: 1 }]);
  });
});

describe('role=button väljaspool ui-d', () => {
  it('loeb role="button" div/span-i; ui kaust, kommentaarid ja lubatud erandid välja', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div role="button" tabIndex={0}/><span role="button"/>' },
      { path: 'src/components/ui/Card.tsx', content: "role={keyboard ? 'button' : role} role=\"button\"" },
      { path: 'src/components/B.tsx', content: '{/* <div role="button"> */}\n// role="button"\n<Button>x</Button>' },
      { path: 'src/components/TripRouteView.tsx', content: '<span role="button">' },
    ]);
    expect(r.roleButtonFiles).toEqual([{ path: 'src/components/A.tsx', count: 2 }]);
  });
  it('erand lubab ainult nimetatud arvu ja ainult täisteed', () => {
    const r = summarize([
      { path: 'src/components/LayerControl.tsx', content: '<div role="button"><div role="button">' },
      { path: 'src/admin/components/LayerControl.tsx', content: '<div role="button">' },
    ]);
    expect(r.roleButtonFiles).toEqual([
      { path: 'src/components/LayerControl.tsx', count: 1 },
      { path: 'src/admin/components/LayerControl.tsx', count: 1 },
    ]);
  });
  it('ei loe aria-role-sarnaseid nimesid (data-role="button")', () => {
    const r = summarize([{ path: 'src/components/C.tsx', content: '<i data-role="button" />' }]);
    expect(r.roleButtonFiles).toEqual([]);
  });
});

describe('disallowedFontWeights', () => {
  it('tuvastab font-weight: 800 ja 900 CSS-is ning font-extrabold TSX-is', () => {
    const files = [
      { path: 'src/components/A.tsx', content: '<div className="font-extrabold text-sm" />' },
      { path: 'src/styles/map.css', content: '.v { font-weight: 800; }' },
      { path: 'src/styles/login.css', content: '.login-brand-word { font-weight: 800; }\n.other { font-weight: 800; }' },
    ];
    const r = disallowedFontWeights(files);
    expect(r).toEqual([
      { path: 'src/components/A.tsx', count: 1 },
      { path: 'src/styles/map.css', count: 1 },
      { path: 'src/styles/login.css', count: 1 },
    ]);
  });
  it('lubab täpselt 1 font-weight: 800 failis src/styles/login.css (logo brändisõna)', () => {
    const files = [
      { path: 'src/styles/login.css', content: '.login-brand-word { font-weight: 800; }' },
      { path: 'src/components/B.tsx', content: '<div className="font-semibold" />' },
    ];
    expect(disallowedFontWeights(files)).toEqual([]);
  });
  it('landing: kuni 3 × font-weight: 800 failis src/landing/landing.css (pealkiri, brändisõna, sammu number), neljas on viga', () => {
    const three = '.a{font-weight:800}.b{font-weight:800}.c{font-weight:800}';
    expect(disallowedFontWeights([{ path: 'src/landing/landing.css', content: three }])).toEqual([]);
    expect(disallowedFontWeights([{ path: 'src/landing/landing.css', content: `${three}.d{font-weight:800}` }])).toEqual([
      { path: 'src/landing/landing.css', count: 1 },
    ]);
  });
});

describe('audit katab vaated (etapp 4.0)', () => {
  it('suvalised väärtused ja skaalavälised vahed loevad src/components, src/admin ja App.tsx failides', () => {
    const bad = '<p className="p-[7px] text-[13px] mt-5 gap-x-7" />';
    const r = summarize([
      { path: 'src/components/FinanceModal.tsx', content: bad },
      { path: 'src/admin/TenantsView.tsx', content: bad },
      { path: 'src/App.tsx', content: bad },
    ]);
    expect(r.arbitrary.map((a) => a.path)).toEqual(
      ['src/components/FinanceModal.tsx', 'src/components/FinanceModal.tsx', 'src/admin/TenantsView.tsx', 'src/admin/TenantsView.tsx', 'src/App.tsx', 'src/App.tsx']
    );
    expect(r.offScaleSpacing.map((a) => `${a.path}:${a.cls}`)).toContain('src/admin/TenantsView.tsx:mt-5');
  });
  it('lubab Tailwindi variandid ja nimega klassid', () => {
    const r = summarize([
      {
        path: 'src/components/X.tsx',
        content:
          '<p className="hover:bg-muted aria-[current=page]:bg-card data-[state=open]:p-2 [&>td]:text-sm dark:text-primary grid-cols-[360px_minmax(0,1fr)] max-w-105 p-2.5 gap-x-4" />',
      },
    ]);
    expect(r.arbitrary).toEqual([]);
    expect(r.offScaleSpacing).toEqual([]);
  });
});

describe('vanad ülevaateklassid (etapp 4.1)', () => {
  it('loeb vanad päise-, pealkirja-, plaadi-, legendi- ja finance-klassid ja admin-login; ui kaust välja', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div className="fullpage-board-header form-sub-header trip-tile finance-kpi-card finance-entry-card section-title" />' },
      { path: 'src/components/ui/X.tsx', content: '<div data-slot="section-title" className="fullpage-board-header" />' },
      { path: 'src/admin/B.tsx', content: '<div className="admin-login" />' },
    ]);
    expect(r.legacyOverviewFiles).toEqual([
      { path: 'src/components/A.tsx', count: 6 },
      { path: 'src/admin/B.tsx', count: 1 },
    ]);
  });
});

describe('leading-[…] on keelatud suvaline väärtus (etapp 4b)', () => {
  it('märgib leading-[normal] ja leading-[1.2], lubab nimega klassid', () => {
    const bad = summarize([{ path: 'src/components/X.tsx', content: '<p className="leading-[normal] leading-[1.2]" />' }]);
    expect(bad.arbitrary.map((a) => a.cls)).toEqual(['leading-[normal]', 'leading-[1.2]']);
    const ok = summarize([{ path: 'src/components/X.tsx', content: '<p className="leading-natural leading-tight leading-6" />' }]);
    expect(ok.arbitrary).toEqual([]);
  });
});

describe('@source valvur (etapp 4b)', () => {
  const css = `
    /* @source '../components/Kommentaar.tsx'; */
    @source '../components/ui';
    @source '../components/FinanceModal.tsx';
    @source not '../components/ui/**/*.{md,test.ts}';
    @source '../App.tsx';
  `;
  it('loeb @source read, jätab kommentaarid ja "not" välja', () => {
    expect(sourcedPaths(css)).toEqual(['src/components/ui', 'src/components/FinanceModal.tsx', 'src/App.tsx']);
  });
  const view = (path: string, content: string) => ({ path, content });
  it('märgib vaatefaili, kus on utiliidi tokeneid, aga mis pole @source-is', () => {
    const r = unsourcedUtilityFiles([view('src/components/Uus.tsx', '<div className="flex items-center gap-2 text-sm" />')], css);
    expect(r).toEqual([{ path: 'src/components/Uus.tsx', tokens: ['gap-2', 'items-center', 'text-sm'] }]);
  });
  it('ei märgi @source-is olevat faili ega ui kataloogi', () => {
    const files = [
      view('src/components/FinanceModal.tsx', '<div className="gap-2 text-sm" />'),
      view('src/components/ui/X.tsx', '<div className="gap-2" />'),
      view('src/App.tsx', '<div className="gap-2" />'),
    ];
    expect(unsourcedUtilityFiles(files, css)).toEqual([]);
  });
  it('ainult ühesõnalised nimed (flex, hidden, border) ei loe: need kattuvad vana CSS-iga', () => {
    expect(unsourcedUtilityFiles([view('src/components/A.tsx', '<div className="flex hidden border" />')], css)).toEqual([]);
  });
  it('lubatud loendi failid jäetakse välja', () => {
    const [path] = Object.keys(SOURCE_GUARD_ALLOWED);
    expect(unsourcedUtilityFiles([view(path, '<p className="gap-2" />')], css)).toEqual([]);
  });
  it('admin ja ülemise taseme vaated loevad; teised kataloogid (services) mitte', () => {
    const a = unsourcedUtilityFiles([view('src/admin/X.tsx', '<p className="px-3" />')], css);
    expect(a.map((x) => x.path)).toEqual(['src/admin/X.tsx']);
    expect(unsourcedUtilityFiles([view('src/services/X.tsx', '<p className="px-3" />')], css)).toEqual([]);
  });
});

describe('vanad fw-* klassid (etapp 4b)', () => {
  it('loeb fw-* klassid tsx-is, kommentaare ja ui kausta mitte; fw-ga algav suvaline sõna ei loe', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div className="fw-card fw-cell-no-sow" /> {/* fw-board-view kommentaar */} // fw-main' },
      { path: 'src/components/ui/X.tsx', content: '<div className="fw-card" />' },
      { path: 'src/components/B.tsx', content: '<div className="draw-fw fwx-a" />' },
    ]);
    expect(r.legacyOverviewFiles).toEqual([{ path: 'src/components/A.tsx', count: 2 }]);
  });
});

describe('vanad Tehnika ja sõitude klassid (etapp 4c)', () => {
  it('loeb kustutatud klassid tsx-is, mitte id-sid, jagatud klasse ega kommentaare', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div className="swap-option-item fleet-top-bar trip-stop-dot" /> {/* gauge-item kommentaar */}' },
      { path: 'src/components/B.tsx', content: '<Field htmlFor="imp-name"><input id="dev-model" /></Field><div id="trip-notes" className="auth-error-banner" />' },
      { path: 'src/components/C.tsx', content: '<div className="dev-model" />' },
    ]);
    expect(r.legacyOverviewFiles).toEqual([{ path: 'src/components/A.tsx', count: 3 }, { path: 'src/components/C.tsx', count: 1 }]);
  });
});

describe('vanad kaardi paneelide klassid (etapp 4d)', () => {
  it('loeb kustutatud klassid tsx-is, mitte id-sid, jagatud klasse ega kommentaare', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div className="layer-item v-indiv-row cc-notice" /> {/* satellite-panel-note kommentaar */}' },
      { path: 'src/components/B.tsx', content: '<Field htmlFor="layer-text" /><div id="cc-header" className="crop-legend-item layer-loading-bar cc-range add-poi-banner" />' },
    ]);
    expect(r.legacyOverviewFiles).toEqual([{ path: 'src/components/A.tsx', count: 3 }]);
  });
});

describe('vanad dialoogide klassid (etapp 4e)', () => {
  it('loeb kustutatud klassid tsx-is, mitte id-sid, jagatud klasse ega kommentaare', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div className="add-work-option telemetry-pill-row alert-box error" /> {/* pria-grid kommentaar */}' },
      { path: 'src/components/B.tsx', content: '<Field htmlFor="season-year" /><div id="work-entry-body" className="year-col selected year-cell has-crop sr-only login-notice" />' },
    ]);
    expect(r.legacyOverviewFiles).toEqual([{ path: 'src/components/A.tsx', count: 3 }]);
  });
});

describe('vanad kesta ja Põllud-tabeli klassid (etapp 4f)', () => {
  it('loeb kustutatud kesta, tööriistariba ja tabeli klassid tsx-is, mitte id-sid', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div className="fullpage-board-view" /><main className="fullpage-board-main wide" /><div className="register-actions-bar" />' },
      { path: 'src/components/B.tsx', content: '<Field htmlFor="search-field" /><div id="name-cell" className="year-col selected year-cell has-crop" />' },
    ]);
    expect(r.legacyOverviewFiles).toEqual([{ path: 'src/components/A.tsx', count: 3 }]);
  });
});

describe('vanad päise, menüü ja väikeste vaadete klassid (etapp 4f)', () => {
  it('loeb kustutatud klassid tsx-is, mitte id-sid, jäävaid erandeid ega kommentaare', () => {
    const r = summarize([
      { path: 'src/components/A.tsx', content: '<div className="app-header header-brand fullpage-board-view" /> {/* weather-chart kommentaar */}' },
      { path: 'src/components/B.tsx', content: '<Field htmlFor="login-name" /><div id="header-actions" className="login-page login-card year-col v-name has-crop sr-only help-content" />' },
    ]);
    expect(r.legacyOverviewFiles).toEqual([{ path: 'src/components/A.tsx', count: 3 }]);
  });
});

describe('offByOneBreakpoints', () => {
  it('märgib vana max-width ilma +1-ta, ka konteineripäringul', () => {
    expect(offByOneBreakpoints('<div className="max-[760px]:flex @max-[560px]:grid max-[1655px]:hidden max-[900px]:p-2" />')).toEqual([
      'max-[760px]', '@max-[560px]', 'max-[1655px]', 'max-[900px]',
    ]);
  });
  it('lubab N+1 ja min-laiused', () => {
    expect(offByOneBreakpoints('max-[761px]:flex @max-[561px]:grid max-[1656px]:hidden min-[760px]:flex md:flex')).toEqual([]);
  });
  it('kommentaaris olev ei loe', () => {
    expect(offByOneBreakpoints('// vana max-[760px]:flex\n<div className="max-[761px]:flex" />')).toEqual([]);
  });
});

describe('murdepunktid lähtekoodis', () => {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = `${d}/${n}`;
      if (n.startsWith('._')) return [];
      if (statSync(p).isDirectory()) return walk(p);
      return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) && !p.includes('/tooling/') ? [p] : [];
    });
  it('ükski src/ ts/tsx fail ei kasuta max-[N px] ilma +1-ta', () => {
    const bad = walk('src').flatMap((p) => offByOneBreakpoints(readFileSync(p, 'utf8')).map((c) => `${p}: ${c}`));
    expect(bad).toEqual([]);
  });
});
