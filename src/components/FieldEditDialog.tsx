// src/components/FieldEditDialog.tsx — põllu põhiandmete ja valitud hooaja kirje muutmise aken
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Edit2, Trash2, Lock, Landmark, Compass, ExternalLink, Info } from 'lucide-react';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import type { FieldCadastralLink, LandTenureType } from '../types/cadastre';
import type { RelatedParty } from '../types/party';
import type { Crop } from '../types/crop';
import { confirmDialog, alertDialog } from './ConfirmDialog';

// Väljad, mis hakkavad tulema Maa- ja Ruumiameti andmetest põllu kuju järgi (praegu ainult vaatamiseks).
const SOIL_AUTO_HINT = 'Täidetakse hiljem automaatselt Maa- ja Ruumiameti mullastiku kaardi põhjal (põllu kuju järgi).';
const DRAINAGE_AUTO_HINT = 'Täidetakse hiljem automaatselt Maa- ja Ruumiameti maaparandussüsteemide andmete põhjal (põllu kuju järgi).';

interface FieldEditDialogProps {
  field: MasterField;
  selectedYear: number;
  seasons?: FarmingSeason[];
  parties?: RelatedParty[];
  onOpenParties?: () => void;
  crops?: Crop[];
  onOpenCrops?: () => void;
  onUpdateField: (fieldId: number | string, fieldData: Partial<MasterField>, seasonData?: FieldYearlyRecord) => void;
  onClose: () => void;
}

export const FieldEditDialog: React.FC<FieldEditDialogProps> = ({
  field,
  selectedYear,
  seasons = [],
  parties = [],
  onOpenParties,
  crops = [],
  onOpenCrops,
  onUpdateField,
  onClose
}) => {
  // Edit form state: Master Field details
  const [editName, setEditName] = useState('');
  const [editNum, setEditNum] = useState('');
  const [editFieldCode, setEditFieldCode] = useState('');
  const [editCadastralCode, setEditCadastralCode] = useState('');
  const [editOperatorId, setEditOperatorId] = useState('');
  const [editSoilType, setEditSoilType] = useState('');
  const [editCadastralParcels, setEditCadastralParcels] = useState<FieldCadastralLink[]>([]);

  // Edit form state: Yearly details
  const editYear = selectedYear;
  const [editAreaHa, setEditAreaHa] = useState<number>(0);
  const [editEligibleAreaHa, setEditEligibleAreaHa] = useState<number | undefined>(undefined);
  const [editAreaChangeReason, setEditAreaChangeReason] = useState('');
  const [editCrop, setEditCrop] = useState('');
  const [editCropColor, setEditCropColor] = useState('#eab308');
  const [editVariety, setEditVariety] = useState('');
  const [editTargetYield, setEditTargetYield] = useState<number | undefined>(undefined);
  const [editActualYield, setEditActualYield] = useState<number | undefined>(undefined);
  const [editNotes, setEditNotes] = useState('');

  // Edit season & locked status
  const editSeason = seasons.find((s) => s.year === selectedYear);
  const isEditSeasonLocked = editSeason?.isLocked ?? false;

  // Kultuuride register (andmebaasist)
  const activeCrops = crops;

  // Sama sisu-põhine sobitus nagu App.tsx resolveCropColor: PRIA tekst
  // ("Punane ristik (...)", "Rukis, v.a ..., allakülvita") seotakse
  // baaskultuuriga, kui see sisaldab registri kultuuri nime.
  const findRegistryCrop = (cropText: string) => {
    const q = cropText.toLowerCase().trim();
    if (!q) return undefined;
    return activeCrops.find((c) => {
      const name = c.name.toLowerCase();
      return name === q || q.includes(name) || name.startsWith(q);
    });
  };

  const selectedCropObj = useMemo(() => findRegistryCrop(editCrop), [activeCrops, editCrop]);

  const availableVarieties = useMemo(() => {
    return selectedCropObj?.varieties || [];
  }, [selectedCropObj]);

  const loadForm = (field: MasterField) => {
    const currentRec = field.history.find(h => h.year === selectedYear) || {
      year: selectedYear,
      areaHa: field.history[0]?.areaHa || 5.0,
      crop: field.history[0]?.crop || 'Talinisu',
      cropColor: field.history[0]?.cropColor || '#eab308'
    };

    const rawParcels = currentRec.cadastralParcels
      ? [...currentRec.cadastralParcels]
      : (field.cadastralParcels ? [...field.cadastralParcels] : []);

    const initialParcels = rawParcels.map(p => ({
      ...p,
      rentFeeEurHa: p.rentFeeEurHa ?? (p.rentFeeEurYear && p.fieldAreaHa > 0 ? Math.round((p.rentFeeEurYear / p.fieldAreaHa) * 10) / 10 : undefined),
      landTaxEurHa: p.landTaxEurHa ?? (p.landTaxEurYear && p.fieldAreaHa > 0 ? Math.round((p.landTaxEurYear / p.fieldAreaHa) * 10) / 10 : undefined)
    }));

    setEditName(field.name);
    setEditNum(field.num || '');
    setEditFieldCode(field.fieldCode);
    setEditCadastralCode(field.cadastralCode || (initialParcels[0]?.cadastralCode) || '');
    setEditOperatorId(field.operatorId || '');
    setEditSoilType(field.soilType || '');
    setEditCadastralParcels(initialParcels);

    const matchedCrop = findRegistryCrop(currentRec.crop);
    setEditAreaHa(currentRec.areaHa);
    setEditEligibleAreaHa(currentRec.eligibleAreaHa || undefined);
    setEditAreaChangeReason(currentRec.areaChangeReason || '');
    setEditCrop(currentRec.crop);
    setEditCropColor(matchedCrop?.color || currentRec.cropColor || '#eab308');
    setEditVariety(currentRec.cropVariety || '');
    setEditTargetYield(currentRec.targetYieldTonsHa || undefined);
    setEditActualYield(currentRec.actualYieldTonsHa || undefined);
    setEditNotes(currentRec.notes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditSeasonLocked) {
      alertDialog(`Hooaeg ${editYear} on suletud ja arhiveeritud. Hooaja andmeid ega katastriüksuseid ei saa muuta.`);
      return;
    }

    const matchedCrop = findRegistryCrop(editCrop);
    const finalCropColor = matchedCrop?.color || selectedCropObj?.color || editCropColor || '#22c55e';

    onUpdateField(
      field.id,
      {
        name: editName.trim() || `Põld ${editNum || field.id}`,
        num: editNum.trim() || undefined,
        fieldCode: editFieldCode.trim(),
        cadastralCode: editCadastralCode.trim() || (editCadastralParcels[0]?.cadastralCode) || undefined,
        operatorId: editOperatorId || undefined,
        soilType: editSoilType.trim() || undefined
      },
      {
        year: editYear,
        areaHa: Number(editAreaHa),
        eligibleAreaHa: editEligibleAreaHa ? Number(editEligibleAreaHa) : undefined,
        areaChangeReason: editAreaChangeReason.trim() || undefined,
        crop: editCrop.trim() || 'Talinisu',
        cropVariety: editVariety.trim() || undefined,
        cropColor: finalCropColor,
        targetYieldTonsHa: editTargetYield ? Number(editTargetYield) : undefined,
        actualYieldTonsHa: editActualYield ? Number(editActualYield) : undefined,
        notes: editNotes.trim() || undefined,
        cadastralParcels: editCadastralParcels
      }
    );

    onClose();
  };

  const handleAddCadastralParcelToEdit = () => {
    if (isEditSeasonLocked) {
      alertDialog(`Hooaeg ${editYear} on suletud/lukustatud. Uute katastriüksuste lisamine on keelatud.`);
      return;
    }

    const defaultHa = Math.round((editAreaHa / (editCadastralParcels.length + 1)) * 100) / 100;

    setEditCadastralParcels([
      ...editCadastralParcels,
      {
        cadastralCode: '',
        parcelName: '',
        ownershipType: 'OWNED',
        ownerName: '',
        fieldAreaHa: defaultHa
      }
    ]);
  };

  const handleRemoveCadastralParcelFromEdit = async (index: number) => {
    if (isEditSeasonLocked) {
      alertDialog(`Hooaeg ${editYear} on suletud/lukustatud. Katastriüksuste kustutamine on keelatud!`);
      return;
    }
    const code = editCadastralParcels[index]?.cadastralCode?.trim();
    if (!await confirmDialog(`Eemaldada katastriüksus${code ? ` ${code}` : ''} põllult ${editYear}. a hooajal?\n\nMuudatus jõustub salvestamisel.`)) return;
    setEditCadastralParcels(editCadastralParcels.filter((_, i) => i !== index));
  };

  const handleUpdateCadastralParcel = (
    index: number,
    updates: Partial<FieldCadastralLink>
  ) => {
    if (isEditSeasonLocked) return;

    setEditCadastralParcels(prev => {
      const copy = [...prev];
      const current = { ...copy[index], ...updates };

      // Kui muutus fieldAreaHa, uuendame kogusummat vastavalt olemasolevale €/ha määrale
      if ('fieldAreaHa' in updates) {
        const area = Number(updates.fieldAreaHa) || 0;
        if (current.ownershipType === 'RENTED' && current.rentFeeEurHa !== undefined) {
          current.rentFeeEurYear = Math.round(current.rentFeeEurHa * area * 100) / 100;
        } else if (current.ownershipType === 'OWNED' && current.landTaxEurHa !== undefined) {
          current.landTaxEurYear = Math.round(current.landTaxEurHa * area * 100) / 100;
        }
      }

      // Kui kasutaja sisestas või muutis €/ha määra
      if ('rentFeeEurHa' in updates) {
        const rate = updates.rentFeeEurHa !== undefined ? Number(updates.rentFeeEurHa) : undefined;
        current.rentFeeEurHa = rate;
        if (rate !== undefined) {
          current.rentFeeEurYear = Math.round(rate * (current.fieldAreaHa || 0) * 100) / 100;
        }
      }

      if ('landTaxEurHa' in updates) {
        const rate = updates.landTaxEurHa !== undefined ? Number(updates.landTaxEurHa) : undefined;
        current.landTaxEurHa = rate;
        if (rate !== undefined) {
          current.landTaxEurYear = Math.round(rate * (current.fieldAreaHa || 0) * 100) / 100;
        }
      }

      // Kui kasutaja sisestas või muutis otse kogusummat (€/a)
      if ('rentFeeEurYear' in updates) {
        const total = updates.rentFeeEurYear !== undefined ? Number(updates.rentFeeEurYear) : undefined;
        current.rentFeeEurYear = total;
        if (total !== undefined && current.fieldAreaHa > 0) {
          current.rentFeeEurHa = Math.round((total / current.fieldAreaHa) * 10) / 10;
        }
      }

      if ('landTaxEurYear' in updates) {
        const total = updates.landTaxEurYear !== undefined ? Number(updates.landTaxEurYear) : undefined;
        current.landTaxEurYear = total;
        if (total !== undefined && current.fieldAreaHa > 0) {
          current.landTaxEurHa = Math.round((total / current.fieldAreaHa) * 10) / 10;
        }
      }

      copy[index] = current;
      return copy;
    });
  };


  // Vorm täidetakse põllu ja valitud hooaja andmetega (ka hooaja vahetamisel)
  useEffect(() => {
    loadForm(field);
  }, [field.id, selectedYear]);

  // Esc sulgeb muutmisakna
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // ei jõua window'ni — alusvaade (nt põllu täisvaade) jääb avatuks
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop sub-modal">
    <form onSubmit={handleSaveEdit} className="modal-content field-edit-modal animate-scale-up">
      <div className="modal-header">
        <div className="modal-title-group">
          {isEditSeasonLocked ? <Lock size={20} className="text-slate-400" /> : <Edit2 size={20} className="text-emerald" />}
          <h3>
            {isEditSeasonLocked ? 'Lukus' : 'Muuda'}: {editNum ? `Nr ${editNum} ` : ''}{editName || `Põld ${field.id}`} · {selectedYear}
          </h3>
        </div>
        <button className="icon-btn-ghost" type="button" onClick={() => onClose()} title="Sulge (Esc)">
          <X size={20} />
        </button>
      </div>

      <div className="modal-body">

      {/* General Master Field Data */}
      <div className="form-sub-header">
        <Landmark size={14} />
        <span>1. Põllu põhiandmed ja massiiv</span>
      </div>
      <div className="form-grid">
        <div className="form-row-3">
          <div className="form-group">
            <label>Põllu nimi (kasutaja määratud) *</label>
            <input
              type="text"
              required
              placeholder="nt Loisu tagune, Kodu põld, Suur põld..."
              disabled={isEditSeasonLocked}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Põllu number (PRIA impordist)</label>
            <input
              type="text"
              placeholder="nt 4, 4-1, 1"
              disabled={isEditSeasonLocked}
              value={editNum}
              onChange={(e) => setEditNum(e.target.value)}
              className="form-input text-right"
            />
          </div>

          <div className="form-group">
            <label>PRIA massiivi number (fieldCode) *</label>
            <input
              type="text"
              required
              placeholder="nt 61144313542"
              disabled={isEditSeasonLocked}
              value={editFieldCode}
              onChange={(e) => setEditFieldCode(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-row-3 field-auto-row">
        <div className="form-group" title={SOIL_AUTO_HINT}>
          <label>
            Mullastiku tüüp <Info size={12} className="auto-field-icon" />
          </label>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            placeholder="Täidetakse hiljem automaatselt"
            value={editSoilType}
            className="form-input auto-field-input"
          />
        </div>

        <div className="form-group" title={DRAINAGE_AUTO_HINT}>
          <label>
            Drenaaž <Info size={12} className="auto-field-icon" />
          </label>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            placeholder="Täidetakse hiljem automaatselt"
            value={field.drainageSystem ? 'Jah' : ''}
            className="form-input auto-field-input"
          />
        </div>

        <div className="form-group">
          <label>Operaator</label>
          <select
            disabled={isEditSeasonLocked}
            value={editOperatorId}
            onChange={(e) => setEditOperatorId(e.target.value)}
            className="form-input"
          >
            <option value="">-- Määramata --</option>
            {parties
              .filter((p) => p.roles?.includes('OPERATOR') || p.id === editOperatorId)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>
        </div>
      </div>

      {/* Seasonal Yearly Data & Cadastral Parcels */}
      <div className="form-sub-header" style={{ marginTop: '16px' }}>
        <Compass size={14} />
        <span>2. Hooaja külvikord, pindala ja piirid</span>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Põllu haritav pindala (ha) *</label>
          <input
            type="number"
            step="0.01"
            required
            disabled={isEditSeasonLocked}
            value={editAreaHa}
            onChange={(e) => setEditAreaHa(Number(e.target.value))}
            className="form-input"
            title="Põllu haritav suurus hooajal"
          />
        </div>

        <div className="form-group">
          <label>PRIA toetusõiguslik pindala (ha)</label>
          <input
            type="number"
            step="0.01"
            disabled={isEditSeasonLocked}
            value={editEligibleAreaHa || ''}
            onChange={(e) => setEditEligibleAreaHa(e.target.value ? Number(e.target.value) : undefined)}
            className="form-input"
            placeholder="nt 4.85"
          />
        </div>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label>Pindala muutuse põhjus (nt võsa pealekasv, kraavipuhastus, puhverribad)</label>
          <input
            type="text"
            disabled={isEditSeasonLocked}
            placeholder="nt Võsa pealekasv idaosas -0.2 ha või Kraaviäärde rajatud puhverriba"
            value={editAreaChangeReason}
            onChange={(e) => setEditAreaChangeReason(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Kultuur
              {selectedCropObj?.color && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: selectedCropObj.color,
                    border: '1px solid rgba(0, 0, 0, 0.2)'
                  }}
                  title={`Kultuuri värv: ${selectedCropObj.color}`}
                />
              )}
            </label>
            {onOpenCrops && (
              <button
                type="button"
                onClick={onOpenCrops}
                title="Ava kultuuride register"
                className="icon-btn-ghost"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--emerald-500, #10b981)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <ExternalLink size={14} />
              </button>
            )}
          </div>
          <select
            disabled={isEditSeasonLocked}
            value={editCrop}
            onChange={(e) => {
              const selectedName = e.target.value;
              setEditCrop(selectedName);
              const match = activeCrops.find(c => c.name === selectedName);
              if (match) {
                setEditCropColor(match.color);
                if (match.varieties && match.varieties.length > 0) {
                  setEditVariety(match.varieties[0].name);
                } else {
                  setEditVariety('');
                }
              }
            }}
            className="form-input"
          >
            {editCrop && !activeCrops.some(c => c.name === editCrop) && (
              <option value={editCrop}>
                {selectedCropObj?.icon || '🌾'} {editCrop}
              </option>
            )}
            {activeCrops.map(c => (
              <option key={c.id} value={c.name}>
                {c.icon || '🌾'} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ margin: 0 }}>Sordi valik ({editCrop || 'Kultuur'})</label>
            {availableVarieties.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {availableVarieties.length} sorti registris
              </span>
            )}
          </div>
          <input
            type="text"
            list="field-available-varieties-list"
            disabled={isEditSeasonLocked}
            placeholder={availableVarieties.length > 0 ? `nt ${availableVarieties[0].name}` : 'nt Skagen'}
            value={editVariety}
            onChange={(e) => setEditVariety(e.target.value)}
            className="form-input"
          />
          <datalist id="field-available-varieties-list">
            {availableVarieties.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name} {v.breeder ? `(${v.breeder})` : ''} {v.qualityClass ? `· ${v.qualityClass}` : ''}
              </option>
            ))}
          </datalist>
        </div>

        <div className="form-group">
          <label>Saagiootus (t/ha) & Koristatud saak (t/ha)</label>
          <div className="input-split">
            <input
              type="number"
              step="0.1"
              disabled={isEditSeasonLocked}
              placeholder="Plaan t/ha"
              value={editTargetYield || ''}
              onChange={(e) => setEditTargetYield(e.target.value ? Number(e.target.value) : undefined)}
              className="form-input"
            />
            <input
              type="number"
              step="0.1"
              disabled={isEditSeasonLocked}
              placeholder="Tegelik t/ha"
              value={editActualYield || ''}
              onChange={(e) => setEditActualYield(e.target.value ? Number(e.target.value) : undefined)}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Hooaja märkmed (väetamine, taimekaitse, PRIA)</label>
          <input
            type="text"
            disabled={isEditSeasonLocked}
            placeholder="nt NPK 8-20-30 250kg/ha sügisel"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="form-input"
          />
        </div>
      </div>

      {/* Cadastral Parcels Management for Selected Year */}
      <div className="form-sub-header" style={{ marginTop: '16px' }}>
        <Landmark size={14} />
        <span>3. Hooaja koosseisu kuuluvad katastriüksused (kokku {editCadastralParcels.length} tk)</span>
        {!isEditSeasonLocked && (
          <button
            type="button"
            className="btn btn-ghost btn-xs add-cad-btn"
            onClick={handleAddCadastralParcelToEdit}
          >
            <Plus size={12} />
            <span>Lisa katastriüksus</span>
          </button>
        )}
      </div>

      <div className="edit-cadastral-list">
        {editCadastralParcels.map((parcel, pIdx) => (
          <div key={pIdx} className="edit-cad-item glass-card">
            <div className="edit-cad-grid">
              <div className="form-group">
                <label>Katastritunnus *</label>
                <input
                  type="text"
                  required
                  disabled={isEditSeasonLocked}
                  value={parcel.cadastralCode}
                  onChange={(e) => handleUpdateCadastralParcel(pIdx, { cadastralCode: e.target.value })}
                  className="form-input"
                  placeholder="nt 89201:001:0100"
                />
              </div>

              <div className="form-group">
                <label>Põllu osa (ha) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  disabled={isEditSeasonLocked}
                  value={parcel.fieldAreaHa}
                  onChange={(e) => handleUpdateCadastralParcel(pIdx, { fieldAreaHa: Number(e.target.value) })}
                  className="form-input"
                  title="Hektarite arv sellest katastriüksusest sellel hooajal"
                />
              </div>

              <div className="form-group">
                <label>Omandivorm</label>
                <select
                  disabled={isEditSeasonLocked}
                  value={parcel.ownershipType}
                  onChange={(e) => handleUpdateCadastralParcel(pIdx, { ownershipType: e.target.value as LandTenureType })}
                  className="form-input"
                >
                  <option value="OWNED">🏛️ Oma maa</option>
                  <option value="RENTED">🤝 Renditud</option>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ margin: 0 }}>Maaomanik</label>
                  {onOpenParties && (
                    <button
                      type="button"
                      onClick={onOpenParties}
                      title="Ava seotud isikute register"
                      className="icon-btn-ghost"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--emerald-500, #10b981)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="parties-landowners-list"
                  disabled={isEditSeasonLocked}
                  value={parcel.ownerName}
                  onChange={(e) => handleUpdateCadastralParcel(pIdx, { ownerName: e.target.value })}
                  className="form-input"
                  placeholder="nt Loisu Agro OÜ / Jaan Tamm"
                />
                <datalist id="parties-landowners-list">
                  {parties
                    .filter((p) => p.roles.includes('LANDOWNER'))
                    .map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                </datalist>
              </div>

              {/* €/ha väli ENNE kogusummat */}
              <div className="form-group">
                <label>
                  {parcel.ownershipType === 'OWNED' ? `Maamaks (€/ha)` : `Renditasu (€/ha)`}
                </label>
                <input
                  type="number"
                  step="0.5"
                  disabled={isEditSeasonLocked}
                  value={parcel.ownershipType === 'OWNED' ? (parcel.landTaxEurHa ?? '') : (parcel.rentFeeEurHa ?? '')}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    if (parcel.ownershipType === 'OWNED') {
                      handleUpdateCadastralParcel(pIdx, { landTaxEurHa: val });
                    } else {
                      handleUpdateCadastralParcel(pIdx, { rentFeeEurHa: val });
                    }
                  }}
                  className="form-input"
                  placeholder="nt 140"
                  title="Tasu hektari kohta aastas (€/ha)"
                />
              </div>

              {/* Kogu summa aastas */}
              <div className="form-group">
                <label>
                  {parcel.ownershipType === 'OWNED' ? `Maamaks kokku (€/a)` : `Renditasu kokku (€/a)`}
                </label>
                <input
                  type="number"
                  step="1"
                  disabled={isEditSeasonLocked}
                  value={parcel.ownershipType === 'OWNED' ? (parcel.landTaxEurYear ?? '') : (parcel.rentFeeEurYear ?? '')}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    if (parcel.ownershipType === 'OWNED') {
                      handleUpdateCadastralParcel(pIdx, { landTaxEurYear: val });
                    } else {
                      handleUpdateCadastralParcel(pIdx, { rentFeeEurYear: val });
                    }
                  }}
                  className="form-input"
                  placeholder="nt 630"
                  title="Kogusumma aastas (€/a)"
                />
              </div>

              <div className="form-group edit-cad-action">
                {isEditSeasonLocked ? (
                  <span className="edit-cad-locked" title="Hooaeg on muudatusteks suletud">
                    <Lock size={14} />
                  </span>
                ) : (
                  <button
                    type="button"
                    className="icon-btn-danger"
                    onClick={() => handleRemoveCadastralParcelFromEdit(pIdx)}
                    title="Eemalda see katastriüksus"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      </div>

      {!isEditSeasonLocked && (
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={() => onClose()}>Loobu</button>
          <button type="submit" className="btn btn-primary">
            Salvesta muudatused
          </button>
        </div>
      )}
    </form>
    </div>,
    document.body
  );
};
