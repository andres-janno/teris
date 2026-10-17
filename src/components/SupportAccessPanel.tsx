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
    <section className="support-panel">
      <div className="support-panel-head">
        <span className="support-panel-icon"><LifeBuoy size={18} /></span>
        <div className="support-panel-titles">
          <h4 className="support-panel-title">Kasutajatoe ligipääs</h4>
          <p className="support-panel-desc">Kasutajatugi saab teie keskkonda vaadata ainult lugemiseks. Iga sisenemine logitakse.</p>
        </div>
        <span className={`support-panel-status${active ? ' is-active' : ''}`}>{active ? 'Lubatud' : 'Suletud'}</span>
      </div>

      {error && (
        <div className="alert-box error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {active ? (
        <div className="support-panel-row">
          <span className="support-panel-until">Ligipääs kehtib kuni <strong>{formatDateTimeTallinn(active.validUntil)}</strong></span>
          {!readOnly && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(() => api.revokeSupportGrant(active.id))}>
              Tühista
            </button>
          )}
        </div>
      ) : (
        !readOnly && (
          <div className="support-panel-row">
            <span className="support-panel-label">Anna ligipääs:</span>
            <div className="support-panel-actions">
              {DURATIONS.map((d) => (
                <button key={d.value} type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(() => api.createSupportGrant(d.value))}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {log.length > 0 && (
        <div className="support-panel-log">
          <div className="section-title">Sisenemised</div>
          <ul>
            {log.map((e, i) => (
              <li key={`${e.grantId}-${e.startedAt}-${i}`}>
                <span>{formatDateTimeTallinn(e.startedAt)}</span>
                <span className="support-panel-who">kasutajatugi ({e.platformUsername})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
