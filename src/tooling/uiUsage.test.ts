import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { comboCount, comboKey, exampleId, isStaticCombo, nextSelection, countUiUsage, isCountedFile, isInsideUiFile, isUnused, parseUiComponents, propLabel, stripComments } from './uiUsage.ts';
import { computeUiUsage } from './uiUsagePlugin.ts';

const INDEX = `
export { cn } from './cn';
export { Button, type ButtonProps } from './Button';
export { Card, CardTitle, type CardProps } from './Card';
export { Dialog, usePopupContainer } from './Dialog';
export { parseNumberText, NumberInput } from './NumberInput';
export { cornerActionClass, type FieldSize, MAX_ITEMS } from './variants';
// export { Hidden } from './Hidden';
`;

const usage = (files: Record<string, string>) => countUiUsage({ indexSource: INDEX, files, generatedAt: '2026-11-26T10:00:00.000Z' });
const get = (files: Record<string, string>, name: string) => usage(files).components.find((c) => c.name === name)!;

describe('parseUiComponents', () => {
  it('võtab suurtähega ekspordid; tüübid, funktsioonid, hookid ja konstandid jäävad välja', () => {
    expect(parseUiComponents(INDEX)).toEqual(['Button', 'Card', 'CardTitle', 'Dialog', 'NumberInput']);
  });
  it('kommenteeritud eksport ei loe ja `X as Y` annab eksporditud nime', () => {
    expect(parseUiComponents("export { A as Aliased } from './A';\n/* export { B } from './B'; */")).toEqual(['Aliased']);
  });
});

describe('stripComments', () => {
  it('eemaldab rea- ja plokkkommentaarid, sõne sisu ja URL jäävad', () => {
    const out = stripComments(`a // <Button\n/* <Button */ b {/* <Button */} "//x" 'a/*b*/' http://x`);
    expect(out).not.toContain('<Button');
    expect(out).toContain('"//x"');
    expect(out).toContain("'a/*b*/'");
    expect(out).toContain('http://x');
  });
});

describe('isCountedFile', () => {
  it('loeb src .tsx faile, välja jäävad ui/ (galerii ja komponendid), testid ja ._ failid', () => {
    expect(isCountedFile('src/components/Fields.tsx')).toBe(true);
    expect(isCountedFile('src/admin/AdminApp.tsx')).toBe(true);
    expect(isCountedFile('src/components/ui/UiGallery.tsx')).toBe(false);
    expect(isCountedFile('src/components/ui/Button.tsx')).toBe(false);
    expect(isCountedFile('src/components/Fields.test.tsx')).toBe(false);
    expect(isCountedFile('src/components/._Fields.tsx')).toBe(false);
    expect(isCountedFile('src/lib/x.ts')).toBe(false);
    expect(isCountedFile('scripts/x.tsx')).toBe(false);
  });
});

describe('countUiUsage', () => {
  it('kommentaarid ei loe, galerii ja testid jäävad välja', () => {
    const files = {
      'src/a.tsx': `// <Button>\n/* <Button> */\nexport const A = () => <div>{/* <Button/> */}<Button>x</Button><Button /></div>;`,
      'src/components/ui/UiGallery.tsx': '<Button/><Button/>',
      'src/a.test.tsx': '<Button/>'
    };
    const b = get(files, 'Button');
    expect(b.count).toBe(2);
    expect(b.fileCount).toBe(1);
    expect(b.files).toEqual([{ file: 'src/a.tsx', count: 2 }]);
  });

  it('failid on kordade järgi kahanevas järjekorras, võrdsete puhul nime järgi', () => {
    const b = get({ 'src/z.tsx': '<Card/>', 'src/b.tsx': '<Card/><Card/>', 'src/a.tsx': '<Card/>' }, 'Card');
    expect(b.files.map((f) => f.file)).toEqual(['src/b.tsx', 'src/a.tsx', 'src/z.tsx']);
    expect(b.count).toBe(4);
    expect(b.fileCount).toBe(3);
  });

  it('kasutamata komponent on 0 kohta; eesliitega nimi (CardTitle vs Card) ei lähe segi', () => {
    const files = { 'src/a.tsx': '<CardTitle>x</CardTitle>' };
    expect(get(files, 'Card').count).toBe(0);
    expect(get(files, 'CardTitle').count).toBe(1);
    expect(get(files, 'Dialog').files).toEqual([]);
  });

  it('alamkomponent `<Dialog.Foo` loeb Dialog kasutuseks; tüübiargument `Foo<Button` ei loe', () => {
    const files = { 'src/a.tsx': 'const x = useRef<Button>(null); <Dialog.Root><Dialog open /></Dialog.Root>' };
    expect(get(files, 'Dialog').count).toBe(2);
    expect(get(files, 'Button').count).toBe(0);
  });

  it('variantide jaotus: staatiline, dünaamiline ja vaikimisi', () => {
    const files = {
      'src/a.tsx': `<Button variant="ghost" size="sm">a</Button>
<Button variant='ghost'>b</Button>
<Button variant={'danger'}>c</Button>
<Button variant={on ? 'primary' : 'ghost'} onClick={() => f({ variant: 'x' })}>d</Button>
<Button>e</Button>
<Button {...rest} title="a > b" />`
    };
    const b = get(files, 'Button');
    expect(b.count).toBe(6);
    const variant = b.props.find((p) => p.prop === 'variant')!;
    expect(variant.values).toEqual([
      { kind: 'static', value: 'ghost', count: 2 },
      { kind: 'default', count: 2 },
      { kind: 'static', value: 'danger', count: 1 },
      { kind: 'dynamic', count: 1 }
    ]);
    const size = b.props.find((p) => p.prop === 'size')!;
    expect(size.values).toEqual([{ kind: 'default', count: 5 }, { kind: 'static', value: 'sm', count: 1 }]);
    expect(b.props.some((p) => p.prop === 'tone')).toBe(false);
  });

  it('prop, mida kunagi ei kirjutata, ei ilmu aruandes', () => {
    expect(get({ 'src/a.tsx': '<Card>x</Card>' }, 'Card').props).toEqual([]);
  });

  it('aeg tuleb sisendist', () => {
    expect(usage({}).generatedAt).toBe('2026-11-26T10:00:00.000Z');
  });
});

describe('propikombinatsioonid', () => {
  const files = {
    'src/a.tsx': `<Button variant="ghost" size="icon-sm">a</Button>
<Button variant="ghost" size="icon-sm">b</Button>
<Button size="icon-sm">c</Button>
<Button variant={v} size="icon-sm">d</Button>
<Button variant="ghost">e</Button>
<Button>f</Button>`
  };
  it('loeb täpse kombinatsiooni kordi, kahanevalt, siltidega vaikimisi/dünaamiline', () => {
    const b = get(files, 'Button');
    expect(b.comboProps).toEqual(['variant', 'size']);
    expect(b.combos).toEqual([
      { values: ['ghost', 'icon-sm'], count: 2 },
      { values: ['dünaamiline', 'icon-sm'], count: 1 },
      { values: ['ghost', 'vaikimisi'], count: 1 },
      { values: ['vaikimisi', 'icon-sm'], count: 1 },
      { values: ['vaikimisi', 'vaikimisi'], count: 1 }
    ]);
    expect(b.combos.reduce((s, c) => s + c.count, 0)).toBe(b.count);
  });
  it('comboKey, propLabel ja comboCount kasutavad sama vormingut', () => {
    const b = get(files, 'Button');
    expect(comboKey(['vaikimisi', 'icon-sm'])).toBe('vaikimisi · icon-sm');
    expect(propLabel(undefined)).toBe('vaikimisi');
    expect(propLabel('ghost')).toBe('ghost');
    expect(comboCount(b, 'ghost · icon-sm')).toBe(2);
    expect(comboCount(b, 'danger · icon-xs')).toBe(0);
  });
  it('kasutamata propid kombinatsiooni ei satu; ui sees olevad kasutused kombinatsioone ei mõjuta', () => {
    const b = get({ ...files, 'src/components/ui/Menu.tsx': '<Button variant="danger" size="xs" />' }, 'Button');
    expect(b.combos.some((c) => c.values.includes('danger'))).toBe(false);
    expect(get({ 'src/a.tsx': '<Card>x</Card>' }, 'Card').combos).toEqual([]);
  });
});

describe('ühiste komponentide sees', () => {
  it('isInsideUiFile: ui/ .tsx failid, v.a. galerii, testid ja ._ failid', () => {
    expect(isInsideUiFile('src/components/ui/Menu.tsx')).toBe(true);
    expect(isInsideUiFile('src/components/ui/UiGallery.tsx')).toBe(false);
    expect(isInsideUiFile('src/components/ui/UiGalleryUsage.tsx')).toBe(false);
    expect(isInsideUiFile('src/components/ui/Menu.test.tsx')).toBe(false);
    expect(isInsideUiFile('src/components/ui/._Menu.tsx')).toBe(false);
    expect(isInsideUiFile('src/components/ui/cn.ts')).toBe(false);
    expect(isInsideUiFile('src/components/Fields.tsx')).toBe(false);
  });
  it('loeb ui-sisese kasutuse eraldi; rakenduse arv jääb samaks', () => {
    const c = get(
      {
        'src/a.tsx': '<Card/>',
        'src/components/ui/Menu.tsx': '<Card/><Card/>{/* <Card/> */}',
        'src/components/ui/UiGallery.tsx': '<Card/><Card/><Card/>'
      },
      'Card'
    );
    expect(c.count).toBe(1);
    expect(c.insideUi).toBe(2);
    expect(c.files).toEqual([{ file: 'src/a.tsx', count: 1 }]);
  });
  it('kasutamata on ainult siis, kui mõlemad arvud on 0', () => {
    expect(isUnused({ count: 0, insideUi: 0 })).toBe(true);
    expect(isUnused({ count: 0, insideUi: 2 })).toBe(false);
    expect(isUnused({ count: 3, insideUi: 0 })).toBe(false);
    const files = { 'src/components/ui/Menu.tsx': '<CardTitle/>' };
    expect(isUnused(get(files, 'CardTitle'))).toBe(false);
    expect(isUnused(get(files, 'Card'))).toBe(true);
  });
});

describe('päris repo', () => {
  it('Dropzone ja Button kordade ning failide arv klapivad grep-iga', () => {
    const u = computeUiUsage('.');
    const grep = (name: string) => {
      const out = execSync(
        `grep -rEo --include='*.tsx' --exclude='*.test.*' --exclude='._*' --exclude-dir=ui '<${name}([^A-Za-z0-9_$]|$)' src | cut -d: -f1 | sort | uniq -c`,
        { encoding: 'utf8' }
      );
      const rows = out.trim().split('\n').filter(Boolean);
      return { files: rows.length, count: rows.reduce((s, r) => s + Number(r.trim().split(/\s+/)[0]), 0) };
    };
    for (const name of ['Dropzone', 'Button']) {
      const c = u.components.find((x) => x.name === name)!;
      const g = grep(name);
      expect(c.count, name).toBeGreaterThan(0);
      expect({ count: c.count, files: c.fileCount }, name).toEqual(g);
    }
  });

  it('kõik index.ts-i komponendid on loendis ja galerii ei lähe arvesse', () => {
    const u = computeUiUsage('.');
    expect(u.components.map((c) => c.name)).toEqual(parseUiComponents(readFileSync('src/components/ui/index.ts', 'utf8')));
    expect(u.components.flatMap((c) => c.files).some((f) => f.file.startsWith('src/components/ui/'))).toBe(false);
  });
});

describe('külgpaneeli valik', () => {
  it('klõps vahetab komponenti, sama märk sulgeb', () => {
    expect(nextSelection(null, 'Button')).toBe('Button');
    expect(nextSelection('Button', 'Badge')).toBe('Badge');
    expect(nextSelection('Badge', 'Badge')).toBeNull();
  });

  it('näidise tunnus ja staatilised kombinatsioonid', () => {
    expect(exampleId('Button', 'ghost · sm')).toBe('Button|ghost · sm');
    expect(isStaticCombo(['ghost', 'sm'])).toBe(true);
    expect(isStaticCombo(['dünaamiline', 'sm'])).toBe(false);
  });
});
