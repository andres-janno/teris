// src/components/CultivationControl.tsx
import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw
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
}

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
  fieldAreaHa
}) => {
  const currentSpeedKmH = pass.points.length > 0 
    ? pass.points[pass.points.length - 1].speedKmH 
    : 0;

  const isWorkingNow = pass.points.length > 0
    ? pass.points[pass.points.length - 1].isWorking
    : false;

  const coverageOfField = (fieldAreaHa && fieldAreaHa > 0)
    ? Math.min(100, Math.round((pass.workedAreaHa / fieldAreaHa) * 100))
    : 0;

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
        </div>
      </div>

      {/* Scrubber & Player Controls */}
      <div className="cultivation-timeline-row">
        <button 
          className="play-btn"
          onClick={onTogglePlay}
          title={isPlaying ? 'Paus' : 'Mängi harimise protsessi'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="play-icon-offset" />}
        </button>

        <button 
          className="icon-btn-ghost"
          onClick={onReset}
          title="Algusesse"
        >
          <RotateCcw size={16} />
        </button>

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

        <div className="timeline-time-label">
          {Math.round(progressPct)}%
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
