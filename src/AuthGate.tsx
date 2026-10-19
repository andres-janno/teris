// src/AuthGate.tsx — sisselogimise kontroll enne rakenduse laadimist.
import React, { useEffect, useRef, useState } from 'react';
import { App } from './App';
import { LoginPage } from './components/LoginPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SetPasswordPage } from './components/SetPasswordPage';
import type { AuthUser } from './types/auth';
import { api, ApiError, setUnauthorizedHandler } from './services/api';
import { alertDialog } from './components/ConfirmDialog';

// /support#<token> — kasutajatoe üleandmislink (vana alias /tugi). Token loetakse ja fragment eemaldatakse kohe
// (enne päringut), et token ei jääks aadressiribale ega ajalukku.
const SUPPORT_PATHS = ['/support', '/tugi'];
const SET_PASSWORD_PATHS = ['/set-password', '/parool'];
const isSupportPath = SUPPORT_PATHS.includes(window.location.pathname);
const supportToken: string | null = isSupportPath && window.location.hash.length > 1 ? window.location.hash.slice(1) : null;
if (isSupportPath) window.history.replaceState(null, '', '/');
let supportLoginStarted = false;
const SUPPORT_409_NOTICE = 'Selles brauseris on juba tavakasutaja sessioon. Logi välja ja ava tugivaate link uuesti (või kasuta privaatakent).';

export const AuthGate: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  // Tavakasutaja sessiooni ja tugivaate vahel valitakse 401 teade selle järgi, kas viimane kasutaja oli tugivaade.
  const supportViewRef = useRef(false);
  supportViewRef.current = !!user?.supportView;
  // Tugivaate lingi 409: sisse jäädakse tavakasutajana, teade jääb rakenduses nähtavale.
  const [banner, setBanner] = useState<string | null>(null);

  // /set-password#<token> (vana alias /parool) — e-kirja link parooli määramiseks.
  const [linkToken, setLinkToken] = useState<string | null>(() =>
    SET_PASSWORD_PATHS.includes(window.location.pathname) && window.location.hash.length > 1 ? window.location.hash.slice(1) : null
  );
  const leaveLinkPage = (message?: string) => {
    window.history.replaceState(null, '', '/login');
    setLinkToken(null);
    if (message) {
      // Parooli määramine lõpetas kõik selle kasutaja sessioonid — näita sisselogimist.
      setUser(null);
      setNotice(message);
    }
  };

  // Sisselogimata olek elab aadressil /login, et värskendamine ei viiks landing'ule
  const showLogin = () => {
    if (window.location.pathname !== '/login') window.history.replaceState(null, '', '/login');
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      showLogin();
      setUser(null);
      setBanner(null);
      setNotice(supportViewRef.current ? 'Tugivaade lõppes. Ava uus link teenusepakkuja keskkonnast.' : 'Sessioon aegus, logi uuesti sisse');
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
        .catch(async (err) => {
          if (err instanceof ApiError && err.status === 409) {
            // Brauseris on juba tavakasutaja sessioon: jätka selle kasutajana, teade jääb nähtavale.
            try {
              const me = await api.getMe();
              setNotice(null);
              setBanner(SUPPORT_409_NOTICE);
              setUser(me);
              return;
            } catch {
              // getMe ebaõnnestus: tagasi sisselogimislehele
            }
          }
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
      .catch(() => {
        showLogin();
        setUser(null);
      })
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
          if (window.location.pathname === '/login') window.history.replaceState(null, '', '/');
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
        showLogin();
        setNotice(null);
        setBanner(null);
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

  return (
    <>
      {banner && (
        <div className="alert-box" role="alert" style={{ margin: 8, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{banner}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBanner(null)}>Sulge</button>
        </div>
      )}
      <App user={user} onLogout={logout} />
    </>
  );
};
