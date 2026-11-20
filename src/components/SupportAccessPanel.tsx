// src/components/SupportAccessPanel.tsx — kasutajatoe ligipääsu luba ja sisenemiste logi (ainult admin).
import React, { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { SupportGrant, SupportAccessEntry } from '../types/auth';
import { formatDateTimeTallinn } from '../services/dateFormat';
import { Alert, Badge, Button, Card, SectionTitle, cn } from './ui';

const DURATIONS: { value: '1h' | '24h' | '7d'; label: string }[] = [
  { value: '1h', label: '1 tund' },
  { value: '24h', label: '24 tundi' },
  { value: '7d', label: '7 päeva' }
];

// Rida on ikooni veeru kõrval (joondub pealkirjaga); kitsal ekraanil täislaiuses.
const ROW_CLASS = 'col-span-2 col-start-2 flex flex-wrap items-center gap-x-3 gap-y-2.5 max-[520px]:col-span-full max-[520px]:col-start-1';
const ROW_TEXT_CLASS = 'text-sm leading-natural text-muted-foreground';

export const SupportAccessPanel: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const [grants, setGrants] = useState<SupportGrant[]>([]);
  const [log, setLog] = useState<SupportAccessEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, l] = await Promise.all([api.listSupportGrants(), api.listSupportAccessLog()]);
      setGrants(g);
      setLog(l);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laadimine ebaõnnestus');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Päring ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  const active = grants.find((g) => g.active) ?? null;

  return (
    <Card asChild variant="tile" className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3"><section>
      <span className="inline-flex size-8.5 items-center justify-center rounded-full bg-primary/12 text-primary"><LifeBuoy size={18} /></span>
      <div>
        <h4 className="mb-1 text-base leading-natural font-semibold text-foreground">Kasutajatoe ligipääs</h4>
        <p className="text-sm text-muted-foreground">Kasutajatugi saab teie keskkonda vaadata ainult lugemiseks. Iga sisenemine logitakse.</p>
      </div>
      <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Lubatud' : 'Suletud'}</Badge>

      {error && (
        <Alert tone="error" className="col-span-full">
          <AlertCircle size={16} />
          <span>{error}</span>
        </Alert>
      )}

      {active ? (
        <div className={ROW_CLASS}>
          <span className={cn(ROW_TEXT_CLASS, '[&_strong]:text-foreground')}>Ligipääs kehtib kuni <strong>{formatDateTimeTallinn(active.validUntil)}</strong></span>
          {!readOnly && (
            <Button type="button" size="sm" disabled={busy} onClick={() => run(() => api.revokeSupportGrant(active.id))}>
              Tühista
            </Button>
          )}
        </div>
      ) : (
        !readOnly && (
          <div className={ROW_CLASS}>
            <span className={ROW_TEXT_CLASS}>Anna ligipääs:</span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <Button key={d.value} type="button" size="sm" disabled={busy} onClick={() => run(() => api.createSupportGrant(d.value))}>
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
        )
      )}

      {log.length > 0 && (
        <div className="col-span-full border-t border-border pt-3">
          <SectionTitle>Sisenemised</SectionTitle>
          <ul className="flex list-none flex-col gap-1.5 text-sm leading-natural text-foreground">
            {log.map((e, i) => (
              <li key={`${e.grantId}-${e.startedAt}-${i}`} className="flex flex-wrap gap-3">
                <span>{formatDateTimeTallinn(e.startedAt)}</span>
                <span className="text-muted-foreground">kasutajatugi ({e.platformUsername})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section></Card>
  );
};
