// src/components/FieldEditDialog.tsx — põllu põhiandmete ja valitud hooaja kirje muutmise aken
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Trash2, Lock, Landmark, Compass, ExternalLink, Info } from 'lucide-react';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import type { FieldCadastralLink, LandTenureType } from '../types/cadastre';
import type { RelatedParty } from '../types/party';
import type { Crop } from '../types/crop';
import { deriveOwnershipType, OWNERSHIP_LABELS } from '../services/landTenure';
import { derivePriaCropName, UNDERSOWING_LABELS, type Undersowing } from '../services/priaCropName';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { isCropUndetermined } from '../types/season';
import type { SoilSample } from '../types/soilSample';
import { SoilSamplesSection } from './SoilSamplesSection';
import { WeatherSeasonSection } from './WeatherSeasonSection';
import { Button, Dialog, DialogContent, DialogHeader, DialogForm, DialogBody, DialogFooter, Badge, type BadgeTone, NumberInput, Field, FieldRow, FormGrid, Input, Select } from './ui';

// Omandivormi märgi toon
const OWNERSHIP_TONE: Record<LandTenureType, BadgeTone> = { OWNED: 'success', RENTED: 'info', UNKNOWN: 'neutral' };

// Kultuur valimata: sama väärtus ja värv mis mujal registris (fieldRegister.ts)
const UNDETERMINED_CROP = 'Määramata';
const UNDETERMINED_CROP_COLOR = '#94a3b8';

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
  soilSamples?: SoilSample[]; // põllu piiridesse jäävad näidatakse (ainult vaatamiseks)
  weatherEnabled?: boolean; // ilmamoodul: hooaja ilmakokkuvõtte plokk
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
  onClose,
  soilSamples = [],
  weatherEnabled = false
}) => {
  const seasonRec = field.history.find((h) => h.year === selectedYear);
  // Valitud hooaja põllukuju mullaproovide jaoks
  const seasonGeometry = useMemo(() => {
    const g = field.history.find((h) => h.year === selectedYear)?.geometry as any;
    return g && (g.type === 'Polygon' || g.type === 'MultiPolygon') ? g : null;
  }, [field, selectedYear]);
  const SOIL_SAMPLE_MAX_AGE_YEARS = 6;
  const recentSoilSamples = useMemo(
    () => soilSamples.filter((s) => s.year <= selectedYear && s.year >= selectedYear - SOIL_SAMPLE_MAX_AGE_YEARS),
    [soilSamples, selectedYear]
  );
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
  const [editAreaHa, setEditAreaHa] = useState<number | null>(0);
  const [editEligibleAreaHa, setEditEligibleAreaHa] = useState<number | undefined>(undefined);
  const [editAreaChangeReason, setEditAreaChangeReason] = useState('');
  const [editCrop, setEditCrop] = useState('');
  const [editCropColor, setEditCropColor] = useState('#eab308');
  const [editVariety, setEditVariety] = useState('');
  const [editUndersowing, setEditUndersowing] = useState<Undersowing>('NONE');
  // Salvestatud valik: muutmata valikuga jääb hooaja senine PRIA nimetus (nagu serveris)
  const [savedPria, setSavedPria] = useState<{ crop: string; variety: string; undersowing: Undersowing; name: string | null }>({ crop: '', variety: '', undersowing: 'NONE', name: null });
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

  // PRIA nimetus: muutmata valikul salvestatud, muidu registri reegli järgi (lõpliku nime paneb server)
  const priaPreview = useMemo(() => {
    const unchanged = savedPria.name && savedPria.crop === editCrop && savedPria.variety === editVariety.trim() && savedPria.undersowing === editUndersowing;
    if (unchanged) return savedPria.name;
    if (!selectedCropObj) return editCrop || null;
    const variety = selectedCropObj.varieties?.find((v) => v.name.toLowerCase() === editVariety.trim().toLowerCase());
    return derivePriaCropName(selectedCropObj, variety, editUndersowing);
  }, [savedPria, editCrop, editVariety, editUndersowing, selectedCropObj]);

  const operatorOf = (id: string) => {
    const p = parties.find((x) => x.id === id);
    return p ? { id: p.id, name: p.name } : null;
  };

  const loadForm = (field: MasterField) => {
    const currentRec = field.history.find(h => h.year === selectedYear) || {
      year: selectedYear,
      areaHa: field.history[0]?.areaHa || 5.0,
      // Aasta hooajakirjet pole: kultuur jääb määramata (teise aasta kultuuri ega vaikekultuuri ei pakuta)
      crop: '',
      cropColor: UNDETERMINED_CROP_COLOR
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
    // Number ja operaator on aasta kaupa (eri aastatel eri kirjapilt / harija)
    const recOperatorId = (currentRec as { operatorId?: string | null }).operatorId;
    const yearOperatorId = (recOperatorId !== undefined ? recOperatorId : field.operatorId) || '';
    setEditNum((currentRec as { num?: string }).num || field.num || '');
    setEditFieldCode(field.fieldCode);
    setEditCadastralCode(field.cadastralCode || (initialParcels[0]?.cadastralCode) || '');
    setEditOperatorId(yearOperatorId);
    setEditSoilType(field.soilType || '');
    setEditCadastralParcels(initialParcels.map((p) => ({ ...p, ownershipType: deriveOwnershipType(p, operatorOf(yearOperatorId)) })));

    const matchedCrop = findRegistryCrop(currentRec.crop);
    setEditAreaHa(currentRec.areaHa);
    setEditEligibleAreaHa(currentRec.eligibleAreaHa || undefined);
    setEditAreaChangeReason(currentRec.areaChangeReason || '');
    setEditCrop(isCropUndetermined(currentRec.crop) ? '' : currentRec.crop);
    setEditCropColor(matchedCrop?.color || currentRec.cropColor || UNDETERMINED_CROP_COLOR);
    setEditVariety(currentRec.cropVariety || '');
    setEditUndersowing(('undersowing' in currentRec && currentRec.undersowing) || 'NONE');
    setSavedPria({
      crop: currentRec.crop,
      variety: currentRec.cropVariety || '',
      undersowing: ('undersowing' in currentRec && currentRec.undersowing) || 'NONE',
      name: ('priaCropName' in currentRec && currentRec.priaCropName) || null
    });
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
    const cropUndetermined = !editCrop.trim();
    const finalCropColor = cropUndetermined
      ? UNDETERMINED_CROP_COLOR
      : matchedCrop?.color || selectedCropObj?.color || editCropColor || '#22c55e';

    onUpdateField(
      field.id,
      {
        name: editName.trim() || `Põld ${editNum || field.id}`,
        fieldCode: editFieldCode.trim(),
        cadastralCode: editCadastralCode.trim() || (editCadastralParcels[0]?.cadastralCode) || undefined,
        soilType: editSoilType.trim() || undefined
      },
      {
        year: editYear,
        // Põllu number ja operaator salvestuvad sellele aastale; põllu enda omad = viimase aasta omad (server)
        num: editNum.trim() || undefined,
        operatorId: editOperatorId || null,
        areaHa: Number(editAreaHa),
        eligibleAreaHa: editEligibleAreaHa ? Number(editEligibleAreaHa) : undefined,
        areaChangeReason: editAreaChangeReason.trim() || undefined,
        crop: editCrop.trim() || UNDETERMINED_CROP,
        cropVariety: editVariety.trim() || undefined,
        undersowing: editUndersowing,
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

    const defaultHa = Math.round(((editAreaHa ?? 0) / (editCadastralParcels.length + 1)) * 100) / 100;

    setEditCadastralParcels([
      ...editCadastralParcels,
      {
        cadastralCode: '',
        parcelName: '',
        ownershipType: 'UNKNOWN',
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
      current.ownershipType = deriveOwnershipType(current, operatorOf(editOperatorId));

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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent size="lg" className="field-edit-modal">
    <DialogForm onSubmit={handleSaveEdit}>
      <DialogHeader
        icon={isEditSeasonLocked ? <Lock size={20} className="text-slate-400" /> : <Edit2 size={20} className="text-emerald" />}
        title={`${isEditSeasonLocked ? 'Lukus' : 'Muuda'}: ${editNum ? `Nr ${editNum} ` : ''}${editName || `Põld ${field.id}`} · ${selectedYear}`}
      />

      <DialogBody>

      {/* General Master Field Data */}
      <div className="form-sub-header">
        <Landmark size={14} />
        <span>Põllu põhiandmed ja massiiv</span>
      </div>
      <FormGrid>
        <FormGrid cols={3} span="full">
          <Field label="Põllu nimi (kasutaja määratud) *" htmlFor="field-edit-name">
            <Input
              id="field-edit-name"
              type="text"
              required
              placeholder="nt Loisu tagune, Kodu põld, Suur põld..."
              disabled={isEditSeasonLocked}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </Field>

          <Field label={`Põllu number ${editYear} (PRIA)`} htmlFor="field-edit-num">
            <Input
              id="field-edit-num"
              type="text"
              numeric
              placeholder="nt 4, 4-1, 1"
              disabled={isEditSeasonLocked}
              value={editNum}
              onChange={(e) => setEditNum(e.target.value)}
            />
          </Field>

          <Field label="PRIA massiivi number (fieldCode) *" htmlFor="field-edit-code">
            <Input
              id="field-edit-code"
              type="text"
              required
              placeholder="nt 61144313542"
              disabled={isEditSeasonLocked}
              value={editFieldCode}
              onChange={(e) => setEditFieldCode(e.target.value)}
            />
          </Field>
        </FormGrid>

        <FormGrid cols={3} span="full">
          <Field
            htmlFor="field-edit-soil"
            label={<span title={SOIL_AUTO_HINT}>Mullastiku tüüp <Info size={12} className="auto-field-icon" /></span>}
          >
            <Input
              id="field-edit-soil"
              type="text"
              readOnly
              tabIndex={-1}
              placeholder="Täidetakse hiljem automaatselt"
              title={SOIL_AUTO_HINT}
              value={editSoilType}
              className="auto-filled-input"
            />
          </Field>

          <Field
            htmlFor="field-edit-drainage"
            label={<span title={DRAINAGE_AUTO_HINT}>Drenaaž <Info size={12} className="auto-field-icon" /></span>}
          >
            <Input
              id="field-edit-drainage"
              type="text"
              readOnly
              tabIndex={-1}
              placeholder="Täidetakse hiljem automaatselt"
              title={DRAINAGE_AUTO_HINT}
              value={field.drainageSystem ? 'Jah' : ''}
              className="auto-filled-input"
            />
          </Field>

          <Field label={`Operaator ${editYear}`} htmlFor="field-edit-operator">
            <Select
              id="field-edit-operator"
              disabled={isEditSeasonLocked}
              value={editOperatorId}
              onValueChange={(id) => {
                setEditOperatorId(id);
                // Omandivorm sõltub operaatorist (omanik = operaator → oma maa)
                setEditCadastralParcels((prev) => prev.map((p) => ({ ...p, ownershipType: deriveOwnershipType(p, operatorOf(id)) })));
              }}
              options={[
                { value: '', label: '-- Määramata --' },
                ...parties
                  .filter((p) => p.roles?.includes('OPERATOR') || p.id === editOperatorId)
                  .map((p) => ({ value: p.id, label: p.name }))
              ]}
            />
          </Field>
        </FormGrid>
      </FormGrid>

      {/* Seasonal Yearly Data & Cadastral Parcels */}
      <div className="form-sub-header" style={{ marginTop: '16px' }}>
        <Compass size={14} />
        <span>Hooaja külvikord, pindala ja piirid</span>
      </div>

      <FormGrid>
        <Field label="Põllu haritav pindala (ha) *" htmlFor="field-edit-area">
          <NumberInput
            id="field-edit-area"
            required
            disabled={isEditSeasonLocked}
            value={editAreaHa}
            onChange={setEditAreaHa}
            title="Põllu haritav suurus hooajal"
          />
        </Field>

        <Field label="PRIA toetusõiguslik pindala (ha)" htmlFor="field-edit-eligible">
          <NumberInput
            id="field-edit-eligible"
            disabled={isEditSeasonLocked}
            value={editEligibleAreaHa || null}
            onChange={(v) => setEditEligibleAreaHa(v ?? undefined)}
            placeholder="nt 4,85"
          />
        </Field>

        <Field label="Pindala muutuse põhjus (nt võsa pealekasv, kraavipuhastus, puhverribad)" htmlFor="field-edit-area-reason" span="full">
          <Input
            id="field-edit-area-reason"
            type="text"
            disabled={isEditSeasonLocked}
            placeholder="nt Võsa pealekasv idaosas -0.2 ha või Kraaviäärde rajatud puhverriba"
            value={editAreaChangeReason}
            onChange={(e) => setEditAreaChangeReason(e.target.value)}
          />
        </Field>

        <Field>
          <div className="field-label-row">
            <label htmlFor="field-edit-crop">
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
              <Button
                type="button"
                onClick={onOpenCrops}
                title="Ava kultuuride register"
                variant="ghost"
                size="icon-sm"
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
              </Button>
            )}
          </div>
          <Select
            id="field-edit-crop"
            disabled={isEditSeasonLocked}
            value={editCrop}
            onValueChange={(selectedName) => {
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
            options={[
              { value: '', label: '– määramata –' },
              ...(editCrop && !activeCrops.some(c => c.name === editCrop)
                ? [{ value: editCrop, label: `${selectedCropObj?.icon || '🌾'} ${editCrop}` }]
                : []),
              ...activeCrops.map(c => ({ value: c.name, label: `${c.icon || '🌾'} ${c.name}` }))
            ]}
          />
        </Field>

        <Field>
          <div className="field-label-row">
            <label htmlFor="field-edit-variety">Sordi valik ({editCrop || 'Kultuur'})</label>
            {availableVarieties.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {availableVarieties.length} sorti registris
              </span>
            )}
          </div>
          <Input
            id="field-edit-variety"
            type="text"
            list="field-available-varieties-list"
            disabled={isEditSeasonLocked}
            placeholder={availableVarieties.length > 0 ? `nt ${availableVarieties[0].name}` : 'nt Skagen'}
            value={editVariety}
            onChange={(e) => setEditVariety(e.target.value)}
          />
          <datalist id="field-available-varieties-list">
            {availableVarieties.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name} {v.breeder ? `(${v.breeder})` : ''} {v.qualityClass ? `· ${v.qualityClass}` : ''}
              </option>
            ))}
          </datalist>
        </Field>

        {selectedCropObj?.priaUndersowing && (
          <Field label="Allakülv" htmlFor="field-undersowing">
            <Select
              id="field-undersowing"
              disabled={isEditSeasonLocked}
              value={editUndersowing}
              onValueChange={(v) => setEditUndersowing(v as Undersowing)}
              options={(Object.keys(UNDERSOWING_LABELS) as Undersowing[]).map((u) => ({ value: u, label: UNDERSOWING_LABELS[u] }))}
            />
          </Field>
        )}

        <Field label="PRIA nimetus" htmlFor="field-edit-pria-name">
          <Input
            id="field-edit-pria-name"
            readOnly
            value={priaPreview || '–'}
            title="Tuletatakse kultuurist, sordist ja allakülvist (kultuuride registri PRIA nimetus)"
          />
        </Field>

        <Field label="Saagiootus (t/ha) & Koristatud saak (t/ha)">
          <FieldRow>
            <NumberInput
              disabled={isEditSeasonLocked}
              placeholder="Plaan t/ha"
              aria-label="Saagiootus (t/ha)"
              value={editTargetYield || null}
              onChange={(v) => setEditTargetYield(v ?? undefined)}
            />
            <NumberInput
              disabled={isEditSeasonLocked}
              placeholder="Tegelik t/ha"
              aria-label="Koristatud saak (t/ha)"
              value={editActualYield || null}
              onChange={(v) => setEditActualYield(v ?? undefined)}
            />
          </FieldRow>
        </Field>

        <Field label="Hooaja märkmed (väetamine, taimekaitse, PRIA)" htmlFor="field-edit-notes">
          <Input
            id="field-edit-notes"
            type="text"
            disabled={isEditSeasonLocked}
            placeholder="nt NPK 8-20-30 250kg/ha sügisel"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />
        </Field>
      </FormGrid>

      {/* Ainult vaatamiseks: põllu piiridesse jäävad mullaproovid kuni 6 aastat tagasi valitud hooajast */}
      {seasonGeometry && (
        <div className="field-edit-insights">
          <SoilSamplesSection geometry={seasonGeometry} samples={recentSoilSamples} />
        </div>
      )}
      {weatherEnabled && (
        <div className="field-edit-insights">
          <WeatherSeasonSection fieldSeasonId={seasonRec?.fieldSeasonId} year={seasonRec?.year} crop={seasonRec?.crop} actualYieldTonsHa={seasonRec?.actualYieldTonsHa} />
        </div>
      )}

      {/* Cadastral Parcels Management for Selected Year */}
      <div className="form-sub-header" style={{ marginTop: '16px' }}>
        <Landmark size={14} />
        <span>Hooaja koosseisu kuuluvad katastriüksused (kokku {editCadastralParcels.length} tk)</span>
        {!isEditSeasonLocked && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="add-cad-btn"
            onClick={handleAddCadastralParcelToEdit}
          >
            <Plus size={12} />
            <span>Lisa katastriüksus</span>
          </Button>
        )}
      </div>

      <div className="edit-cadastral-list">
        {editCadastralParcels.map((parcel, pIdx) => (
          <div key={pIdx} className="edit-cad-item glass-card">
            <div className="edit-cad-grid">
              <Field label="Katastritunnus *" htmlFor={`field-edit-cad-code-${pIdx}`}>
                <Input
                  id={`field-edit-cad-code-${pIdx}`}
                  type="text"
                  required
                  disabled={isEditSeasonLocked}
                  value={parcel.cadastralCode}
                  onChange={(e) => handleUpdateCadastralParcel(pIdx, { cadastralCode: e.target.value })}
                  placeholder="nt 89201:001:0100"
                />
              </Field>

              <Field label="Põllu osa (ha) *" htmlFor={`field-edit-cad-area-${pIdx}`}>
                <NumberInput
                  id={`field-edit-cad-area-${pIdx}`}
                  required
                  disabled={isEditSeasonLocked}
                  value={parcel.fieldAreaHa || null}
                  onChange={(v) => handleUpdateCadastralParcel(pIdx, { fieldAreaHa: v ?? 0 })}
                  title="Hektarite arv sellest katastriüksusest sellel hooajal"
                />
              </Field>

              <Field>
                <div className="field-label-row">
                  <label htmlFor={`field-edit-cad-owner-${pIdx}`}>
                    Maaomanik
                    <Badge tone={OWNERSHIP_TONE[parcel.ownershipType]} title="Tuletatakse: omanik = põllu operaator → oma maa, muu omanik → renditud, omanik või operaator sisestamata → teadmata">
                      {OWNERSHIP_LABELS[parcel.ownershipType]}
                    </Badge>
                  </label>
                  {onOpenParties && (
                    <Button
                      type="button"
                      onClick={onOpenParties}
                      title="Ava seotud isikute register"
                      variant="ghost"
                      size="icon-sm"
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
                    </Button>
                  )}
                </div>
                <Input
                  id={`field-edit-cad-owner-${pIdx}`}
                  type="text"
                  list="parties-landowners-list"
                  disabled={isEditSeasonLocked}
                  value={parcel.ownerName}
                  onChange={(e) => handleUpdateCadastralParcel(pIdx, { ownerName: e.target.value })}
                  placeholder="nt Loisu Agro OÜ / Jaan Tamm"
                />
                <datalist id="parties-landowners-list">
                  {parties
                    .filter((p) => p.roles.includes('LANDOWNER'))
                    .map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                </datalist>
              </Field>

              {parcel.ownershipType === 'UNKNOWN' ? (
                <div className="cad-tenure-hint">
                  Omandivorm on teadmata. Maamaksu või renditasu saab sisestada, kui maaomanik ja põllu operaator on valitud.
                </div>
              ) : (
              <>
              {/* €/ha väli ENNE kogusummat */}
              <Field label={parcel.ownershipType === 'OWNED' ? `Maamaks (€/ha)` : `Renditasu (€/ha)`} htmlFor={`field-edit-cad-ha-${pIdx}`}>
                <NumberInput
                  id={`field-edit-cad-ha-${pIdx}`}
                  disabled={isEditSeasonLocked}
                  value={parcel.ownershipType === 'OWNED' ? (parcel.landTaxEurHa ?? null) : (parcel.rentFeeEurHa ?? null)}
                  onChange={(v) => {
                    const val = v ?? undefined;
                    if (parcel.ownershipType === 'OWNED') {
                      handleUpdateCadastralParcel(pIdx, { landTaxEurHa: val });
                    } else {
                      handleUpdateCadastralParcel(pIdx, { rentFeeEurHa: val });
                    }
                  }}
                  placeholder="nt 140"
                  title="Tasu hektari kohta aastas (€/ha)"
                />
              </Field>

              {/* Kogu summa aastas */}
              <Field label={parcel.ownershipType === 'OWNED' ? `Maamaks kokku (€/a)` : `Renditasu kokku (€/a)`} htmlFor={`field-edit-cad-year-${pIdx}`}>
                <NumberInput
                  id={`field-edit-cad-year-${pIdx}`}
                  disabled={isEditSeasonLocked}
                  value={parcel.ownershipType === 'OWNED' ? (parcel.landTaxEurYear ?? null) : (parcel.rentFeeEurYear ?? null)}
                  onChange={(v) => {
                    const val = v ?? undefined;
                    if (parcel.ownershipType === 'OWNED') {
                      handleUpdateCadastralParcel(pIdx, { landTaxEurYear: val });
                    } else {
                      handleUpdateCadastralParcel(pIdx, { rentFeeEurYear: val });
                    }
                  }}
                  placeholder="nt 630"
                  title="Kogusumma aastas (€/a)"
                />
              </Field>

              </>
              )}

              <div className="edit-cad-action">
                {isEditSeasonLocked ? (
                  <span className="edit-cad-locked" title="Hooaeg on muudatusteks suletud">
                    <Lock size={14} />
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="danger-ghost"
                    size="icon-sm"
                    onClick={() => handleRemoveCadastralParcelFromEdit(pIdx)}
                    title="Eemalda see katastriüksus"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>


      </DialogBody>

      {!isEditSeasonLocked && (
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onClose()}>Loobu</Button>
          <Button type="submit" variant="primary">
            Salvesta muudatused
          </Button>
        </DialogFooter>
      )}
    </DialogForm>
    </DialogContent>
    </Dialog>
  );
};
