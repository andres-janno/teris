// src/components/WorkRegisterModal.tsx — tööde register: põllutööde liigid (kulumaterjalid on laoarvestuse artiklites).
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ListChecks, Edit2, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import {
  WORK_PHASES,
  WORK_PHASE_META,
  type WorkPhase,
  type WorkType
} from '../types/fieldWork';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { Button } from './ui';

interface WorkRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

// Mida kandes küsitakse (töötaja sisestab ainult kogused).
const entryInputs = (w: WorkType) => [
  'Tööaeg',
  'Masin + haakeriist (h)',
  'Kütus',
  ...(w.usesMaterials ? ['Kulumaterjalid'] : []),
  ...(w.phase === 'HARVEST' ? ['Saak (t)'] : [])
];

const PhaseBadge: React.FC<{ phase: WorkPhase }> = ({ phase }) => {
  const m = WORK_PHASE_META[phase];
  return (
    <span className="work-phase-badge" style={{ color: m.color, backgroundColor: m.bg }}>
      {m.label}
    </span>
  );
};

export const WorkRegisterModal: React.FC<WorkRegisterModalProps> = ({ isOpen, onClose }) => {
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setWorkTypes(await api.getWorkTypes());
    } catch (err) {
      alertDialog(errorText(err));
    }
  }, []);

  useEffect(() => {
    if (isOpen) void reload();
  }, [isOpen, reload]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // --- Töö vorm ---
  const [workForm, setWorkForm] = useState<Partial<WorkType> | null>(null);
  const saveWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workForm) return;
    void run(async () => {
      await api.saveWorkType(workForm);
      setWorkForm(null);
    });
  };
  const deleteWork = async (w: WorkType) => {
    if (!await confirmDialog(`Kas soovid kindlasti kustutada töö "${w.name}" registrist?`)) return;
    void run(() => api.deleteWorkType(w.id));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content work-register-modal animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-badge season-icon-badge">
              <ListChecks size={20} />
            </div>
            <div>
              <h3>Tööde register</h3>
              <p className="modal-subtitle">Põllutööde liigid. PRIA põlluraamatust lahus. Kulumaterjalid on laoarvestuse artiklites.</p>
            </div>
          </div>
          <div className="season-header-actions">
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="Sulge">
              <X size={18} />
            </Button>
          </div>
        </div>

        <div className="modal-body work-register-body">
          {/* tööliigid on PRIA e-põlluraamatu 29 tegevust; uusi ei lisata, muuta saab faasi ja materjalide küsimist */}
          <div className="register-table-wrap">
            <table className="register-table work-register-table">
              <thead>
                <tr>
                  <th>PRIA tegevus</th>
                  <th>Lühinimi</th>
                  <th>Faas</th>
                  <th>Kandes küsitakse (kogused)</th>
                  <th className="num">Põldudel</th>
                  <th className="actions-col">Tegevused</th>
                </tr>
              </thead>
              <tbody>
                {[...workTypes]
                  .sort((a, b) => WORK_PHASES.indexOf(a.phase) - WORK_PHASES.indexOf(b.phase) || a.sortOrder - b.sortOrder)
                  .map((w) => (
                    <tr key={w.id} className={w.isActive ? '' : 'inactive'}>
                      <td className="work-name-cell">
                        {w.name}
                        {!w.isActive && <span className="users-admin-badge">Mitteaktiivne</span>}
                      </td>
                      <td>{w.shortName?.trim() || '–'}</td>
                      <td><PhaseBadge phase={w.phase} /></td>
                      <td>
                        <div className="field-sub-tags">
                          {entryInputs(w).map((i) => <span key={i} className="sub-tag">{i}</span>)}
                        </div>
                      </td>
                      <td className="num">{w.fieldWorkCount ?? 0}</td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <Button variant="ghost" size="icon-sm" title="Muuda" aria-label="Muuda" onClick={() => setWorkForm(w)}>
                            <Edit2 size={15} />
                          </Button>
                          <Button variant="danger-ghost" size="icon-sm" title="Kustuta" aria-label="Kustuta" disabled={busy} onClick={() => deleteWork(w)}>
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {workForm && createPortal(
        <div className="modal-backdrop sub-modal">
          <form className="modal-content animate-scale-up work-form-modal" onSubmit={saveWork}>
            <div className="modal-header">
              <div className="modal-title-group">
                <Edit2 size={20} className="text-emerald" />
                <h3>Muuda tööd: {workForm.name}</h3>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setWorkForm(null)} title="Sulge"><X size={20} /></Button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="wt-name">PRIA tegevus</label>
                  <input id="wt-name" className="form-input" readOnly value={workForm.name ?? ''} />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="wt-short">Lühinimi</label>
                  <input id="wt-short" className="form-input" maxLength={60} placeholder="nt Umbrohutõrje" value={workForm.shortName ?? ''} onChange={(e) => setWorkForm({ ...workForm, shortName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="wt-phase">Faas</label>
                  <select id="wt-phase" className="form-input" value={workForm.phase} onChange={(e) => setWorkForm({ ...workForm, phase: e.target.value as WorkPhase })}>
                    {WORK_PHASES.map((p) => <option key={p} value={p}>{WORK_PHASE_META[p].label}</option>)}
                  </select>
                </div>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={workForm.usesMaterials ?? false} onChange={(e) => setWorkForm({ ...workForm, usesMaterials: e.target.checked })} />
                  <span>Kandes küsitakse kulumaterjale (seeme, väetis, taimekaitsevahend)</span>
                </label>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={workForm.isActive ?? true} onChange={(e) => setWorkForm({ ...workForm, isActive: e.target.checked })} />
                  <span>Aktiivne (mitteaktiivset tööd põldudele ei lisata)</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="ghost" onClick={() => setWorkForm(null)}>Loobu</Button>
              <Button type="submit" variant="primary" disabled={busy}>Salvesta</Button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  );
};
