import { useState, type FormEvent } from 'react';
import { platformApi } from './platformApi.ts';

export function LoginView({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await platformApi.login(username.trim(), password, code.trim());
      onLogin(user.username);
    } catch (err) {
      setError((err as Error).message);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="glass-card admin-login admin-form" onSubmit={submit}>
      <h1>Teris — teenusepakkuja</h1>
      {error && <div className="alert-box error">{error}</div>}
      <div className="form-group">
        <label htmlFor="pl-user">Kasutajanimi</label>
        <input id="pl-user" className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
      </div>
      <div className="form-group">
        <label htmlFor="pl-pass">Parool</label>
        <input id="pl-pass" className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      <div className="form-group">
        <label htmlFor="pl-code">Autentimisrakenduse kood</label>
        <input
          id="pl-code"
          className="form-input"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="6 numbrit"
          required
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Sisselogimine…' : 'Logi sisse'}
      </button>
    </form>
  );
}
