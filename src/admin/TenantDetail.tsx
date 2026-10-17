import { useCallback, useEffect, useState } from 'react';
import { platformApi, type LicenseModule, type TenantDetailData } from './platformApi.ts';
import { LicenseCell } from './LicenseCell.tsx';
import { ModuleChecks } from './NewTenantForm.tsx';
import { StatusBadge } from './TenantsView.tsx';
import { AuditView } from './AuditView.tsx';
import { formatHa, formatTallinn } from './format.ts';
import { DateInput } from '../components/DateInput.tsx';

export function TenantDetail({ id, initialNotice, onBack }: { id: string; initialNotice?: string; onBack: () => void }) {
  const [tenant, setTenant] = useState<TenantDetailData | null>(null);
  const [error, setError] = useState('');
  const [supportUrl, setSupportUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState(initialNotice ?? '');
  const [busy, setBusy] = useState(false);
  const [validUntil, setValidUntil] = useState('');
  const [modules, setModules] = useState<LicenseModule[]>([]);
  const [auditKey, setAuditKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const t = await platformApi.getTenant(id);
      setTenant(t);
      setValidUntil(t.license.validUntil?.slice(0, 10) ?? '');
      setModules(t.license.modules);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await load();
      setAuditKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveLicense = () =>
    run(async () => {
      await platformApi.updateLicense(id, validUntil, modules);
      return 'Litsents salvestatud.';
    });

  const toggleStatus = () => {
    if (!tenant) return;
    const suspend = tenant.status === 'ACTIVE';
    if (suspend && !window.confirm('Peatamisel logitakse kõik selle ettevõtte kasutajad välja ja sisselogimine keelatakse.\n\nKas peata ettevõte?')) return;
    void run(async () => {
      if (suspend) await platformApi.suspend(id);
      else await platformApi.activate(id);
      return suspend ? 'Ettevõte peatatud.' : 'Ettevõte taasaktiveeritud.';
    });
  };

  const resend = (username: string) =>
    run(async () => {
      const r = await platformApi.resendInvite(id, username);
      return r.inviteSent ? `Kutse saadeti uuesti kasutajale ${username}.` : 'Kutset ei õnnestunud saata.';
    });

  const openSupport = () => {
    // Aken avatakse klõpsu käigus sünkroonselt (enne päringut), muidu blokeerib brauser hüpikakna.
    const w = window.open('', '_blank');
    setSupportUrl(null);
    void run(async () => {
      try {
        const { url } = await platformApi.openSupportSession(id);
        if (w) {
          w.opener = null;
          w.location.href = url;
        } else {
          setSupportUrl(url);
        }
      } catch (err) {
        w?.close();
        throw err;
      }
    });
  };

  return (
    <div>
      <div className="admin-toolbar">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          ← Ettevõtted
        </button>
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {notice && <div className="alert-box">{notice}</div>}
      {!tenant && !error && <div className="admin-muted">Laadin…</div>}
      {tenant && (
        <>
          <div className="glass-card admin-card">
            <div className="admin-toolbar">
              <h2>{tenant.name} <StatusBadge status={tenant.status} /></h2>
              <button type="button" className={`btn ${tenant.status === 'ACTIVE' ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleStatus} disabled={busy}>
                {tenant.status === 'ACTIVE' ? 'Peata ettevõte' : 'Taasaktiveeri'}
              </button>
            </div>
            <div className="admin-meta">
              <div><span>Registrikood</span>{tenant.registryCode ?? '–'}</div>
              <div><span>Litsents</span><LicenseCell license={tenant.license} /></div>
              <div><span>Kasutajad (aktiivsed/kokku)</span>{tenant.activeUserCount}/{tenant.userCount}</div>
              <div><span>Põlde</span>{tenant.fieldCount}</div>
              <div><span>Pindala (ha)</span>{formatHa(tenant.areaHa)}</div>
              <div><span>Viimane sisselogimine</span>{formatTallinn(tenant.lastLoginAt)}</div>
            </div>
          </div>

          <div className="glass-card admin-card">
            <div className="admin-card-head">
              <h2>Kasutajatugi</h2>
              <span className={`admin-badge ${tenant.supportGrant ? 'ok' : 'neutral'}`}>{tenant.supportGrant ? 'Lubatud' : 'Suletud'}</span>
            </div>
            {tenant.supportGrant ? (
              <div className="admin-split">
                <div>
                  <div className="admin-field-label">Ligipääs kehtib kuni</div>
                  <div className="admin-field-value">{formatTallinn(tenant.supportGrant.validUntil)}</div>
                  <div className="admin-hint">Tugivaade avaneb uues aknas ainult lugemiseks. Iga sisenemine logitakse ettevõtte poolel.</div>
                </div>
                <div className="admin-actions">
                  <button type="button" className="btn btn-primary" onClick={openSupport} disabled={busy}>Ava ettevõtte vaade</button>
                </div>
              </div>
            ) : (
              <p className="admin-hint">Ettevõte pole kasutajatoele ligipääsu andnud. Luba antakse ettevõtte admini poolt teris.ee-s (Kasutajad → Kasutajatoe ligipääs).</p>
            )}
            {supportUrl && (
              <div className="alert-box info admin-support-link">
                <a href={supportUrl} target="_blank" rel="noopener noreferrer">Ava tugivaade</a>
                <span> — brauser blokeeris uue akna. Link kehtib 60 sekundit.</span>
              </div>
            )}
          </div>

          <form className="glass-card admin-card" onSubmit={(e) => { e.preventDefault(); void saveLicense(); }}>
            <div className="admin-card-head">
              <h2>Litsents</h2>
              <LicenseCell license={tenant.license} />
            </div>
            <div className="admin-license-grid">
              <div className="admin-field">
                <label className="admin-field-label" htmlFor="td-until">Kehtib kuni</label>
                <DateInput id="td-until" className="form-input" value={validUntil} onChange={setValidUntil} required />
              </div>
              <div className="admin-field">
                <span className="admin-field-label">Moodulid</span>
                <ModuleChecks value={modules} onChange={setModules} />
              </div>
            </div>
            <div className="admin-card-foot">
              <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta litsents</button>
            </div>
          </form>

          <div className="glass-card admin-card">
            <h2>Kasutajad</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Kasutajanimi</th>
                    <th>Nimi</th>
                    <th>E-post</th>
                    <th>Roll</th>
                    <th>Olek</th>
                    <th>Viimane sisselogimine</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.users.map((u) => (
                    <tr key={u.username}>
                      <td>{u.username}</td>
                      <td>{u.displayName ?? '–'}</td>
                      <td>{u.email ?? '–'}</td>
                      <td>{u.isAdmin ? 'Admin' : 'Kasutaja'}</td>
                      <td>{!u.isActive ? 'Keelatud' : u.hasPassword ? 'Aktiivne' : 'Kutsutud'}</td>
                      <td>{formatTallinn(u.lastLoginAt)}</td>
                      <td>
                        {!u.hasPassword && u.isActive && (
                          <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !u.email} onClick={() => void resend(u.username)}>
                            Saada kutse uuesti
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card admin-card">
            <h2>Ettevõtte logi</h2>
            <AuditView key={auditKey} tenantId={id} />
          </div>
        </>
      )}
    </div>
  );
}
