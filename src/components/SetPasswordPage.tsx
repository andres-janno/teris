// src/components/SetPasswordPage.tsx — parooli määramine e-kirja lingiga (/parool#token).
import React, { useEffect, useState } from 'react';
import { KeyRound, AlertCircle, Check } from 'lucide-react';
import { TerisLogo } from './TerisLogo';
import { api } from '../services/api';

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
            <p className="modal-subtitle">Küsi uus link sisselogimise lehe „Unustasid parooli?“ kaudu või adminilt.</p>
            <button type="button" className="btn btn-primary btn-full" onClick={onCancel}>Sisselogimise lehele</button>
          </>
        ) : username === null ? (
          <p className="modal-subtitle">Kontrollin linki…</p>
        ) : (
          <>
            <p className="modal-subtitle">
              Määra parool kasutajale <strong>{username}</strong>.
            </p>
            {error && (
              <div className="alert-box error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            <input type="text" autoComplete="username" value={username} readOnly hidden />
            <div className="form-group">
              <label htmlFor="sp-password">Uus parool (vähemalt 10 märki)</label>
              <input id="sp-password" type="password" className="form-input" autoComplete="new-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="sp-repeat">Korda parooli</label>
              <input id="sp-repeat" type="password" className="form-input" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
              {busy ? <KeyRound size={16} /> : <Check size={16} />}
              <span>{busy ? 'Salvestan…' : 'Määra parool'}</span>
            </button>
          </>
        )}
      </form>
    </div>
  );
};
