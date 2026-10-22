// src/components/AddFieldWorkDialog.tsx — põllule tööde lisamine (sama tegevust võib lisada mitu korda; eemaldamine tahvli töö paneelist).
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Pencil } from 'lucide-react';
import { api } from '../services/api';
import { PRIA_ACTIVITIES } from '../services/pria';
import { workTypeDisplayName } from '../services/workTypeName';
import { WORK_PHASES, WORK_PHASE_META, type FieldWork, type WorkPhase, type WorkType, type WorkTemplateItem } from '../types/fieldWork';

interface AddFieldWorkDialogProps {
  fieldSeasonId: number;
  fieldLabel: string;
  workTypes: WorkType[];
  existing: FieldWork[]; // selle põllu hooaja tööd
  templateWorkTypeIds: Set<string>; // kultuuri mall (või üldmall)
  templateItems?: WorkTemplateItem[];
  initialPhase?: WorkPhase;
  allowedPhases?: WorkPhase[];
  onClose: () => void;
  onSaved: () => void;
}

export const AddFieldWorkDialog: React.FC<AddFieldWorkDialogProps> = ({
  fieldSeasonId,
  fieldLabel,
  workTypes,
  existing,
  templateWorkTypeIds,
  templateItems,
  initialPhase,
  allowedPhases,
  onClose,
  onSaved
}) => {
  const [toAdd, setToAdd] = useState<Set<string>>(new Set());
  const [plannedText, setPlannedText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sama tegevust võib põllul olla mitu tööd (iga töö = üks kord); olemasolevate arv on ainult vihje
  const existingCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of existing) map.set(w.workTypeId, (map.get(w.workTypeId) ?? 0) + 1);
    return map;
  }, [existing]);

  const templateItemsMap = useMemo(() => {
    const map = new Map<string, WorkTemplateItem>();
    for (const item of templateItems ?? []) {
      map.set(item.workTypeId, item);
    }
    return map;
  }, [templateItems]);

  // PRIA tegevuste järjekord; PRIA-koodita tüübid lõppu
  const priaIndex = (w: WorkType): number => {
    const i = PRIA_ACTIVITIES.findIndex((p) => p.name === w.priaCode);
    return i < 0 ? PRIA_ACTIVITIES.length : i;
  };

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

  const toggle = (workTypeId: string) => {
    setToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(workTypeId)) next.delete(workTypeId);
      else next.add(workTypeId);
      return next;
    });
  };

  const save = async () => {
    if (toAdd.size === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Lisa valitud tööd (säilitades malli sortOrderi)
      for (const id of toAdd) {
        await api.addFieldWork({
          fieldSeasonId,
          workTypeId: id,
          sortOrder: templateItemsMap.get(id)?.sortOrder,
          plannedText: plannedText.trim() || null
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tööde salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  // Valitud faas ettepoole, teised järgnevad (filtreeritud lubatud faaside järgi)
  const basePhases = allowedPhases ?? WORK_PHASES;
  const phases = initialPhase && basePhases.includes(initialPhase)
    ? [initialPhase, ...basePhases.filter((p) => p !== initialPhase)]
    : basePhases;

  const summaryText = toAdd.size === 0 ? 'Vali põllule lisatavad tööd' : `+${toAdd.size} lisatakse`;

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content animate-scale-up add-work-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <Pencil size={20} className="text-emerald" />
            <div>
              <h3>Lisa põllule töid</h3>
              <p className="modal-subtitle">{fieldLabel}</p>
            </div>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body add-work-body">
          {phases.map((phase) => {
            const list = workTypes
              .filter((w) => w.phase === phase && w.isActive)
              .sort((a, b) => priaIndex(a) - priaIndex(b) || (a.name || '').localeCompare(b.name || ''));
            if (list.length === 0) return null;
            return (
              <section key={phase} className="add-work-phase">
                <span className="work-template-phase-label" style={{ color: WORK_PHASE_META[phase].color }}>
                  {WORK_PHASE_META[phase].label.toUpperCase()}
                </span>
                {list.map((w) => {
                  const count = existingCount.get(w.id) ?? 0;
                  const isAdding = toAdd.has(w.id);
                  const inTemplate = templateWorkTypeIds.has(w.id);

                  let optionClass = 'add-work-option';
                  let tagClass = 'add-work-tag';
                  let tagText: string;
                  if (isAdding) {
                    optionClass += ' picked';
                    tagClass += ' to-add';
                    tagText = count > 0 ? `Lisatakse (põllul juba ${count})` : 'Lisatakse';
                  } else if (count > 0) {
                    tagClass += ' on-field';
                    tagText = `põllul juba ${count}`;
                  } else {
                    tagText = inTemplate ? 'Mallis' : 'Pole mallis';
                    tagClass += inTemplate ? ' on-field' : ' extra';
                  }

                  return (
                    <button
                      key={w.id}
                      type="button"
                      className={optionClass}
                      aria-pressed={isAdding}
                      title={isAdding ? 'Kliki, et tühistada lisamine' : 'Kliki, et lisada töö plaanile'}
                      onClick={() => toggle(w.id)}
                    >
                      <span className={`add-work-check ${isAdding ? 'on' : ''}`}>
                        {isAdding && <Check size={11} strokeWidth={3.4} />}
                      </span>
                      <span className="add-work-name" title={w.name}>
                        {workTypeDisplayName(w)}
                        {w.shortName?.trim() && <small style={{ display: 'block', fontWeight: 400, color: 'var(--text-secondary)' }}>{w.name}</small>}
                      </span>
                      <span className={tagClass}>{tagText}</span>
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
        <div className="modal-footer add-work-footer">
          {toAdd.size > 0 && (
            <div className="form-group animate-slide-in">
              <label htmlFor="aw-planned">Planeeritud aeg (uutele töödele)</label>
              <input id="aw-planned" className="form-input" placeholder="nt mai 2027" value={plannedText} onChange={(e) => setPlannedText(e.target.value)} />
            </div>
          )}
          {error && <div className="alert-box error">{error}</div>}
          <div className="add-work-actions">
            <span className="add-work-count">{summaryText}</span>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Loobu</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || toAdd.size === 0}
              onClick={() => void save()}
            >
              {busy ? 'Salvestan...' : 'Lisa tööd'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
