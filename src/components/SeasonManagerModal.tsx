// src/components/SeasonManagerModal.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Lock,
  Unlock,
  Plus,
  Edit2,
  Info,
  Map as MapIcon,
  CalendarDays
} from 'lucide-react';
import type { FarmingSeason, SeasonStatus } from '../types/season';
import { SEASON_STATUS_META } from '../types/season';

// Kuupäevad eesti vormingus (pp.kk.aaaa); sisend on ISO 'YYYY-MM-DD' (või pikem ISO aeg).
const splitIso = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? { y: m[1], m: m[2], d: m[3] } : null;
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '–';
  const p = splitIso(iso);
  return p ? `${p.d}.${p.m}.${p.y}` : iso;
};

// Sama aasta piires lühem vahemik: 01.08–30.09.2026
const formatRange = (start?: string | null, end?: string | null) => {
  if (!start) return '–';
  if (!end) return `${formatDate(start)} –`;
  const a = splitIso(start);
  const b = splitIso(end);
  if (a && b && a.y === b.y) return `${a.d}.${a.m}–${b.d}.${b.m}.${b.y}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
};

const formatNum = (n: number | null | undefined, digits: number) =>
  n == null ? '–' : n.toLocaleString('et-EE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatPerHa = (tons?: number | null, areaHa?: number | null) =>
  tons != null && areaHa ? formatNum(tons / areaHa, 2) : '–';

interface SeasonManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasons: FarmingSeason[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onUpdateSeason: (season: FarmingSeason) => void;
  onCloseSeason: (year: number) => void;
  onReopenSeason: (year: number) => void;
  onCreateSeason: (season: FarmingSeason) => void;
}

export const SeasonManagerModal: React.FC<SeasonManagerModalProps> = ({
  isOpen,
  onClose,
  seasons,
  selectedYear,
  onSelectYear,
  onUpdateSeason,
  onCloseSeason,
  onReopenSeason,
  onCreateSeason
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Form State
  const [formYear, setFormYear] = useState<number>(2027);
  const [formName, setFormName] = useState<string>('Hooaeg 2027');
  const [formStatus, setFormStatus] = useState<SeasonStatus>('planning');
  const [formPrepDate, setFormPrepDate] = useState<string>('');
  const [formSeedDate, setFormSeedDate] = useState<string>('');
  const [formHarvestStartDate, setFormHarvestStartDate] = useState<string>('');
  const [formHarvestEndDate, setFormHarvestEndDate] = useState<string>('');
  const [formTargetYield, setFormTargetYield] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Esc sulgeb ainult muutmisakna (register jääb avatuks).
  useEffect(() => {
    if (!isAdding) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsAdding(false); setEditingYear(null); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isAdding]);

  if (!isOpen) return null;

  // Hooajaregistris uusim üleval (ainus koht, kus hooajad on kahanevas järjekorras).
  const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year);

  const toggleNotes = (year: number) =>
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });

  const handleStartAdd = () => {
    const nextYear = Math.max(...seasons.map(s => s.year), 2026) + 1;
    setFormYear(nextYear);
    setFormName(`Hooaeg ${nextYear}`);
    setFormStatus('planning');
    setFormPrepDate(`${nextYear - 1}-08-20`);
    setFormSeedDate(`${nextYear - 1}-09-05`);
    setFormHarvestStartDate(`${nextYear}-08-01`);
    setFormHarvestEndDate(`${nextYear}-09-30`);
    setFormTargetYield('1800');
    setFormNotes('');
    setEditingYear(null);
    setIsAdding(true);
  };

  const handleStartEdit = (s: FarmingSeason) => {
    setFormYear(s.year);
    setFormName(s.name);
    setFormStatus(s.status);
    setFormPrepDate(s.preparationStartDate || '');
    setFormSeedDate(s.seedingStartDate || '');
    setFormHarvestStartDate(s.harvestStartDate || '');
    setFormHarvestEndDate(s.harvestEndDate || '');
    setFormTargetYield(s.targetYieldTons ? String(s.targetYieldTons) : '');
    setFormNotes(s.notes || '');
    setEditingYear(s.year);
    setIsAdding(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingYear !== null) {
      const existing = seasons.find(s => s.year === editingYear);
      if (existing) {
        const updated: FarmingSeason = {
          ...existing,
          name: formName,
          status: formStatus,
          isLocked: formStatus === 'closed',
          preparationStartDate: formPrepDate || undefined,
          seedingStartDate: formSeedDate || undefined,
          harvestStartDate: formHarvestStartDate || undefined,
          harvestEndDate: formHarvestEndDate || undefined,
          targetYieldTons: formTargetYield ? Number(formTargetYield) : undefined,
          notes: formNotes || undefined
        };
        onUpdateSeason(updated);
      }
    } else {
      const newSeason: FarmingSeason = {
        id: `season-${formYear}`,
        year: formYear,
        name: formName,
        status: formStatus,
        isLocked: formStatus === 'closed',
        preparationStartDate: formPrepDate || undefined,
        seedingStartDate: formSeedDate || undefined,
        harvestStartDate: formHarvestStartDate || undefined,
        harvestEndDate: formHarvestEndDate || undefined,
        targetYieldTons: formTargetYield ? Number(formTargetYield) : undefined,
        notes: formNotes || undefined,
        fieldsCount: 32,
        totalAreaHa: 298.5
      };
      onCreateSeason(newSeason);
    }
    setIsAdding(false);
    setEditingYear(null);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content season-manager-modal glass-modal">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-badge season-icon-badge">
              <CalendarDays size={20} />
            </div>
            <div>
              <h3>Hooaegade register & elutsükkel</h3>
              <p className="modal-subtitle">
                Hooaeg hõlmab ettevalmistust, külvi ja koristust. Koristuse järel suletakse hooaeg muudatusteks.
              </p>
            </div>
          </div>
          <div className="season-header-actions">
            {!isAdding && (
              <button className="btn btn-primary btn-sm" onClick={handleStartAdd}>
                <Plus size={14} />
                <span>Loo uus hooaeg</span>
              </button>
            )}
            <button className="icon-btn" onClick={onClose} title="Sulge">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body season-modal-body">
          {/* Add / Edit Form eraldi aknas registri peal (portal: registri aken võib olla
              glass-card/glass-modal, mille backdrop-filter piiraks muidu position: fixed tausta) */}
          {isAdding && createPortal(
            <div className="modal-backdrop sub-modal">
            <form className="modal-content season-edit-modal animate-scale-up" onSubmit={handleSaveForm}>
              <div className="modal-header">
                <div className="modal-title-group">
                  <Edit2 size={20} className="text-emerald" />
                  <h3>{editingYear ? `Muuda hooaega: ${editingYear}` : 'Lisa uus hooaeg'}</h3>
                </div>
                <button
                  type="button"
                  className="icon-btn-ghost"
                  onClick={() => { setIsAdding(false); setEditingYear(null); }}
                  title="Sulge (Esc)"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">

              <div className="form-grid season-form-grid">
                <div className="form-group">
                  <label>Aasta (Hooaeg) *</label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2040}
                    disabled={editingYear !== null}
                    value={formYear}
                    onChange={(e) => {
                      const yr = Number(e.target.value);
                      setFormYear(yr);
                      setFormName(`Hooaeg ${yr}`);
                    }}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Hooaja nimetus</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Staatuse etapp</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as SeasonStatus)}
                    className="form-input"
                  >
                    <option value="planning">📝 Planeerimisel</option>
                    <option value="active">🌱 Aktiivne (Külv & Hooldus)</option>
                    <option value="harvesting">🚜 Koristusel</option>
                    <option value="closed">🔒 Suletud (Muudatusteks lukus)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Saagiootus (tonnides kokku)</label>
                  <input
                    type="number"
                    placeholder="nt 1800"
                    value={formTargetYield}
                    onChange={(e) => setFormTargetYield(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>🚜 Ettevalmistuse algus</label>
                  <input
                    type="date"
                    value={formPrepDate}
                    onChange={(e) => setFormPrepDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>🌱 Külvide algus</label>
                  <input
                    type="date"
                    value={formSeedDate}
                    onChange={(e) => setFormSeedDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>🌾 Koristuse algus</label>
                  <input
                    type="date"
                    value={formHarvestStartDate}
                    onChange={(e) => setFormHarvestStartDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>🏁 Koristuse lõpp (Hooaja lõpp)</label>
                  <input
                    type="date"
                    value={formHarvestEndDate}
                    onChange={(e) => setFormHarvestEndDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Hooaja märkmed & kokkuvõte</label>
                  <textarea
                    rows={2}
                    placeholder="Ilmastikuolud, saagikokkuvõte, PRIA toetuste koodid..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setIsAdding(false); setEditingYear(null); }}
                >
                  Loobu
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingYear ? 'Salvesta muudatused' : 'Loo hooaeg'}
                </button>
              </div>
            </form>
            </div>,
            document.body
          )}

          {/* Hooaegade tabel: üks rida hooaja kohta, et hooaegu oleks lihtne võrrelda */}
          <div className="seasons-table-wrap">
            <table className="seasons-table">
              <thead>
                <tr>
                  <th>Hooaeg</th>
                  <th>Olek</th>
                  <th>Ettevalmistus</th>
                  <th>Külv</th>
                  <th>Koristus</th>
                  <th className="num">Pindala, ha</th>
                  <th className="num">Põlde</th>
                  <th className="num">Saagiootus, t</th>
                  <th className="num">Ootus, t/ha</th>
                  <th className="num">Koristatud, t</th>
                  <th className="num">Tegelik, t/ha</th>
                  <th><span className="sr-only">Tegevused</span></th>
                </tr>
              </thead>
              <tbody>
                {sortedSeasons.map((season, i) => {
                  const meta = SEASON_STATUS_META[season.status] || SEASON_STATUS_META.planning;
                  const isCurrent = season.year === selectedYear;
                  const prev = sortedSeasons[i + 1];
                  const delta = season.targetYieldTons != null && prev?.targetYieldTons != null
                    ? season.targetYieldTons - prev.targetYieldTons
                    : null;
                  const notesOpen = expandedYears.has(season.year);

                  return (
                    <tr
                      key={season.year}
                      className={`${isCurrent ? 'current' : ''} ${season.isLocked ? 'locked' : ''} ${season.notes ? 'has-notes' : ''}`}
                      onClick={() => season.notes && toggleNotes(season.year)}
                      title={season.notes && !notesOpen ? 'Klõpsa märkuse nägemiseks' : undefined}
                    >
                      <td className="season-cell">
                        <div className="season-cell-head">
                          <span className="season-year">{season.year}</span>
                          {season.notes && <Info size={13} className="season-notes-icon" />}
                        </div>
                        {season.name !== `Hooaeg ${season.year}` && (
                          <div className="season-cell-name">{season.name}</div>
                        )}
                        {notesOpen && season.notes && <div className="season-cell-notes">{season.notes}</div>}
                      </td>
                      <td>
                        <span
                          className="season-status-badge"
                          style={{ color: meta.color, backgroundColor: meta.bg }}
                          title={meta.description}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="mono">{formatDate(season.preparationStartDate)}</td>
                      <td className="mono">{formatDate(season.seedingStartDate)}</td>
                      <td className="mono">{formatRange(season.harvestStartDate, season.harvestEndDate)}</td>
                      <td className="num mono">{formatNum(season.totalAreaHa, 1)}</td>
                      <td className="num mono">{formatNum(season.fieldsCount, 0)}</td>
                      <td className="num mono">
                        {formatNum(season.targetYieldTons, 0)}
                        {delta != null && (
                          <div className={`season-delta ${delta < 0 ? 'down' : 'up'}`}>
                            Δ {delta < 0 ? '−' : '+'}{formatNum(Math.abs(delta), 0)}
                          </div>
                        )}
                      </td>
                      <td className="num mono muted">{formatPerHa(season.targetYieldTons, season.totalAreaHa)}</td>
                      <td className={`num mono ${season.actualYieldTons != null ? 'actual' : 'muted'}`}>
                        {formatNum(season.actualYieldTons, 0)}
                      </td>
                      <td className={`num mono ${season.actualYieldTons != null ? 'actual' : 'muted'}`}>
                        {formatPerHa(season.actualYieldTons, season.totalAreaHa)}
                      </td>
                      <td className="season-row-actions" onClick={(e) => e.stopPropagation()}>
                        {!isCurrent && (
                          <button
                            type="button"
                            className="icon-btn-ghost"
                            onClick={() => { onSelectYear(season.year); onClose(); }}
                            title={`Vali ${season.year}. aasta aktiivseks kaardil`}
                          >
                            <MapIcon size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn-ghost"
                          onClick={() => handleStartEdit(season)}
                          title="Muuda hooaja parameetreid"
                        >
                          <Edit2 size={15} />
                        </button>
                        {season.isLocked ? (
                          <button
                            type="button"
                            className="icon-btn-ghost"
                            onClick={() => onReopenSeason(season.year)}
                            title={`Ava muudatusteks${season.closedAt ? ` (suletud ${formatDate(season.closedAt)}${season.closedBy ? `, ${season.closedBy}` : ''})` : ''}`}
                          >
                            <Unlock size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="icon-btn-danger"
                            onClick={() => onCloseSeason(season.year)}
                            title="Lõpeta koristus ja sulge hooaeg muudatusteks"
                          >
                            <Lock size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="seasons-table-hint">
            Märkusega real (<Info size={11} />) näitab klõps märkust. Δ = saagiootuse muutus eelmise hooajaga võrreldes. Suletud hooaega saab muuta pärast avamist.
          </p>
        </div>
      </div>
    </div>
  );
};
