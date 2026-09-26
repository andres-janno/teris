import React from 'react';
import {
  Layers,
  Tractor,
  MapPin,
  Activity,
  BarChart3,
  CalendarDays,
  Users,
  Sprout
} from 'lucide-react';
import { AgroLogo } from './AgroLogo';
import { UserMenu } from './UserMenu';
import { OperatorSelector } from './OperatorSelector';
import type { FarmingSeason } from '../types/season';
import type { RelatedParty } from '../types/party';
import type { AuthUser } from '../types/auth';

interface HeaderProps {
  fieldsCount: number;
  totalAreaHa: number;
  workedAreaHa: number;
  activeVehiclesCount: number;
  poiCount: number;
  partiesCount?: number;
  parties?: RelatedParty[];
  cropsCount?: number;
  varietiesCount?: number;
  operatorFilter?: string[]; // tühi = kõik operaatorid
  onOperatorFilterChange?: (partyIds: string[]) => void;
  selectedYear: number;
  activeSeason?: FarmingSeason;
  onOpenSeasonManager: () => void;
  onOpenFieldsRegister: () => void;
  onOpenParties?: () => void;
  onOpenCrops?: () => void;
  onOpenVehicles: () => void;
  onOpenPoi: () => void;
  onOpenAnalytics: () => void;
  isAddPoiMode: boolean;
  onToggleAddPoiMode: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  dbConnected?: boolean;
  currentUser?: AuthUser;
  onChangePassword?: () => void;
  onOpenUsers?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  fieldsCount,
  totalAreaHa,
  workedAreaHa,
  activeVehiclesCount,
  poiCount,
  partiesCount = 0,
  parties = [],
  cropsCount = 0,
  varietiesCount = 0,
  operatorFilter = [],
  onOperatorFilterChange,
  selectedYear,
  activeSeason,
  onOpenSeasonManager,
  onOpenFieldsRegister,
  onOpenParties,
  onOpenCrops,
  onOpenVehicles,
  onOpenPoi,
  onOpenAnalytics,
  isAddPoiMode,
  onToggleAddPoiMode,
  theme,
  onToggleTheme,
  dbConnected = false,
  currentUser,
  onChangePassword,
  onOpenUsers,
  onLogout
}) => {
  const overallProgress = totalAreaHa > 0 ? Math.round((workedAreaHa / totalAreaHa) * 100) : 0;
  const isLocked = activeSeason?.isLocked ?? false;

  return (
    <header className="app-header">
      <div className="header-brand">
        <AgroLogo variant="horizontal" />
        {onOperatorFilterChange && (
          <OperatorSelector parties={parties} selected={operatorFilter} onChange={onOperatorFilterChange} />
        )}
      </div>

      <div className="header-stats">
        {/* Clickable Season Register Pill */}
        <div
          className={`stat-pill clickable season-stat-pill ${isLocked ? 'season-locked-pill' : ''}`}
          onClick={onOpenSeasonManager}
          title="Ava hooaja register ja elutsükli haldus"
        >
          <CalendarDays size={16} className={`stat-icon ${isLocked ? 'text-slate-400' : 'season-icon'}`} />
          <div>
            <div className="stat-label-with-year">
              {isLocked ? (
                <span className="stat-status-tag locked">Lukus</span>
              ) : (
                <span className="stat-status-tag active">Aktiivne</span>
              )}
            </div>
            <div className="stat-value">
              {activeSeason?.name || `Hooaeg ${selectedYear}`}
            </div>
          </div>
        </div>

        {/* Clickable Fields Register Pill with Season indicator */}
        <div className="stat-pill clickable field-stat-pill" onClick={onOpenFieldsRegister} title="Ava põldude ja külvikorra register">
          <Layers size={16} className="stat-icon fields-icon" />
          <div>
            <div className="stat-label-with-year">
              <span>Põllud ({fieldsCount})</span>
            </div>
            <div className="stat-value">{totalAreaHa.toFixed(1)} <span className="unit">ha</span></div>
          </div>
        </div>

        <div className="stat-pill" title="Teltonika järgi haritud pindala">
          <Activity size={16} className="stat-icon work-icon" />
          <div>
            <div className="stat-label">Haritud ({overallProgress}%)</div>
            <div className="stat-value">{workedAreaHa.toFixed(1)} <span className="unit">ha</span></div>
          </div>
          <div className="stat-progress-bar">
            <div className="progress-fill" style={{ width: `${overallProgress}%` }}></div>
          </div>
        </div>

        <div className="stat-pill clickable" onClick={onOpenVehicles} title="Aktiivne tehnika">
          <Tractor size={16} className="stat-icon tech-icon" />
          <div>
            <div className="stat-label">Tehnika</div>
            <div className="stat-value">{activeVehiclesCount} <span className="unit">aktiivne</span></div>
          </div>
        </div>

        <div className="stat-pill clickable" onClick={onOpenPoi} title="Olulised asukohad">
          <MapPin size={16} className="stat-icon poi-icon" />
          <div>
            <div className="stat-label">Taristu / POI</div>
            <div className="stat-value">{poiCount} <span className="unit">punkti</span></div>
          </div>
        </div>

        {onOpenParties && (
          <div
            className="stat-pill clickable parties-stat-pill"
            onClick={onOpenParties}
            title="Ava seotud isikute register (maaomanikud, masinajuhid, partnerid)"
          >
            <Users size={16} className="stat-icon text-emerald" />
            <div>
              <div className="stat-label">Seotud isikud</div>
              <div className="stat-value">{partiesCount ?? 0} <span className="unit">isikut</span></div>
            </div>
          </div>
        )}

        {onOpenCrops && (
          <div
            className="stat-pill clickable crops-stat-pill"
            onClick={onOpenCrops}
            title="Ava kultuuride ja sortide register"
          >
            <Sprout size={16} className="stat-icon text-amber" />
            <div>
              <div className="stat-label">Kultuurid & Sordid</div>
              <div className="stat-value">
                {cropsCount ?? 0} <span className="unit">kultuuri</span>
                {varietiesCount ? ` (${varietiesCount} sorti)` : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="header-actions">
        <button
          className={`btn btn-secondary ${isAddPoiMode ? 'btn-active-poi' : ''}`}
          onClick={onToggleAddPoiMode}
          title="Klõpsa kaardile, et lisada kuivati, veepunkt või töökoda"
        >
          <MapPin size={16} />
          <span>{isAddPoiMode ? 'Lõpeta lisamine' : 'Lisa marker (POI)'}</span>
        </button>

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
