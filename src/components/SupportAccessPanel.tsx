// src/components/SupportAccessPanel.tsx — kasutajatoe ligipääsu luba ja sisenemiste logi (ainult admin).
import React, { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { SupportGrant, SupportAccessEntry } from '../types/auth';
import { formatDateTimeTallinn } from '../services/dateFormat';

const DURATIONS: { value: '1h' | '24h' | '7d'; label: string }[] = [
  { value: '1h', label: '1 tund' },
  { value: '24h', label: '24 tundi' },
  { value: '7d', label: '7 päeva' }
];

export const SupportAccessPanel: React.FC = () => {
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
    <section className="support-access-panel" style={{ marginTop: 24 }}>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LifeBuoy size={18} />
        <span>Kasutajatoe ligipääs</span>
      </h4>

      {error && (
        <div className="alert-box error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {active ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>Ligipääs kehtib kuni {formatDateTimeTallinn(active.validUntil)}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api.revokeSupportGrant(active.id))}>
            Tühista
          </button>
        </p>
      ) : (
        <>
          <p>Kasutajatugi saab teie keskkonda vaadata ainult lugemiseks. Iga sisenemine logitakse siia.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DURATIONS.map((d) => (
              <button key={d.value} type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.createSupportGrant(d.value))}>
                {d.label}
              </button>
            ))}
          </div>
        </>
      )}

      {log.length > 0 && (
        <ul style={{ marginTop: 16, paddingLeft: 18 }}>
          {log.map((e, i) => (
            <li key={`${e.grantId}-${e.startedAt}-${i}`}>
              {formatDateTimeTallinn(e.startedAt)} — kasutajatugi ({e.platformUsername})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
