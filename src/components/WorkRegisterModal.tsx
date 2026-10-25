// src/components/WorkRegisterModal.tsx — tööde register: tööd ja kulumaterjalid.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ListChecks, Plus, Edit2, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import {
  WORK_PHASES,
  WORK_PHASE_META,
  MATERIAL_CATEGORY_LABEL,
  NEW_MATERIAL,
  type Material,
  type WorkPhase,
  type WorkType
} from '../types/fieldWork';
import { MaterialFormDialog } from './MaterialFormDialog';
import { confirmDialog, alertDialog } from './ConfirmDialog';

interface WorkRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'works' | 'materials';

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
  const [tab, setTab] = useState<Tab>('works');
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [w, m] = await Promise.all([api.getWorkTypes(), api.getMaterials()]);
      setWorkTypes(w);
      setMaterials(m);
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

  // --- Materjali vorm ---
  const [materialForm, setMaterialForm] = useState<Partial<Material> | null>(null);
  const deleteMaterial = async (m: Material) => {
    if (!await confirmDialog(`Kas soovid kindlasti kustutada materjali "${m.name}"?`)) return;
    void run(() => api.deleteMaterial(m.id));
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
              <p className="modal-subtitle">Põllutööde liigid ja kulumaterjalid. PRIA põlluraamatust lahus.</p>
            </div>
          </div>
          <div className="season-header-actions">
            <div className="work-register-tabs" role="tablist">
              {([['works', 'Tööd'], ['materials', 'Kulumaterjalid']] as [Tab, string][]).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                  {label}
                </button>
              ))}
            </div>
            <button className="icon-btn" onClick={onClose} title="Sulge">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body work-register-body">
          {tab === 'works' && (
            <>
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
                              <button className="icon-btn-ghost" title="Muuda" aria-label="Muuda" onClick={() => setWorkForm(w)}>
                                <Edit2 size={15} />
                              </button>
                              <button className="icon-btn-danger" title="Kustuta" aria-label="Kustuta" disabled={busy} onClick={() => deleteWork(w)}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'materials' && (
            <>
              <div className="work-register-toolbar">
                <button className="btn btn-primary btn-sm" onClick={() => setMaterialForm(NEW_MATERIAL)}>
                  <Plus size={14} />
                  <span>Lisa materjal</span>
                </button>
              </div>
              <div className="register-table-wrap">
                <table className="register-table work-register-table">
                  <thead>
                    <tr>
                      <th>Materjal</th>
                      <th>Liik</th>
                      <th>Ühik</th>
                      <th className="num">Kandeid</th>
                      <th>Märkus</th>
                      <th className="actions-col">Tegevused</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 && (
                      <tr><td colSpan={6} className="muted">Materjale pole. Lisa seemned, väetised ja taimekaitsevahendid, et töötajad saaksid neid kannetes valida.</td></tr>
                    )}
                    {materials.map((m) => (
                      <tr key={m.id} className={m.isActive ? '' : 'inactive'}>
                        <td className="work-name-cell">
                          {m.name}
                          {!m.isActive && <span className="users-admin-badge">Mitteaktiivne</span>}
                        </td>
                        <td>{MATERIAL_CATEGORY_LABEL[m.category]}</td>
                        <td>{m.unit}</td>
                        <td className="num">{m.usageCount ?? 0}</td>
                        <td className="muted">{m.notes ?? ''}</td>
                        <td className="actions-col">
                          <div className="row-actions">
                            <button className="icon-btn-ghost" title="Muuda" aria-label="Muuda" onClick={() => setMaterialForm(m)}>
                              <Edit2 size={15} />
                            </button>
                            <button className="icon-btn-danger" title="Kustuta" aria-label="Kustuta" disabled={busy} onClick={() => deleteMaterial(m)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
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
              <button type="button" className="icon-btn-ghost" onClick={() => setWorkForm(null)} title="Sulge"><X size={20} /></button>
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
              <button type="button" className="btn btn-ghost" onClick={() => setWorkForm(null)}>Loobu</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {materialForm && (
        <MaterialFormDialog
          initial={materialForm}
          onClose={() => setMaterialForm(null)}
          onSaved={() => {
            setMaterialForm(null);
            void reload();
          }}
        />
      )}
    </div>
  );
};
