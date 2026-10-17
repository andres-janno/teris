// src/AuthGate.tsx — sisselogimise kontroll enne rakenduse laadimist.
import React, { useEffect, useState } from 'react';
import { App } from './App';
import { LoginPage } from './components/LoginPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SetPasswordPage } from './components/SetPasswordPage';
import type { AuthUser } from './types/auth';
import { api, setUnauthorizedHandler } from './services/api';
import { alertDialog } from './components/ConfirmDialog';

// /tugi#<token> — kasutajatoe üleandmislink. Token loetakse ja fragment eemaldatakse kohe
// (enne päringut), et token ei jääks aadressiribale ega ajalukku.
const supportToken: string | null =
  window.location.pathname === '/tugi' && window.location.hash.length > 1 ? window.location.hash.slice(1) : null;
if (window.location.pathname === '/tugi') window.history.replaceState(null, '', '/');
let supportLoginStarted = false;

export const AuthGate: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // /parool#<token> — e-kirja link parooli määramiseks.
  const [linkToken, setLinkToken] = useState<string | null>(() =>
    window.location.pathname === '/parool' && window.location.hash.length > 1 ? window.location.hash.slice(1) : null
  );
  const leaveLinkPage = (message?: string) => {
    window.history.replaceState(null, '', '/');
    setLinkToken(null);
    if (message) {
      // Parooli määramine lõpetas kõik selle kasutaja sessioonid — näita sisselogimist.
      setUser(null);
      setNotice(message);
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setNotice('Sessioon aegus, logi uuesti sisse');
    });
    if (supportToken !== null && !supportLoginStarted) {
      // Tugivaate link: kasuta üleandmistokenit, tavalist sessiooni ei kontrollita.
      supportLoginStarted = true;
      api
        .supportLogin(supportToken)
        .then((u) => {
          setNotice(null);
          setUser(u);
        })
        .catch((err) => {
          setUser(null);
          setNotice(err instanceof Error ? err.message : 'Tugivaate link on aegunud või juba kasutatud');
        })
        .finally(() => setChecking(false));
      return () => setUnauthorizedHandler(null);
    }
    if (supportLoginStarted) return () => setUnauthorizedHandler(null); // StrictMode kordus
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  if (linkToken) {
    return <SetPasswordPage token={linkToken} onDone={(m) => leaveLinkPage(m)} onCancel={() => leaveLinkPage()} />;
  }

  if (checking) return <div className="auth-loading">Laadin…</div>;

  if (!user) {
    return (
      <LoginPage
        notice={notice}
        onLoggedIn={(u) => {
          setNotice(null);
          setUser(u);
        }}
      />
    );
  }

  const logout = () => {
    api
      .logout()
      .then(() => {
        setNotice(null);
        setUser(null);
      })
      .catch((err) => {
        // Väljalogimine ebaõnnestus — jäetakse sisse logituks, kasutajale teatatakse alert()-iga.
        alertDialog(err instanceof Error ? err.message : 'Väljalogimine ebaõnnestus');
      });
  };

  if (user.mustChangePassword) {
    return (
      <div className="forced-password-page">
        <ChangePasswordModal
          isOpen
          forced
          onClose={() => undefined}
          onDone={() => {
            api.getMe().then(setUser).catch(() => setUser(null));
          }}
          onLogout={logout}
        />
      </div>
    );
  }

  return <App user={user} onLogout={logout} />;
};
