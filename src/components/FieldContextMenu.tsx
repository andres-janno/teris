// src/components/FieldContextMenu.tsx — kaardil põllu kontekstimenüü (parem hiireklõps).
// Esimene tegevus: kande lisamine lõpetamata tööle (kande dialoogi avab App, nagu varem põllu täisvaatest).
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardPlus, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { formatDate, formatDateRange } from '../services/dateFormat';
import type { FieldFeature } from '../types/field';
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import type { FieldWork } from '../types/fieldWork';

interface Props {
  field: FieldFeature;
  point: { x: number; y: number };
  masterField: MasterField | null;
  seasons: FarmingSeason[];
  onAddEntry: (ctx: { fieldLabel: string; fieldAreaHa: number; work: FieldWork; entry: null }) => void;
  onClose: () => void;
}

const STATUS_LABEL = { PLANNED: 'Planeeritud', IN_PROGRESS: 'Töös', DONE: 'Lõpetatud' } as const;
const fmtHa = (n: number) => n.toLocaleString('et-EE', { maximumFractionDigits: 2 });

// Plaani aeg menüüreal: kuupäevavahemik või vaba tekst (nt "Sügis 2026")
const plannedWhen = (w: FieldWork): string | null => {
  if (w.plannedDateFrom) return w.plannedDateTo && w.plannedDateTo !== w.plannedDateFrom
    ? formatDateRange(w.plannedDateFrom, w.plannedDateTo)
    : formatDate(w.plannedDateFrom);
  return w.plannedText;
};

export const FieldContextMenu: React.FC<Props> = ({ field, point, masterField, seasons, onAddEntry, onClose }) => {
  const p = field.properties;
  const year = p.year ?? new Date().getFullYear();
  const [works, setWorks] = useState<FieldWork[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(point);

  useEffect(() => {
    let alive = true;
    api.getFieldWorks(year, p.id)
      .then((ws) => { if (alive) setWorks(ws); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Tööde laadimine ebaõnnestus'); });
    return () => { alive = false; };
  }, [year, p.id]);

  // Menüü jääb ekraani piiridesse
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(point.x, window.innerWidth - r.width - 8));
    const y = Math.max(8, Math.min(point.y, window.innerHeight - r.height - 8));
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  });

  // Sulgemine: Esc või klõps menüüst väljas
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Töö hooaja kirje (järgmise aasta sügistöö kuulub järgmisse hooaega)
  const recOf = (w: FieldWork) => masterField?.history.find((h) => h.fieldSeasonId === w.fieldSeasonId) ?? null;
  const isLocked = (w: FieldWork) => seasons.find((s) => s.year === (w.seasonYear ?? year))?.isLocked ?? false;
  const open = (works ?? []).filter((w) => w.status !== 'DONE' && !isLocked(w));

  const openEntry = (w: FieldWork) => {
    const rec = recOf(w);
    const areaHa = rec?.areaHa ?? p.areaHa;
    const fieldLabel = `Nr ${p.num ?? '–'} ${p.name} · ${rec?.crop ?? p.crop ?? 'kultuur valimata'} · ${fmtHa(areaHa)} ha · hooaeg ${w.seasonYear ?? year}`;
    onAddEntry({ fieldLabel, fieldAreaHa: areaHa, work: w, entry: null });
    onClose();
  };

  return createPortal(
    <div ref={menuRef} className="map-context-menu" role="menu" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      <div className="map-context-menu-title">
        <strong>{p.name}</strong>
        <span className="muted">{p.num ? `Nr ${p.num} · ` : ''}{p.crop} · {fmtHa(p.areaHa)} ha</span>
      </div>
      <div className="map-context-menu-section">Lisa kanne</div>
      {works === null && !error && <div className="map-context-menu-note"><Loader2 size={14} className="animate-spin" /> Laen töid…</div>}
      {error && <div className="map-context-menu-note error">{error}</div>}
      {works !== null && open.length === 0 && <div className="map-context-menu-note muted">Lõpetamata töid pole</div>}
      {open.map((w) => {
        const when = plannedWhen(w);
        return (
          <button key={w.id} type="button" role="menuitem" className="map-context-menu-item" onClick={() => openEntry(w)}>
            <ClipboardPlus size={15} />
            <span className="map-context-menu-item-text">
              <span>{w.workTypeName}</span>
              <span className="muted">
                {STATUS_LABEL[w.status]}
                {when ? ` · ${when}` : ''}
                {w.seasonYear && w.seasonYear !== year ? ` · saak ${w.seasonYear}` : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>,
    document.body
  );
};
