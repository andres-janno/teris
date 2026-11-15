// src/components/SetPasswordPage.tsx — parooli määramine e-kirja lingiga (/set-password#token).
import React, { useEffect, useState } from 'react';
import { KeyRound, AlertCircle, Check } from 'lucide-react';
import { TerisLogo } from './TerisLogo';
import { LoginBackdrop } from './LoginBackdrop';
import { COPYRIGHT_TEXT } from '../copyright';
import { api } from '../services/api';
import { Button, Field, Input } from './ui';

interface SetPasswordPageProps {
  token: string;
  onDone: (notice: string) => void;
  onCancel: () => void;
}

export const SetPasswordPage: React.FC<SetPasswordPageProps> = ({ token, onDone, onCancel }) => {
  const [username, setUsername] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .checkPasswordToken(token)
      .then((r) => setUsername(r.username))
      .catch((err) => setInvalid(err instanceof Error ? err.message : 'Link on aegunud või juba kasutatud'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError('Parool peab olema vähemalt 10 märki');
    if (password !== repeat) return setError('Paroolid ei kattu');
    setBusy(true);
    try {
      await api.setPasswordWithToken(token, password);
      onDone('Parool määratud. Logi sisse.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parooli määramine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <LoginBackdrop />
      <div className="login-column">
        <form className="login-card glass-card" onSubmit={submit}>
          <div className="login-brand">
            <TerisLogo variant="vertical" />
          </div>
          {invalid ? (
            <>
              <div className="alert-box error">
                <AlertCircle size={16} />
                <span>{invalid}</span>
              </div>
              <p className="hint-text">Küsi uus link sisselogimise lehe „Unustasid parooli?“ kaudu või adminilt.</p>
              <Button type="button" variant="primary" className="btn-full login-primary-btn" onClick={onCancel}>Sisselogimise lehele</Button>
            </>
          ) : username === null ? (
            <p className="hint-text">Kontrollin linki…</p>
          ) : (
            <>
              <p className="hint-text">
                Määra parool kasutajale <strong>{username}</strong>.
              </p>
              {error && (
                <div className="alert-box error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
              <Input type="text" autoComplete="username" value={username} readOnly hidden />
              <Field label="Uus parool (vähemalt 10 märki)" htmlFor="sp-password">
                <Input id="sp-password" type="password" autoComplete="new-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label="Korda parooli" htmlFor="sp-repeat">
                <Input id="sp-repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary" className="btn-full login-primary-btn" disabled={busy}>
                {busy ? <KeyRound size={16} /> : <Check size={16} />}
                <span>{busy ? 'Salvestan…' : 'Määra parool'}</span>
              </Button>
            </>
          )}
        </form>
        <p className="login-copyright">{COPYRIGHT_TEXT}</p>
      </div>
    </div>
  );
};
