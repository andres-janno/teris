// src/components/SeasonManagerModal.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Lock,
  Unlock,
  Plus,
  Edit2,
  Tractor,
  Sprout,
  Wheat,
  Info,
  Check,
  CalendarDays
} from 'lucide-react';
import type { FarmingSeason, SeasonStatus } from '../types/season';
import { SEASON_STATUS_META } from '../types/season';

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
  const activeCount = seasons.filter(s => s.status === 'active' || s.status === 'harvesting').length;
  const closedCount = seasons.filter(s => s.isLocked).length;

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
          <button className="icon-btn" onClick={onClose} title="Sulge">
            <X size={18} />
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="season-top-bar">
          <div className="season-stats-pills">
            <div className="season-stat-pill active">
              <span className="stat-dot green"></span>
              <span className="stat-title">Aktiivseid / Töös:</span>
              <strong className="stat-num">{activeCount}</strong>
            </div>
            <div className="season-stat-pill locked">
              <Lock size={13} className="text-slate-400" />
              <span className="stat-title">Suletud (Lukus):</span>
              <strong className="stat-num">{closedCount}</strong>
            </div>
            <div className="season-stat-pill current">
              <span className="stat-title">Vaates aktiivne:</span>
              <strong className="stat-num">{selectedYear}</strong>
            </div>
          </div>

          <div className="season-actions-right">
            {!isAdding && (
              <button className="btn btn-primary btn-sm" onClick={handleStartAdd}>
                <Plus size={14} />
                <span>Loo uus hooaeg</span>
              </button>
            )}
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

          {/* Season Cards List */}
          <div className="seasons-list">
            {sortedSeasons.map((season) => {
              const meta = SEASON_STATUS_META[season.status] || SEASON_STATUS_META.planning;
              const isCurrent = season.year === selectedYear;

              return (
                <div
                  key={season.year}
                  className={`season-card glass-card ${isCurrent ? 'selected-season-card' : ''} ${season.isLocked ? 'locked-season-card' : ''}`}
                >
                  <div className="season-card-header">
                    <div className="season-card-title-area">
                      <span className="season-year-badge">{season.year}</span>
                      <h4 className="season-name">{season.name}</h4>
                      {isCurrent && (
                        <span className="active-view-tag">
                          <Check size={12} /> Aktiivne vaade
                        </span>
                      )}
                      <span
                        className="season-status-badge"
                        style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.color }}
                        title={meta.description}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                    </div>

                    <div className="season-card-top-actions">
                      {!isCurrent && (
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => {
                            onSelectYear(season.year);
                            onClose();
                          }}
                          title={`Vali ${season.year}. aasta aktiivseks kaardil`}
                        >
                          <span>Vali kaardile</span>
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleStartEdit(season)}
                        title="Muuda hooaja parameetreid"
                      >
                        <Edit2 size={13} />
                        <span>Muuda</span>
                      </button>
                    </div>
                  </div>

                  {/* Lifecycle Stages Timeline */}
                  <div className="season-timeline-row">
                    <div className="timeline-stage" title="Põldude ettevalmistuse algus">
                      <div className="stage-icon prep"><Tractor size={13} /></div>
                      <div className="stage-info">
                        <span className="stage-name">Ettevalmistus</span>
                        <span className="stage-date">{season.preparationStartDate || 'Määramata'}</span>
                      </div>
                    </div>

                    <div className="timeline-arrow">&rarr;</div>

                    <div className="timeline-stage" title="Külvide algus">
                      <div className="stage-icon seed"><Sprout size={13} /></div>
                      <div className="stage-info">
                        <span className="stage-name">Külvamine</span>
                        <span className="stage-date">{season.seedingStartDate || 'Määramata'}</span>
                      </div>
                    </div>

                    <div className="timeline-arrow">&rarr;</div>

                    <div className="timeline-stage" title="Koristuse periood">
                      <div className="stage-icon harvest"><Wheat size={13} /></div>
                      <div className="stage-info">
                        <span className="stage-name">Koristus</span>
                        <span className="stage-date">
                          {season.harvestStartDate ? `${season.harvestStartDate} - ${season.harvestEndDate || ''}` : 'Määramata'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics & Notes */}
                  <div className="season-card-meta-row">
                    <div className="season-metrics">
                      {season.totalAreaHa && (
                        <span className="metric-tag"><strong>Pindala:</strong> {season.totalAreaHa.toFixed(1)} ha</span>
                      )}
                      {season.fieldsCount && (
                        <span className="metric-tag"><strong>Põlde:</strong> {season.fieldsCount} tk</span>
                      )}
                      {season.targetYieldTons && (
                        <span className="metric-tag"><strong>Saagiootus:</strong> {season.targetYieldTons} t</span>
                      )}
                      {season.actualYieldTons && (
                        <span className="metric-tag success"><strong>Koristatud:</strong> {season.actualYieldTons} t</span>
                      )}
                    </div>

                    {season.notes && (
                      <div className="season-notes-box">
                        <Info size={13} className="text-slate-400" />
                        <span>{season.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Lock / Close Season Action Area */}
                  <div className="season-lock-footer">
                    {season.isLocked ? (
                      <div className="locked-info-bar">
                        <div className="locked-msg">
                          <Lock size={14} className="text-slate-400" />
                          <span>
                            <strong>Hooaeg on muudatusteks suletud.</strong>
                            {season.closedAt && ` Koristus lõpetatud ja arhiveeritud ${season.closedAt}${season.closedBy ? ` (${season.closedBy})` : ''}.`}
                          </span>
                        </div>
                        <button
                          className="btn btn-ghost btn-xs btn-reopen"
                          onClick={() => onReopenSeason(season.year)}
                          title="Vajadusel ava hooaeg parandusteks"
                        >
                          <Unlock size={12} />
                          <span>Ava muudatusteks</span>
                        </button>
                      </div>
                    ) : (
                      <div className="active-season-control-bar">
                        <span className="unlocked-msg">
                          <Unlock size={13} className="text-emerald" />
                          <span>Hooaeg on avatud ja andmed on muudetavad.</span>
                        </span>
                        <div className="season-action-buttons">
                          {season.status !== 'harvesting' && (
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={() => onUpdateSeason({ ...season, status: 'harvesting' })}
                              title="Märgi hooaeg koristusetappi"
                            >
                              <Wheat size={12} />
                              <span>Alusta koristust</span>
                            </button>
                          )}
                          <button
                            className="btn btn-danger-outline btn-xs"
                            onClick={() => onCloseSeason(season.year)}
                            title="Lõpeta koristus ja sulge hooaeg muudatusteks"
                          >
                            <Lock size={12} />
                            <span>Sulge hooaeg (Lukusta)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
