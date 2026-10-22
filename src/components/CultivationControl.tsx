// src/components/CultivationControl.tsx
// Masina sõidu taasesituse paneel kaardi allservas: olek ja mõõdikud, ajavahemiku valik ning mängija.
import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, AlertCircle, Zap, Loader2, X } from 'lucide-react';
import type { CultivationPass } from '../types/telemetry';
import { DateInput } from './DateInput';
import { formatDate } from '../services/dateFormat';

interface CultivationControlProps {
  pass: CultivationPass;
  /** Laaditud raja punktide arv (taasesituse seisust sõltumata) */
  loadedPointCount?: number;
  isLoading?: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  progressPct: number;
  onSeek: (pct: number) => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  workingWidthM: number;
  targetFieldName?: string;
  fieldAreaHa?: number;
  selectedStartTime?: string;
  onStartTimeChange?: (timeStr: string) => void;
  telemetryHours?: number;
  onHoursChange?: (hours: number) => void;
  simTimeMode?: 'rolling' | 'custom';
  onSimTimeModeChange?: (mode: 'rolling' | 'custom') => void;
  customDate?: string;
  onCustomDateChange?: (date: string) => void;
  customTime?: string;
  onCustomTimeChange?: (time: string) => void;
  durationHours?: number;
  onDurationHoursChange?: (hours: number) => void;
  currentImplement?: { id: string; name: string; workingWidthM: number; type?: string } | null;
  lastActiveAt?: string;
  onJumpToLastActive?: () => void;
}

const ROLLING_HOURS = [1, 2, 4, 6, 12, 24];
const DURATION_HOURS = [1, 2, 3, 4, 6, 8, 12];
const MINUTE_STEPS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const SPEEDS = [1, 2, 5, 10];

const toLocalTimeString = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatTimeDisplay = (iso?: string, withSeconds = false): string => {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return withSeconds ? `${hhmm}:${String(d.getSeconds()).padStart(2, '0')}` : hhmm;
};

export const CultivationControl: React.FC<CultivationControlProps> = ({
  pass,
  loadedPointCount,
  isLoading = false,
  isPlaying,
  onTogglePlay,
  onReset,
  progressPct,
  onSeek,
  playbackSpeed,
  onSpeedChange,
  workingWidthM,
  targetFieldName,
  fieldAreaHa,
  selectedStartTime,
  onStartTimeChange,
  telemetryHours = 2,
  onHoursChange,
  simTimeMode = 'rolling',
  onSimTimeModeChange,
  customDate = '',
  onCustomDateChange,
  customTime = '12:00',
  onCustomTimeChange,
  durationHours = 2,
  onDurationHoursChange,
  currentImplement,
  lastActiveAt,
  onJumpToLastActive
}) => {
  const lastPoint = pass.points.length > 0 ? pass.points[pass.points.length - 1] : null;
  const currentSpeedKmH = lastPoint?.speedKmH ?? 0;
  const isWorkingNow = lastPoint?.isWorking ?? false;
  const currentTimestamp = lastPoint?.timestamp ?? pass.startTime;
  const hasTrack = (loadedPointCount ?? pass.points.length) >= 2;

  const coverageOfField = fieldAreaHa && fieldAreaHa > 0
    ? Math.min(100, Math.round((pass.workedAreaHa / fieldAreaHa) * 100))
    : null;

  // Taasesituse alguskellaaeg raja sees (nt "08:30")
  const defaultStartTime = toLocalTimeString(pass.startTime);
  const [localStartTime, setLocalStartTime] = useState<string>(selectedStartTime || defaultStartTime);

  useEffect(() => {
    if (selectedStartTime) setLocalStartTime(selectedStartTime);
    else if (pass.startTime) setLocalStartTime(toLocalTimeString(pass.startTime));
  }, [selectedStartTime, pass.startTime]);

  const handleStartTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalStartTime(val);
    if (val && onStartTimeChange) onStartTimeChange(val);
  };

  const handleResetToOrigin = () => {
    const origin = toLocalTimeString(pass.startTime);
    setLocalStartTime(origin);
    onStartTimeChange?.(origin);
  };

  const isCustomStart = !!localStartTime && !!defaultStartTime && localStartTime !== defaultStartTime;

  const customHour = (customTime.split(':')[0] || '12').padStart(2, '0');
  const customMin = (customTime.split(':')[1] || '00').padStart(2, '0');
  // Kui minut ei ole 5 min sammul (nt vana väärtus), näidatakse seda ikkagi valikus
  const minuteOptions = MINUTE_STEPS.includes(customMin) ? MINUTE_STEPS : [...MINUTE_STEPS, customMin].sort();

  const endTotalMin = Number(customHour) * 60 + Number(customMin) + durationHours * 60;
  const customEndLabel = `${String(Math.floor(endTotalMin / 60) % 24).padStart(2, '0')}:${customMin}${endTotalMin >= 24 * 60 ? ' (järgmine päev)' : ''}`;

  const statusText = !hasTrack
    ? (isLoading ? 'Sõiduandmete laadimine…' : 'Sõiduandmed puuduvad')
    : isWorkingNow
      ? `Töötab · ${currentSpeedKmH.toFixed(1)} km/h`
      : currentSpeedKmH > 0.5
        ? `Sõidab · ${currentSpeedKmH.toFixed(1)} km/h`
        : 'Seisab';

  return (
    <div className="cultivation-panel glass-card">
      {/* 1. Masin, olek ja mõõdikud */}
      <div className="cc-header">
        <div className="cc-title">
          <span className={`cc-status-dot ${isWorkingNow ? 'working' : ''}`} aria-hidden="true" />
          <div className="cc-title-text">
            <div className="cc-title-name">
              {pass.vehicleName || 'Sõidu taasesitus'}
              {targetFieldName && <span className="cc-title-field">· {targetFieldName}</span>}
            </div>
            <div className="cc-title-status">{statusText}</div>
          </div>
        </div>

        <div className="cc-stats">
          <div className="cc-stat">
            <span className="cc-label">Haritud ala</span>
            <span className="cc-value">
              {pass.workedAreaHa.toFixed(2)} ha
              {coverageOfField !== null && <span className="cc-value-sub">{coverageOfField}%</span>}
            </span>
          </div>
          <div className="cc-stat">
            <span className="cc-label">Läbisõit</span>
            <span className="cc-value">{pass.distanceKm.toFixed(2)} km</span>
          </div>
          <div className="cc-stat">
            <span className="cc-label">Kiirus</span>
            <span className="cc-value">{currentSpeedKmH.toFixed(1)} km/h</span>
          </div>
          <div className="cc-stat" title={currentImplement ? `Haakeriist: ${currentImplement.name}` : 'Haakeriista pole määratud'}>
            <span className="cc-label">Töölaius</span>
            <span className="cc-value">
              {workingWidthM} m
              {currentImplement && <span className="cc-value-sub cc-value-impl">{currentImplement.name}</span>}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Ajavahemik */}
      <div className="cc-period">
        <Clock size={14} className="cc-period-icon" aria-hidden="true" />
        {onSimTimeModeChange && (
          <div className="cc-segmented" role="group" aria-label="Ajavahemiku režiim">
            <button
              type="button"
              className={simTimeMode === 'rolling' ? 'active' : ''}
              onClick={() => onSimTimeModeChange('rolling')}
              title="Viimased tunnid praegusest hetkest tagasi"
            >
              Viimased tunnid
            </button>
            <button
              type="button"
              className={simTimeMode === 'custom' ? 'active' : ''}
              onClick={() => onSimTimeModeChange('custom')}
              title="Konkreetne kuupäev, kellaaeg ja kestus"
            >
              Kuupäev ja kell
            </button>
          </div>
        )}

        {simTimeMode === 'custom' ? (
          <div className="cc-period-controls">
            <div className="cc-date">
              <DateInput
                value={customDate}
                onChange={(val) => onCustomDateChange?.(val)}
                className="cc-input"
                popupPlacement="top"
              />
            </div>
            <div className="cc-time" title="Alguskellaaeg (24 h)">
              <select
                value={customHour}
                onChange={(e) => onCustomTimeChange?.(`${e.target.value}:${customMin}`)}
                aria-label="Tund"
              >
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span aria-hidden="true">:</span>
              <select
                value={customMin}
                onChange={(e) => onCustomTimeChange?.(`${customHour}:${e.target.value}`)}
                aria-label="Minut"
              >
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <select
              value={durationHours}
              onChange={(e) => onDurationHoursChange?.(Number(e.target.value))}
              className="cc-select"
              title="Kestus alguskellaajast edasi"
            >
              {DURATION_HOURS.map((h) => (
                <option key={h} value={h}>+{h} h</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="cc-period-controls">
            {onHoursChange && (
              <select
                value={telemetryHours}
                onChange={(e) => onHoursChange(Number(e.target.value))}
                className="cc-select"
                title="Mitu tundi praegusest hetkest tagasi"
              >
                {ROLLING_HOURS.map((h) => (
                  <option key={h} value={h}>{h === 1 ? 'Viimane 1 h' : `Viimased ${h} h`}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {lastActiveAt && onJumpToLastActive && (
          <button
            type="button"
            className="cc-link-btn"
            onClick={onJumpToLastActive}
            title="Ava masina viimase teadaoleva sõidu aeg"
          >
            <Zap size={13} aria-hidden="true" />
            Viimane sõit {formatDate(lastActiveAt)} {formatTimeDisplay(lastActiveAt)}
          </button>
        )}
      </div>

      {/* 3. Mängija */}
      <div className="cc-player">
        <button
          type="button"
          className="cc-play"
          onClick={onTogglePlay}
          disabled={!hasTrack}
          title={isPlaying ? 'Paus' : 'Mängi (alates valitud algusajast)'}
          aria-label={isPlaying ? 'Paus' : 'Mängi'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="cc-play-icon" />}
        </button>
        <button
          type="button"
          className="cc-icon-btn"
          onClick={onReset}
          disabled={!hasTrack && simTimeMode !== 'rolling'}
          title={simTimeMode === 'rolling'
            ? 'Värskenda: loe viimased andmed ja alusta algusest'
            : isCustomStart ? 'Tagasi alguskellaaja juurde (uuesti vajutus viib algusesse)' : 'Algusesse'}
          aria-label={simTimeMode === 'rolling' ? 'Värskenda' : 'Algusesse'}
        >
          <RotateCcw size={16} />
        </button>

        {isLoading && !hasTrack ? (
          <div className="cc-notice cc-notice-loading" role="status">
            <Loader2 size={16} className="cc-spin" aria-hidden="true" />
            <span>Sõiduandmete laadimine…</span>
          </div>
        ) : !hasTrack ? (
          <div className="cc-notice" role="status">
            <AlertCircle size={16} aria-hidden="true" />
            <span>
              {simTimeMode === 'custom'
                ? `${formatDate(customDate)} kell ${customHour}:${customMin}–${customEndLabel} sõiduandmeid ei leitud.`
                : `Viimase ${telemetryHours} h jooksul sõiduandmeid ei leitud.`}
            </span>
            {lastActiveAt && onJumpToLastActive && (
              <button type="button" className="cc-link-btn" onClick={onJumpToLastActive}>
                Vaata viimast sõitu
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="cc-start" title="Alguskellaaeg raja sees (24 h), millest taasesitus algab">
              <span className="cc-label">Algus</span>
              <input
                type="text"
                maxLength={5}
                placeholder="08:00"
                value={localStartTime}
                onChange={handleStartTimeInputChange}
                className="cc-start-input"
                aria-label="Taasesituse alguskellaaeg"
              />
              {isCustomStart && (
                <button type="button" className="cc-start-reset" onClick={handleResetToOrigin} title="Raja algusesse" aria-label="Lähtesta alguskellaaeg">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="cc-timeline">
              <span className="cc-time-bound" title={`Raja algus: ${formatDate(pass.startTime)} ${formatTimeDisplay(pass.startTime)}`}>
                {formatTimeDisplay(pass.startTime)}
              </span>
              <div className="cc-slider">
                <div className="cc-slider-fill" style={{ width: `${progressPct}%` }} />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressPct}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  aria-label="Taasesituse asukoht"
                />
              </div>
              <span className="cc-time-bound" title={`Raja lõpp: ${formatDate(pass.endTime)} ${formatTimeDisplay(pass.endTime)}`}>
                {formatTimeDisplay(pass.endTime)}
              </span>
            </div>

            <div className="cc-now" title="Taasesituse hetk ja edenemine">
              <span className="cc-now-time">{formatTimeDisplay(currentTimestamp, true)}</span>
              <span className="cc-now-pct">{Math.round(progressPct)}%</span>
            </div>

            <div className="cc-segmented cc-speed" role="group" aria-label="Taasesituse kiirus">
              {SPEEDS.map((s) => (
                <button key={s} type="button" className={playbackSpeed === s ? 'active' : ''} onClick={() => onSpeedChange(s)}>
                  {s}×
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
