// src/components/AddFieldWorkDialog.tsx — põllu plaanitud tööde haldamine (lisamine ja eemaldamine).
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Pencil } from 'lucide-react';
import { api } from '../services/api';
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
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  const [plannedText, setPlannedText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kaardistus olemasolevatest töödest põllul
  const existingMap = useMemo(() => {
    const map = new Map<string, FieldWork>();
    for (const w of existing) {
      map.set(w.workTypeId, w);
    }
    return map;
  }, [existing]);

  const existingIds = useMemo(() => new Set(existing.map((w) => w.workTypeId)), [existing]);

  const templateItemsMap = useMemo(() => {
    const map = new Map<string, WorkTemplateItem>();
    for (const item of templateItems ?? []) {
      map.set(item.workTypeId, item);
    }
    return map;
  }, [templateItems]);

  const getWorkSortKey = (w: WorkType): number => {
    // 1. Kui töö on põllul olemas: kasuta põllu töö järjekorranumbrit (sama järjekord nagu tahvlil)
    const existingWork = existingMap.get(w.id);
    if (existingWork !== undefined) {
      return existingWork.sortOrder;
    }
    // 2. Kui töö on kultuuri mallis: kasuta malli elemendi järjekorranumbrit
    const templateItem = templateItemsMap.get(w.id);
    if (templateItem !== undefined) {
      return templateItem.sortOrder;
    }
    // 3. Kui tööd pole mallis ega põllul: paiguta mallitööde järele registri järjekorras
    return 10000 + (w.sortOrder ?? 0);
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
    const existingWork = existingMap.get(workTypeId);
    if (existingWork) {
      // Kui tööl on reaalsed kanded või lõpetatud staatus, ei saa eemaldada
      if ((existingWork.entries?.length ?? 0) > 0 || existingWork.status === 'DONE') {
        return;
      }
      // Olemasoleva plaanitud töö eemaldamise ümberlülitus
      setToRemove((prev) => {
        const next = new Set(prev);
        if (next.has(workTypeId)) next.delete(workTypeId);
        else next.add(workTypeId);
        return next;
      });
    } else {
      // Uue töö lisamise ümberlülitus
      setToAdd((prev) => {
        const next = new Set(prev);
        if (next.has(workTypeId)) next.delete(workTypeId);
        else next.add(workTypeId);
        return next;
      });
    }
  };

  const save = async () => {
    if (toAdd.size === 0 && toRemove.size === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 1. Lisa uued valitud tööd (säilitades malli sortOrderi)
      for (const id of toAdd) {
        await api.addFieldWork({
          fieldSeasonId,
          workTypeId: id,
          sortOrder: templateItemsMap.get(id)?.sortOrder,
          plannedText: plannedText.trim() || null
        });
      }
      // 2. Kustuta eemaldamiseks märgitud tööd (ainult ilma kanneteta)
      for (const id of toRemove) {
        const work = existingMap.get(id);
        if (work && (!work.entries || work.entries.length === 0)) {
          await api.deleteFieldWork(work.id);
        }
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

  const totalChanges = toAdd.size + toRemove.size;
  const summaryText = totalChanges === 0
    ? 'Vali töid lisamiseks või eemaldamiseks'
    : [
        toAdd.size > 0 ? `+${toAdd.size} lisatakse` : null,
        toRemove.size > 0 ? `-${toRemove.size} eemaldatakse` : null
      ].filter(Boolean).join(', ');

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content animate-scale-up add-work-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <Pencil size={20} className="text-emerald" />
            <div>
              <h3>Põllu plaanitud tööd</h3>
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
              .filter((w) => w.phase === phase && (w.isActive || existingIds.has(w.id)))
              .sort((a, b) => getWorkSortKey(a) - getWorkSortKey(b) || (a.name || '').localeCompare(b.name || ''));
            if (list.length === 0) return null;
            return (
              <section key={phase} className="add-work-phase">
                <span className="work-template-phase-label" style={{ color: WORK_PHASE_META[phase].color }}>
                  {WORK_PHASE_META[phase].label.toUpperCase()}
                </span>
                {list.map((w) => {
                  const existingWork = existingMap.get(w.id);
                  const already = Boolean(existingWork);
                  const hasEntries = existingWork ? (existingWork.entries?.length ?? 0) > 0 || existingWork.status === 'DONE' : false;
                  const isRemoving = toRemove.has(w.id);
                  const isAdding = toAdd.has(w.id);

                  let optionClass = 'add-work-option';
                  let tagClass = 'add-work-tag';
                  let tagText = '';

                  if (already) {
                    if (hasEntries) {
                      optionClass += ' disabled';
                      tagText = existingWork?.status === 'DONE' ? 'Lõpetatud' : `Tehtud kanded (${existingWork?.entries?.length ?? 0})`;
                    } else if (isRemoving) {
                      optionClass += ' to-remove';
                      tagClass += ' to-remove';
                      tagText = 'Eemaldatakse';
                    } else {
                      optionClass += ' on-field';
                      tagClass += ' on-field';
                      tagText = templateWorkTypeIds.has(w.id) ? 'Mallis (aktiivne)' : 'Põllul olemas';
                    }
                  } else {
                    if (isAdding) {
                      optionClass += ' picked';
                      tagClass += ' to-add';
                      tagText = 'Lisatakse';
                    } else {
                      tagText = templateWorkTypeIds.has(w.id) ? 'Mallist eemaldatud' : 'Pole mallis';
                      tagClass += templateWorkTypeIds.has(w.id) ? ' removed' : ' extra';
                    }
                  }

                  const isChecked = (already && !isRemoving) || isAdding;

                  return (
                    <button
                      key={w.id}
                      type="button"
                      className={optionClass}
                      disabled={hasEntries}
                      aria-pressed={isChecked}
                      title={hasEntries ? 'Kannetega tööd ei saa eemaldada' : already ? (isRemoving ? 'Kliki, et jätta töö alles' : 'Kliki, et eemaldada töö plaanist') : (isAdding ? 'Kliki, et tühistada lisamine' : 'Kliki, et lisada töö plaanile')}
                      onClick={() => toggle(w.id)}
                    >
                      <span className={`add-work-check ${isChecked ? 'on' : ''} ${isRemoving ? 'removing' : ''}`}>
                        {isRemoving ? <X size={12} strokeWidth={3} /> : (isChecked && <Check size={11} strokeWidth={3.4} />)}
                      </span>
                      <span className="add-work-name">{w.name}</span>
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
              disabled={busy || totalChanges === 0}
              onClick={() => void save()}
            >
              {busy ? 'Salvestan...' : 'Salvesta muudatused'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
