import { useCallback, useEffect, useState } from 'react';
import { platformApi, setUnauthorizedHandler } from './platformApi.ts';
import { LoginView } from './LoginView.tsx';
import { TenantsView } from './TenantsView.tsx';
import { NewTenantForm } from './NewTenantForm.tsx';
import { TenantDetail } from './TenantDetail.tsx';
import { AuditView } from './AuditView.tsx';
import { CatalogView } from './CatalogView.tsx';
import { DevicesView } from './DevicesView.tsx';
import { HelpView } from './HelpView.tsx';
import { LandingStatsView } from './LandingStatsView.tsx';
import { InterestView } from './InterestView.tsx';

type View = { kind: 'tenants' } | { kind: 'new' } | { kind: 'detail'; id: string; notice?: string } | { kind: 'audit' } | { kind: 'catalog' } | { kind: 'devices' } | { kind: 'help' } | { kind: 'landing' } | { kind: 'interest' };

export function AdminApp() {
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>({ kind: 'tenants' });

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    platformApi
      .me()
      .then((u) => setUser(u.username))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const logout = useCallback(async () => {
    await platformApi.logout().catch(() => undefined);
    setUser(null);
    setView({ kind: 'tenants' });
  }, []);

  if (checking) return null;
  if (!user) return <LoginView onLogin={setUser} />;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>Teris — teenusepakkuja</h1>
        <div className="admin-header-right">
          <span>{user}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void logout()}>
            Logi välja
          </button>
        </div>
      </header>
      <nav className="admin-nav">
        <button type="button" className={`btn btn-secondary ${!['audit', 'catalog', 'devices', 'help', 'landing', 'interest'].includes(view.kind) ? 'active' : ''}`} onClick={() => setView({ kind: 'tenants' })}>
          Ettevõtted
        </button>
        <button type="button" className={`btn btn-secondary ${view.kind === 'catalog' ? 'active' : ''}`} onClick={() => setView({ kind: 'catalog' })}>
          Algkataloog
        </button>
        <button type="button" className={`btn btn-secondary ${view.kind === 'devices' ? 'active' : ''}`} onClick={() => setView({ kind: 'devices' })}>
          Seadmed
        </button>
        <button type="button" className={`btn btn-secondary ${view.kind === 'help' ? 'active' : ''}`} onClick={() => setView({ kind: 'help' })}>
          Juhendid
        </button>
        <button type="button" className={`btn btn-secondary ${view.kind === 'landing' ? 'active' : ''}`} onClick={() => setView({ kind: 'landing' })}>
          Landing
        </button>
        <button type="button" className={`btn btn-secondary ${view.kind === 'interest' ? 'active' : ''}`} onClick={() => setView({ kind: 'interest' })}>
          Huvilised
        </button>
        <button type="button" className={`btn btn-secondary ${view.kind === 'audit' ? 'active' : ''}`} onClick={() => setView({ kind: 'audit' })}>
          Logi
        </button>
      </nav>
      {view.kind === 'tenants' && <TenantsView onOpen={(id) => setView({ kind: 'detail', id })} onNew={() => setView({ kind: 'new' })} />}
      {view.kind === 'new' && (
        <NewTenantForm onCreated={(id, notice) => setView({ kind: 'detail', id, notice })} onCancel={() => setView({ kind: 'tenants' })} />
      )}
      {view.kind === 'detail' && <TenantDetail key={view.id} id={view.id} initialNotice={view.notice} onBack={() => setView({ kind: 'tenants' })} />}
      {view.kind === 'catalog' && <CatalogView />}
      {view.kind === 'devices' && <DevicesView />}
      {view.kind === 'help' && <HelpView />}
      {view.kind === 'landing' && <LandingStatsView />}
      {view.kind === 'interest' && <InterestView />}
      {view.kind === 'audit' && (
        <div className="glass-card admin-card">
          <h2>Logi</h2>
          <AuditView />
        </div>
      )}
    </div>
  );
}
