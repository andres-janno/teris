import { Card, Button, Field, Input } from '../components/ui';
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
    <Card asChild className="admin-login"><form className="admin-form" onSubmit={submit}>
      <h1><em className="admin-brand-word">TERIS</em> — teenusepakkuja</h1>
      {error && <div className="alert-box error">{error}</div>}
      <Field label="Kasutajanimi" htmlFor="pl-user">
        <Input id="pl-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
      </Field>
      <Field label="Parool" htmlFor="pl-pass">
        <Input id="pl-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <Field label="Autentimisrakenduse kood" htmlFor="pl-code">
        <Input
          id="pl-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="6 numbrit"
          required
        />
      </Field>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? 'Sisselogimine…' : 'Logi sisse'}
      </Button>
    </form></Card>
  );
}
