import React from 'react';
import {
  Layers,
  Tractor,
  MapPin,
  BarChart3,
  CalendarDays,
  Sprout,
  Map as MapIcon,
  SquareKanban
} from 'lucide-react';
import { TerisLogo } from './TerisLogo';
import { UserMenu } from './UserMenu';
import { OperatorSelector } from './OperatorSelector';
import type { FarmingSeason } from '../types/season';
import type { RelatedParty } from '../types/party';
import type { AuthUser } from '../types/auth';

export type MainView = 'map' | 'seasons' | 'fields' | 'crops' | 'works' | 'fleet' | 'infrastructure';

interface HeaderProps {
  fieldsCount?: number;
  totalAreaHa?: number;
  workedAreaHa?: number;
  activeVehiclesCount?: number;
  poiCount?: number;
  partiesCount?: number;
  parties?: RelatedParty[];
  cropsCount?: number;
  varietiesCount?: number;
  operatorFilter?: string[];
  onOperatorFilterChange?: (partyIds: string[]) => void;
  selectedYear?: number;
  activeSeason?: FarmingSeason;
  onOpenSeasonManager?: () => void;
  onOpenFieldsRegister?: () => void;
  onOpenParties?: () => void;
  onOpenCrops?: () => void;
  mainView?: MainView;
  onChangeMainView?: (view: MainView) => void;
  onOpenVehicles?: () => void;
  onOpenPoi?: () => void;
  onOpenAnalytics: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  dbConnected?: boolean;
  currentUser?: AuthUser;
  onChangePassword?: () => void;
  onOpenUsers?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  parties = [],
  operatorFilter = [],
  onOperatorFilterChange,
  mainView = 'map',
  onChangeMainView,
  onOpenAnalytics,
  theme,
  onToggleTheme,
  dbConnected = false,
  currentUser,
  onChangePassword,
  onOpenUsers,
  onLogout
}) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <TerisLogo variant="horizontal" />
        {onChangeMainView && (
          <nav className="main-view-switch" aria-label="Põhivaade">
            <button
              type="button"
              className={mainView === 'map' ? 'active' : ''}
              aria-current={mainView === 'map' ? 'page' : undefined}
              onClick={() => onChangeMainView('map')}
            >
              <MapIcon size={15} />
              <span>Kaart</span>
            </button>
            <button
              type="button"
              className={mainView === 'seasons' ? 'active' : ''}
              aria-current={mainView === 'seasons' ? 'page' : undefined}
              onClick={() => onChangeMainView('seasons')}
            >
              <CalendarDays size={15} />
              <span>Hooajad</span>
            </button>
            <button
              type="button"
              className={mainView === 'fields' ? 'active' : ''}
              aria-current={mainView === 'fields' ? 'page' : undefined}
              onClick={() => onChangeMainView('fields')}
            >
              <Layers size={15} />
              <span>Põllud</span>
            </button>
            <button
              type="button"
              className={mainView === 'crops' ? 'active' : ''}
              aria-current={mainView === 'crops' ? 'page' : undefined}
              onClick={() => onChangeMainView('crops')}
            >
              <Sprout size={15} />
              <span>Kultuurid</span>
            </button>
            <button
              type="button"
              className={mainView === 'works' ? 'active' : ''}
              aria-current={mainView === 'works' ? 'page' : undefined}
              onClick={() => onChangeMainView('works')}
            >
              <SquareKanban size={15} />
              <span>Põllutööd</span>
            </button>
            <button
              type="button"
              className={mainView === 'fleet' ? 'active' : ''}
              aria-current={mainView === 'fleet' ? 'page' : undefined}
              onClick={() => onChangeMainView('fleet')}
            >
              <Tractor size={15} />
              <span>Tehnika</span>
            </button>
            <button
              type="button"
              className={mainView === 'infrastructure' ? 'active' : ''}
              aria-current={mainView === 'infrastructure' ? 'page' : undefined}
              onClick={() => onChangeMainView('infrastructure')}
            >
              <MapPin size={15} />
              <span>Taristu</span>
            </button>
          </nav>
        )}
        {onOperatorFilterChange && (
          <OperatorSelector parties={parties} selected={operatorFilter} onChange={onOperatorFilterChange} />
        )}
      </div>

      <div className="header-actions">
        <button
          className="btn btn-secondary"
          onClick={onOpenAnalytics}
          title="Vaata tootlikkuse ja kütuse kokkuvõtet"
        >
          <BarChart3 size={16} />
          <span>Analüütika</span>
        </button>

        {currentUser && (
          <UserMenu
            user={currentUser}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onChangePassword={onChangePassword}
            onOpenUsers={onOpenUsers}
            onLogout={onLogout}
            dbConnected={dbConnected}
          />
        )}
      </div>
    </header>
  );
};
