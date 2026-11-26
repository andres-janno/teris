// src/components/ui/UiGalleryUsage.tsx — kasutusmärgid galeriis /ui: mitu korda ja mitmes failis iga ühist komponenti
// rakenduses kasutatakse. Andmed pakub ehitusaegne plugin (virtual:ui-usage, vt src/tooling/uiUsagePlugin.ts).
// Fail on galerii osa ega kuulu ui/ indeksisse; ui/ kaust jääb loendusest välja.
import React from 'react';
import usageData from 'virtual:ui-usage';
import { comboCount, comboKey, isUnused, propLabel, type ComponentUsage } from '../../tooling/uiUsage';
import { formatDateTimeTallinn } from '../../services/dateFormat';
import { Badge, Button, Popover, PopoverContent, PopoverTrigger, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './index';

const byName = new Map(usageData.components.map((c) => [c.name, c]));

// Galeriis näidatud kombinatsioonid ("Button|vaikimisi · icon-sm"). Täidab UsageExample renderdamisel (idempotentne);
// hüpik loeb seda avamisel, kui kõik näidised on juba renderdatud.
const shownCombos = new Set<string>();

const summaryText = (c: ComponentUsage): string => `${c.count} kohta ${c.fileCount} failis`;

/** Näidise kombinatsiooni võti, arvutatud näidise tegelikest propidest (sama vorming kui loenduses). */
export function exampleKey(usage: ComponentUsage, props: Record<string, unknown>): string {
  return comboKey(usage.comboProps.map((p) => propLabel(props[p])));
}

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

/** Galerii näidis: komponent + pealdis „kombinatsioon · kordi rakenduses“. */
export function UsageExample<C extends React.ElementType>({ as, name, props, children, className }: ExampleProps<C>): React.ReactElement {
  const Component = as as React.ElementType;
  const usage = byName.get(name);
  const key = usage ? exampleKey(usage, props as Record<string, unknown>) : '';
  if (usage) shownCombos.add(`${name}|${key}`);
  const count = usage ? comboCount(usage, key) : 0;
  return (
    <div className={`flex flex-col items-start gap-1 ${className ?? ''}`.trim()}>
      <Component {...(props as object)}>{children}</Component>
      <span className="text-2xs tabular-nums text-muted-foreground" data-usage-caption={name} data-usage-key={key}>
        {key ? `${key} · ${count}` : count}
      </span>
    </div>
  );
}

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

const UsageDetails: React.FC<{ usage: ComponentUsage }> = ({ usage }) => (
  <div className="flex w-96 max-w-full flex-col gap-3 text-sm">
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
        <Table dense>
          <TableHeader>
            <TableRow>
              {usage.comboProps.map((p) => <TableHead key={p}>{p}</TableHead>)}
              <TableHead numeric>Kordi</TableHead>
              <TableHead>Näidis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.combos.map((c) => {
              const has = shownCombos.has(`${usage.name}|${comboKey(c.values)}`);
              return (
                <TableRow key={comboKey(c.values)}>
                  {c.values.map((v, i) => (
                    <TableCell key={usage.comboProps[i]} className={v === 'vaikimisi' || v === 'dünaamiline' ? 'text-muted-foreground' : undefined}>{v}</TableCell>
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

/** Üks märk: „Button · 412 kohta 96 failis“; klõps avab hüpiku failide ja variantide jaotusega. */
const UsageBadge: React.FC<{ name: string }> = ({ name }) => {
  const usage = byName.get(name);
  if (!usage) return <Badge tone="danger">{name} · puudub registrist</Badge>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="bare" size="inline" aria-label={`${name}: kasutuse üksikasjad`}>
          <Badge tone={isUnused(usage) ? 'warning' : 'neutral'}>
            <span>{name} ·</span> <span className="tabular-nums">{usage.count === 0 ? '0 kohta' : summaryText(usage)}{usage.count === 0 && usage.insideUi > 0 ? ` (+${usage.insideUi} sees)` : ''}</span>
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="overflow-y-auto"><UsageDetails usage={usage} /></PopoverContent>
    </Popover>
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
