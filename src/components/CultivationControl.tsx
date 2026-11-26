// src/components/CultivationControl.tsx
// Masina sõidu taasesituse paneel kaardi allservas: olek ja mõõdikud, ajavahemiku valik ning mängija.
import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, AlertCircle, Zap, Loader2, X } from 'lucide-react';
import type { CultivationPass } from '../types/telemetry';
import { Button, Card, ToggleGroup, ToggleGroupItem, DateInput, Select, Input, cn } from './ui';
import { loadingSpinnerClass } from './ui/variants';
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

// Taasesituse paneeli klassid (vana map.css `.cc-*`; --cc-h 32px = h-8)
const CC_LABEL = 'whitespace-nowrap text-2xs font-semibold uppercase leading-natural tracking-wider text-muted-foreground';
const CC_VALUE = 'whitespace-nowrap text-base font-medium leading-natural tabular-nums text-foreground';
const CC_VALUE_SUB = 'ml-1.5 text-xs font-medium';
const CC_BOX = 'flex h-8 items-center rounded-sm border border-input bg-field'; // tund:minut ja algusaja kast
const CC_TOGGLE_ITEM = 'self-stretch'; // vana `.cc-toggle > button { align-self: stretch }`
const CC_LINK = 'ml-auto px-2 py-1 text-xs max-[761px]:ml-0';
const CC_NOTICE = 'flex min-h-8 flex-1 items-center gap-2 rounded-sm border border-warning-solid/40 bg-warning-solid/10 py-1 pr-1 pl-3 font-medium text-foreground [&>svg]:shrink-0 [&>svg]:text-warning';
const CC_NOTICE_LOADING = 'border-border bg-muted text-muted-foreground [&>svg]:text-primary';
const CC_CLOCK_SELECT = 'h-full w-auto min-w-11 border-0 bg-transparent px-1 text-muted-foreground'; // tund ja minut algusaja kastis
const CC_EDGE_TIME = 'text-xs leading-natural tabular-nums text-muted-foreground'; // raja algus- ja lõpuaeg joonel

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
  const hourOptions = Array.from({ length: 24 }, (_, i) => { const h = String(i).padStart(2, '0'); return { value: h, label: h }; });
  const minuteOptions = MINUTE_STEPS.includes(customMin) ? MINUTE_STEPS : [...MINUTE_STEPS, customMin].sort();
  const minuteSelectOptions = minuteOptions.map((m) => ({ value: m, label: m }));

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
    <Card variant="floating" className="absolute bottom-5 left-1/2 z-900 flex w-[min(1040px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-3 text-sm leading-natural max-[761px]:bottom-3">
      {/* 1. Masin, olek ja mõõdikud */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('size-2.5 shrink-0 rounded-full bg-subtle', isWorkingNow && 'bg-primary ring-4 ring-primary/20')} aria-hidden="true" />
          <div>
            <div className="whitespace-nowrap text-base font-semibold leading-natural text-foreground">
              {pass.vehicleName || 'Sõidu taasesitus'}
              {targetFieldName && <span className="ml-1.5 font-medium text-muted-foreground">· {targetFieldName}</span>}
            </div>
            <div className="text-xs leading-natural text-muted-foreground">{statusText}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 max-[761px]:gap-3">
          <div className="flex flex-col gap-0.5">
            <span className={CC_LABEL}>Haritud ala</span>
            <span className={CC_VALUE}>
              {pass.workedAreaHa.toFixed(2)} ha
              {coverageOfField !== null && <span className={cn(CC_VALUE_SUB, 'text-success-text')}>{coverageOfField}%</span>}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={CC_LABEL}>Läbisõit</span>
            <span className={CC_VALUE}>{pass.distanceKm.toFixed(2)} km</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={CC_LABEL}>Kiirus</span>
            <span className={CC_VALUE}>{currentSpeedKmH.toFixed(1)} km/h</span>
          </div>
          <div className="flex flex-col gap-0.5" title={currentImplement ? `Haakeriist: ${currentImplement.name}` : 'Haakeriista pole määratud'}>
            <span className={CC_LABEL}>Töölaius</span>
            <span className={CC_VALUE}>
              {workingWidthM} m
              {currentImplement && <span className={cn(CC_VALUE_SUB, 'inline-block max-w-40 truncate align-bottom text-muted-foreground')}>{currentImplement.name}</span>}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Ajavahemik */}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
        <Clock size={14} className="shrink-0 text-primary" aria-hidden="true" />
        {onSimTimeModeChange && (
          <ToggleGroup
            className="h-8"
            aria-label="Ajavahemiku režiim"
            value={simTimeMode}
            onValueChange={(next) => onSimTimeModeChange(next as typeof simTimeMode)}
          >
            <ToggleGroupItem value="rolling" className={CC_TOGGLE_ITEM} title="Viimased tunnid praegusest hetkest tagasi">Viimased tunnid</ToggleGroupItem>
            <ToggleGroupItem value="custom" className={CC_TOGGLE_ITEM} title="Konkreetne kuupäev, kellaaeg ja kestus">Kuupäev ja kell</ToggleGroupItem>
          </ToggleGroup>
        )}

        {simTimeMode === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-34">
              <DateInput
                value={customDate}
                onChange={(val) => onCustomDateChange?.(val)}
                popupPlacement="top"
              />
            </div>
            <div className={cn(CC_BOX, 'inline-flex px-1')} title="Alguskellaaeg (24 h)">
              <Select
                value={customHour}
                onValueChange={(v) => onCustomTimeChange?.(`${v}:${customMin}`)}
                aria-label="Tund"
                className={CC_CLOCK_SELECT}
                options={hourOptions}
              />
              <span aria-hidden="true" className="text-muted-foreground">:</span>
              <Select
                value={customMin}
                onValueChange={(v) => onCustomTimeChange?.(`${customHour}:${v}`)}
                aria-label="Minut"
                className={CC_CLOCK_SELECT}
                options={minuteSelectOptions}
              />
            </div>
            <span className="block min-w-24" title="Kestus alguskellaajast edasi">
              <Select
                value={String(durationHours)}
                onValueChange={(v) => onDurationHoursChange?.(Number(v))}
                aria-label="Kestus"
                options={DURATION_HOURS.map((h) => ({ value: String(h), label: `+${h} h` }))}
              />
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {onHoursChange && (
              <span className="block min-w-24" title="Mitu tundi praegusest hetkest tagasi">
                <Select
                  value={String(telemetryHours)}
                  onValueChange={(v) => onHoursChange(Number(v))}
                  aria-label="Tundide arv"
                  options={ROLLING_HOURS.map((h) => ({ value: String(h), label: h === 1 ? 'Viimane 1 h' : `Viimased ${h} h` }))}
                />
              </span>
            )}
          </div>
        )}

        {lastActiveAt && onJumpToLastActive && (
          <Button variant="link" size="inline" className={CC_LINK}
            onClick={onJumpToLastActive}
            title="Ava masina viimase teadaoleva sõidu aeg"
          >
            <Zap size={13} aria-hidden="true" />
            Viimane sõit {formatDate(lastActiveAt)} {formatTimeDisplay(lastActiveAt)}
          </Button>
        )}
      </div>

      {/* 3. Mängija */}
      <div className="flex min-h-10 items-center gap-2.5 max-[761px]:flex-wrap">
        <Button variant="primary" size="icon-lg"
          onClick={onTogglePlay}
          disabled={!hasTrack}
          title={isPlaying ? 'Paus' : 'Mängi (alates valitud algusajast)'}
          aria-label={isPlaying ? 'Paus' : 'Mängi'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </Button>
        <Button size="icon-sm"
          onClick={onReset}
          disabled={!hasTrack && simTimeMode !== 'rolling'}
          title={simTimeMode === 'rolling'
            ? 'Värskenda: loe viimased andmed ja alusta algusest'
            : isCustomStart ? 'Tagasi alguskellaaja juurde (uuesti vajutus viib algusesse)' : 'Algusesse'}
          aria-label={simTimeMode === 'rolling' ? 'Värskenda' : 'Algusesse'}
        >
          <RotateCcw size={16} />
        </Button>

        {isLoading && !hasTrack ? (
          <div className={cn(CC_NOTICE, CC_NOTICE_LOADING)} role="status">
            <Loader2 size={16} className={loadingSpinnerClass} aria-hidden="true" />
            <span>Sõiduandmete laadimine…</span>
          </div>
        ) : !hasTrack ? (
          <div className={CC_NOTICE} role="status">
            <AlertCircle size={16} aria-hidden="true" />
            <span>
              {simTimeMode === 'custom'
                ? `${formatDate(customDate)} kell ${customHour}:${customMin}–${customEndLabel} sõiduandmeid ei leitud.`
                : `Viimase ${telemetryHours} h jooksul sõiduandmeid ei leitud.`}
            </span>
            {lastActiveAt && onJumpToLastActive && (
              <Button variant="link" size="inline" className={CC_LINK} onClick={onJumpToLastActive}>
                Vaata viimast sõitu
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={cn(CC_BOX, 'shrink-0 gap-1.5 px-2 focus-within:border-primary')} title="Alguskellaaeg raja sees (24 h), millest taasesitus algab">
              <span className={CC_LABEL}>Algus</span>
              <Input
                type="text"
                maxLength={5}
                placeholder="08:00"
                value={localStartTime}
                onChange={handleStartTimeInputChange}
                aria-label="Taasesituse alguskellaaeg"
                className="h-full w-11 border-0 bg-transparent p-0 text-center tabular-nums"
              />
              {isCustomStart && (
                <Button variant="ghost" size="icon-xs" onClick={handleResetToOrigin} title="Raja algusesse" aria-label="Lähtesta alguskellaaeg">
                  <X size={12} />
                </Button>
              )}
            </div>

            <div className="flex min-w-30 flex-1 items-center gap-2 max-[761px]:order-10 max-[761px]:basis-full">
              <span className={CC_EDGE_TIME} title={`Raja algus: ${formatDate(pass.startTime)} ${formatTimeDisplay(pass.startTime)}`}>
                {formatTimeDisplay(pass.startTime)}
              </span>
              <div className="relative h-1.5 flex-1 rounded-sm bg-border">
                <div className="pointer-events-none absolute inset-y-0 left-0 rounded-sm bg-primary" style={{ width: `${progressPct}%` }} />
                <input
                  type="range"
                  className="cc-range absolute -inset-y-2 inset-x-0 m-0 h-5.5 w-full cursor-pointer appearance-none bg-transparent"
                  min="0"
                  max="100"
                  value={progressPct}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  aria-label="Taasesituse asukoht"
                />
              </div>
              <span className={CC_EDGE_TIME} title={`Raja lõpp: ${formatDate(pass.endTime)} ${formatTimeDisplay(pass.endTime)}`}>
                {formatTimeDisplay(pass.endTime)}
              </span>
            </div>

            <div className="flex shrink-0 items-baseline gap-1.5 tabular-nums" title="Taasesituse hetk ja edenemine">
              <span className="text-base font-medium leading-natural text-foreground">{formatTimeDisplay(currentTimestamp, true)}</span>
              <span className="min-w-8 text-xs font-medium leading-natural text-muted-foreground">{Math.round(progressPct)}%</span>
            </div>

            <ToggleGroup
              className="h-8"
              aria-label="Taasesituse kiirus"
              value={String(playbackSpeed)}
              onValueChange={(next) => onSpeedChange(Number(next))}
            >
              {SPEEDS.map((s) => (
                <ToggleGroupItem key={s} value={String(s)} className={CC_TOGGLE_ITEM}>{s}×</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </>
        )}
      </div>
    </Card>
  );
};
