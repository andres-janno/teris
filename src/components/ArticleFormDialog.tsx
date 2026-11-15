// src/components/ArticleFormDialog.tsx — artikli lisamine/muutmine (Artiklite leht ja Tööde register)
import React, { useEffect, useState } from 'react';
import { Edit2 } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import type { Article, ArticleCategory } from '../types/fieldWork';
import type { Warehouse } from '../types/stock';
import { ARTICLE_GROUPS, ARTICLE_GROUP_LABEL, articleFieldRules, sanitizeArticleFields, type ArticleSystemKind } from '../services/articleRules';
import { convertQty } from '../services/units';
import { SEED_REGISTERS, SEED_CATEGORIES, FERTILIZER_REGISTERS, LIMING_REGISTERS, PLANT_PROTECTION_REGISTERS } from '../services/pria';
import {
  Button, CheckboxField, Dialog, DialogBody, DialogContent, DialogFooter, DialogForm, DialogHeader, Field, FormGrid, Input, NumberInput, Select, Textarea
} from './ui';

// Kordusteta (tõstutundetult) ja tähestiku järjekorras
const distinctValues = (values: (string | null | undefined)[]) => {
  const byKey = new Map<string, string>();
  for (const raw of values) {
    const v = raw?.trim();
    if (v && !byKey.has(v.toLowerCase())) byKey.set(v.toLowerCase(), v);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'et'));
};

// PRIA registrid artikli süsteemse liigi järgi (väetisel ka lubiväetised)
const REGISTERS: Partial<Record<ArticleSystemKind, readonly string[]>> = {
  SEED: SEED_REGISTERS,
  FERTILIZER: [...new Set([...FERTILIZER_REGISTERS, ...LIMING_REGISTERS])],
  PLANT_PROTECTION: PLANT_PROTECTION_REGISTERS
};
const NUTRIENTS = [['nPct', 'N'], ['pPct', 'P'], ['kPct', 'K']] as const;
type NutrientKey = (typeof NUTRIENTS)[number][0];

const fmtPct = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('et-EE', { maximumFractionDigits: 3, useGrouping: false }));

interface ArticleFormDialogProps {
  initial: Partial<Article>;
  onClose: () => void;
  onSaved: () => void;
  canManageFinance: boolean;
}

export const ArticleFormDialog: React.FC<ArticleFormDialogProps> = ({ initial, onClose, onSaved, canManageFinance }) => {
  const [form, setForm] = useState<Partial<Article>>(initial);
  const [busy, setBusy] = useState(false);
  // Tootja ja ühiku valikud: teistel materjalidel kasutatud väärtused; uus väärtus lisandub salvestamisel
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [all, setAll] = useState<Article[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [crops, setCrops] = useState<{ id: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [price, setPrice] = useState<number | null>(initial.price ?? null);
  const cat = categories.find((c) => c.id === form.categoryId);
  const rules = cat ? articleFieldRules(cat.group, cat.systemKind) : null;
  const isTimeService = cat?.group === 'SERVICE' && ['LABOR_TIME', 'MACHINE_TIME', 'IMPLEMENT_TIME', 'DRYING_TIME'].includes(cat.systemKind ?? '');
  const registers = rules?.pria && cat?.systemKind ? REGISTERS[cat.systemKind] : undefined;
  // Ühiku muutmisel teisendustegur: 1 vana ühik = tegur uut ühikut (kaaluühikutel automaatne)
  const [unitFactor, setUnitFactor] = useState<number | null>(null);
  const unitChanged = !!initial.id && !!initial.unit && !!form.unit?.trim() && initial.unit.trim().toLowerCase() !== form.unit.trim().toLowerCase();
  const autoFactor = unitChanged ? convertQty(1, initial.unit!, form.unit!) : null;
  const [pct, setPct] = useState<Record<NutrientKey, number | null>>({
    nPct: initial.nPct ?? null, pPct: initial.pPct ?? null, kPct: initial.kPct ?? null
  });

  useEffect(() => {
    api.getArticles()
      .then((ms) => {
        setManufacturers(distinctValues(ms.map((m) => m.manufacturer)));
        setUnits(distinctValues(ms.map((m) => m.unit)));
        setAll(ms);
      })
      .catch(() => {
        setManufacturers([]);
        setUnits([]);
      });
    api.getArticleCategories().then(setCategories).catch(() => setCategories([]));
    api.getCrops().then((cs) => setCrops(cs.map((c) => ({ id: c.id, name: c.name })))).catch(() => setCrops([]));
    api.getWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    // Liigiga mittesobivad väljad tühjendatakse (nt liigi muutmisel)
    if (!rules) return alertDialog('Vali kategooria');
    const payload: Partial<Article> & { unitFactor?: number | null } = {
      ...form,
      ...sanitizeArticleFields({
        price: rules.price && canManageFinance ? price : (form.price ?? null), cropId: form.cropId ?? null, defaultWarehouseId: form.defaultWarehouseId ?? null,
        cropVarietyId: form.cropVarietyId ?? null, priaRegister: form.priaRegister || null, priaKind: form.priaKind || null,
        priaSpec: form.priaSpec || null, activeIngredient: form.activeIngredient || null,
        nPct: pct.nPct, pPct: pct.pPct, kPct: pct.kPct
      }, rules),
      isDefaultService: isTimeService && !!form.isDefaultService,
      unitFactor: unitChanged ? unitFactor ?? autoFactor : null
    };
    if (unitChanged && payload.unitFactor != null && !(payload.unitFactor > 0)) return alertDialog('Teisendustegur peab olema suurem kui 0');
    setBusy(true);
    try {
      try {
        await api.saveArticle(payload);
      } catch (err: any) {
        if (!err?.body?.needsConfirm) throw err;
        if (!(await confirmDialog(`${err.message} Kas muudan ühiku ikkagi?`))) return;
        await api.saveArticle(payload, true);
      }
      onSaved();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Artikli salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md" className="article-form-modal" dismissible={!busy}>
        <DialogForm onSubmit={save}>
        <DialogHeader icon={<Edit2 size={20} className="text-emerald" />} title={form.id ? `Muuda artiklit: ${initial.name}` : 'Lisa artikkel'} />
        <DialogBody className="article-form-body">
          <FormGrid>
            <Field span="full" label="Nimi *" htmlFor="mt-name">
              <Input id="mt-name" required placeholder="nt YaraMila 16-27-7" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field span="full" label="Tootja" htmlFor="mt-manufacturer">
              <Input id="mt-manufacturer" list="article-manufacturers" placeholder="vali olemasolev või sisesta uus" value={form.manufacturer ?? ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              <datalist id="article-manufacturers">{manufacturers.map((m) => <option key={m} value={m} />)}</datalist>
            </Field>
            <Field label="Kategooria *" htmlFor="mt-cat">
              <Select
                id="mt-cat"
                required
                disabled={!!initial?.isDefaultService}
                placeholder="– vali –"
                value={form.categoryId ?? ''}
                onValueChange={(v) => {
                  const c = categories.find((x) => x.id === v);
                  setForm({ ...form, categoryId: v, unit: form.unit || (c?.group === 'SERVICE' ? 'h' : form.unit) });
                }}
                options={ARTICLE_GROUPS.flatMap((g) => categories
                  .filter((c) => c.group === g && (c.isActive || c.id === form.categoryId))
                  .map((c) => ({ value: c.id, label: c.name, group: ARTICLE_GROUP_LABEL[g] })))}
              />
            </Field>
            <Field label="Ühik *" htmlFor="mt-unit">
              <Input id="mt-unit" required list="article-units" placeholder="vali olemasolev või sisesta uus" value={form.unit ?? ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <datalist id="article-units">{units.map((u) => <option key={u} value={u} />)}</datalist>
            </Field>
            {rules?.price && canManageFinance && (
              <Field label={`Hind (€ / ${form.unit || 'ühik'})`} htmlFor="mt-price">
                <NumberInput id="mt-price" decimals={4} value={price} onChange={setPrice} />
              </Field>
            )}
            {isTimeService && (
              <CheckboxField
                checked={!!form.isDefaultService}
                disabled={!!initial?.isDefaultService}
                onCheckedChange={(v) => setForm({ ...form, isDefaultService: v })}
                label="Vaikimisi teenus"
                hint="Kanne kasutab seda teenust, kui töötajal, masinal või haakeriistal pole oma teenust"
              />
            )}
            {rules?.crop && (
              <Field label="Kultuur" htmlFor="mt-crop">
                <Select id="mt-crop" value={form.cropId ?? ''} onValueChange={(v) => setForm({ ...form, cropId: v || null })}
                  options={[{ value: '', label: '–' }, ...crops.map((c) => ({ value: c.id, label: c.name }))]} />
              </Field>
            )}
            {rules?.defaultWarehouse && (
              <Field label="Vaikimisi ladu" htmlFor="mt-wh">
                <Select id="mt-wh" value={form.defaultWarehouseId ?? ''} onValueChange={(v) => setForm({ ...form, defaultWarehouseId: v || null })}
                  options={[
                    { value: '', label: 'Kande ladu' },
                    ...warehouses.filter((w) => (w.isActive && !w.fieldId) || w.id === form.defaultWarehouseId).map((w) => ({ value: w.id, label: w.name }))
                  ]} />
              </Field>
            )}
            {unitChanged && (
              <Field
                span="full"
                label={`Teisendus: 1 ${initial.unit} = ? ${form.unit}`}
                htmlFor="mt-unit-factor"
                hint={`Kanded, plaanid ja laokanded teisendatakse uude ühikusse, rahaline väärtus ei muutu.${autoFactor == null ? ' Teisendusteguriga muudetakse ka laokannetega materjali ühik.' : ''}`}
              >
                <NumberInput
                  id="mt-unit-factor"
                  decimals={6}
                  placeholder={autoFactor != null ? fmtPct(autoFactor) : `mitu ${form.unit} on üks ${initial.unit}`}
                  value={unitFactor}
                  onChange={setUnitFactor}
                />
              </Field>
            )}
            {registers && (
              <>
                <div className="form-section-title" title="Täidavad plaani ja kande rea materjali valimisel">PRIA andmed</div>
                <Field span="full" label="PRIA register" htmlFor="mt-pria-register">
                  <Select id="mt-pria-register" value={form.priaRegister ?? ''} onValueChange={(v) => setForm({ ...form, priaRegister: v })}
                    options={[
                      { value: '', label: '–' },
                      ...registers.map((x) => ({ value: x, label: x })),
                      ...(form.priaRegister && !registers.includes(form.priaRegister) ? [{ value: form.priaRegister, label: form.priaRegister }] : [])
                    ]} />
                </Field>
                <Field label="PRIA täpsustus" htmlFor="mt-pria-kind">
                  <Input id="mt-pria-kind" list="article-pria-kinds" placeholder={rules?.seed ? 'nt Taliraps' : rules?.fertilizer ? 'nt NPK väetis' : 'nt Herbitsiid'} value={form.priaKind ?? ''} onChange={(e) => setForm({ ...form, priaKind: e.target.value })} />
                  <datalist id="article-pria-kinds">{distinctValues(all.filter((m) => m.categoryId === form.categoryId).map((m) => m.priaKind)).map((k) => <option key={k} value={k} />)}</datalist>
                </Field>
                {rules?.seed && (
                  <Field label="PRIA spetsifikatsioon" htmlFor="mt-pria-spec">
                    <Select id="mt-pria-spec" value={form.priaSpec ?? ''} onValueChange={(v) => setForm({ ...form, priaSpec: v })}
                      options={[{ value: '', label: '–' }, ...SEED_CATEGORIES.map((x) => ({ value: x, label: x }))]} />
                  </Field>
                )}
                {rules?.plantProtection && (
                  <Field label="Toimeaine" htmlFor="mt-active">
                    <Input id="mt-active" value={form.activeIngredient ?? ''} onChange={(e) => setForm({ ...form, activeIngredient: e.target.value })} />
                  </Field>
                )}
                {rules?.fertilizer && (
                  <Field label={<span title="PRIA arvestab P ja K elemendina, mitte P₂O₅ / K₂O">Sisaldus % (N / P / K elemendina)</span>}>
                    <div className="article-npk-inputs">
                      {NUTRIENTS.map(([k, label]) => (
                        <NumberInput key={k} decimals={3} aria-label={`${label} %`} placeholder={label} value={pct[k]} onChange={(n) => setPct({ ...pct, [k]: n })} />
                      ))}
                    </div>
                  </Field>
                )}
              </>
            )}
            <Field span="full" label="Koostisosad" htmlFor="mt-composition">
              <Textarea id="mt-composition" autosize rows={2} placeholder="nt toimeained ja sisaldus, N-P-K" value={form.composition ?? ''} onChange={(e) => setForm({ ...form, composition: e.target.value })} />
            </Field>
            <Field span="full" label="Märkus" htmlFor="mt-notes">
              <Textarea id="mt-notes" autosize rows={2} placeholder="nt ERP tootekood" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Field span="full">
              <CheckboxField
                checked={form.isActive ?? true}
                disabled={!!initial?.isDefaultService}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                label="Aktiivne (kannetes valitav)"
              />
            </Field>
          </FormGrid>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Loobu</Button>
          <Button type="submit" variant="primary" disabled={busy}>Salvesta</Button>
        </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
};
