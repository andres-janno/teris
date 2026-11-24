import { Card, Button } from '../components/ui';
import { useCallback, useEffect, useState } from 'react';
import { platformApi, setUnauthorizedHandler } from './platformApi.ts';
import { LoginView } from './LoginView.tsx';
import { TenantsView } from './TenantsView.tsx';
import { NewTenantForm } from './NewTenantForm.tsx';
import { TenantDetail } from './TenantDetail.tsx';
import { AuditView } from './AuditView.tsx';
import { CatalogView } from './CatalogView.tsx';
import { DevicesView } from './DevicesView.tsx';
import { WeatherAdminView } from './WeatherAdminView.tsx';
import { HelpView } from './HelpView.tsx';
import { AiInstructionsView } from './AiInstructionsView.tsx';
import { LandingStatsView } from './LandingStatsView.tsx';
import { InterestView } from './InterestView.tsx';
import { ReleaseNotesView } from './ReleaseNotesView.tsx';
import { adminCardClass, adminH2Class, adminNavClass, adminShellClass, adminTitleClass } from './adminUi.ts';

type View = { kind: 'tenants'; notice?: string } | { kind: 'new' } | { kind: 'detail'; id: string; notice?: string } | { kind: 'audit' } | { kind: 'catalog' } | { kind: 'devices' } | { kind: 'weather' } | { kind: 'help' } | { kind: 'landing' } | { kind: 'interest' } | { kind: 'ai' } | { kind: 'releases' };

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
    <div className={adminShellClass}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className={adminTitleClass}><em className="login-brand-word">TERIS</em> — teenusepakkuja</h1>
        <div className="flex items-center gap-3 text-base leading-natural">
          <span>{user}</span>
          <Button size="sm" onClick={() => void logout()}>
            Logi välja
          </Button>
        </div>
      </header>
      <nav className={adminNavClass}>
        <Button size="sm" aria-pressed={!['audit', 'catalog', 'devices', 'weather', 'help', 'landing', 'interest', 'ai', 'releases'].includes(view.kind)} onClick={() => setView({ kind: 'tenants' })}>
          Ettevõtted
        </Button>
        <Button size="sm" aria-pressed={view.kind === 'catalog'} onClick={() => setView({ kind: 'catalog' })}>
          Algkataloog
        </Button>
        <Button size="sm" aria-pressed={view.kind === 'devices'} onClick={() => setView({ kind: 'devices' })}>
          Seadmed
        </Button>
        <Button size="sm" aria-pressed={view.kind === 'weather'} onClick={() => setView({ kind: 'weather' })}>
          Ilm
        </Button>
        <Button size="sm" aria-pressed={view.kind === 'help'} onClick={() => setView({ kind: 'help' })}>
          Juhendid
        </Button>
        <Button size="sm" aria-pressed={view.kind === 'releases'} onClick={() => setView({ kind: 'releases' })}>
          Uuendused
        </Button>
        <Button size="sm" aria-pressed={view.kind === 'ai'} onClick={() => setView({ kind: 'ai' })}>
          AI ühendus
        </Button>
        <Button size="sm" aria-pressed={view.kind === 'landing'} onClick={() => setView({ kind: 'landing' })}>
          Landing
        </Button>
        <Button size="sm" aria-pressed={view.kind === 'interest'} onClick={() => setView({ kind: 'interest' })}>
          Huvilised
        </Button>
        <Button size="sm" aria-pressed={view.kind === 'audit'} onClick={() => setView({ kind: 'audit' })}>
          Logi
        </Button>
      </nav>
      {view.kind === 'tenants' && <TenantsView notice={view.notice} onOpen={(id) => setView({ kind: 'detail', id })} onNew={() => setView({ kind: 'new' })} />}
      {view.kind === 'new' && (
        <NewTenantForm onCreated={(id, notice) => setView({ kind: 'detail', id, notice })} onCancel={() => setView({ kind: 'tenants' })} />
      )}
      {view.kind === 'detail' && <TenantDetail key={view.id} id={view.id} initialNotice={view.notice} onBack={() => setView({ kind: 'tenants' })} onDeleted={(notice) => setView({ kind: 'tenants', notice })} />}
      {view.kind === 'catalog' && <CatalogView />}
      {view.kind === 'devices' && <DevicesView />}
      {view.kind === 'weather' && <WeatherAdminView />}
      {view.kind === 'help' && <HelpView />}
      {view.kind === 'releases' && <ReleaseNotesView />}
      {view.kind === 'ai' && <AiInstructionsView />}
      {view.kind === 'landing' && <LandingStatsView />}
      {view.kind === 'interest' && <InterestView />}
      {view.kind === 'audit' && (
        <Card className={adminCardClass}>
          <h2 className={adminH2Class}>Logi</h2>
          <AuditView />
        </Card>
      )}
    </div>
  );
}
