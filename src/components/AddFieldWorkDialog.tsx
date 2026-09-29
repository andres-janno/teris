// src/components/AddFieldWorkDialog.tsx — tööde lisamine hooaja põllule tööde registrist.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { api } from '../services/api';
import { WORK_PHASES, WORK_PHASE_META, type FieldWork, type WorkPhase, type WorkType } from '../types/fieldWork';

interface AddFieldWorkDialogProps {
  fieldSeasonId: number;
  fieldLabel: string;
  workTypes: WorkType[];
  existing: FieldWork[]; // selle põllu hooaja tööd
  templateWorkTypeIds: Set<string>; // kultuuri mall (või üldmall)
  initialPhase?: WorkPhase;
  onClose: () => void;
  onSaved: () => void;
}

export const AddFieldWorkDialog: React.FC<AddFieldWorkDialogProps> = ({
  fieldSeasonId,
  fieldLabel,
  workTypes,
  existing,
  templateWorkTypeIds,
  initialPhase,
  onClose,
  onSaved
}) => {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [plannedText, setPlannedText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existingIds = new Set(existing.map((w) => w.workTypeId));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const id of picked) {
        await api.addFieldWork({ fieldSeasonId, workTypeId: id, plannedText: plannedText.trim() || null });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lisamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  // Valitud faas ettepoole, teised järgnevad
  const phases = initialPhase ? [initialPhase, ...WORK_PHASES.filter((p) => p !== initialPhase)] : WORK_PHASES;

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content animate-scale-up add-work-modal">
        <div className="modal-header">
          <div>
            <h3>Lisa töö</h3>
            <p className="modal-subtitle">{fieldLabel}</p>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body add-work-body">
          {phases.map((phase) => {
            const list = workTypes.filter((w) => w.phase === phase && (w.isActive || existingIds.has(w.id)));
            if (list.length === 0) return null;
            return (
              <section key={phase} className="add-work-phase">
                <span className="work-template-phase-label" style={{ color: WORK_PHASE_META[phase].color }}>
                  {WORK_PHASE_META[phase].label.toUpperCase()}
                </span>
                {list.map((w) => {
                  const already = existingIds.has(w.id);
                  const checked = already || picked.has(w.id);
                  const tag = already ? 'Põllul juba olemas' : templateWorkTypeIds.has(w.id) ? 'Mallist eemaldatud' : 'Pole mallis';
                  return (
                    <button
                      key={w.id}
                      type="button"
                      className={`add-work-option ${already ? 'disabled' : picked.has(w.id) ? 'picked' : ''}`}
                      disabled={already}
                      aria-pressed={checked}
                      onClick={() => toggle(w.id)}
                    >
                      <span className={`add-work-check ${checked ? 'on' : ''}`}>{checked && <Check size={11} strokeWidth={3.4} />}</span>
                      <span className="add-work-name">{w.name}</span>
                      <span className={`add-work-tag ${already ? '' : templateWorkTypeIds.has(w.id) ? 'removed' : 'extra'}`}>{tag}</span>
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
        <div className="modal-footer add-work-footer">
          <div className="form-group">
            <label htmlFor="aw-planned">Planeeritud aeg</label>
            <input id="aw-planned" className="form-input" placeholder="nt mai 2027" value={plannedText} onChange={(e) => setPlannedText(e.target.value)} />
          </div>
          {error && <div className="alert-box error">{error}</div>}
          <div className="add-work-actions">
            <span className="add-work-count">{picked.size ? `${picked.size} töö(d) valitud` : 'Vali vähemalt üks töö'}</span>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Loobu</button>
            <button type="button" className="btn btn-primary" disabled={busy || picked.size === 0} onClick={() => void save()}>Lisa põllule</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
