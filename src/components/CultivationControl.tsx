// src/components/CultivationControl.tsx
import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw,
  Clock
} from 'lucide-react';
import type { CultivationPass } from '../types/telemetry';

interface CultivationControlProps {
  pass: CultivationPass;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  progressPct: number;
  onSeek: (pct: number) => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  workingWidthM: number;
  onWidthChange: (width: number) => void;
  targetFieldName?: string;
  fieldAreaHa?: number;
  selectedStartTime?: string;
  onStartTimeChange?: (timeStr: string) => void;
  telemetryHours?: number;
  onHoursChange?: (hours: number) => void;
}

const toLocalTimeString = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const formatTimeDisplay = (iso?: string, withSeconds = false): string => {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('et-EE', {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false
  });
};

export const CultivationControl: React.FC<CultivationControlProps> = ({
  pass,
  isPlaying,
  onTogglePlay,
  onReset,
  progressPct,
  onSeek,
  playbackSpeed,
  onSpeedChange,
  workingWidthM,
  onWidthChange,
  targetFieldName,
  fieldAreaHa,
  selectedStartTime,
  onStartTimeChange,
  telemetryHours,
  onHoursChange
}) => {
  const currentSpeedKmH = pass.points.length > 0 
    ? pass.points[pass.points.length - 1].speedKmH 
    : 0;

  const isWorkingNow = pass.points.length > 0
    ? pass.points[pass.points.length - 1].isWorking
    : false;

  const currentTimestamp = pass.points.length > 0
    ? pass.points[pass.points.length - 1].timestamp
    : pass.startTime;

  const coverageOfField = (fieldAreaHa && fieldAreaHa > 0)
    ? Math.min(100, Math.round((pass.workedAreaHa / fieldAreaHa) * 100))
    : 0;

  // Kohalik alguskellaaja sisend (nt "08:30")
  const defaultStartTime = toLocalTimeString(pass.startTime);
  const [localStartTime, setLocalStartTime] = useState<string>(selectedStartTime || defaultStartTime);

  useEffect(() => {
    if (selectedStartTime) {
      setLocalStartTime(selectedStartTime);
    } else if (pass.startTime) {
      setLocalStartTime(toLocalTimeString(pass.startTime));
    }
  }, [selectedStartTime, pass.startTime]);

  const handleStartTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalStartTime(val);
    if (val && onStartTimeChange) {
      onStartTimeChange(val);
    }
  };

  const handleResetToOrigin = () => {
    const origin = toLocalTimeString(pass.startTime);
    setLocalStartTime(origin);
    if (onStartTimeChange) {
      onStartTimeChange(origin);
    }
  };

  const isCustomStart = localStartTime && defaultStartTime && localStartTime !== defaultStartTime;

  return (
    <div className="cultivation-panel glass-card">
      <div className="cultivation-top">
        <div className="cultivation-title">
          <div className="pulse-indicator">
            <span className={`pulse-dot ${isWorkingNow ? 'dot-active' : 'dot-idle'}`}></span>
          </div>
          <div>
            <div className="title-bold">
              <span>Teltonika Harimise Telemeetria</span>
              {targetFieldName && <span className="field-tag">&bull; {targetFieldName}</span>}
            </div>
            <div className="title-sub">
              {isWorkingNow ? '🟢 Rippriist maas (Külv / harimine aktiivne)' : '⚪ Transpordiasend (Pööre või sõit)'}
            </div>
          </div>
        </div>

        {/* Live Mini Stats */}
        <div className="cultivation-stats-row">
          <div className="mini-stat">
            <span className="stat-label">Haritud pindala:</span>
            <strong className="stat-val">{pass.workedAreaHa.toFixed(2)} ha</strong>
            {fieldAreaHa && <span className="stat-perc">({coverageOfField}%)</span>}
          </div>

          <div className="mini-stat">
            <span className="stat-label">Läbisõit:</span>
            <strong className="stat-val">{pass.distanceKm.toFixed(2)} km</strong>
          </div>

          <div className="mini-stat">
            <span className="stat-label">Hetkekiirus:</span>
            <strong className="stat-val">{currentSpeedKmH.toFixed(1)} km/h</strong>
          </div>

          <div className="mini-stat">
            <span className="stat-label">Töölaius:</span>
            <select 
              value={workingWidthM} 
              onChange={(e) => onWidthChange(Number(e.target.value))}
              className="width-select"
            >
              <option value={6}>6 m</option>
              <option value={8}>8 m</option>
              <option value={12}>12 m (Külvik)</option>
              <option value={18}>18 m</option>
              <option value={24}>24 m (Prits)</option>
              <option value={36}>36 m (Suurprits)</option>
            </select>
          </div>

          {onHoursChange && (
            <div className="mini-stat">
              <span className="stat-label">Ajalugu:</span>
              <select
                value={telemetryHours || 6}
                onChange={(e) => onHoursChange(Number(e.target.value))}
                className="width-select"
                title="Laaditud GPS-ajaloo vahemik"
              >
                <option value={2}>2 h</option>
                <option value={4}>4 h</option>
                <option value={6}>6 h</option>
                <option value={12}>12 h</option>
                <option value={24}>24 h</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Scrubber & Player Controls */}
      <div className="cultivation-timeline-row">
        <button 
          className="play-btn"
          onClick={onTogglePlay}
          title={isPlaying ? 'Paus' : 'Mängi marsruuti (alates valitud algusajast)'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="play-icon-offset" />}
        </button>

        <button 
          className="icon-btn-ghost"
          onClick={onReset}
          title={isCustomStart ? 'Tagasi valitud alguskellaaja juurde (uuesti vajutus viib 0%-ni)' : 'Algusesse'}
        >
          <RotateCcw size={16} />
        </button>

        {/* Alguskellaaja valik / sisend */}
        <div className="start-time-picker-badge" title="Määra alguskellaaeg, millest alates marsruuti mängima panna">
          <Clock size={14} className="start-time-icon" />
          <span className="start-time-label">Algus:</span>
          <input 
            type="time" 
            step="60"
            value={localStartTime}
            onChange={handleStartTimeInputChange}
            className="start-time-input"
            title="Vali või sisesta kellaaeg, millest alates marsruuti mängima panna"
          />
          {isCustomStart && (
            <button 
              className="start-time-reset-btn" 
              onClick={handleResetToOrigin}
              title="Lähtesta marsruudi algsesse algusaega"
            >
              &times;
            </button>
          )}
        </div>

        {/* Marsruudi algusaeg sildi kujul */}
        {pass.startTime && (
          <span className="timeline-clock-label bound-start" title={`Marsruudi algus: ${pass.startTime}`}>
            {formatTimeDisplay(pass.startTime)}
          </span>
        )}

        <div className="timeline-slider-wrapper">
          <input 
            type="range"
            min="0"
            max="100"
            value={progressPct}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="timeline-slider"
          />
          <div className="timeline-progress-bar" style={{ width: `${progressPct}%` }}></div>
        </div>

        {/* Marsruudi lõppaeg sildi kujul */}
        {pass.endTime && (
          <span className="timeline-clock-label bound-end" title={`Marsruudi lõpp: ${pass.endTime}`}>
            {formatTimeDisplay(pass.endTime)}
          </span>
        )}

        {/* Hetkeline taasesituse kellaaeg ja protsent */}
        <div className="timeline-current-time-box" title="Hetkeline taasesituse kellaaeg ja progress">
          <span className="current-clock-val">{formatTimeDisplay(currentTimestamp, true)}</span>
          <span className="current-pct-val">{Math.round(progressPct)}%</span>
        </div>

        {/* Speed multiplier selector */}
        <div className="speed-buttons">
          {[1, 2, 5, 10].map((s) => (
            <button 
              key={s}
              className={`speed-btn ${playbackSpeed === s ? 'active' : ''}`}
              onClick={() => onSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
