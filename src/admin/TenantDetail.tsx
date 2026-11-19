import { useCallback, useEffect, useState } from 'react';
import { platformApi, type LicenseModule, type TenantDetailData } from './platformApi.ts';
import { LicenseCell } from './LicenseCell.tsx';
import { ModuleChecks } from './NewTenantForm.tsx';
import { StatusBadge } from './TenantsView.tsx';
import { AuditView } from './AuditView.tsx';
import { formatHa, formatTallinn } from './format.ts';
import { Alert, DateInput, Card, Button, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui';

export function TenantDetail({ id, initialNotice, onBack, onDeleted }: { id: string; initialNotice?: string; onBack: () => void; onDeleted: (notice: string) => void }) {
  const [tenant, setTenant] = useState<TenantDetailData | null>(null);
  const [error, setError] = useState('');
  const [supportUrl, setSupportUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState(initialNotice ?? '');
  const [busy, setBusy] = useState(false);
  const [validUntil, setValidUntil] = useState('');
  const [modules, setModules] = useState<LicenseModule[]>([]);
  const [auditKey, setAuditKey] = useState(0);
  const [confirmName, setConfirmName] = useState('');

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

  const deleteTenant = async () => {
    if (!tenant) return;
    if (!window.confirm(`Ettevõte „${tenant.name}" ja KÕIK tema andmed kustutatakse jäädavalt. Seda ei saa tagasi võtta.\n\nKas kustutan?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await platformApi.deleteTenant(id, confirmName);
      onDeleted(`Ettevõte „${tenant.name}" ja tema andmed on kustutatud.`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
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
        <Button onClick={onBack}>
          ← Ettevõtted
        </Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}
      {!tenant && !error && <div className="admin-muted">Laadin…</div>}
      {tenant && (
        <>
          <Card className="admin-card">
            <div className="admin-toolbar">
              <h2>{tenant.name} <StatusBadge status={tenant.status} /></h2>
              <Button variant={tenant.status === 'ACTIVE' ? 'secondary' : 'primary'} onClick={toggleStatus} disabled={busy}>
                {tenant.status === 'ACTIVE' ? 'Peata ettevõte' : 'Taasaktiveeri'}
              </Button>
            </div>
            <div className="admin-meta">
              <div><span>Registrikood</span>{tenant.registryCode ?? '–'}</div>
              <div><span>Litsents</span><LicenseCell license={tenant.license} /></div>
              <div><span>Kasutajad (aktiivsed/kokku)</span>{tenant.activeUserCount}/{tenant.userCount}</div>
              <div><span>Põlde</span>{tenant.fieldCount}</div>
              <div><span>Pindala (ha)</span>{formatHa(tenant.areaHa)}</div>
              <div><span>Viimane sisselogimine</span>{formatTallinn(tenant.lastLoginAt)}</div>
            </div>
          </Card>

          <Card className="admin-card">
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
                  <Button variant="primary" onClick={openSupport} disabled={busy}>Ava ettevõtte vaade</Button>
                </div>
              </div>
            ) : (
              <p className="admin-hint">Ettevõte pole kasutajatoele ligipääsu andnud. Luba antakse ettevõtte admini poolt teris.ee-s (Kasutajad → Kasutajatoe ligipääs).</p>
            )}
            {supportUrl && (
              <Alert tone="info" className="admin-support-link">
                <a href={supportUrl} target="_blank" rel="noopener noreferrer">Ava tugivaade</a>
                <span> — brauser blokeeris uue akna. Link kehtib 60 sekundit.</span>
              </Alert>
            )}
          </Card>

          <Card asChild className="admin-card"><form onSubmit={(e) => { e.preventDefault(); void saveLicense(); }}>
            <div className="admin-card-head">
              <h2>Litsents</h2>
              <LicenseCell license={tenant.license} />
            </div>
            <div className="admin-license-grid">
              <div className="admin-field">
                <label className="admin-field-label" htmlFor="td-until">Kehtib kuni</label>
                <DateInput id="td-until" value={validUntil} onChange={setValidUntil} required />
              </div>
              <div className="admin-field">
                <span className="admin-field-label">Moodulid</span>
                <ModuleChecks value={modules} onChange={setModules} />
              </div>
            </div>
            <div className="admin-card-foot">
              <Button type="submit" variant="primary" disabled={busy}>Salvesta litsents</Button>
            </div>
          </form></Card>

          <Card className="admin-card">
            <h2>Kasutajad</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kasutajanimi</TableHead>
                  <TableHead>Nimi</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Olek</TableHead>
                  <TableHead>Viimane sisselogimine</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.users.map((u) => (
                  <TableRow key={u.username}>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>{u.displayName ?? '–'}</TableCell>
                    <TableCell>{u.email ?? '–'}</TableCell>
                    <TableCell>{u.isAdmin ? 'Admin' : 'Kasutaja'}</TableCell>
                    <TableCell>{!u.isActive ? 'Keelatud' : u.hasPassword ? 'Aktiivne' : 'Kutsutud'}</TableCell>
                    <TableCell>{formatTallinn(u.lastLoginAt)}</TableCell>
                    <TableCell>
                      {!u.hasPassword && u.isActive && (
                        <Button size="sm" disabled={busy || !u.email} onClick={() => void resend(u.username)}>
                          Saada kutse uuesti
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="admin-card">
            <h2>Ettevõtte logi</h2>
            <AuditView key={auditKey} tenantId={id} />
          </Card>

          <Card className="admin-card admin-danger-card">
            <h2>Ettevõtte kustutamine</h2>
            {tenant.status === 'ACTIVE' ? (
              <p className="admin-hint">Kustutada saab ainult peatatud ettevõtet. Peata ettevõte enne kustutamist.</p>
            ) : (
              <>
                <p className="admin-hint">
                  Kustutab jäädavalt ettevõtte, tema kasutajad, litsentsi ja kõik andmed (põllud, tööd, laoarvestus, masinad, seadmed, sõidud jm).
                  Seadmete tunnused vabanevad teistele ettevõtetele. Teenusepakkuja logisse jääb kustutamise kirje. Tagasi võtta ei saa.
                </p>
                <div className="admin-split admin-danger-row">
                  <div className="admin-field">
                    <label className="admin-field-label" htmlFor="td-confirm">Kinnituseks sisesta ettevõtte nimi: <strong>{tenant.name}</strong></label>
                    <Input id="td-confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
                  </div>
                  <div className="admin-actions">
                    <Button variant="danger" onClick={() => void deleteTenant()} disabled={busy || confirmName.trim() !== tenant.name.trim()}>
                      Kustuta jäädavalt
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
