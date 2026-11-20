import React from 'react';
import { User as UserIcon, ChevronDown, KeyRound, Moon, Sun, LogOut, Database, Users, Bot, CloudSun } from 'lucide-react';
import type { AuthUser } from '../types/auth';
import { COPYRIGHT_TEXT } from '../copyright';
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, cn } from './ui';
import { headerChevronClass, headerNarrowHiddenClass, headerTriggerClass } from './ui/variants';

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

// Avatud menüü: nupp jääb teisejärgulise nupu värvi ka hõljumisel (ghost-nupu hõljumine ei tohi seda üle võtta).
const TRIGGER_OPEN_CLASS =
  'data-[state=open]:border-secondary-border data-[state=open]:bg-secondary data-[state=open]:text-foreground data-[state=open]:enabled:hover:bg-secondary';
const INFO_LINE_CLASS = 'text-xs leading-tight text-muted-foreground';

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
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={cn(headerTriggerClass, TRIGGER_OPEN_CLASS)} title={user.displayName || user.username} aria-label={user.displayName || user.username}>
            <UserIcon size={14} />
            <span className={headerNarrowHiddenClass}>{user.displayName || user.username}</span>
            <ChevronDown size={14} className={headerChevronClass} />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-60">
          <div className="mb-1 border-b border-border px-2.5 pt-2 pb-2.5 leading-tight">
            <div className="text-base leading-tight font-medium text-foreground">{user.displayName || user.username}</div>
            <div className={cn(INFO_LINE_CLASS, 'mt-0.5')}>Kasutajanimi: {user.username}</div>
            {user.tenantName && <div className={cn(INFO_LINE_CLASS, 'mt-0.5')}>Ettevõte: {user.tenantName}</div>}
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
            {theme === 'light' ? <Moon /> : <Sun className="text-warning" />}
            <span>{theme === 'light' ? 'Tume režiim' : 'Hele režiim'}</span>
          </DropdownMenuItem>

          <div className={cn('mt-1 flex flex-col gap-1 border-t border-border px-2.5 pt-2 pb-1', INFO_LINE_CLASS)}>
            <div>Versioon {VERSION_LABEL}</div>
            <div>{COPYRIGHT_TEXT}</div>
            <div className="inline-flex items-center gap-1" title="PostgreSQL andmebaas">
              <Database size={12} />
              <span className={cn('size-1.5 rounded-full', dbConnected ? 'bg-primary text-primary shadow-glow' : 'bg-subtle')} />
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
