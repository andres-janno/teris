import { DEFAULT_CROP_COLOR } from '../lib/dataColors';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CROP_GROUP_LABELS,
  PHASE_LABELS,
  platformApi,
  type CatalogCrop,
  type CatalogData,
  type CatalogVariety,
  type CatalogWorkType,
  type CropGroup,
  type WorkPhase
} from './platformApi.ts';
import { NumberInput, CheckboxField, Field, Card, Button, Input, Select, Textarea, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '../components/ui';

type Tab = 'crops' | 'workTypes';

const numOrNull = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};
const textOrNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());
const numStr = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(n));
const yesNo = (b: boolean) => (b ? 'Jah' : 'Ei');

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <CheckboxField label={label} checked={checked} onCheckedChange={onChange} />
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
  gddBaseC: number | null;
  priaName: string;
  priaUndersowing: boolean;
}

function CropForm({ crop, onSaved, onCancel }: { crop: CatalogCrop | null; onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<CropDraft>({
    name: crop?.name ?? '',
    scientificName: crop?.scientificName ?? '',
    group: crop?.group ?? 'CEREAL',
    color: crop?.color ?? DEFAULT_CROP_COLOR,
    icon: crop?.icon ?? '',
    priaCode: crop?.priaCode ?? '',
    seedRate: numStr(crop?.defaultSeedRateKgHa),
    yieldT: numStr(crop?.defaultYieldTonsHa),
    description: crop?.description ?? '',
    isWinterCrop: crop?.isWinterCrop ?? false,
    gddBaseC: crop?.gddBaseC ?? 5,
    priaName: crop?.priaName ?? '',
    priaUndersowing: crop?.priaUndersowing ?? false
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
      isWinterCrop: d.isWinterCrop,
      gddBaseC: d.gddBaseC ?? 5,
      priaName: textOrNull(d.priaName),
      priaUndersowing: d.priaUndersowing
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
    <Card asChild variant="tile" padding="sm" className="admin-subform"><form className="admin-form" onSubmit={submit}>
      <h3>{crop ? `Muuda kultuuri: ${crop.name}` : 'Uus kultuur'}</h3>
      {error && <div className="alert-box error">{error}</div>}
      <div className="admin-form-grid">
        <Field htmlFor="cc-name" label="Nimi *">
          <Input id="cc-name" value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={100} required />
        </Field>
        <Field htmlFor="cc-sci" label="Ladinakeelne nimi">
          <Input id="cc-sci" value={d.scientificName} onChange={(e) => set('scientificName', e.target.value)} maxLength={200} />
        </Field>
        <Field htmlFor="cc-group" label="Kultuurirühm">
          <Select id="cc-group" value={d.group} onValueChange={(v) => set('group', v as CropGroup)} options={(Object.keys(CROP_GROUP_LABELS) as CropGroup[]).map((g) => ({ value: g, label: CROP_GROUP_LABELS[g] }))} />
        </Field>
        <Field htmlFor="cc-color" label="Värv">
          <input id="cc-color" className="admin-color-input" type="color" value={d.color} onChange={(e) => set('color', e.target.value)} />
        </Field>
        <Field htmlFor="cc-pria" label="PRIA kood">
          <Input id="cc-pria" value={d.priaCode} onChange={(e) => set('priaCode', e.target.value)} maxLength={50} />
        </Field>
        <Field htmlFor="cc-icon" label="Ikoon">
          <Input id="cc-icon" value={d.icon} onChange={(e) => set('icon', e.target.value)} maxLength={100} />
        </Field>
        <Field htmlFor="cc-seed" label="Külvinorm (kg/ha)">
          <NumberInput id="cc-seed" min={0} value={numOrNull(d.seedRate)} onChange={(v) => set('seedRate', numStr(v))} />
        </Field>
        <Field htmlFor="cc-yield" label="Saagikus (t/ha)">
          <NumberInput id="cc-yield" min={0} value={numOrNull(d.yieldT)} onChange={(v) => set('yieldT', numStr(v))} />
        </Field>
      </div>
      <Field htmlFor="cc-desc" label="Kirjeldus">
        <Textarea id="cc-desc" rows={2} value={d.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
      </Field>
      <Field htmlFor="cc-pria-name" label="PRIA nimetus">
        <Input id="cc-pria-name" value={d.priaName} onChange={(e) => set('priaName', e.target.value)} maxLength={300} placeholder={d.name} />
      </Field>
      <Field htmlFor="cc-gdd" label="GDD baastemperatuur (°C)">
        <NumberInput id="cc-gdd" min={0} max={15} value={d.gddBaseC} onChange={(v) => set('gddBaseC', v)} />
      </Field>
      <Check label="Talikultuur" checked={d.isWinterCrop} onChange={(v) => set('isWinterCrop', v)} />
      <Check label="PRIA eristab allakülvi" checked={d.priaUndersowing} onChange={(v) => set('priaUndersowing', v)} />
      <div className="admin-actions">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Salvestan…' : 'Salvesta'}</Button>
        <Button onClick={onCancel} disabled={busy}>Tühista</Button>
      </div>
    </form></Card>
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
    <Card asChild variant="tile" padding="sm" className="admin-subform"><form className="admin-form" onSubmit={submit}>
      <h3>{variety ? `Muuda sorti: ${variety.name}` : 'Uus sort'}</h3>
      {error && <div className="alert-box error">{error}</div>}
      <div className="admin-form-grid">
        <Field htmlFor="cv-name" label="Nimi *">
          <Input id="cv-name" value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={100} required />
        </Field>
        <Field htmlFor="cv-breeder" label="Aretaja">
          <Input id="cv-breeder" value={d.breeder} onChange={(e) => set('breeder', e.target.value)} maxLength={200} />
        </Field>
        <Field htmlFor="cv-mat" label="Valmimisaeg">
          <Input id="cv-mat" value={d.maturityDays} onChange={(e) => set('maturityDays', e.target.value)} maxLength={100} />
        </Field>
        <Field htmlFor="cv-wh" label="Talvekindlus">
          <Input id="cv-wh" value={d.winterHardiness} onChange={(e) => set('winterHardiness', e.target.value)} maxLength={100} />
        </Field>
        <Field htmlFor="cv-seed" label="Soovitatav külvinorm (kg/ha)">
          <NumberInput id="cv-seed" min={0} value={numOrNull(d.seedRate)} onChange={(v) => set('seedRate', numStr(v))} />
        </Field>
        <Field htmlFor="cv-yield" label="Potentsiaalne saagikus (t/ha)">
          <NumberInput id="cv-yield" min={0} value={numOrNull(d.yieldT)} onChange={(v) => set('yieldT', numStr(v))} />
        </Field>
        <Field htmlFor="cv-q" label="Kvaliteediklass">
          <Input id="cv-q" value={d.qualityClass} onChange={(e) => set('qualityClass', e.target.value)} maxLength={100} />
        </Field>
      </div>
      <Field htmlFor="cv-notes" label="Märkused">
        <Textarea id="cv-notes" rows={2} value={d.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} />
      </Field>
      <Check label="Aktiivne" checked={d.isActive} onChange={(v) => set('isActive', v)} />
      <div className="admin-actions">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Salvestan…' : 'Salvesta'}</Button>
        <Button onClick={onCancel} disabled={busy}>Tühista</Button>
      </div>
    </form></Card>
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
        <Button size="sm" onClick={() => setEditing('new')}>Lisa sort</Button>
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
      <Table>
        <TableHeader>
          <TableRow><TableHead>Nimi</TableHead><TableHead>Aretaja</TableHead><TableHead>Valmimisaeg</TableHead><TableHead>Talvekindlus</TableHead><TableHead>Aktiivne</TableHead><TableHead/></TableRow>
        </TableHeader>
        <TableBody>
          {crop.varieties.map((v) => (
            <TableRow key={v.id}>
              <TableCell>{v.name}</TableCell>
              <TableCell>{v.breeder ?? '–'}</TableCell>
              <TableCell>{v.maturityDays ?? '–'}</TableCell>
              <TableCell>{v.winterHardiness ?? '–'}</TableCell>
              <TableCell>{yesNo(v.isActive)}</TableCell>
              <TableCell><div className="admin-row-actions">
                <Button size="sm" onClick={() => setEditing(v)}>Muuda</Button>
                <Button variant="danger" size="sm" onClick={() => void remove(v)}>Kustuta</Button>
              </div></TableCell>
            </TableRow>
          ))}
          {crop.varieties.length === 0 && <TableEmpty colSpan={6}>Sorte pole</TableEmpty>}
        </TableBody>
      </Table>
    </div>
  );
}

function CropsTab({ data, reload }: { data: CatalogData; reload: () => void }) {
  const [editing, setEditing] = useState<CatalogCrop | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const remove = async (c: CatalogCrop) => {
    if (!window.confirm(`Kustutad kultuuri „${c.name}“? Sordid kustuvad koos sellega.`)) return;
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
        <Button variant="primary" size="sm" onClick={() => setEditing('new')}>Lisa kultuur</Button>
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
      <Table>
        <TableHeader>
          <TableRow><TableHead>Nimi</TableHead><TableHead>Ladinakeelne nimi</TableHead><TableHead>Rühm</TableHead><TableHead>Värv</TableHead><TableHead>PRIA kood</TableHead><TableHead>Talivili</TableHead><TableHead numeric>Sorte</TableHead><TableHead/></TableRow>
        </TableHeader>
        <TableBody>
          {data.crops.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.scientificName ?? '–'}</TableCell>
              <TableCell>{CROP_GROUP_LABELS[c.group] ?? c.group}</TableCell>
              <TableCell><span className="admin-swatch" style={{ background: c.color }} title={c.color} /></TableCell>
              <TableCell>{c.priaCode ?? '–'}</TableCell>
              <TableCell>{yesNo(c.isWinterCrop)}</TableCell>
              <TableCell numeric>{c.varieties.length}</TableCell>
              <TableCell><div className="admin-row-actions">
                <Button size="sm" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                  {openId === c.id ? 'Peida sordid' : 'Sordid'}
                </Button>
                <Button size="sm" onClick={() => setEditing(c)}>Muuda</Button>
                <Button variant="danger" size="sm" onClick={() => void remove(c)}>Kustuta</Button>
              </div></TableCell>
            </TableRow>
          ))}
          {data.crops.length === 0 && <TableEmpty colSpan={8}>Kultuure pole</TableEmpty>}
        </TableBody>
      </Table>
      {open && <VarietiesPanel key={open.id} crop={open} onChanged={reload} />}
    </div>
  );
}

// ---- Tööliigid ----

interface WorkTypeDraft {
  name: string;
  phase: WorkPhase;
  usesMaterials: boolean;
  sortOrder: string;
  isActive: boolean;
}

function WorkTypeForm({ wt, nextOrder, onSaved, onCancel }: { wt: CatalogWorkType | null; nextOrder: number; onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<WorkTypeDraft>({
    name: wt?.name ?? '',
    phase: wt?.phase ?? 'CARE',
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
    <Card asChild variant="tile" padding="sm" className="admin-subform"><form className="admin-form" onSubmit={submit}>
      <h3>{wt ? `Muuda tööliiki: ${wt.name}` : 'Uus tööliik'}</h3>
      {error && <div className="alert-box error">{error}</div>}
      <div className="admin-form-grid">
        <Field htmlFor="wt-name" label="Nimi *">
          <Input id="wt-name" value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={100} required />
        </Field>
        <Field htmlFor="wt-phase" label="Faas">
          <Select id="wt-phase" value={d.phase} onValueChange={(v) => set('phase', v as WorkPhase)} options={(Object.keys(PHASE_LABELS) as WorkPhase[]).map((p) => ({ value: p, label: PHASE_LABELS[p] }))} />
        </Field>
        <Field htmlFor="wt-order" label="Järjekord">
          <NumberInput id="wt-order" min={0} integer value={numOrNull(d.sortOrder)} onChange={(v) => set('sortOrder', numStr(v))} />
        </Field>
      </div>
      <div className="admin-checks">
        <Check label="Kasutab kulumaterjale" checked={d.usesMaterials} onChange={(v) => set('usesMaterials', v)} />
        <Check label="Aktiivne" checked={d.isActive} onChange={(v) => set('isActive', v)} />
      </div>
      <div className="admin-actions">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Salvestan…' : 'Salvesta'}</Button>
        <Button onClick={onCancel} disabled={busy}>Tühista</Button>
      </div>
    </form></Card>
  );
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
        <Button variant="primary" size="sm" onClick={() => setEditing('new')}>Lisa tööliik</Button>
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
      <Table>
        <TableHeader>
          <TableRow><TableHead>Nimi</TableHead><TableHead>Faas</TableHead><TableHead>Kulumaterjalid</TableHead><TableHead numeric>Järjekord</TableHead><TableHead>Aktiivne</TableHead><TableHead/></TableRow>
        </TableHeader>
        <TableBody>
          {data.workTypes.map((w) => (
            <TableRow key={w.id}>
              <TableCell>{w.name}</TableCell>
              <TableCell>{PHASE_LABELS[w.phase] ?? w.phase}</TableCell>
              <TableCell>{yesNo(w.usesMaterials)}</TableCell>
              <TableCell numeric>{w.sortOrder}</TableCell>
              <TableCell>{yesNo(w.isActive)}</TableCell>
              <TableCell><div className="admin-row-actions">
                <Button size="sm" onClick={() => setEditing(w)}>Muuda</Button>
                <Button variant="danger" size="sm" onClick={() => void remove(w)}>Kustuta</Button>
              </div></TableCell>
            </TableRow>
          ))}
          {data.workTypes.length === 0 && <TableEmpty colSpan={6}>Tööliike pole</TableEmpty>}
        </TableBody>
      </Table>
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
    <Card className="admin-card">
      <h2>Algkataloog</h2>
      <div className="alert-box info">Algkataloogi muudatused kehtivad ainult edaspidi loodavatele ettevõtetele.</div>
      <div className="admin-nav">
        {([['crops', 'Kultuurid'], ['workTypes', 'Tööliigid']] as [Tab, string][]).map(([k, l]) => (
          <Button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {l}
          </Button>
        ))}
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {!data && !error && <div className="admin-muted">Laadin…</div>}
      {data && tab === 'crops' && <CropsTab data={data} reload={reload} />}
      {data && tab === 'workTypes' && <WorkTypesTab data={data} reload={reload} />}
    </Card>
  );
}
