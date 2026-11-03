// src/components/ArticleFormDialog.tsx — artikli lisamine/muutmine (Artiklite leht ja Tööde register)
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, X } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import type { Article, ArticleCategory } from '../types/fieldWork';
import type { Warehouse } from '../types/stock';
import { ARTICLE_GROUPS, ARTICLE_GROUP_LABEL, articleFieldRules, sanitizeArticleFields, type ArticleSystemKind } from '../services/articleRules';
import { convertQty } from '../services/units';
import { SEED_REGISTERS, SEED_CATEGORIES, FERTILIZER_REGISTERS, LIMING_REGISTERS, PLANT_PROTECTION_REGISTERS } from '../services/pria';

// Tekstiväli kasvab sisu järgi; field-sizing'ut mittetoetavas brauseris seatakse kõrgus käsitsi
const autoGrow = (el: HTMLTextAreaElement | null) => {
  if (!el || CSS.supports('field-sizing', 'content')) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight + 2, 320)}px`;
};

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

const parsePct = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};
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
  const [priceText, setPriceText] = useState(fmtPct(initial.price));
  const cat = categories.find((c) => c.id === form.categoryId);
  const rules = cat ? articleFieldRules(cat.group, cat.systemKind) : null;
  const isTimeService = cat?.group === 'SERVICE' && ['LABOR_TIME', 'MACHINE_TIME', 'IMPLEMENT_TIME', 'DRYING_TIME'].includes(cat.systemKind ?? '');
  const registers = rules?.pria && cat?.systemKind ? REGISTERS[cat.systemKind] : undefined;
  // Sisalduse % tekstina, et komaga arvu (nt "8,") saaks sisestada
  // Ühiku muutmisel teisendustegur: 1 vana ühik = tegur uut ühikut (kaaluühikutel automaatne)
  const [unitFactor, setUnitFactor] = useState('');
  const unitChanged = !!initial.id && !!initial.unit && !!form.unit?.trim() && initial.unit.trim().toLowerCase() !== form.unit.trim().toLowerCase();
  const autoFactor = unitChanged ? convertQty(1, initial.unit!, form.unit!) : null;
  const [pct, setPct] = useState<Record<NutrientKey, string>>({
    nPct: fmtPct(initial.nPct), pPct: fmtPct(initial.pPct), kPct: fmtPct(initial.kPct)
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    // Liigiga mittesobivad väljad tühjendatakse (nt liigi muutmisel)
    if (!rules) return alertDialog('Vali kategooria');
    const payload: Partial<Article> & { unitFactor?: number | null } = {
      ...form,
      ...sanitizeArticleFields({
        price: rules.price && canManageFinance ? parsePct(priceText) : (form.price ?? null), cropId: form.cropId ?? null, defaultWarehouseId: form.defaultWarehouseId ?? null,
        cropVarietyId: form.cropVarietyId ?? null, priaRegister: form.priaRegister || null, priaKind: form.priaKind || null,
        priaSpec: form.priaSpec || null, activeIngredient: form.activeIngredient || null,
        nPct: parsePct(pct.nPct), pPct: parsePct(pct.pPct), kPct: parsePct(pct.kPct)
      }, rules),
      isDefaultService: isTimeService && !!form.isDefaultService,
      unitFactor: unitChanged ? parsePct(unitFactor) ?? autoFactor : null
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

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <form className="modal-content animate-scale-up work-form-modal article-form-modal" onSubmit={save}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Edit2 size={20} className="text-emerald" />
            <h3>{form.id ? `Muuda artiklit: ${initial.name}` : 'Lisa artikkel'}</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="mt-name">Nimi *</label>
              <input id="mt-name" className="form-input" required placeholder="nt YaraMila 16-27-7" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="mt-manufacturer">Tootja</label>
              <input id="mt-manufacturer" className="form-input" list="article-manufacturers" placeholder="vali olemasolev või sisesta uus" value={form.manufacturer ?? ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              <datalist id="article-manufacturers">{manufacturers.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <div className="form-group">
              <label htmlFor="mt-cat">Kategooria *</label>
              <select id="mt-cat" className="form-input" required disabled={!!initial?.isDefaultService} value={form.categoryId ?? ''} onChange={(e) => {
                const c = categories.find((x) => x.id === e.target.value);
                setForm({ ...form, categoryId: e.target.value, unit: form.unit || (c?.group === 'SERVICE' ? 'h' : form.unit) });
              }}>
                <option value="" disabled>– vali –</option>
                {ARTICLE_GROUPS.map((g) => {
                  const list = categories.filter((c) => c.group === g && (c.isActive || c.id === form.categoryId));
                  return list.length ? (
                    <optgroup key={g} label={ARTICLE_GROUP_LABEL[g]}>
                      {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="mt-unit">Ühik *</label>
              <input id="mt-unit" className="form-input" required list="article-units" placeholder="vali olemasolev või sisesta uus" value={form.unit ?? ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <datalist id="article-units">{units.map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            {rules?.price && canManageFinance && (
              <div className="form-group">
                <label htmlFor="mt-price">Hind (€ / {form.unit || 'ühik'})</label>
                <input id="mt-price" className="form-input num" inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
              </div>
            )}
            {isTimeService && (
              <label className="users-admin-checkbox" title="Kanne kasutab seda teenust, kui töötajal, masinal või haakeriistal pole oma teenust">
                <input type="checkbox" checked={!!form.isDefaultService} disabled={!!initial?.isDefaultService}
                  onChange={(e) => setForm({ ...form, isDefaultService: e.target.checked })} />
                <span>Vaikimisi teenus</span>
              </label>
            )}
            {rules?.crop && (
              <div className="form-group">
                <label htmlFor="mt-crop">Kultuur</label>
                <select id="mt-crop" className="form-input" value={form.cropId ?? ''} onChange={(e) => setForm({ ...form, cropId: e.target.value || null })}>
                  <option value="">–</option>
                  {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {rules?.defaultWarehouse && (
              <div className="form-group">
                <label htmlFor="mt-wh" title="Kust kaup vaikimisi maha kantakse (nt kütus mahutist)">Vaikimisi ladu</label>
                <select id="mt-wh" className="form-input" value={form.defaultWarehouseId ?? ''} onChange={(e) => setForm({ ...form, defaultWarehouseId: e.target.value || null })}>
                  <option value="">Kande ladu</option>
                  {warehouses.filter((w) => w.isActive || w.id === form.defaultWarehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
            {unitChanged && (
              <div className="form-group full-width">
                <label htmlFor="mt-unit-factor">Teisendus: 1 {initial.unit} = ? {form.unit}</label>
                <input
                  id="mt-unit-factor"
                  className="form-input num"
                  inputMode="decimal"
                  placeholder={autoFactor != null ? fmtPct(autoFactor) : `mitu ${form.unit} on üks ${initial.unit}`}
                  value={unitFactor}
                  onChange={(e) => setUnitFactor(e.target.value)}
                />
                <small className="work-entry-hint">
                  Kanded, plaanid ja laokanded teisendatakse uude ühikusse, rahaline väärtus ei muutu.
                  {autoFactor == null && ' Teisendusteguriga muudetakse ka laokannetega materjali ühik.'}
                </small>
              </div>
            )}
            {registers && (
              <>
                <div className="form-section-title" title="Täidavad plaani ja kande rea materjali valimisel">PRIA andmed</div>
                <div className="form-group full-width">
                  <label htmlFor="mt-pria-register">PRIA register</label>
                  <select id="mt-pria-register" className="form-input" value={form.priaRegister ?? ''} onChange={(e) => setForm({ ...form, priaRegister: e.target.value })}>
                    <option value="">–</option>
                    {registers.map((x) => <option key={x} value={x}>{x}</option>)}
                    {form.priaRegister && !registers.includes(form.priaRegister) && <option value={form.priaRegister}>{form.priaRegister}</option>}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="mt-pria-kind">PRIA täpsustus</label>
                  <input id="mt-pria-kind" className="form-input" list="article-pria-kinds" placeholder={rules?.seed ? 'nt Taliraps' : rules?.fertilizer ? 'nt NPK väetis' : 'nt Herbitsiid'} value={form.priaKind ?? ''} onChange={(e) => setForm({ ...form, priaKind: e.target.value })} />
                  <datalist id="article-pria-kinds">{distinctValues(all.filter((m) => m.categoryId === form.categoryId).map((m) => m.priaKind)).map((k) => <option key={k} value={k} />)}</datalist>
                </div>
                {rules?.seed && (
                  <div className="form-group">
                    <label htmlFor="mt-pria-spec">PRIA spetsifikatsioon</label>
                    <select id="mt-pria-spec" className="form-input" value={form.priaSpec ?? ''} onChange={(e) => setForm({ ...form, priaSpec: e.target.value })}>
                      <option value="">–</option>
                      {SEED_CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                )}
                {rules?.plantProtection && (
                  <div className="form-group">
                    <label htmlFor="mt-active">Toimeaine</label>
                    <input id="mt-active" className="form-input" value={form.activeIngredient ?? ''} onChange={(e) => setForm({ ...form, activeIngredient: e.target.value })} />
                  </div>
                )}
                {rules?.fertilizer && (
                  <div className="form-group">
                    <label title="PRIA arvestab P ja K elemendina, mitte P₂O₅ / K₂O">Sisaldus % (N / P / K elemendina)</label>
                    <div className="article-npk-inputs">
                      {NUTRIENTS.map(([k, label]) => (
                        <input key={k} className="form-input num" inputMode="decimal" aria-label={`${label} %`} placeholder={label} value={pct[k]} onChange={(e) => setPct({ ...pct, [k]: e.target.value })} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="form-group full-width">
              <label htmlFor="mt-composition">Koostisosad</label>
              <textarea id="mt-composition" ref={autoGrow} rows={2} className="form-input auto-resize-textarea" placeholder="nt toimeained ja sisaldus, N-P-K" value={form.composition ?? ''} onChange={(e) => { autoGrow(e.target); setForm({ ...form, composition: e.target.value }); }} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="mt-notes">Märkus</label>
              <textarea id="mt-notes" ref={autoGrow} rows={2} className="form-input auto-resize-textarea" placeholder="nt ERP tootekood" value={form.notes ?? ''} onChange={(e) => { autoGrow(e.target); setForm({ ...form, notes: e.target.value }); }} />
            </div>
            <label className="users-admin-checkbox full-width">
              <input type="checkbox" checked={form.isActive ?? true} disabled={!!initial?.isDefaultService} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>Aktiivne (kannetes valitav)</span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Loobu</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
        </div>
      </form>
    </div>,
    document.body
  );
};
