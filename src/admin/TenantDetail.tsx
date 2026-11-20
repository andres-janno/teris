import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { platformApi, type LicenseModule, type TenantDetailData } from './platformApi.ts';
import { LicenseCell } from './LicenseCell.tsx';
import { ModuleChecks } from './NewTenantForm.tsx';
import { StatusBadge } from './TenantsView.tsx';
import { AuditView } from './AuditView.tsx';
import { formatHa, formatTallinn } from './format.ts';
import { Alert, Badge, DateInput, Card, Button, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui';
import { cn } from '../components/ui/cn';
import {
  adminActionsClass, adminBadgeTone, adminCardClass, adminCardFootClass, adminCardHeadClass, adminFieldClass, adminFieldLabelClass, adminH2Class,
  adminH2FlushClass, adminHintClass, adminLicenseGridClass, adminMetaGridClass, adminMetaLabelClass, adminMutedClass, adminSplitClass, adminToolbarClass
} from './adminUi.ts';

/** Üks lahter ettevõtte kokkuvõttes: silt + väärtus. */
const MetaItem = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <span className={adminMetaLabelClass}>{label}</span>
    {children}
  </div>
);

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
      <div className={adminToolbarClass}>
        <Button onClick={onBack}>
          ← Ettevõtted
        </Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}
      {!tenant && !error && <div className={adminMutedClass}>Laadin…</div>}
      {tenant && (
        <>
          <Card className={adminCardClass}>
            <div className={adminToolbarClass}>
              <h2 className={adminH2Class}>{tenant.name} <StatusBadge status={tenant.status} /></h2>
              <Button variant={tenant.status === 'ACTIVE' ? 'secondary' : 'primary'} onClick={toggleStatus} disabled={busy}>
                {tenant.status === 'ACTIVE' ? 'Peata ettevõte' : 'Taasaktiveeri'}
              </Button>
            </div>
            <div className={adminMetaGridClass}>
              <MetaItem label="Registrikood">{tenant.registryCode ?? '–'}</MetaItem>
              <MetaItem label="Litsents"><LicenseCell license={tenant.license} /></MetaItem>
              <MetaItem label="Kasutajad (aktiivsed/kokku)">{tenant.activeUserCount}/{tenant.userCount}</MetaItem>
              <MetaItem label="Põlde">{tenant.fieldCount}</MetaItem>
              <MetaItem label="Pindala (ha)">{formatHa(tenant.areaHa)}</MetaItem>
              <MetaItem label="Viimane sisselogimine">{formatTallinn(tenant.lastLoginAt)}</MetaItem>
            </div>
          </Card>

          <Card className={adminCardClass}>
            <div className={adminCardHeadClass}>
              <h2 className={adminH2FlushClass}>Kasutajatugi</h2>
              <Badge tone={adminBadgeTone(tenant.supportGrant ? 'ok' : 'neutral')}>{tenant.supportGrant ? 'Lubatud' : 'Suletud'}</Badge>
            </div>
            {tenant.supportGrant ? (
              <div className={adminSplitClass}>
                <div>
                  <div className={adminFieldLabelClass}>Ligipääs kehtib kuni</div>
                  <div className="mt-1 text-lg font-semibold leading-natural text-foreground">{formatTallinn(tenant.supportGrant.validUntil)}</div>
                  <div className={adminHintClass}>Tugivaade avaneb uues aknas ainult lugemiseks. Iga sisenemine logitakse ettevõtte poolel.</div>
                </div>
                <div className={adminActionsClass}>
                  <Button variant="primary" onClick={openSupport} disabled={busy}>Ava ettevõtte vaade</Button>
                </div>
              </div>
            ) : (
              <p className={adminHintClass}>Ettevõte pole kasutajatoele ligipääsu andnud. Luba antakse ettevõtte admini poolt teris.ee-s (Kasutajad → Kasutajatoe ligipääs).</p>
            )}
            {supportUrl && (
              <Alert tone="info" className="mt-3">
                <a href={supportUrl} target="_blank" rel="noopener noreferrer">Ava tugivaade</a>
                <span> — brauser blokeeris uue akna. Link kehtib 60 sekundit.</span>
              </Alert>
            )}
          </Card>

          <Card asChild className={adminCardClass}><form onSubmit={(e) => { e.preventDefault(); void saveLicense(); }}>
            <div className={adminCardHeadClass}>
              <h2 className={adminH2FlushClass}>Litsents</h2>
              <LicenseCell license={tenant.license} />
            </div>
            <div className={adminLicenseGridClass}>
              <div className={adminFieldClass}>
                <label className={adminFieldLabelClass} htmlFor="td-until">Kehtib kuni</label>
                <DateInput id="td-until" value={validUntil} onChange={setValidUntil} required />
              </div>
              <div className={adminFieldClass}>
                <span className={adminFieldLabelClass}>Moodulid</span>
                <ModuleChecks value={modules} onChange={setModules} className="min-h-10.5 items-center" />
              </div>
            </div>
            <div className={adminCardFootClass}>
              <Button type="submit" variant="primary" disabled={busy}>Salvesta litsents</Button>
            </div>
          </form></Card>

          <Card className={adminCardClass}>
            <h2 className={adminH2Class}>Kasutajad</h2>
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

          <Card className={adminCardClass}>
            <h2 className={adminH2Class}>Ettevõtte logi</h2>
            <AuditView key={auditKey} tenantId={id} />
          </Card>

          <Card className={cn(adminCardClass, 'border-danger-solid/35')}>
            <h2 className={cn(adminH2Class, 'text-danger-text')}>Ettevõtte kustutamine</h2>
            {tenant.status === 'ACTIVE' ? (
              <p className={adminHintClass}>Kustutada saab ainult peatatud ettevõtet. Peata ettevõte enne kustutamist.</p>
            ) : (
              <>
                <p className={adminHintClass}>
                  Kustutab jäädavalt ettevõtte, tema kasutajad, litsentsi ja kõik andmed (põllud, tööd, laoarvestus, masinad, seadmed, sõidud jm).
                  Seadmete tunnused vabanevad teistele ettevõtetele. Teenusepakkuja logisse jääb kustutamise kirje. Tagasi võtta ei saa.
                </p>
                <div className={cn(adminSplitClass, 'mt-3 items-end')}>
                  <div className={cn(adminFieldClass, 'grow basis-70')}>
                    <label className={adminFieldLabelClass} htmlFor="td-confirm">Kinnituseks sisesta ettevõtte nimi: <strong>{tenant.name}</strong></label>
                    <Input id="td-confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
                  </div>
                  <div className={adminActionsClass}>
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
