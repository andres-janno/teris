// src/components/LoginPage.tsx
import React, { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { TerisLogo } from './TerisLogo';
import { LoginBackdrop } from './LoginBackdrop';
import { COPYRIGHT_TEXT } from '../copyright';
import type { AuthUser } from '../types/auth';
import { api } from '../services/api';
import { Alert, Button, Field, Input, loginPageClass, loginColumnClass, loginCardClass, loginLogoClass, loginPrimaryButtonClass, loginCopyrightClass, loginNoticeClass } from './ui';

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
    <div className={loginPageClass}>
      <LoginBackdrop />
      <div className={loginColumnClass}>
        <form className={loginCardClass} onSubmit={submit}>
          <div className={loginLogoClass}>
            <TerisLogo variant="vertical" />
          </div>

          {notice && !error && <div className={loginNoticeClass}>{notice}</div>}
          {error && (
            <Alert tone="error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </Alert>
          )}

          <Field label="Kasutajanimi" htmlFor="login-username">
            <Input
              id="login-username"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label="Parool" htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" className={loginPrimaryButtonClass} disabled={busy}>
            <LogIn size={16} />
            <span>{busy ? 'Login sisse…' : 'Logi sisse'}</span>
          </Button>
          <button type="button" className="login-forgot-link mt-1 cursor-pointer self-center border-none bg-transparent font-inherit text-sm leading-natural underline" onClick={() => { setForgotOpen((v) => !v); setForgotSent(false); }}>
            Unustasid parooli?
          </button>
          {forgotOpen && (
            <div className="login-forgot-box flex flex-col gap-1.5 text-sm leading-natural">
              {forgotSent ? (
                <div className={loginNoticeClass}>Kui konto on olemas, saatsime e-posti aadressile parooli määramise lingi.</div>
              ) : (
                <>
                  <label htmlFor="forgot-login">Kasutajanimi või e-post</label>
                  <div className="flex gap-1.5 [&>[data-slot=input]]:flex-1">
                    <Input id="forgot-login" value={forgotLogin} onChange={(e) => setForgotLogin(e.target.value)} />
                    <Button
                      type="button"
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
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </form>
        <a className="login-home-link mt-4 rounded-full px-3 py-1.5 text-base leading-natural font-medium no-underline" href="/">← Tutvu <em className="login-brand-word">TERIS</em>-ega avalehel</a>
        <p className={loginCopyrightClass}>{COPYRIGHT_TEXT}</p>
      </div>
    </div>
  );
};
