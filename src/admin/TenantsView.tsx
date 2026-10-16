import { useEffect, useState } from 'react';
import { platformApi, type TenantSummary } from './platformApi.ts';
import { LicenseCell } from './LicenseCell.tsx';
import { formatHa, formatTallinn } from './format.ts';

export function StatusBadge({ status }: { status: TenantSummary['status'] }) {
  return status === 'ACTIVE' ? <span className="admin-badge ok">Aktiivne</span> : <span className="admin-badge off">Peatatud</span>;
}

export function TenantsView({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    platformApi
      .listTenants()
      .then((t) => !cancelled && setTenants(t))
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="glass-card admin-card">
      <div className="admin-toolbar">
        <h2>Ettevõtted</h2>
        <button type="button" className="btn btn-primary" onClick={onNew}>
          Uus ettevõte
        </button>
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {!tenants && !error && <div className="admin-muted">Laadin…</div>}
      {tenants && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nimi</th>
                <th>Registrikood</th>
                <th>Staatus</th>
                <th>Litsents</th>
                <th>Kasutajad</th>
                <th>Põlde</th>
                <th>Pindala (ha)</th>
                <th>Viimane sisselogimine</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => onOpen(t.id)}>
                  <td>{t.name}</td>
                  <td>{t.registryCode ?? '–'}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td><LicenseCell license={t.license} /></td>
                  <td>{t.activeUserCount}/{t.userCount}</td>
                  <td>{t.fieldCount}</td>
                  <td>{formatHa(t.areaHa)}</td>
                  <td>{formatTallinn(t.lastLoginAt)}</td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={8} className="admin-muted">Ettevõtteid pole</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
