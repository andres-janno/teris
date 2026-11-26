// src/components/ui/UiGalleryUsage.tsx — kasutusmärgid galeriis /ui: mitu korda ja mitmes failis iga ühist komponenti
// rakenduses kasutatakse. Andmed pakub ehitusaegne plugin (virtual:ui-usage, vt src/tooling/uiUsagePlugin.ts).
// Fail on galerii osa ega kuulu ui/ indeksisse; ui/ kaust jääb loendusest välja.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import usageData from 'virtual:ui-usage';
import { comboCount, comboKey, exampleId, isUnused, nextSelection, propLabel, type ComponentUsage } from '../../tooling/uiUsage';
import { formatDateTimeTallinn } from '../../services/dateFormat';
import { Badge, Button, Card, CardActions, CardHeader, cn, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './index';

/** Galerii enda sektsiooni- ja külgpaneeli raam (rakenduse vaated Panel-it ei kasuta). */
export const GalleryPanel: React.FC<{
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, actions, className, bodyClassName, children }) => (
  <Card asChild padding="none" className={cn('flex flex-col', className)}>
    <section>
      <CardHeader className="border-b border-border px-4 py-3">
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
        {actions && <CardActions className="gap-2">{actions}</CardActions>}
      </CardHeader>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  </Card>
);

const byName = new Map(usageData.components.map((c) => [c.name, c]));

// Galeriis näidatud kombinatsioonid ("Button|vaikimisi · icon-sm"). Täidab UsageExample renderdamisel (idempotentne);
// hüpik loeb seda avamisel, kui kõik näidised on juba renderdatud.
const shownCombos = new Set<string>();

const summaryText = (c: ComponentUsage): string => `${c.count} kohta ${c.fileCount} failis`;

/** Näidise kombinatsiooni võti, arvutatud näidise tegelikest propidest (sama vorming kui loenduses). */
export function exampleKey(usage: ComponentUsage, props: Record<string, unknown>): string {
  return comboKey(usage.comboProps.map((p) => propLabel(props[p])));
}

type SelectionState = {
  selected: string | null;
  select: (name: string) => void;
  close: () => void;
  /** Paneeli tabelirea all esile tõstetud näidis (exampleId) või null. */
  highlight: string | null;
  setHighlight: (id: string | null) => void;
};
const SelectionContext = createContext<SelectionState>({ selected: null, select: () => {}, close: () => {}, highlight: null, setHighlight: () => {} });
// „Kasutamata variandid“ rea sees olevad näidised märgitakse (test kontrollib, et seal on ainult 0 kasutusega näidised).
const UnusedContext = createContext(false);

type ExampleProps<C extends React.ElementType> = {
  as: C;
  /** Komponendi nimi index.ts-is (loenduse võti). */
  name: string;
  /** Täpselt need propid antakse komponendile; pealdis tuletatakse samast objektist. */
  props: React.ComponentProps<C>;
  children?: React.ReactNode;
  /** Ümbrise lisaklassid (nt `w-full` vormiväljas). */
  className?: string;
};

/** Mitu korda see näidise kombinatsioon rakenduses esineb (galerii kasutab kasutamata variantide valikuks). */
export function exampleCount(name: string, props: Record<string, unknown>): number {
  const usage = byName.get(name);
  return usage ? comboCount(usage, exampleKey(usage, props)) : 0;
}

/** Galerii näidis: komponent + pealdis „kombinatsioon · kordi rakenduses“. */
export function UsageExample<C extends React.ElementType>({ as, name, props, children, className }: ExampleProps<C>): React.ReactElement {
  const Component = as as React.ElementType;
  const usage = byName.get(name);
  const key = usage ? exampleKey(usage, props as Record<string, unknown>) : '';
  if (usage) shownCombos.add(exampleId(name, key));
  const count = usage ? comboCount(usage, key) : 0;
  const unused = useContext(UnusedContext);
  const { highlight } = useContext(SelectionContext);
  const id = exampleId(name, key);
  const active = highlight === id;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // block: 'nearest' — leht ei hüppa, kui näidis on juba nähtaval
    if (active) ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);
  return (
    <div
      ref={ref}
      data-usage-example={id}
      className={`flex flex-col items-start gap-1 rounded-md ${active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''} ${className ?? ''}`.trim()}
    >
      <Component {...(props as object)}>{children}</Component>
      <span className="text-2xs tabular-nums text-muted-foreground" data-usage-caption={name} data-usage-key={key} data-usage-unused={unused ? 'true' : undefined}>
        {key ? `${key} · ${count}` : count}
      </span>
    </div>
  );
}

/** Rakenduses kasutamata variantide rida jaotuse lõpus: dokumenteeritud, aga ei näita normi. */
export const UnusedVariants: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <UnusedContext.Provider value>
    <div className="flex w-full flex-wrap items-start gap-3 border-t border-dashed border-border pt-3 opacity-70">
      <span className="w-full text-xs font-medium text-muted-foreground">Kasutamata variandid</span>
      {children}
    </div>
  </UnusedContext.Provider>
);

/** Failinimi, mis murdub kaldkriipsu kohalt (ei keset sõna). */
const BreakablePath: React.FC<{ path: string }> = ({ path }) => (
  <span className="min-w-0 break-words">
    {path.split('/').map((part, i, all) => (
      <React.Fragment key={i}>
        {part}
        {i < all.length - 1 && <>/<wbr /></>}
      </React.Fragment>
    ))}
  </span>
);

const UsageDetails: React.FC<{ usage: ComponentUsage }> = ({ usage }) => {
  const { setHighlight } = useContext(SelectionContext);
  return (
  <div className="flex min-w-0 flex-col gap-3 text-sm">
    <div>
      <div className="font-semibold">{usage.name}</div>
      <div className="text-muted-foreground">{usage.count === 0 ? 'Rakenduses ei kasutata' : summaryText(usage)}</div>
      {usage.insideUi > 0 && (
        <div className="text-muted-foreground">
          + <span className="tabular-nums">{usage.insideUi}</span> kohta ühiste komponentide sees
        </div>
      )}
    </div>
    {usage.combos.length > 0 && usage.comboProps.length > 0 && (
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground">Kombinatsioonid</div>
        <Table dense scroll="none" className="text-xs">
          <TableHeader>
            <TableRow>
              {usage.comboProps.map((p) => <TableHead key={p}>{p}</TableHead>)}
              <TableHead numeric>Kordi</TableHead>
              <TableHead>Näidis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.combos.map((c) => {
              const id = exampleId(usage.name, comboKey(c.values));
              const has = shownCombos.has(id);
              return (
                <TableRow
                  key={id}
                  tabIndex={0}
                  onMouseEnter={() => setHighlight(has ? id : null)}
                  onMouseLeave={() => setHighlight(null)}
                  onFocus={() => setHighlight(has ? id : null)}
                  onBlur={() => setHighlight(null)}
                >
                  {c.values.map((v, i) => (
                    <TableCell key={usage.comboProps[i]} wrap className={v === 'vaikimisi' || v === 'dünaamiline' ? 'text-muted-foreground' : undefined}>{v}</TableCell>
                  ))}
                  <TableCell numeric>{c.count}</TableCell>
                  <TableCell>{has ? <Badge tone="success">galeriis</Badge> : <Badge tone="warning">puudub</Badge>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    )}
    {usage.files.length > 0 && (
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground">Failid</div>
        <div className="flex flex-col gap-1">
          {usage.files.map((f) => (
            <div key={f.file} className="flex justify-between gap-3">
              <BreakablePath path={f.file.replace(/^src\//, '')} />
              <span className="tabular-nums">{f.count}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
  );
};

/** Üks märk: „Button · 412 kohta 96 failis“; klõps näitab üksikasju külgpaneelis. */
const UsageBadge: React.FC<{ name: string }> = ({ name }) => {
  const usage = byName.get(name);
  const { selected, select } = useContext(SelectionContext);
  if (!usage) return <Badge tone="danger">{name} · puudub registrist</Badge>;
  return (
    <Button variant="bare" size="inline" aria-label={`${name}: kasutuse üksikasjad`} aria-pressed={selected === name} onClick={() => select(name)}>
      <Badge tone={isUnused(usage) ? 'warning' : 'neutral'} className={selected === name ? 'ring-2 ring-primary' : undefined}>
        <span>{name} ·</span> <span className="tabular-nums">{usage.count === 0 ? '0 kohta' : summaryText(usage)}{usage.count === 0 && usage.insideUi > 0 ? ` (+${usage.insideUi} sees)` : ''}</span>
      </Badge>
    </Button>
  );
};

/** Külgpaneel: valitud komponendi kasutus; ilma valikuta vihje. */
const UsagePanel: React.FC = () => {
  const { selected, close } = useContext(SelectionContext);
  const usage = selected ? byName.get(selected) : undefined;
  return (
    <aside
      className={`${usage ? 'flex' : 'hidden lg:flex'} fixed inset-x-0 bottom-0 z-30 max-h-[45vh] flex-col lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-6 lg:z-auto lg:max-h-[calc(100vh-3rem)]`}
      aria-label="Komponendi kasutus"
    >
      <GalleryPanel
        className="min-h-0 flex-1 shadow-lg lg:shadow-none"
        bodyClassName="min-h-0 flex-1 overflow-y-auto"
        title={<span className="text-base">Kasutus</span>}
        actions={usage && <Button variant="ghost" size="icon-sm" aria-label="Sulge paneel" onClick={close}><X size={14} /></Button>}
      >
        {usage ? <UsageDetails usage={usage} /> : <p className="text-sm text-muted-foreground">Vali komponendi märk, et näha kasutust</p>}
      </GalleryPanel>
    </aside>
  );
};

/** Galerii paigutus: sisu vasakul, kasutuse külgpaneel paremal (kitsal ekraanil alumine sahtel). */
export const UsageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const value = useMemo<SelectionState>(
    () => ({ selected, select: (n) => setSelected((cur) => nextSelection(cur, n)), close: () => setSelected(null), highlight, setHighlight }),
    [selected, highlight]
  );
  return (
    <SelectionContext.Provider value={value}>
      <div className="mx-auto grid max-w-7xl items-start gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {children}
          {/* kitsal ekraanil jätab alumise sahtli jaoks ruumi, et viimane jaotis ei jääks selle alla */}
          {selected && <div className="h-[45vh] lg:hidden" aria-hidden />}
        </div>
        <UsagePanel />
      </div>
    </SelectionContext.Provider>
  );
};

export const UsageBadges: React.FC<{ names: string[] }> = ({ names }) => (
  <span className="flex flex-wrap items-center gap-2">
    {names.map((n) => <UsageBadge key={n} name={n} />)}
  </span>
);

/** Galerii ülaosa: komponentide arv, kasutamata komponendid ja loenduse aeg. */
export const UsageSummary: React.FC = () => {
  const unused = usageData.components.filter(isUnused);
  const insideOnly = usageData.components.filter((c) => c.count === 0 && c.insideUi > 0);
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      <p>
        <span className="tabular-nums">{usageData.components.length}</span> ühist komponenti, neist{' '}
        <span className="tabular-nums">{unused.length}</span> kasutamata (ei rakenduse vaadetes ega teiste ühiste komponentide
        sees) ja <span className="tabular-nums">{insideOnly.length}</span> kasutusel ainult ühiste komponentide sees. Loendus tehtud{' '}
        <span className="tabular-nums">{formatDateTimeTallinn(usageData.generatedAt)}</span> (galerii ja testid ei loe).
      </p>
      {unused.length > 0 && <UsageBadges names={unused.map((c) => c.name)} />}
    </div>
  );
};
