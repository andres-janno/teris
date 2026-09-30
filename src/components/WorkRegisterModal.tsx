// src/components/WorkRegisterModal.tsx — tööde register: tööd, kultuuride mallid (+ üldmall), kulumaterjalid.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ListChecks, Plus, Edit2, Trash2, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { Crop } from '../types/crop';
import {
  WORK_PHASES,
  WORK_PHASE_META,
  MATERIAL_CATEGORY_LABEL,
  type Material,
  type MaterialCategory,
  type WorkPhase,
  type WorkRepeatMode,
  type WorkTemplate,
  type WorkTemplateItem,
  type WorkType
} from '../types/fieldWork';

interface WorkRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  crops: Crop[];
}

type Tab = 'works' | 'templates' | 'materials';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

export const repeatLabel = (w: Pick<WorkType, 'repeatMode' | 'maxRepeats' | 'intervalDays'>) =>
  w.repeatMode === 'UP_TO' ? `Kuni ${w.maxRepeats ?? 1} korda` : w.repeatMode === 'INTERVAL' ? `Iga ${w.intervalDays ?? 14} päeva järel` : 'Ühekordne';

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

export const WorkRegisterModal: React.FC<WorkRegisterModalProps> = ({ isOpen, onClose, crops }) => {
  const [tab, setTab] = useState<Tab>('works');
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [w, m, t] = await Promise.all([api.getWorkTypes(), api.getMaterials(), api.getWorkTemplates()]);
      setWorkTypes(w);
      setMaterials(m);
      setTemplates(t);
    } catch (err) {
      alert(errorText(err));
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
      alert(errorText(err));
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
  const deleteWork = (w: WorkType) => {
    if (!confirm(`Kas soovid kindlasti kustutada töö "${w.name}" registrist?`)) return;
    void run(() => api.deleteWorkType(w.id));
  };

  // --- Materjali vorm ---
  const [materialForm, setMaterialForm] = useState<Partial<Material> | null>(null);
  const saveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialForm) return;
    void run(async () => {
      await api.saveMaterial(materialForm);
      setMaterialForm(null);
    });
  };
  const deleteMaterial = (m: Material) => {
    if (!confirm(`Kas soovid kindlasti kustutada materjali "${m.name}"?`)) return;
    void run(() => api.deleteMaterial(m.id));
  };

  // --- Mallid ---
  type TemplateTarget = 'SPRING' | 'AUTUMN' | string;
  const [selectedTarget, setSelectedTarget] = useState<TemplateTarget>('SPRING');
  const [draftItems, setDraftItems] = useState<WorkTemplateItem[] | null>(null);
  const [addWorkTypeId, setAddWorkTypeId] = useState('');

  const springTemplate = templates.find((t) => t.cropId === null && !t.isWinter) ?? null;
  const autumnTemplate = templates.find((t) => t.cropId === null && t.isWinter) ?? null;

  const isGeneralTarget = selectedTarget === 'SPRING' || selectedTarget === 'AUTUMN';
  const selectedCrop = !isGeneralTarget ? crops.find((c) => c.id === selectedTarget) ?? null : null;
  const selectedCropId = selectedCrop ? selectedCrop.id : null;
  const targetIsWinter = selectedTarget === 'AUTUMN' || (selectedCrop?.isWinterCrop ?? false);

  const fallbackGeneral = targetIsWinter ? autumnTemplate : springTemplate;
  const ownTemplate = selectedCrop ? templates.find((t) => t.cropId === selectedCrop.id) ?? null : fallbackGeneral;
  const usesGeneral = selectedCrop !== null && !templates.some((t) => t.cropId === selectedCrop.id);

  const workTypeById = useMemo(() => new Map(workTypes.map((w) => [w.id, w])), [workTypes]);
  const shownItems = draftItems ?? (ownTemplate ?? fallbackGeneral)?.items ?? [];
  const dirty = draftItems !== null;

  const selectTarget = (target: TemplateTarget) => {
    if (dirty && !confirm('Mallis on salvestamata muudatusi. Kas loobud neist?')) return;
    setDraftItems(null);
    setSelectedTarget(target);
  };
  const editItems = (fn: (items: WorkTemplateItem[]) => WorkTemplateItem[]) =>
    setDraftItems(fn([...shownItems]).map((it, i) => ({ ...it, sortOrder: i })));
  const moveItem = (index: number, dir: -1 | 1) =>
    editItems((items) => {
      const phase = workTypeById.get(items[index].workTypeId)?.phase;
      let j = index + dir;
      while (j >= 0 && j < items.length && workTypeById.get(items[j].workTypeId)?.phase !== phase) j += dir;
      if (j < 0 || j >= items.length) return items;
      [items[index], items[j]] = [items[j], items[index]];
      return items;
    });
  const removeItem = (index: number) => {
    const w = workTypeById.get(shownItems[index].workTypeId);
    if (!confirm(`Kas soovid kindlasti eemaldada töö "${w?.name ?? ''}" mallist?`)) return;
    editItems((items) => items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    const w = workTypeById.get(addWorkTypeId);
    if (!w) return;
    editItems((items) => {
      // Uus töö oma faasi lõppu
      const lastOfPhase = items.map((it) => workTypeById.get(it.workTypeId)?.phase).lastIndexOf(w.phase);
      const at = lastOfPhase >= 0 ? lastOfPhase + 1 : items.filter((it) => WORK_PHASES.indexOf(workTypeById.get(it.workTypeId)!.phase) < WORK_PHASES.indexOf(w.phase)).length;
      items.splice(at, 0, { workTypeId: w.id, sortOrder: at, typicalTiming: null, plannedCount: w.repeatMode === 'UP_TO' ? w.maxRepeats : null });
      return items;
    });
    setAddWorkTypeId('');
  };
  const saveTemplate = () =>
    run(async () => {
      await api.saveWorkTemplate(selectedCropId, shownItems, targetIsWinter);
      setDraftItems(null);
    });
  const createOwnTemplate = () => setDraftItems([...(fallbackGeneral?.items ?? [])]);
  const deleteOwnTemplate = () => {
    if (!selectedCrop) return;
    const existing = templates.find((t) => t.cropId === selectedCrop.id);
    if (!existing) return;
    if (!confirm(`Kas soovid kindlasti kustutada kultuuri "${selectedCrop.name}" malli? Edaspidi kasutatakse sellel kultuuril ${selectedCrop.isWinterCrop ? 'sügiskülvi' : 'kevadkülvi'} üldmalli.`)) return;
    void run(async () => {
      await api.deleteWorkTemplate(existing.id);
      setDraftItems(null);
    });
  };

  if (!isOpen) return null;

  const sortedCrops = [...crops].sort((a, b) => Number(!!b.isWinterCrop) - Number(!!a.isWinterCrop) || a.name.localeCompare(b.name, 'et'));
  const missingWorkTypes = workTypes.filter((w) => w.isActive && !shownItems.some((it) => it.workTypeId === w.id));

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
              <p className="modal-subtitle">Põllutööde liigid, kultuuride mallid ja kulumaterjalid. PRIA põlluraamatust lahus.</p>
            </div>
          </div>
          <div className="season-header-actions">
            <div className="work-register-tabs" role="tablist">
              {([['works', 'Tööd'], ['templates', 'Kultuuride mallid'], ['materials', 'Kulumaterjalid']] as [Tab, string][]).map(([k, label]) => (
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
              <div className="work-register-toolbar">
                <button className="btn btn-primary btn-sm" onClick={() => setWorkForm({ phase: 'PREPARATION', repeatMode: 'ONCE', usesMaterials: false, isActive: true, sortOrder: workTypes.length })}>
                  <Plus size={14} />
                  <span>Lisa töö</span>
                </button>
              </div>
              <div className="register-table-wrap">
                <table className="register-table work-register-table">
                  <thead>
                    <tr>
                      <th>Töö</th>
                      <th>Faas</th>
                      <th>Kordumine</th>
                      <th>Kandes küsitakse (kogused)</th>
                      <th className="num">Mallides</th>
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
                          <td><PhaseBadge phase={w.phase} /></td>
                          <td>{repeatLabel(w)}</td>
                          <td>
                            <div className="field-sub-tags">
                              {entryInputs(w).map((i) => <span key={i} className="sub-tag">{i}</span>)}
                            </div>
                          </td>
                          <td className="num">{w.templateCount ?? 0}</td>
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

          {tab === 'templates' && (
            <div className="work-templates-layout">
              <div className="work-templates-list">
                <span className="work-templates-list-label">ÜLDMALLID</span>
                <button
                  type="button"
                  className={`work-template-crop general ${selectedTarget === 'SPRING' ? 'selected' : ''}`}
                  onClick={() => selectTarget('SPRING')}
                >
                  <span className="work-template-crop-name">
                    Kevadkülvi üldmall
                    <small>suviviljad (kui oma malli pole)</small>
                  </span>
                  <span className="work-template-crop-count">{springTemplate?.items.length ?? 0} tööd</span>
                </button>
                <button
                  type="button"
                  className={`work-template-crop general ${selectedTarget === 'AUTUMN' ? 'selected' : ''}`}
                  onClick={() => selectTarget('AUTUMN')}
                >
                  <span className="work-template-crop-name">
                    Sügiskülvi üldmall
                    <small>taliviljad (kui oma malli pole)</small>
                  </span>
                  <span className="work-template-crop-count">{autumnTemplate?.items.length ?? 0} tööd</span>
                </button>
                <span className="work-templates-list-label">KULTUURID</span>
                {sortedCrops.map((c) => {
                  const own = templates.find((t) => t.cropId === c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`work-template-crop ${selectedTarget === c.id ? 'selected' : ''}`}
                      style={{ '--crop-color': c.color } as React.CSSProperties}
                      onClick={() => selectTarget(c.id)}
                    >
                      <span className="work-template-crop-name">
                        {c.name}
                        <small>{c.isWinterCrop ? 'talivili · sügiskülv' : 'suvivili · kevadkülv'}</small>
                      </span>
                      <span className="work-template-crop-count">{own ? `${own.items.length} tööd` : c.isWinterCrop ? 'sügiskülvi mall' : 'kevadkülvi mall'}</span>
                    </button>
                  );
                })}
              </div>

              <div className="work-template-editor">
                <div className="work-template-head">
                  <div>
                    <h4>
                      {selectedCrop
                        ? `${selectedCrop.name} – tööde mall`
                        : selectedTarget === 'AUTUMN'
                          ? 'Sügiskülvi üldmall'
                          : 'Kevadkülvi üldmall'}
                    </h4>
                    <p className="modal-subtitle">
                      {selectedCrop
                        ? selectedCrop.isWinterCrop ? 'Talivili · ettevalmistus ja külv hooajale eelneval sügisel' : 'Suvivili · kevadkülv'
                        : selectedTarget === 'AUTUMN'
                          ? 'Taliviljad · kasutatakse kultuuridel, millel oma malli pole · ettevalmistus ja külv hooajale eelneval sügisel'
                          : 'Suviviljad · kasutatakse kultuuridel, millel oma malli pole · ettevalmistus ja külv kevadel'}
                      {' · '}Malli muudatus mõjutab ainult uusi hooaegu.
                    </p>
                  </div>
                  <div className="work-template-actions">
                    {selectedCropId !== null && ownTemplate && !dirty && (
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={deleteOwnTemplate}>Kustuta kultuuri mall</button>
                    )}
                    {dirty && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDraftItems(null)}>Loobu</button>
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveTemplate()}>Salvesta mall</button>
                      </>
                    )}
                  </div>
                </div>

                {usesGeneral && !dirty && (
                  <div className="work-template-notice">
                    <AlertCircle size={16} />
                    <span>
                      Sellel kultuuril oma malli pole – põllule lisatakse <strong>{selectedCrop?.isWinterCrop ? 'sügiskülvi' : 'kevadkülvi'} üldmalli</strong> tööd. Allpool on {selectedCrop?.isWinterCrop ? 'sügiskülvi' : 'kevadkülvi'} üldmall.
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={createOwnTemplate}>
                      Loo oma mall {selectedCrop?.isWinterCrop ? 'sügiskülvi' : 'kevadkülvi'} üldmalli põhjal
                    </button>
                  </div>
                )}

                {WORK_PHASES.map((phase) => {
                  const rows = shownItems.map((it, index) => ({ it, index, w: workTypeById.get(it.workTypeId) })).filter((r) => r.w?.phase === phase);
                  const readOnly = usesGeneral && !dirty;
                  return (
                    <section key={phase} className="work-template-phase">
                      <span className="work-template-phase-label" style={{ color: WORK_PHASE_META[phase].color }}>
                        {WORK_PHASE_META[phase].label.toUpperCase()}
                      </span>
                      {rows.length === 0 && <div className="work-template-empty">Selles faasis töid pole</div>}
                      {rows.map(({ it, index, w }, i) => (
                        <div key={it.workTypeId} className={`work-template-item ${readOnly ? 'readonly' : ''}`}>
                          {!readOnly && (
                            <span className="work-template-move">
                              <button type="button" className="icon-btn-ghost-xs" aria-label="Liiguta üles" disabled={i === 0} onClick={() => moveItem(index, -1)}><ChevronUp size={14} /></button>
                              <button type="button" className="icon-btn-ghost-xs" aria-label="Liiguta alla" disabled={i === rows.length - 1} onClick={() => moveItem(index, 1)}><ChevronDown size={14} /></button>
                            </span>
                          )}
                          <span className="work-template-name" title={w?.name}>{w?.name}</span>
                          <input
                            className="form-input"
                            placeholder="Tavapärane aeg, nt apr–mai"
                            value={it.typicalTiming ?? ''}
                            disabled={readOnly}
                            onChange={(e) => editItems((items) => { items[index] = { ...items[index], typicalTiming: e.target.value || null }; return items; })}
                          />
                          {w && w.repeatMode !== 'ONCE' ? (
                            <label className="work-template-count">
                              <span>{w.repeatMode === 'INTERVAL' ? `iga ${w.intervalDays} p` : 'kordi'}</span>
                              {w.repeatMode === 'UP_TO' && (
                                <input
                                  className="form-input"
                                  type="number"
                                  min={1}
                                  value={it.plannedCount ?? w.maxRepeats ?? 1}
                                  disabled={readOnly}
                                  onChange={(e) => editItems((items) => { items[index] = { ...items[index], plannedCount: Number(e.target.value) || 1 }; return items; })}
                                />
                              )}
                            </label>
                          ) : (
                            <span className="work-template-count muted">ühekordne</span>
                          )}
                          {!readOnly && (
                            <button type="button" className="icon-btn-danger" title="Eemalda mallist" aria-label="Eemalda mallist" onClick={() => removeItem(index)}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </section>
                  );
                })}

                {!(usesGeneral && !dirty) && (
                  <div className="work-template-add">
                    <select className="form-input" value={addWorkTypeId} onChange={(e) => setAddWorkTypeId(e.target.value)}>
                      <option value="">Lisa registrist…</option>
                      {missingWorkTypes.map((w) => (
                        <option key={w.id} value={w.id}>{WORK_PHASE_META[w.phase].label}: {w.name}</option>
                      ))}
                    </select>
                    <button className="btn btn-secondary btn-sm" disabled={!addWorkTypeId} onClick={addItem}>
                      <Plus size={14} />
                      <span>Lisa mallisse</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'materials' && (
            <>
              <div className="work-register-toolbar">
                <button className="btn btn-primary btn-sm" onClick={() => setMaterialForm({ category: 'FERTILIZER', unit: 'kg', isActive: true })}>
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
                <h3>{workForm.id ? `Muuda tööd: ${workForm.name}` : 'Lisa töö'}</h3>
              </div>
              <button type="button" className="icon-btn-ghost" onClick={() => setWorkForm(null)} title="Sulge"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="wt-name">Nimi *</label>
                  <input id="wt-name" className="form-input" required value={workForm.name ?? ''} onChange={(e) => setWorkForm({ ...workForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="wt-phase">Faas</label>
                  <select id="wt-phase" className="form-input" value={workForm.phase} onChange={(e) => setWorkForm({ ...workForm, phase: e.target.value as WorkPhase })}>
                    {WORK_PHASES.map((p) => <option key={p} value={p}>{WORK_PHASE_META[p].label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="wt-repeat">Kordumine</label>
                  <select id="wt-repeat" className="form-input" value={workForm.repeatMode} onChange={(e) => setWorkForm({ ...workForm, repeatMode: e.target.value as WorkRepeatMode })}>
                    <option value="ONCE">Ühekordne</option>
                    <option value="UP_TO">Kuni N korda</option>
                    <option value="INTERVAL">Iga N päeva järel</option>
                  </select>
                </div>
                {workForm.repeatMode === 'UP_TO' && (
                  <div className="form-group">
                    <label htmlFor="wt-max">Kordi kuni</label>
                    <input id="wt-max" className="form-input" type="number" min={1} value={workForm.maxRepeats ?? 2} onChange={(e) => setWorkForm({ ...workForm, maxRepeats: Number(e.target.value) || 1 })} />
                  </div>
                )}
                {workForm.repeatMode === 'INTERVAL' && (
                  <div className="form-group">
                    <label htmlFor="wt-int">Päevade vahe</label>
                    <input id="wt-int" className="form-input" type="number" min={1} value={workForm.intervalDays ?? 14} onChange={(e) => setWorkForm({ ...workForm, intervalDays: Number(e.target.value) || 1 })} />
                  </div>
                )}
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={workForm.usesMaterials ?? false} onChange={(e) => setWorkForm({ ...workForm, usesMaterials: e.target.checked })} />
                  <span>Kandes küsitakse kulumaterjale (seeme, väetis, taimekaitsevahend)</span>
                </label>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={workForm.isActive ?? true} onChange={(e) => setWorkForm({ ...workForm, isActive: e.target.checked })} />
                  <span>Aktiivne (mitteaktiivset tööd uutesse mallidesse ja põldudele ei lisata)</span>
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

      {materialForm && createPortal(
        <div className="modal-backdrop sub-modal">
          <form className="modal-content animate-scale-up work-form-modal" onSubmit={saveMaterial}>
            <div className="modal-header">
              <div className="modal-title-group">
                <Edit2 size={20} className="text-emerald" />
                <h3>{materialForm.id ? `Muuda materjali: ${materialForm.name}` : 'Lisa materjal'}</h3>
              </div>
              <button type="button" className="icon-btn-ghost" onClick={() => setMaterialForm(null)} title="Sulge"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="mt-name">Nimi *</label>
                  <input id="mt-name" className="form-input" required placeholder="nt YaraMila 16-27-7" value={materialForm.name ?? ''} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="mt-cat">Liik</label>
                  <select id="mt-cat" className="form-input" value={materialForm.category} onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value as MaterialCategory })}>
                    {(Object.keys(MATERIAL_CATEGORY_LABEL) as MaterialCategory[]).map((c) => <option key={c} value={c}>{MATERIAL_CATEGORY_LABEL[c]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="mt-unit">Ühik *</label>
                  <input id="mt-unit" className="form-input" required list="material-units" value={materialForm.unit ?? ''} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })} />
                  <datalist id="material-units"><option value="kg" /><option value="l" /><option value="t" /><option value="tk" /></datalist>
                </div>
                <div className="form-group full-width">
                  <label htmlFor="mt-notes">Märkus</label>
                  <input id="mt-notes" className="form-input" placeholder="nt ERP tootekood" value={materialForm.notes ?? ''} onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })} />
                </div>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={materialForm.isActive ?? true} onChange={(e) => setMaterialForm({ ...materialForm, isActive: e.target.checked })} />
                  <span>Aktiivne (kannetes valitav)</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setMaterialForm(null)}>Loobu</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
};
