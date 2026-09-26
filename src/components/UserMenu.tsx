import React, { useEffect, useRef, useState } from 'react';
import { User as UserIcon, ChevronDown, KeyRound, Moon, Sun, LogOut, Database, Users } from 'lucide-react';
import type { AuthUser } from '../types/auth';

interface UserMenuProps {
  user: AuthUser;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onChangePassword?: () => void;
  onOpenUsers?: () => void;
  onLogout?: () => void;
  dbConnected: boolean;
}

const VERSION_LABEL = __APP_COMMIT__ ? `${__APP_VERSION__} (${__APP_COMMIT__})` : __APP_VERSION__;

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  theme,
  onToggleTheme,
  onChangePassword,
  onOpenUsers,
  onLogout,
  dbConnected
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const run = (action?: () => void) => () => {
    setOpen(false);
    action?.();
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className={`user-menu-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserIcon size={14} />
        <span>{user.displayName || user.username}</span>
        <ChevronDown size={14} className="user-menu-chevron" />
      </button>

      <button className="btn btn-secondary btn-icon-only" onClick={onLogout} title="Logi välja" aria-label="Logi välja">
        <LogOut size={16} />
      </button>

      {open && (
        <div className="user-menu-dropdown glass-card animate-scale-up" role="menu">
          <div className="user-menu-info">
            <div className="user-menu-info-name">{user.displayName || user.username}</div>
            <div className="user-menu-info-login">Kasutajanimi: {user.username}</div>
          </div>

          <button type="button" role="menuitem" className="user-menu-item" onClick={run(onChangePassword)}>
            <KeyRound size={15} />
            <span>Muuda parooli</span>
          </button>
          {user.isAdmin && onOpenUsers && (
            <button type="button" role="menuitem" className="user-menu-item" onClick={run(onOpenUsers)}>
              <Users size={15} />
              <span>Kasutajad</span>
            </button>
          )}
          <button type="button" role="menuitem" className="user-menu-item" onClick={run(onToggleTheme)}>
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} className="text-amber-400" />}
            <span>{theme === 'light' ? 'Tume režiim' : 'Hele režiim'}</span>
          </button>

          <div className="user-menu-footer">
            <div>Versioon {VERSION_LABEL}</div>
            <div className="user-menu-db" title="PostgreSQL andmebaas">
              <Database size={12} />
              <span className={`user-menu-db-dot ${dbConnected ? 'connected' : ''}`}></span>
              agro_db {dbConnected ? '' : '(ühendus puudub)'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
