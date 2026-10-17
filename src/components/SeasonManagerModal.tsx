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
  CalendarDays
} from 'lucide-react';
import type { FarmingSeason } from '../types/season';
import type { MasterField } from '../types/fieldRegister';
import { formatDateTimeTallinn } from '../services/dateFormat';
import { SEASON_PHASE_META, deriveSeasonPhase } from '../types/season';

const formatNum = (n: number | null | undefined, digits: number) =>
  n == null ? '–' : n.toLocaleString('et-EE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

interface SeasonManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasons: FarmingSeason[];
  masterFields: MasterField[];
  selectedYear: number;
  onUpdateSeason: (season: FarmingSeason) => void;
  onCloseSeason: (year: number) => void;
  onReopenSeason: (year: number) => void;
  onCreateSeason: (season: FarmingSeason) => void;
  isFullPage?: boolean;
}

export const SeasonManagerModal: React.FC<SeasonManagerModalProps> = ({
  isOpen,
  onClose,
  seasons,
  masterFields,
  selectedYear,
  onUpdateSeason,
  onCloseSeason,
  onReopenSeason,
  onCreateSeason,
  isFullPage = false
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Form State
  const [formYear, setFormYear] = useState<number>(2027);
  const [formName, setFormName] = useState<string>('Hooaeg 2027');
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

  // Lukus hooaega saab ainult vaadata: väljad keelatud, salvestusnuppe pole.
  const editingLocked = editingYear !== null && !!seasons.find(s => s.year === editingYear)?.isLocked;

  // Hooajaregistris uusim üleval (ainus koht, kus hooajad on kahanevas järjekorras).
  const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year);

  // Pindala ja põldude arv arvutatakse põldude aastaandmetest (mitte hooaja kirjest).
  const fieldTotalsByYear = new Map<number, { areaHa: number; count: number }>();
  masterFields.forEach((mf) => {
    mf.history.forEach((h) => {
      const t = fieldTotalsByYear.get(h.year) ?? { areaHa: 0, count: 0 };
      t.areaHa += h.areaHa || 0;
      t.count += 1;
      fieldTotalsByYear.set(h.year, t);
    });
  });

  const toggleNotes = (year: number) =>
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });

  // Hooaja oleku jaoks: hooaja põllud on selle või eelmise hooaja põllud. Põllul, millel
  // selle aasta kirje puudub (eelmisest hooajast edasi tulnud), on kultuur määramata.
  const seasonCrops = (year: number): (string | null)[] =>
    masterFields
      .filter((mf) => mf.history.some((h) => h.year === year || h.year === year - 1))
      .map((mf) => mf.history.find((h) => h.year === year)?.crop ?? null);

  const handleStartAdd = () => {
    const nextYear = Math.max(...seasons.map(s => s.year), 2026) + 1;
    setFormYear(nextYear);
    setFormName(`Hooaeg ${nextYear}`);
    setFormNotes('');
    setEditingYear(null);
    setIsAdding(true);
  };

  const handleStartEdit = (s: FarmingSeason) => {
    setFormYear(s.year);
    setFormName(s.name);
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
          notes: formNotes || null
        };
        onUpdateSeason(updated);
      }
    } else {
      const newSeason: FarmingSeason = {
        id: `season-${formYear}`,
        year: formYear,
        name: formName,
        isLocked: false,
        notes: formNotes || null
      };
      onCreateSeason(newSeason);
    }
    setIsAdding(false);
    setEditingYear(null);
  };

  if (!isOpen && !isFullPage) return null;

  const bodyContent = (
    <>
      {/* Add / Edit Form eraldi aknas registri peal */}
      {isAdding && createPortal(
        <div className="modal-backdrop sub-modal">
        <form className="modal-content season-edit-modal animate-scale-up" onSubmit={handleSaveForm}>
              <div className="modal-header">
                <div className="modal-title-group">
                  {editingLocked ? <Lock size={20} className="text-slate-400" /> : <Edit2 size={20} className="text-emerald" />}
                  <h3>
                    {editingLocked
                      ? `Lukus hooaeg: ${editingYear}`
                      : editingYear ? `Muuda hooaega: ${editingYear}` : 'Lisa uus hooaeg'}
                  </h3>
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

              <fieldset className="season-form-fieldset" disabled={editingLocked}>
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

                <div className="form-group full-width">
                  <label>Hooaja märkmed</label>
                  <textarea
                    rows={3}
                    placeholder="Ilmastikuolud, saagikokkuvõte, PRIA toetuste koodid..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              </fieldset>

              </div>

              {!editingLocked && <div className="modal-footer">
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
              </div>}
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
                  <th className="num">Pindala, ha</th>
                  <th className="num">Põlde</th>
                  <th><span className="sr-only">Tegevused</span></th>
                </tr>
              </thead>
              <tbody>
                {sortedSeasons.map((season) => {
                  const isCurrent = season.year === selectedYear;
                  const notesOpen = expandedYears.has(season.year);
                  const totals = fieldTotalsByYear.get(season.year);
                  const areaHa = totals?.areaHa ?? null;
                  const meta = SEASON_PHASE_META[deriveSeasonPhase(season.isLocked, seasonCrops(season.year))];

                  const rowClass = `${isCurrent ? 'current' : ''} ${season.isLocked ? 'locked' : ''}`;
                  return (
                    <React.Fragment key={season.year}>
                    <tr
                      className={`${rowClass} ${season.notes ? 'has-notes' : ''} ${notesOpen && season.notes ? 'notes-open' : ''}`}
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
                      <td className="num mono">{formatNum(areaHa, 1)}</td>
                      <td className="num mono">{formatNum(totals?.count ?? null, 0)}</td>
                      <td className="season-row-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="icon-btn-ghost"
                          onClick={() => handleStartEdit(season)}
                          title={season.isLocked ? 'Vaata hooaja andmeid' : 'Muuda hooaja parameetreid'}
                        >
                          <Edit2 size={15} />
                        </button>
                        {season.isLocked ? (
                          <button
                            type="button"
                            className="icon-btn-ghost"
                            onClick={() => onReopenSeason(season.year)}
                            title={`Hooaeg on lukus${season.closedAt ? ` (suletud ${formatDateTimeTallinn(season.closedAt)}${season.closedBy ? `, ${season.closedBy}` : ''})` : ''} – klõpsa avamiseks`}
                          >
                            <Lock size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="icon-btn-ghost"
                            onClick={() => onCloseSeason(season.year)}
                            title="Hooaeg on avatud – klõpsa lukustamiseks (lõpeta koristus ja sulge muudatusteks)"
                          >
                            <Unlock size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {notesOpen && season.notes && (
                      <tr className={`${rowClass} has-notes season-notes-row`} onClick={() => toggleNotes(season.year)}>
                        <td colSpan={5}>
                          <div className="season-cell-notes">
                            <Info size={13} />
                            <span>{season.notes}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="seasons-table-hint">
            Märkusega real (<Info size={11} />) näitab klõps märkust. Pindala ja põldude arv tulevad põldude andmetest. Luku ikoon näitab hooaja olekut, klõps lukustab või avab. Lukus hooaega saab muuta pärast avamist.
          </p>
    </>
  );

  if (isFullPage) {
    return (
      <div className="fullpage-board-view">
        <main className="fullpage-board-main">
          <div className="fullpage-board-header">
            <div className="fullpage-title-wrap">
              <CalendarDays className="text-emerald" size={26} />
              <div>
                <h2>Hooajad</h2>
                <p className="fullpage-subtitle">Hooaegade register: aasta, nimi ja märkmed. Importimisel luuakse puuduv hooaeg automaatselt.</p>
              </div>
            </div>
            {!isAdding && (
              <button className="btn btn-primary" onClick={handleStartAdd}>
                <Plus size={16} />
                <span>Loo uus hooaeg</span>
              </button>
            )}
          </div>
          <div className="fullpage-board-body">
            {bodyContent}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content season-manager-modal glass-modal">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-badge season-icon-badge">
              <CalendarDays size={20} />
            </div>
            <div>
              <h3>Hooaegade register</h3>
              <p className="modal-subtitle">
                Lukus hooaeg on muudatusteks suletud. Importimisel luuakse puuduv hooaeg automaatselt.
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

        <div className="modal-body season-modal-body">
          {bodyContent}
        </div>
      </div>
    </div>
  );
};
