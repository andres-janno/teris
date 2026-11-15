// src/components/FieldContextMenu.tsx — kaardil põllu kontekstimenüü (parem hiireklõps).
// Esimene tegevus: kande lisamine lõpetamata tööle (kande dialoogi avab App, nagu varem põllu täisvaatest).
import React, { useEffect, useState } from 'react';
import { ClipboardPlus, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, MenuItemText } from './ui';
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
  useEffect(() => {
    let alive = true;
    api.getFieldWorks(year, p.id)
      .then((ws) => { if (alive) setWorks(ws); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Tööde laadimine ebaõnnestus'); });
    return () => { alive = false; };
  }, [year, p.id]);

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

  return (
    <DropdownMenu open modal={false} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Nähtamatu 0×0 ankur hiireklõpsu kohas: Leaflet'i sündmusel pole DOM-elementi, millele menüüd siduda */}
      <DropdownMenuTrigger asChild>
        <span className="field-menu-anchor" style={{ left: point.x, top: point.y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={0}
        className="field-menu"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="field-menu-title">
          <strong>{p.name}</strong>
          <span className="muted">{p.num ? `Nr ${p.num} · ` : ''}{p.crop} · {fmtHa(p.areaHa)} ha</span>
        </div>
        <DropdownMenuLabel>Lisa kanne</DropdownMenuLabel>
        {works === null && !error && <div className="field-menu-note"><Loader2 size={14} className="animate-spin" /> Laen töid…</div>}
        {error && <div className="field-menu-note error">{error}</div>}
        {works !== null && open.length === 0 && <div className="field-menu-note muted">Lõpetamata töid pole</div>}
        {open.map((w) => {
          const when = plannedWhen(w);
          const description = `${STATUS_LABEL[w.status]}${when ? ` · ${when}` : ''}${w.seasonYear && w.seasonYear !== year ? ` · saak ${w.seasonYear}` : ''}`;
          return (
            <DropdownMenuItem key={w.id} className="items-start" onSelect={() => openEntry(w)}>
              <ClipboardPlus />
              <MenuItemText title={w.workTypeName} description={description} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
