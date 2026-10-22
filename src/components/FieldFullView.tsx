// src/components/FieldFullView.tsx — põllu täisvaade: päis + hooaeg, vasakul üldandmed, paremal tööde ajajoon.
// Asendab FieldDetailsDrawer'i. Kaart jääb taha alles; sulgemine ✕ või Esc.
import React, { useEffect, useState } from 'react';
import { X, Crosshair, Lock, Pencil, CalendarDays } from 'lucide-react';
import type { FieldFeature } from '../types/field';
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import type { SoilSample } from '../types/soilSample';
import type { FieldSeasonWorks, FieldWork, WorkEntry } from '../types/fieldWork';
import { getFieldFeatureForYear } from '../types/fieldRegister';
import { api } from '../services/api';
import { FieldOverviewPanel } from './FieldOverviewPanel';
import { FieldWorksTimeline } from './FieldWorksTimeline';

interface FieldFullViewProps {
  field: FieldFeature | null;
  masterField?: MasterField | null;
  seasons?: FarmingSeason[];
  soilSamples?: SoilSample[];
  satelliteDate?: string | null;
  canEdit?: boolean;
  elevated?: boolean; // kuvatakse modaalakna (nt põlluregistri) peal
  reloadKey?: number; // suureneb, kui töö/kanne salvestati väljaspool (dialoogid App'is)
  onClose: () => void;
  onFocusField: (field: FieldFeature) => void;
  onEditField?: (fieldId: number) => void;
  onEditWork?: (ctx: { fieldSeasonId: number; fieldLabel: string; fieldAreaHa: number; work: FieldWork | null }) => void;
  onEditEntry?: (ctx: { fieldLabel: string; fieldAreaHa: number; work: FieldWork; entry: WorkEntry | null }) => void;
}

export const FieldFullView: React.FC<FieldFullViewProps> = ({
  field, masterField = null, seasons = [], soilSamples = [], satelliteDate = null, canEdit = false, elevated = false, reloadKey = 0,
  onClose, onFocusField, onEditField, onEditWork, onEditEntry
}) => {
  const mapYear = field?.properties.year;
  const [viewYear, setViewYear] = useState<number | undefined>(mapYear);
  const [works, setWorks] = useState<FieldSeasonWorks | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setViewYear(mapYear), [field?.properties.id, mapYear]);

  useEffect(() => {
    if (!field) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [field, onClose]);

  const fieldId = field?.properties.id;
  useEffect(() => {
    if (fieldId == null || viewYear == null) return;
    let alive = true; // vana päringu vastus ei kirjuta üle uue hooaja andmeid
    setWorks(null); // eelmise põllu/hooaja töid (ja fieldSeasonId-d) ei näidata ega kasutata
    setLoading(true);
    api.getFieldSeasonWorks(fieldId, viewYear)
      .then((w) => { if (alive) setWorks(w); })
      .catch((e) => { console.error('Põllu tööde laadimine ebaõnnestus:', e); if (alive) setWorks(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fieldId, viewYear, reloadKey]);

  if (!field) return null;

  const years = masterField ? [...new Set(masterField.history.map((h) => h.year))].sort((a, b) => a - b) : [];
  const shown = masterField && viewYear !== undefined && viewYear !== mapYear && years.includes(viewYear)
    ? getFieldFeatureForYear(masterField, viewYear)
    : field;
  const p = shown.properties;
  const locked = seasons.find((s) => s.year === p.year)?.isLocked ?? false;
  const editable = canEdit && !locked && works?.fieldSeasonId != null;
  const fieldLabel = `Nr ${p.num ?? '–'} ${p.name} · ${p.crop} · ${(works?.areaHa ?? p.areaHa ?? 0).toLocaleString('et-EE', { maximumFractionDigits: 2 })} ha · hooaeg ${p.year}`;
  const areaHa = works?.areaHa ?? 0;

  return (
    <div className={`field-full-view${elevated ? ' elevated' : ''}`} role="dialog" aria-label={`Põld ${p.name}`}>
      <header className="ffv-header">
        <div className="ffv-title">
          <span className="crop-indicator-dot" style={{ backgroundColor: p.cropColor || '#22c55e' }} />
          <h2>{p.name}</h2>
          <span className="ffv-badge">#{p.id}</span>
          {p.num && <span className="ffv-badge num">Nr {p.num}</span>}
          {p.fieldCode && <span className="ffv-code">{p.fieldCode}</span>}
          <span className="ffv-crop">{p.crop}</span>
        </div>
        <div className="ffv-actions">
          {onEditField && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditField(Number(p.id))}><Pencil size={14} /> Muuda põldu</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onFocusField(shown); onClose(); }}><Crosshair size={14} /> Fookusta kaardil</button>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
      </header>
      {years.length > 1 && (
        <nav className="ffv-seasons">
          <CalendarDays size={14} /> <span>Hooaeg:</span>
          {years.map((y) => {
            const isLocked = seasons.find((s) => s.year === y)?.isLocked;
            return (
              <button key={y} type="button" className={`field-season-chip ${y === p.year ? 'active' : ''}`} onClick={() => setViewYear(y)} title={isLocked ? `Hooaeg ${y} on lukus` : `Näita hooaega ${y}`}>
                {y}{isLocked && <Lock size={11} />}
              </button>
            );
          })}
        </nav>
      )}
      <div className="ffv-columns">
        <aside className="ffv-left">
          {locked && (
            <div className="drawer-season-locked-alert">
              <Lock size={13} />
              <span>Hooaeg {p.year} on muudatusteks suletud (arhiiv).</span>
            </div>
          )}
          <FieldOverviewPanel shown={shown} soilSamples={soilSamples} satelliteDate={satelliteDate} />
        </aside>
        <main className="ffv-right">
          <FieldWorksTimeline
            data={works}
            loading={loading}
            canEdit={editable}
            onAddWork={() => works?.fieldSeasonId && onEditWork?.({ fieldSeasonId: works.fieldSeasonId, fieldLabel, fieldAreaHa: areaHa, work: null })}
            onEditWork={(w) => onEditWork?.({ fieldSeasonId: w.fieldSeasonId, fieldLabel, fieldAreaHa: areaHa, work: w })}
            onAddEntry={(w) => onEditEntry?.({ fieldLabel, fieldAreaHa: areaHa, work: w, entry: null })}
            onEditEntry={(w, e) => onEditEntry?.({ fieldLabel, fieldAreaHa: areaHa, work: w, entry: e })}
          />
        </main>
      </div>
    </div>
  );
};
