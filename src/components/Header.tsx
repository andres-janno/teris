import React from 'react';
import {
  Layers,
  Tractor,
  Upload,
  MapPin,
  Activity,
  BarChart3,
  Sun,
  Moon,
  CalendarDays,
  Users,
  Sprout
} from 'lucide-react';
import type { FarmingSeason } from '../types/season';

interface HeaderProps {
  fieldsCount: number;
  totalAreaHa: number;
  workedAreaHa: number;
  activeVehiclesCount: number;
  poiCount: number;
  partiesCount?: number;
  cropsCount?: number;
  varietiesCount?: number;
  selectedYear: number;
  activeSeason?: FarmingSeason;
  onOpenSeasonManager: () => void;
  onOpenFieldsRegister: () => void;
  onOpenParties?: () => void;
  onOpenCrops?: () => void;
  onOpenUpload: () => void;
  onOpenVehicles: () => void;
  onOpenPoi: () => void;
  onOpenAnalytics: () => void;
  isAddPoiMode: boolean;
  onToggleAddPoiMode: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  fieldsCount,
  totalAreaHa,
  workedAreaHa,
  activeVehiclesCount,
  poiCount,
  partiesCount = 0,
  cropsCount = 0,
  varietiesCount = 0,
  selectedYear,
  activeSeason,
  onOpenSeasonManager,
  onOpenFieldsRegister,
  onOpenParties,
  onOpenCrops,
  onOpenUpload,
  onOpenVehicles,
  onOpenPoi,
  onOpenAnalytics,
  isAddPoiMode,
  onToggleAddPoiMode,
  theme,
  onToggleTheme
}) => {
  const overallProgress = totalAreaHa > 0 ? Math.round((workedAreaHa / totalAreaHa) * 100) : 0;
  const isLocked = activeSeason?.isLocked ?? false;

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-icon">
          <Tractor className="brand-tractor" size={24} />
          <span className="brand-pulse"></span>
        </div>
        <div className="brand-text">
          <div className="brand-title">
            <span>AGRI</span>MAP <span className="brand-badge">PRO</span>
          </div>
          <div className="brand-subtitle">Maa-amet &bull; PRIA SHP &bull; Teltonika GPS</div>
        </div>
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
              <span>Hooaeg {selectedYear}</span>
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

        <button
          className="btn btn-primary"
          onClick={onOpenUpload}
          title="Laadi üles PRIA põldude SHP ZIP fail"
        >
          <Upload size={16} />
          <span>Impordi PRIA SHP</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          className="btn btn-secondary theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Lülita tumedale režiimile (Dark Mode)' : 'Lülita heledale režiimile (Light Mode)'}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} className="text-amber-400" />}
          <span>{theme === 'light' ? 'Tume režiim' : 'Hele režiim'}</span>
        </button>
      </div>
    </header>
  );
};
