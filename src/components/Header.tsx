import React from 'react';
import { 
  Layers, 
  Tractor, 
  Upload, 
  MapPin, 
  Activity, 
  BarChart3,
  Maximize2,
  Sun,
  Moon
} from 'lucide-react';

interface HeaderProps {
  fieldsCount: number;
  totalAreaHa: number;
  workedAreaHa: number;
  activeVehiclesCount: number;
  poiCount: number;
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onOpenFieldsRegister: () => void;
  onOpenUpload: () => void;
  onOpenVehicles: () => void;
  onOpenPoi: () => void;
  onOpenAnalytics: () => void;
  isAddPoiMode: boolean;
  onToggleAddPoiMode: () => void;
  onFitAll: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  fieldsCount,
  totalAreaHa,
  workedAreaHa,
  activeVehiclesCount,
  poiCount,
  selectedYear,
  onSelectYear,
  onOpenFieldsRegister,
  onOpenUpload,
  onOpenVehicles,
  onOpenPoi,
  onOpenAnalytics,
  isAddPoiMode,
  onToggleAddPoiMode,
  onFitAll,
  theme,
  onToggleTheme
}) => {
  const overallProgress = totalAreaHa > 0 ? Math.round((workedAreaHa / totalAreaHa) * 100) : 0;

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
        {/* Clickable Fields Register Pill with Season indicator */}
        <div className="stat-pill clickable field-stat-pill" onClick={onOpenFieldsRegister} title="Ava põldude ja külvikorra register">
          <Layers size={16} className="stat-icon fields-icon" />
          <div>
            <div className="stat-label-with-year">
              <span>Põllud ({fieldsCount})</span>
              <select
                className="header-season-select"
                value={selectedYear}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onSelectYear(Number(e.target.value))}
                title="Vali aktiivne hooaeg / aasta"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
                <option value={2023}>2023</option>
              </select>
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
      </div>

      <div className="header-actions">
        {/* Theme Toggle Button */}
        <button 
          className="btn btn-secondary theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Lülita tumedale režiimile (Dark Mode)' : 'Lülita heledale režiimile (Light Mode)'}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} className="text-amber-400" />}
          <span>{theme === 'light' ? 'Tume režiim' : 'Hele režiim'}</span>
        </button>

        <button 
          className="btn btn-secondary"
          onClick={onFitAll}
          title="Mahuta kõik valitud kihtide elemendid ekraanile (Fit All)"
        >
          <Maximize2 size={16} className="text-emerald" />
          <span>Mahuta kõik</span>
        </button>

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
      </div>
    </header>
  );
};
