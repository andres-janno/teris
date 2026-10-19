// src/components/LoginPage.tsx
import React, { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { TerisLogo } from './TerisLogo';
import { LoginBackdrop } from './LoginBackdrop';
import { COPYRIGHT_TEXT } from '../copyright';
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
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLogin, setForgotLogin] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

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
      <LoginBackdrop />
      <div className="login-column">
        <form className="login-card glass-card" onSubmit={submit}>
          <div className="login-brand">
            <TerisLogo variant="vertical" />
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
          <button type="button" className="login-forgot-link" onClick={() => { setForgotOpen((v) => !v); setForgotSent(false); }}>
            Unustasid parooli?
          </button>
          {forgotOpen && (
            <div className="login-forgot-box">
              {forgotSent ? (
                <div className="alert-box">Kui konto on olemas, saatsime e-posti aadressile parooli määramise lingi.</div>
              ) : (
                <>
                  <label htmlFor="forgot-login">Kasutajanimi või e-post</label>
                  <div className="login-forgot-row">
                    <input id="forgot-login" className="form-input" value={forgotLogin} onChange={(e) => setForgotLogin(e.target.value)} />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!forgotLogin.trim()}
                      onClick={async () => {
                        setError(null);
                        try {
                          await api.forgotPassword(forgotLogin.trim());
                          setForgotSent(true);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Päring ebaõnnestus');
                        }
                      }}
                    >
                      Saada link
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </form>
        <a className="login-home-link" href="/">← Tutvu <em className="login-brand-word">TERIS</em>-ega avalehel</a>
        <p className="login-copyright">{COPYRIGHT_TEXT}</p>
      </div>
    </div>
  );
};
