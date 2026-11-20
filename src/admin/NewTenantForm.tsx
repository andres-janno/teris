import { useState, type FormEvent } from 'react';
import { MODULES, platformApi, type LicenseModule } from './platformApi.ts';
import { Alert, CheckboxField, DateInput, Card, Button, Field, Input } from '../components/ui';
import { cn } from '../components/ui/cn';
import { adminActionsClass, adminCardClass, adminChecksClass, adminFormClass, adminFormGridClass, adminH2Class } from './adminUi.ts';

export function ModuleChecks({ value, onChange, className }: { value: LicenseModule[]; onChange: (v: LicenseModule[]) => void; className?: string }) {
  return (
    <div className={cn(adminChecksClass, className)}>
      {MODULES.map((m) => (
        <CheckboxField
          key={m.id}
          label={m.label}
          checked={value.includes(m.id)}
          onCheckedChange={(on) => onChange(on ? [...value, m.id] : value.filter((x) => x !== m.id))}
        />
      ))}
    </div>
  );
}

export function NewTenantForm({ onCreated, onCancel }: { onCreated: (id: string, notice: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [registryCode, setRegistryCode] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [modules, setModules] = useState<LicenseModule[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await platformApi.createTenant({
        name: name.trim(),
        registryCode: registryCode.trim() || undefined,
        adminUsername: adminUsername.trim(),
        adminDisplayName: adminDisplayName.trim() || undefined,
        adminEmail: adminEmail.trim(),
        validUntil,
        modules
      });
      const invite = res.inviteSent
        ? `Ettevõte loodud. Kutse saadeti aadressile ${adminEmail.trim()}.`
        : 'Ettevõte loodud. Kutset ei õnnestunud saata — saada uuesti ettevõtte kaardilt.';
      const c = res.catalog;
      onCreated(res.id, c ? `${invite} Ettevõttele kopeeriti algkataloog: ${c.crops} kultuuri, ${c.workTypes} tööliiki.` : invite);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card asChild className={adminCardClass}><form className={adminFormClass} onSubmit={submit}>
      <h2 className={adminH2Class}>Uus ettevõte</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <div className={adminFormGridClass}>
        <Field label="Nimi *" htmlFor="nt-name">
          <Input id="nt-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
        </Field>
        <Field label="Registrikood" htmlFor="nt-reg">
          <Input id="nt-reg" value={registryCode} onChange={(e) => setRegistryCode(e.target.value)} maxLength={20} />
        </Field>
        <Field label="Admini kasutajanimi *" htmlFor="nt-user">
          <Input id="nt-user" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} autoComplete="off" required />
        </Field>
        <Field label="Admini nimi" htmlFor="nt-dn">
          <Input id="nt-dn" value={adminDisplayName} onChange={(e) => setAdminDisplayName(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Admini e-post *" htmlFor="nt-email">
          <Input id="nt-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
        </Field>
        <Field label="Litsents kuni *" htmlFor="nt-until">
          <DateInput id="nt-until" value={validUntil} onChange={setValidUntil} required />
        </Field>
      </div>
      <Field label="Moodulid">
        <ModuleChecks value={modules} onChange={setModules} />
      </Field>
      <div className={adminActionsClass}>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Salvestan…' : 'Loo ettevõte'}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Tühista
        </Button>
      </div>
    </form></Card>
  );
}
