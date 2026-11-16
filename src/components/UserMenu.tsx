import React from 'react';
import { User as UserIcon, ChevronDown, KeyRound, Moon, Sun, LogOut, Database, Users, Bot, CloudSun } from 'lucide-react';
import type { AuthUser } from '../types/auth';
import { COPYRIGHT_TEXT } from '../copyright';
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui';

interface UserMenuProps {
  user: AuthUser;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onChangePassword?: () => void;
  onOpenAiConnection?: () => void;
  onOpenUsers?: () => void;
  onOpenWeatherCredential?: () => void;
  onLogout?: () => void;
  dbConnected: boolean;
}

const VERSION_LABEL = __APP_COMMIT__ ? `${__APP_VERSION__} (${__APP_COMMIT__})` : __APP_VERSION__;

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  theme,
  onToggleTheme,
  onChangePassword,
  onOpenAiConnection,
  onOpenUsers,
  onOpenWeatherCredential,
  onLogout,
  dbConnected
}) => {
  return (
    <div className="header-account">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="header-account-trigger">
            <UserIcon size={14} />
            <span>{user.displayName || user.username}</span>
            <ChevronDown size={14} className="header-account-chevron" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="header-account-content">
          <div className="header-account-info">
            <div className="header-account-info-name">{user.displayName || user.username}</div>
            <div className="header-account-info-login">Kasutajanimi: {user.username}</div>
            {user.tenantName && <div className="header-account-info-login">Ettevõte: {user.tenantName}</div>}
          </div>

          {!user.supportView && (
            <DropdownMenuItem onSelect={() => onChangePassword?.()}>
              <KeyRound />
              <span>Muuda parooli</span>
            </DropdownMenuItem>
          )}
          {!user.supportView && onOpenAiConnection && (
            <DropdownMenuItem onSelect={() => onOpenAiConnection()}>
              <Bot />
              <span>AI ühendus</span>
            </DropdownMenuItem>
          )}
          {user.isAdmin && onOpenUsers && (
            <DropdownMenuItem onSelect={() => onOpenUsers()}>
              <Users />
              <span>Kasutajad</span>
            </DropdownMenuItem>
          )}
          {user.isAdmin && onOpenWeatherCredential && (
            <DropdownMenuItem onSelect={() => onOpenWeatherCredential()}>
              <CloudSun />
              <span>Ilmaandmete ühendus</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => onToggleTheme()}>
            {theme === 'light' ? <Moon /> : <Sun className="header-account-sun" />}
            <span>{theme === 'light' ? 'Tume režiim' : 'Hele režiim'}</span>
          </DropdownMenuItem>

          <div className="header-account-footer">
            <div>Versioon {VERSION_LABEL}</div>
            <div>{COPYRIGHT_TEXT}</div>
            <div className="header-account-db" title="PostgreSQL andmebaas">
              <Database size={12} />
              <span className={`header-account-db-dot ${dbConnected ? 'connected' : ''}`}></span>
              teris_db {dbConnected ? '' : '(ühendus puudub)'}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="icon-sm" onClick={onLogout} title="Logi välja" aria-label="Logi välja">
        <LogOut size={16} />
      </Button>
    </div>
  );
};
