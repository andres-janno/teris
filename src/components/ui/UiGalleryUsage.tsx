// src/components/ui/UiGalleryUsage.tsx — kasutusmärgid galeriis /ui: mitu korda ja mitmes failis iga ühist komponenti
// rakenduses kasutatakse. Andmed pakub ehitusaegne plugin (virtual:ui-usage, vt src/tooling/uiUsagePlugin.ts).
// Fail on galerii osa ega kuulu ui/ indeksisse; ui/ kaust jääb loendusest välja.
import React from 'react';
import usageData from 'virtual:ui-usage';
import type { ComponentUsage, PropValueCount } from '../../tooling/uiUsage';
import { formatDateTimeTallinn } from '../../services/dateFormat';
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from './index';

const byName = new Map(usageData.components.map((c) => [c.name, c]));

const valueLabel = (v: PropValueCount): string => (v.kind === 'static' ? (v.value ?? '') : v.kind === 'dynamic' ? 'dünaamiline' : 'vaikimisi');

const summaryText = (c: ComponentUsage): string => `${c.count} kohta ${c.fileCount} failis`;

const UsageDetails: React.FC<{ usage: ComponentUsage }> = ({ usage }) => (
  <div className="flex w-80 max-w-full flex-col gap-3 text-sm">
    <div>
      <div className="font-semibold">{usage.name}</div>
      <div className="text-muted-foreground">{usage.count === 0 ? 'Rakenduses ei kasutata' : summaryText(usage)}</div>
    </div>
    {usage.props.map((p) => (
      <div key={p.prop} className="flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground">{p.prop}</div>
        {p.values.map((v) => (
          <div key={`${v.kind}:${v.value ?? ''}`} className="flex justify-between gap-3">
            <span className={v.kind === 'static' ? undefined : 'text-muted-foreground'}>{valueLabel(v)}</span>
            <span className="tabular-nums">{v.count}</span>
          </div>
        ))}
      </div>
    ))}
    {usage.files.length > 0 && (
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground">Failid</div>
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {usage.files.map((f) => (
            <div key={f.file} className="flex justify-between gap-3">
              <span className="min-w-0 break-all">{f.file.replace(/^src\//, '')}</span>
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
          <Badge tone={usage.count === 0 ? 'warning' : 'neutral'}>
            <span>{name} ·</span> <span className="tabular-nums">{usage.count === 0 ? '0 kohta' : summaryText(usage)}</span>
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent><UsageDetails usage={usage} /></PopoverContent>
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
  const unused = usageData.components.filter((c) => c.count === 0);
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      <p>
        <span className="tabular-nums">{usageData.components.length}</span> ühist komponenti, neist{' '}
        <span className="tabular-nums">{unused.length}</span> rakenduses kasutamata. Loendus tehtud{' '}
        <span className="tabular-nums">{formatDateTimeTallinn(usageData.generatedAt)}</span> (galerii, testid ja komponentide
        enda failid ei loe).
      </p>
      {unused.length > 0 && <UsageBadges names={unused.map((c) => c.name)} />}
    </div>
  );
};
