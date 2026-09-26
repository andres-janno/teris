// src/AuthGate.tsx — sisselogimise kontroll enne rakenduse laadimist.
import React, { useEffect, useState } from 'react';
import { App } from './App';
import { LoginPage } from './components/LoginPage';
import type { AuthUser } from './types/auth';
import { api, setUnauthorizedHandler } from './services/api';

export const AuthGate: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setNotice('Sessioon aegus, logi uuesti sisse');
    });
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    return () => setUnauthorizedHandler(null);
  }, []);

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

  return (
    <App
      user={user}
      onLogout={() => {
        api.logout().catch(() => undefined).finally(() => {
          setNotice(null);
          setUser(null);
        });
      }}
    />
  );
};
