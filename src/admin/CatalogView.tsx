import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CROP_GROUP_LABELS,
  PHASE_LABELS,
  REPEAT_LABELS,
  platformApi,
  type CatalogCrop,
  type CatalogData,
  type CatalogTemplate,
  type CatalogVariety,
  type CatalogWorkType,
  type CropGroup,
  type TemplateItemInput,
  type WorkPhase,
  type WorkRepeatMode
} from './platformApi.ts';

type Tab = 'crops' | 'workTypes' | 'templates';

const numOrNull = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};
const textOrNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());
const numStr = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(n));
const yesNo = (b: boolean) => (b ? 'Jah' : 'Ei');

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="admin-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// ---- Kultuurid ja sordid ----

interface CropDraft {
  name: string;
  scientificName: string;
  group: CropGroup;
  color: string;
  icon: string;
  priaCode: string;
  seedRate: string;
  yieldT: string;
  description: string;
  isWinterCrop: boolean;
}

function CropForm({ crop, onSaved, onCancel }: { crop: CatalogCrop | null; onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<CropDraft>({
    name: crop?.name ?? '',
    scientificName: crop?.scientificName ?? '',
    group: crop?.group ?? 'CEREAL',
    color: crop?.color ?? '#eab308',
    icon: crop?.icon ?? '',
    priaCode: crop?.priaCode ?? '',
    seedRate: numStr(crop?.defaultSeedRateKgHa),
    yieldT: numStr(crop?.defaultYieldTonsHa),
    description: crop?.description ?? '',
    isWinterCrop: crop?.isWinterCrop ?? false
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CropDraft>(k: K, v: CropDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const input = {
      name: d.name.trim(),
      scientificName: textOrNull(d.scientificName),
      group: d.group,
      color: d.color,
      icon: textOrNull(d.icon),
      priaCode: textOrNull(d.priaCode),
      defaultSeedRateKgHa: numOrNull(d.seedRate),
      defaultYieldTonsHa: numOrNull(d.yieldT),
      description: textOrNull(d.description),
      isWinterCrop: d.isWinterCrop
    };
    try {
      if (crop) await platformApi.updateCrop(crop.id, input);
      else await platformApi.createCrop(input);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admin-form admin-subform" onSubmit={submit}>
      <h3>{crop ? `Muuda kultuuri: ${crop.name}` : 'Uus kultuur'}</h3>
      {error && <div className="alert-box error">{error}</div>}
      <div className="admin-form-grid">
        <Field id="cc-name" label="Nimi *">
          <input id="cc-name" className="form-input" value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={100} required />
        </Field>
        <Field id="cc-sci" label="Ladinakeelne nimi">
          <input id="cc-sci" className="form-input" value={d.scientificName} onChange={(e) => set('scientificName', e.target.value)} maxLength={200} />
        </Field>
        <Field id="cc-group" label="Kultuurirühm">
          <select id="cc-group" className="form-input" value={d.group} onChange={(e) => set('group', e.target.value as CropGroup)}>
            {(Object.keys(CROP_GROUP_LABELS) as CropGroup[]).map((g) => (
              <option key={g} value={g}>{CROP_GROUP_LABELS[g]}</option>
            ))}
          </select>
        </Field>
        <Field id="cc-color" label="Värv">
          <input id="cc-color" className="form-input" type="color" value={d.color} onChange={(e) => set('color', e.target.value)} />
        </Field>
        <Field id="cc-pria" label="PRIA kood">
          <input id="cc-pria" className="form-input" value={d.priaCode} onChange={(e) => set('priaCode', e.target.value)} maxLength={50} />
        </Field>
        <Field id="cc-icon" label="Ikoon">
          <input id="cc-icon" className="form-input" value={d.icon} onChange={(e) => set('icon', e.target.value)} maxLength={100} />
        </Field>
        <Field id="cc-seed" label="Külvinorm (kg/ha)">
          <input id="cc-seed" className="form-input" type="number" min="0" step="any" value={d.seedRate} onChange={(e) => set('seedRate', e.target.value)} />
        </Field>
        <Field id="cc-yield" label="Saagikus (t/ha)">
          <input id="cc-yield" className="form-input" type="number" min="0" step="any" value={d.yieldT} onChange={(e) => set('yieldT', e.target.value)} />
        </Field>
      </div>
      <Field id="cc-desc" label="Kirjeldus">
        <textarea id="cc-desc" className="form-input" rows={2} value={d.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
      </Field>
      <Check label="Talikultuur" checked={d.isWinterCrop} onChange={(v) => set('isWinterCrop', v)} />
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Salvestan…' : 'Salvesta'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Tühista</button>
      </div>
    </form>
  );
}

interface VarietyDraft {
  name: string;
  breeder: string;
  maturityDays: string;
  winterHardiness: string;
  seedRate: string;
  yieldT: string;
  qualityClass: string;
  notes: string;
  isActive: boolean;
}

function VarietyForm({ cropId, variety, onSaved, onCancel }: { cropId: string; variety: CatalogVariety | null; onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<VarietyDraft>({
    name: variety?.name ?? '',
    breeder: variety?.breeder ?? '',
    maturityDays: variety?.maturityDays ?? '',
    winterHardiness: variety?.winterHardiness ?? '',
    seedRate: numStr(variety?.recommendedSeedRateKgHa),
    yieldT: numStr(variety?.potentialYieldTonsHa),
    qualityClass: variety?.qualityClass ?? '',
    notes: variety?.notes ?? '',
    isActive: variety?.isActive ?? true
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof VarietyDraft>(k: K, v: VarietyDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const input = {
      name: d.name.trim(),
      breeder: textOrNull(d.breeder),
      maturityDays: textOrNull(d.maturityDays),
      winterHardiness: textOrNull(d.winterHardiness),
      recommendedSeedRateKgHa: numOrNull(d.seedRate),
      potentialYieldTonsHa: numOrNull(d.yieldT),
      qualityClass: textOrNull(d.qualityClass),
      notes: textOrNull(d.notes),
      isActive: d.isActive
    };
    try {
      if (variety) await platformApi.updateVariety(cropId, variety.id, input);
      else await platformApi.createVariety(cropId, input);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admin-form admin-subform" onSubmit={submit}>
      <h3>{variety ? `Muuda sorti: ${variety.name}` : 'Uus sort'}</h3>
      {error && <div className="alert-box error">{error}</div>}
      <div className="admin-form-grid">
        <Field id="cv-name" label="Nimi *">
          <input id="cv-name" className="form-input" value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={100} required />
        </Field>
        <Field id="cv-breeder" label="Aretaja">
          <input id="cv-breeder" className="form-input" value={d.breeder} onChange={(e) => set('breeder', e.target.value)} maxLength={200} />
        </Field>
        <Field id="cv-mat" label="Valmimisaeg">
          <input id="cv-mat" className="form-input" value={d.maturityDays} onChange={(e) => set('maturityDays', e.target.value)} maxLength={100} />
        </Field>
        <Field id="cv-wh" label="Talvekindlus">
          <input id="cv-wh" className="form-input" value={d.winterHardiness} onChange={(e) => set('winterHardiness', e.target.value)} maxLength={100} />
        </Field>
        <Field id="cv-seed" label="Soovitatav külvinorm (kg/ha)">
          <input id="cv-seed" className="form-input" type="number" min="0" step="any" value={d.seedRate} onChange={(e) => set('seedRate', e.target.value)} />
        </Field>
        <Field id="cv-yield" label="Potentsiaalne saagikus (t/ha)">
          <input id="cv-yield" className="form-input" type="number" min="0" step="any" value={d.yieldT} onChange={(e) => set('yieldT', e.target.value)} />
        </Field>
        <Field id="cv-q" label="Kvaliteediklass">
          <input id="cv-q" className="form-input" value={d.qualityClass} onChange={(e) => set('qualityClass', e.target.value)} maxLength={100} />
        </Field>
      </div>
      <Field id="cv-notes" label="Märkused">
        <textarea id="cv-notes" className="form-input" rows={2} value={d.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} />
      </Field>
      <Check label="Aktiivne" checked={d.isActive} onChange={(v) => set('isActive', v)} />
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Salvestan…' : 'Salvesta'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Tühista</button>
      </div>
    </form>
  );
}

function VarietiesPanel({ crop, onChanged }: { crop: CatalogCrop; onChanged: () => void }) {
  const [editing, setEditing] = useState<CatalogVariety | 'new' | null>(null);
  const [error, setError] = useState('');

  const remove = async (v: CatalogVariety) => {
    if (!window.confirm(`Kustutad sordi „${v.name}“?`)) return;
    setError('');
    try {
      await platformApi.deleteVariety(crop.id, v.id);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="admin-subpanel">
      <div className="admin-toolbar">
        <strong>Sordid — {crop.name}</strong>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing('new')}>Lisa sort</button>
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {editing && (
        <VarietyForm
          key={editing === 'new' ? 'new' : editing.id}
          cropId={crop.id}
          variety={editing === 'new' ? null : editing}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Nimi</th><th>Aretaja</th><th>Valmimisaeg</th><th>Talvekindlus</th><th>Aktiivne</th><th /></tr>
          </thead>
          <tbody>
            {crop.varieties.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.breeder ?? '–'}</td>
                <td>{v.maturityDays ?? '–'}</td>
                <td>{v.winterHardiness ?? '–'}</td>
                <td>{yesNo(v.isActive)}</td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(v)}>Muuda</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(v)}>Kustuta</button>
                </td>
              </tr>
            ))}
            {crop.varieties.length === 0 && <tr><td colSpan={6} className="admin-muted">Sorte pole</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CropsTab({ data, reload }: { data: CatalogData; reload: () => void }) {
  const [editing, setEditing] = useState<CatalogCrop | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const remove = async (c: CatalogCrop) => {
    if (!window.confirm(`Kustutad kultuuri „${c.name}“? Sordid ja kultuuripõhised mallid kustuvad koos sellega.`)) return;
    setError('');
    try {
      await platformApi.deleteCrop(c.id);
      if (openId === c.id) setOpenId(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const open = data.crops.find((c) => c.id === openId) ?? null;

  return (
    <div>
      <div className="admin-toolbar">
        <h2>Kultuurid</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>Lisa kultuur</button>
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {editing && (
        <CropForm
          key={editing === 'new' ? 'new' : editing.id}
          crop={editing === 'new' ? null : editing}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Nimi</th><th>Ladinakeelne nimi</th><th>Rühm</th><th>Värv</th><th>PRIA kood</th><th>Talivili</th><th>Sorte</th><th /></tr>
          </thead>
          <tbody>
            {data.crops.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.scientificName ?? '–'}</td>
                <td>{CROP_GROUP_LABELS[c.group] ?? c.group}</td>
                <td><span className="admin-swatch" style={{ background: c.color }} title={c.color} /></td>
                <td>{c.priaCode ?? '–'}</td>
                <td>{yesNo(c.isWinterCrop)}</td>
                <td>{c.varieties.length}</td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                    {openId === c.id ? 'Peida sordid' : 'Sordid'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(c)}>Muuda</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(c)}>Kustuta</button>
                </td>
              </tr>
            ))}
            {data.crops.length === 0 && <tr><td colSpan={8} className="admin-muted">Kultuure pole</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <VarietiesPanel key={open.id} crop={open} onChanged={reload} />}
    </div>
  );
}

// ---- Tööliigid ----

interface WorkTypeDraft {
  name: string;
  phase: WorkPhase;
  repeatMode: WorkRepeatMode;
  maxRepeats: string;
  intervalDays: string;
  usesMaterials: boolean;
  sortOrder: string;
  isActive: boolean;
}

function WorkTypeForm({ wt, nextOrder, onSaved, onCancel }: { wt: CatalogWorkType | null; nextOrder: number; onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<WorkTypeDraft>({
    name: wt?.name ?? '',
    phase: wt?.phase ?? 'CARE',
    repeatMode: wt?.repeatMode ?? 'ONCE',
    maxRepeats: numStr(wt?.maxRepeats),
    intervalDays: numStr(wt?.intervalDays),
    usesMaterials: wt?.usesMaterials ?? false,
    sortOrder: String(wt?.sortOrder ?? nextOrder),
    isActive: wt?.isActive ?? true
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof WorkTypeDraft>(k: K, v: WorkTypeDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const input = {
      name: d.name.trim(),
      phase: d.phase,
      repeatMode: d.repeatMode,
      maxRepeats: d.repeatMode === 'UP_TO' ? numOrNull(d.maxRepeats) : null,
      intervalDays: d.repeatMode === 'INTERVAL' ? numOrNull(d.intervalDays) : null,
      usesMaterials: d.usesMaterials,
      sortOrder: numOrNull(d.sortOrder) ?? 0,
      isActive: d.isActive
    };
    try {
      if (wt) await platformApi.updateWorkType(wt.id, input);
      else await platformApi.createWorkType(input);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admin-form admin-subform" onSubmit={submit}>
      <h3>{wt ? `Muuda tööliiki: ${wt.name}` : 'Uus tööliik'}</h3>
      {error && <div className="alert-box error">{error}</div>}
      <div className="admin-form-grid">
        <Field id="wt-name" label="Nimi *">
          <input id="wt-name" className="form-input" value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={100} required />
        </Field>
        <Field id="wt-phase" label="Faas">
          <select id="wt-phase" className="form-input" value={d.phase} onChange={(e) => set('phase', e.target.value as WorkPhase)}>
            {(Object.keys(PHASE_LABELS) as WorkPhase[]).map((p) => (
              <option key={p} value={p}>{PHASE_LABELS[p]}</option>
            ))}
          </select>
        </Field>
        <Field id="wt-repeat" label="Kordus">
          <select id="wt-repeat" className="form-input" value={d.repeatMode} onChange={(e) => set('repeatMode', e.target.value as WorkRepeatMode)}>
            {(Object.keys(REPEAT_LABELS) as WorkRepeatMode[]).map((r) => (
              <option key={r} value={r}>{REPEAT_LABELS[r]}</option>
            ))}
          </select>
        </Field>
        {d.repeatMode === 'UP_TO' && (
          <Field id="wt-max" label="Kordi kuni">
            <input id="wt-max" className="form-input" type="number" min="0" step="1" value={d.maxRepeats} onChange={(e) => set('maxRepeats', e.target.value)} />
          </Field>
        )}
        {d.repeatMode === 'INTERVAL' && (
          <Field id="wt-int" label="Intervall (päeva)">
            <input id="wt-int" className="form-input" type="number" min="0" step="1" value={d.intervalDays} onChange={(e) => set('intervalDays', e.target.value)} />
          </Field>
        )}
        <Field id="wt-order" label="Järjekord">
          <input id="wt-order" className="form-input" type="number" min="0" step="1" value={d.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
        </Field>
      </div>
      <div className="admin-checks">
        <Check label="Kasutab kulumaterjale" checked={d.usesMaterials} onChange={(v) => set('usesMaterials', v)} />
        <Check label="Aktiivne" checked={d.isActive} onChange={(v) => set('isActive', v)} />
      </div>
      <div className="admin-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Salvestan…' : 'Salvesta'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Tühista</button>
      </div>
    </form>
  );
}

function repeatText(w: CatalogWorkType): string {
  if (w.repeatMode === 'UP_TO') return `${REPEAT_LABELS.UP_TO}${w.maxRepeats !== null ? ` (${w.maxRepeats})` : ''}`;
  if (w.repeatMode === 'INTERVAL') return `${REPEAT_LABELS.INTERVAL}${w.intervalDays !== null ? ` (${w.intervalDays} p)` : ''}`;
  return REPEAT_LABELS.ONCE;
}

function WorkTypesTab({ data, reload }: { data: CatalogData; reload: () => void }) {
  const [editing, setEditing] = useState<CatalogWorkType | 'new' | null>(null);
  const [error, setError] = useState('');

  const remove = async (w: CatalogWorkType) => {
    if (!window.confirm(`Kustutad tööliigi „${w.name}“?`)) return;
    setError('');
    try {
      await platformApi.deleteWorkType(w.id);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const nextOrder = data.workTypes.reduce((m, w) => Math.max(m, w.sortOrder), 0) + 10;

  return (
    <div>
      <div className="admin-toolbar">
        <h2>Tööliigid</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>Lisa tööliik</button>
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {editing && (
        <WorkTypeForm
          key={editing === 'new' ? 'new' : editing.id}
          wt={editing === 'new' ? null : editing}
          nextOrder={nextOrder}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Nimi</th><th>Faas</th><th>Kordus</th><th>Kulumaterjalid</th><th>Järjekord</th><th>Aktiivne</th><th /></tr>
          </thead>
          <tbody>
            {data.workTypes.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td>{PHASE_LABELS[w.phase] ?? w.phase}</td>
                <td>{repeatText(w)}</td>
                <td>{yesNo(w.usesMaterials)}</td>
                <td>{w.sortOrder}</td>
                <td>{yesNo(w.isActive)}</td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(w)}>Muuda</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(w)}>Kustuta</button>
                </td>
              </tr>
            ))}
            {data.workTypes.length === 0 && <tr><td colSpan={7} className="admin-muted">Tööliike pole</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Mallid ----

interface DraftItem {
  key: number;
  catalogWorkTypeId: string;
  typicalTiming: string;
  plannedCount: string;
}

let itemKey = 0;

function itemsOf(t: CatalogTemplate | undefined): DraftItem[] {
  return (t?.items ?? []).map((i) => ({
    key: ++itemKey,
    catalogWorkTypeId: i.catalogWorkTypeId,
    typicalTiming: i.typicalTiming ?? '',
    plannedCount: numStr(i.plannedCount)
  }));
}

function TemplatesTab({ data, reload }: { data: CatalogData; reload: () => void }) {
  const [cropId, setCropId] = useState<string>(''); // '' = üldmall
  const [isWinter, setIsWinter] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [addId, setAddId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const current = data.templates.find((t) => (t.catalogCropId ?? '') === cropId && t.isWinter === isWinter);

  // Valiku või serveriandmete muutudes laetakse redaktor uuesti
  useEffect(() => {
    setItems(itemsOf(current));
  }, [current]);

  // Teade ja viga nullitakse ainult valiku vahetamisel, mitte pärast salvestust
  useEffect(() => {
    setNotice('');
    setError('');
  }, [cropId, isWinter]);

  const used = new Set(items.map((i) => i.catalogWorkTypeId));
  const available = data.workTypes.filter((w) => !used.has(w.id));
  const nameOf = (id: string) => data.workTypes.find((w) => w.id === id)?.name ?? id;

  const patch = (key: number, p: Partial<DraftItem>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const move = (idx: number, dir: -1 | 1) =>
    setItems((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  const add = () => {
    if (!addId) return;
    setItems((prev) => [...prev, { key: ++itemKey, catalogWorkTypeId: addId, typicalTiming: '', plannedCount: '' }]);
    setAddId('');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    const payload: TemplateItemInput[] = items.map((i) => ({
      catalogWorkTypeId: i.catalogWorkTypeId,
      typicalTiming: textOrNull(i.typicalTiming),
      plannedCount: numOrNull(i.plannedCount)
    }));
    try {
      await platformApi.saveTemplate(cropId || null, isWinter, payload);
      setNotice(payload.length ? 'Mall salvestatud.' : 'Mall on tühi ja eemaldati.');
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const label = (t: CatalogTemplate) => `${t.cropName ?? 'Üldmall'} — ${t.isWinter ? 'talvi' : 'suvi'} (${t.items.length} tööd)`;

  return (
    <div>
      <div className="admin-toolbar">
        <h2>Mallid</h2>
      </div>
      <p className="admin-muted">
        Olemasolevad mallid: {data.templates.length ? data.templates.map(label).join('; ') : 'puuduvad'}.
      </p>
      <div className="admin-form-grid">
        <Field id="tp-crop" label="Kultuur">
          <select id="tp-crop" className="form-input" value={cropId} onChange={(e) => setCropId(e.target.value)}>
            <option value="">Üldmall (kõik kultuurid)</option>
            {data.crops.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field id="tp-season" label="Hooaeg">
          <select id="tp-season" className="form-input" value={isWinter ? 'winter' : 'summer'} onChange={(e) => setIsWinter(e.target.value === 'winter')}>
            <option value="summer">Suvivili</option>
            <option value="winter">Talivili</option>
          </select>
        </Field>
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {notice && <div className="alert-box success">{notice}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>#</th><th>Tööliik</th><th>Tüüpiline aeg</th><th>Plaanitud kordi</th><th /></tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.key}>
                <td>{idx + 1}</td>
                <td>{nameOf(it.catalogWorkTypeId)}</td>
                <td>
                  <input className="form-input" aria-label="Tüüpiline aeg" value={it.typicalTiming} maxLength={100} onChange={(e) => patch(it.key, { typicalTiming: e.target.value })} />
                </td>
                <td>
                  <input className="form-input admin-narrow" aria-label="Plaanitud kordi" type="number" min="0" step="1" value={it.plannedCount} onChange={(e) => patch(it.key, { plannedCount: e.target.value })} />
                </td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Üles">↑</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label="Alla">↓</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setItems((prev) => prev.filter((i) => i.key !== it.key))}>Eemalda</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="admin-muted">Mallis pole töid</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="admin-actions admin-template-add">
        <select className="form-input" aria-label="Lisa tööliik" value={addId} onChange={(e) => setAddId(e.target.value)}>
          <option value="">Vali tööliik…</option>
          {available.map((w) => (
            <option key={w.id} value={w.id}>{PHASE_LABELS[w.phase]} — {w.name}</option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={add} disabled={!addId}>Lisa mallile</button>
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Salvestan…' : 'Salvesta mall'}
        </button>
      </div>
    </div>
  );
}

// ---- Vaade ----

export function CatalogView() {
  const [tab, setTab] = useState<Tab>('crops');
  const [data, setData] = useState<CatalogData | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    platformApi
      .getCatalog()
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(reload, [reload]);

  return (
    <div className="glass-card admin-card">
      <h2>Algkataloog</h2>
      <div className="alert-box info">Algkataloogi muudatused kehtivad ainult edaspidi loodavatele ettevõtetele.</div>
      <div className="admin-nav">
        {([['crops', 'Kultuurid'], ['workTypes', 'Tööliigid'], ['templates', 'Mallid']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" className={`btn btn-secondary ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {!data && !error && <div className="admin-muted">Laadin…</div>}
      {data && tab === 'crops' && <CropsTab data={data} reload={reload} />}
      {data && tab === 'workTypes' && <WorkTypesTab data={data} reload={reload} />}
      {data && tab === 'templates' && <TemplatesTab data={data} reload={reload} />}
    </div>
  );
}
