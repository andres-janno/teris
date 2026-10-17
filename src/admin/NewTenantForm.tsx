import { useState, type FormEvent } from 'react';
import { MODULES, platformApi, type LicenseModule } from './platformApi.ts';
import { DateInput } from '../components/DateInput.tsx';

export function ModuleChecks({ value, onChange }: { value: LicenseModule[]; onChange: (v: LicenseModule[]) => void }) {
  return (
    <div className="admin-checks">
      {MODULES.map((m) => (
        <label key={m.id}>
          <input
            type="checkbox"
            checked={value.includes(m.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, m.id] : value.filter((x) => x !== m.id))}
          />
          {m.label}
        </label>
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
      onCreated(res.id, c ? `${invite} Ettevõttele kopeeriti algkataloog: ${c.crops} kultuuri, ${c.workTypes} tööliiki, ${c.templates} malli.` : invite);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="glass-card admin-card admin-form" onSubmit={submit}>
      <h2>Uus ettevõte</h2>
      {error && <div className="alert-box error">{error}</div>}
      <div className="admin-form-grid">
        <div className="form-group">
          <label htmlFor="nt-name">Nimi *</label>
          <input id="nt-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
        </div>
        <div className="form-group">
          <label htmlFor="nt-reg">Registrikood</label>
          <input id="nt-reg" className="form-input" value={registryCode} onChange={(e) => setRegistryCode(e.target.value)} maxLength={20} />
        </div>
        <div className="form-group">
          <label htmlFor="nt-user">Admini kasutajanimi *</label>
          <input id="nt-user" className="form-input" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} autoComplete="off" required />
        </div>
        <div className="form-group">
          <label htmlFor="nt-dn">Admini nimi</label>
          <input id="nt-dn" className="form-input" value={adminDisplayName} onChange={(e) => setAdminDisplayName(e.target.value)} maxLength={200} />
        </div>
        <div className="form-group">
          <label htmlFor="nt-email">Admini e-post *</label>
          <input id="nt-email" className="form-input" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="nt-until">Litsents kuni *</label>
          <DateInput id="nt-until" className="form-input" value={validUntil} onChange={setValidUntil} required />
        </div>
      </div>
      <div className="form-group">
        <span>Moodulid</span>
        <ModuleChecks value={modules} onChange={setModules} />
      </div>
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Salvestan…' : 'Loo ettevõte'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Tühista
        </button>
      </div>
    </form>
  );
}
