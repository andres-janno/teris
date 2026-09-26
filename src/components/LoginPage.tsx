// src/components/LoginPage.tsx
import React, { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { WheatLogo } from './WheatLogo';
import type { AuthUser } from '../types/auth';
import { api } from '../services/api';

interface LoginPageProps {
  notice?: string | null;
  onLoggedIn: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ notice, onLoggedIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLoggedIn(await api.login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sisselogimine ebaõnnestus');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card glass-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="logo-icon">
            <WheatLogo className="brand-logo-mark" size={26} />
          </div>
          <div className="brand-title">
            <span>AGRO</span>
          </div>
        </div>

        {notice && !error && <div className="alert-box">{notice}</div>}
        {error && (
          <div className="alert-box error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="login-username">Kasutajanimi</label>
          <input
            id="login-username"
            className="form-input"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">Parool</label>
          <input
            id="login-password"
            type="password"
            className="form-input"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
          <LogIn size={16} />
          <span>{busy ? 'Login sisse…' : 'Logi sisse'}</span>
        </button>
      </form>
    </div>
  );
};
