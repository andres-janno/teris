// src/components/CropRegisterModal.tsx
import { DEFAULT_CROP_COLOR } from '../lib/dataColors';
import React, { useState, useMemo } from 'react';
import {
  Sprout,
  Plus,
  Edit2,
  Trash2,
  Tag,
  Sparkles,
  Calendar,
  Lock,
  Download
} from 'lucide-react';
import type { Crop, CropVariety, CropGroup } from '../types/crop';
import { CROP_GROUP_CONFIG } from '../types/crop';
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import { pickCropColor } from '../services/cropColors';
import { confirmDialog } from './ConfirmDialog';
import { seasonSelectorYears } from '../types/season';
import { UNDERSOWING_LABELS, defaultPriaVariantName, type Undersowing } from '../services/priaCropName';
import { Button, Dialog, DialogContent, DialogHeader, DialogForm, DialogBody, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, ToggleGroup, ToggleGroupItem, NumberInput, SearchInput, CheckboxField, Field, FieldRow, FormGrid, Input, Select, SectionTitle, PageHeader } from './ui';

interface CropRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  crops: Crop[];
  onSaveCrop: (crop: Crop) => void;
  onDeleteCrop: (cropId: string) => void;
  masterFields?: MasterField[];
  selectedYear?: number;
  // Avatud teise akna (nt põllu muutmise) pealt — kuvatakse kõige peal.
  isFullPage?: boolean;
  // Hooaja valik nagu Põldude registris (ilma selleta näidatakse ainult valitud aasta andmeid)
  seasons?: FarmingSeason[];
  onSelectYear?: (year: number) => void;
}

// Vaate veerud: kolm põhigruppi eraldi, ülejäänud grupid veerus „Muud“
const cropBlocks: { key: string; label: string; icon: string; groups: CropGroup[] }[] = [
  { key: 'cereal', label: 'Teraviljad', icon: '🌾', groups: ['CEREAL'] },
  { key: 'oilseed', label: 'Õlikultuurid', icon: '🌼', groups: ['OILSEED'] },
  { key: 'legume', label: 'Kaunviljad', icon: '🌱', groups: ['LEGUME'] },
  { key: 'other', label: 'Muud', icon: '🪴', groups: ['OTHER', 'FORAGE_GRASS', 'FALLOW'] }
];

export const CropRegisterModal: React.FC<CropRegisterModalProps> = ({
  isOpen,
  onClose,
  crops,
  onSaveCrop,
  onDeleteCrop,
  masterFields = [],
  selectedYear = 2026,
  isFullPage = false,
  seasons = [],
  onSelectYear
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Crop Editing State
  const [isEditingCrop, setIsEditingCrop] = useState(false);
  const [editCropId, setEditCropId] = useState<string | null>(null);
  const [editCropName, setEditCropName] = useState('');
  const [editCropScientific, setEditCropScientific] = useState('');
  const [editCropGroup, setEditCropGroup] = useState<CropGroup>('CEREAL');
  const [editCropColor, setEditCropColor] = useState(DEFAULT_CROP_COLOR);
  const [editCropIcon, setEditCropIcon] = useState('🌾');
  const [editCropPriaCode, setEditCropPriaCode] = useState('');
  const [editCropSeedRate, setEditCropSeedRate] = useState<number | ''>('');
  const [editCropYield, setEditCropYield] = useState<number | ''>('');
  const [editCropDescription, setEditCropDescription] = useState('');
  const [editCropIsWinter, setEditCropIsWinter] = useState(false);
  const [editCropGddBase, setEditCropGddBase] = useState<number | undefined>(5);
  // PRIA nimetuse reegel; erandnimed tühjad = vaikimisi alus + allakülvi järelliide
  const [editCropPria, setEditCropPria] = useState({ name: '', undersowing: false, NONE: '', OTHER: '', LEGUME: '' });
  // Uuele kultuurile värv automaatselt (talivili külm, suvivili soe toon); kasutaja võib üle kirjutada.
  const [editCropAutoColor, setEditCropAutoColor] = useState(false);

  // Variety Editing State
  const [isEditingVariety, setIsEditingVariety] = useState(false);
  const [varietyTargetCropId, setVarietyTargetCropId] = useState<string | null>(null);
  const [editVarietyId, setEditVarietyId] = useState<string | null>(null);
  const [editVarietyName, setEditVarietyName] = useState('');
  const [editVarietyBreeder, setEditVarietyBreeder] = useState('');
  const [editVarietyMaturity, setEditVarietyMaturity] = useState('');
  const [editVarietyWinterHardiness, setEditVarietyWinterHardiness] = useState('');
  const [editVarietySeedRate, setEditVarietySeedRate] = useState<number | ''>('');
  const [editVarietyPotentialYield, setEditVarietyPotentialYield] = useState<number | ''>('');
  const [editVarietyQualityClass, setEditVarietyQualityClass] = useState('');
  const [editVarietyPriaName, setEditVarietyPriaName] = useState('');
  const [editVarietyNotes, setEditVarietyNotes] = useState('');

  // Calculate field acreage per crop for active season.
  // Ainult põllud, millel on TÄPSELT valitud aasta kirje (vt sama
  // muster FieldManagerModal/generateFieldCollectionForYear'is) —
  // muidu paisutaks mõne teise aasta kultuur/pindala vale aasta kokkuvõtet.
  const cropAcreageMap = useMemo(() => {
    const map: Record<string, number> = {};
    masterFields.forEach((field) => {
      const yearRec = field.history.find((h) => h.year === selectedYear);
      if (yearRec && yearRec.crop) {
        const cropName = yearRec.crop.toLowerCase().trim();
        // Sobita registri kultuuriga nime algusest, lõpust VÕI seest —
        // PRIA tekstid on tihti kujul "Muu põlduba" või "Punane ristik
        // (vähemalt 80%...)", mis ei ALGA baaskultuuri nimega, aga
        // sisaldavad seda.
        const match = crops.find(
          (c) => {
            const name = c.name.toLowerCase();
            return name === cropName || cropName.includes(name) || name.startsWith(cropName);
          }
        );
        const key = match ? match.id : cropName;
        map[key] = (map[key] || 0) + (yearRec.areaHa || 0);
        // Sordi pind: võti kultuuri id + sordinimi väiketähtedega
        if (match && yearRec.cropVariety) {
          const vKey = `${match.id}|${yearRec.cropVariety.toLowerCase().trim()}`;
          map[vKey] = (map[vKey] || 0) + (yearRec.areaHa || 0);
        }
      }
    });
    return map;
  }, [masterFields, crops, selectedYear]);

  // Overall Statistics
  const stats = useMemo(() => ({
    totalCrops: crops.length,
    totalVarieties: crops.reduce((sum, c) => sum + (c.varieties?.length || 0), 0)
  }), [crops]);

  // Hooaegade valik: sama reegel nagu Põldude registris
  const availableYearsList = useMemo(() => seasonSelectorYears(seasons), [seasons]);

  const handleExportCsv = () => {
    const headers = ['ID', 'Kultuur', 'Ladinakeelne nimi', 'Grupp', 'PRIA kood', 'Talivili', 'Külvinorm (kg/ha)', 'Saagiootus (t/ha)', `Külvipind ${selectedYear} (ha)`, 'Sordid'];
    const rows = [...crops].sort((a, b) => a.name.localeCompare(b.name, 'et')).map((c) => [
      `"${c.id}"`,
      `"${c.name}"`,
      `"${c.scientificName || ''}"`,
      `"${CROP_GROUP_CONFIG[c.group]?.label || c.group}"`,
      `"${c.priaCode || ''}"`,
      c.isWinterCrop ? 'jah' : 'ei',
      c.defaultSeedRateKgHa ?? '',
      c.defaultYieldTonsHa ?? '',
      (cropAcreageMap[c.id] || 0).toFixed(2),
      `"${(c.varieties || []).map((v) => v.name).join('; ')}"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `agrimap_kultuuride_register_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Filtered crops list
  const filteredCrops = useMemo(() => {
    return crops.filter((crop) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        crop.name.toLowerCase().includes(q) ||
        (crop.scientificName && crop.scientificName.toLowerCase().includes(q)) ||
        (crop.priaCode && crop.priaCode.toLowerCase().includes(q)) ||
        (crop.description && crop.description.toLowerCase().includes(q)) ||
        crop.varieties.some(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            (v.breeder && v.breeder.toLowerCase().includes(q)) ||
            (v.qualityClass && v.qualityClass.toLowerCase().includes(q))
        );

      return matchesSearch;
    });
  }, [crops, searchQuery]);

  // Kuvatud kultuuride pind kokku (sama summa, mis veergude päistes)
  const filteredHectares = useMemo(
    () => filteredCrops.reduce((sum, c) => sum + (cropAcreageMap[c.id] || 0), 0),
    [filteredCrops, cropAcreageMap]
  );

  // Handlers for Crop Form
  const startCreateCrop = (group: CropGroup = 'CEREAL') => {
    setEditCropId(null);
    setEditCropName('');
    setEditCropScientific('');
    setEditCropGroup(group);
    setEditCropColor(pickCropColor(false, crops.map((c) => c.color)));
    setEditCropAutoColor(true);
    setEditCropIcon('🌾');
    setEditCropPriaCode('');
    setEditCropSeedRate('');
    setEditCropYield('');
    setEditCropDescription('');
    setEditCropIsWinter(false);
    setEditCropGddBase(5);
    setEditCropPria({ name: '', undersowing: group === 'CEREAL' || group === 'OILSEED', NONE: '', OTHER: '', LEGUME: '' });
    setIsEditingCrop(true);
    setIsEditingVariety(false);
  };

  const startEditCrop = (crop: Crop) => {
    setEditCropId(crop.id);
    setEditCropName(crop.name);
    setEditCropScientific(crop.scientificName || '');
    setEditCropGroup(crop.group);
    setEditCropColor(crop.color);
    setEditCropAutoColor(false);
    setEditCropIcon(crop.icon || '🌾');
    setEditCropPriaCode(crop.priaCode || '');
    setEditCropSeedRate(crop.defaultSeedRateKgHa ?? '');
    setEditCropYield(crop.defaultYieldTonsHa ?? '');
    setEditCropDescription(crop.description || '');
    setEditCropIsWinter(crop.isWinterCrop === true);
    setEditCropGddBase(crop.gddBaseC ?? 5);
    setEditCropPria({
      name: crop.priaName || '',
      undersowing: crop.priaUndersowing === true,
      NONE: crop.priaNameWithoutUndersowing || '',
      OTHER: crop.priaNameWithUndersowing || '',
      LEGUME: crop.priaNameWithLegumeUndersowing || ''
    });
    setIsEditingCrop(true);
    setIsEditingVariety(false);
  };

  const handleSaveCropForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCropName.trim()) return;

    const existingCrop = crops.find((c) => c.id === editCropId);
    const updatedCrop: Crop = {
      id: editCropId || `crop-${Date.now()}`,
      name: editCropName.trim(),
      scientificName: editCropScientific.trim() || undefined,
      group: editCropGroup,
      color: editCropColor,
      icon: editCropIcon.trim() || '🌾',
      priaCode: editCropPriaCode.trim() || undefined,
      defaultSeedRateKgHa: editCropSeedRate !== '' ? Number(editCropSeedRate) : undefined,
      defaultYieldTonsHa: editCropYield !== '' ? Number(editCropYield) : undefined,
      description: editCropDescription.trim() || undefined,
      isWinterCrop: editCropIsWinter,
      gddBaseC: editCropGddBase ?? 5,
      priaName: editCropPria.name.trim() || null,
      priaUndersowing: editCropPria.undersowing,
      priaNameWithoutUndersowing: (editCropPria.undersowing && editCropPria.NONE.trim()) || null,
      priaNameWithUndersowing: (editCropPria.undersowing && editCropPria.OTHER.trim()) || null,
      priaNameWithLegumeUndersowing: (editCropPria.undersowing && editCropPria.LEGUME.trim()) || null,
      varieties: existingCrop ? existingCrop.varieties : [],
      updatedAt: new Date().toISOString()
    };

    onSaveCrop(updatedCrop);
    setIsEditingCrop(false);
  };

  // Handlers for Variety Form
  const startCreateVariety = (crop: Crop) => {
    setVarietyTargetCropId(crop.id);
    setEditVarietyId(null);
    setEditVarietyName('');
    setEditVarietyBreeder('');
    setEditVarietyMaturity('');
    setEditVarietyWinterHardiness('');
    setEditVarietySeedRate(crop.defaultSeedRateKgHa ?? '');
    setEditVarietyPotentialYield(crop.defaultYieldTonsHa ?? '');
    setEditVarietyQualityClass('');
    setEditVarietyPriaName('');
    setEditVarietyNotes('');
    setIsEditingVariety(true);
    setIsEditingCrop(false);
  };

  const startEditVariety = (crop: Crop, variety: CropVariety) => {
    setVarietyTargetCropId(crop.id);
    setEditVarietyId(variety.id);
    setEditVarietyName(variety.name);
    setEditVarietyBreeder(variety.breeder || '');
    setEditVarietyMaturity(variety.maturityDays || '');
    setEditVarietyWinterHardiness(variety.winterHardiness || '');
    setEditVarietySeedRate(variety.recommendedSeedRateKgHa ?? '');
    setEditVarietyPotentialYield(variety.potentialYieldTonsHa ?? '');
    setEditVarietyQualityClass(variety.qualityClass || '');
    setEditVarietyPriaName(variety.priaName || '');
    setEditVarietyNotes(variety.notes || '');
    setIsEditingVariety(true);
    setIsEditingCrop(false);
  };

  const handleSaveVarietyForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!varietyTargetCropId || !editVarietyName.trim()) return;

    const crop = crops.find((c) => c.id === varietyTargetCropId);
    if (!crop) return;

    const newVariety: CropVariety = {
      id: editVarietyId || `var-${Date.now()}`,
      cropId: varietyTargetCropId,
      name: editVarietyName.trim(),
      breeder: editVarietyBreeder.trim() || undefined,
      maturityDays: editVarietyMaturity.trim() || undefined,
      winterHardiness: editVarietyWinterHardiness.trim() || undefined,
      recommendedSeedRateKgHa: editVarietySeedRate !== '' ? Number(editVarietySeedRate) : undefined,
      potentialYieldTonsHa: editVarietyPotentialYield !== '' ? Number(editVarietyPotentialYield) : undefined,
      qualityClass: editVarietyQualityClass.trim() || undefined,
      priaName: editVarietyPriaName.trim() || null,
      notes: editVarietyNotes.trim() || undefined,
      isActive: true
    };

    let updatedVarieties: CropVariety[];
    if (editVarietyId) {
      updatedVarieties = crop.varieties.map((v) => (v.id === editVarietyId ? newVariety : v));
    } else {
      updatedVarieties = [...crop.varieties, newVariety];
    }

    onSaveCrop({
      ...crop,
      varieties: updatedVarieties,
      updatedAt: new Date().toISOString()
    });

    setIsEditingVariety(false);
  };

  const handleDeleteVariety = async (crop: Crop, varietyId: string, varietyName: string) => {
    if (await confirmDialog(`Kas soovid kindlasti eemaldada sordi "${varietyName}" kultuurilt "${crop.name}"?`)) {
      const updatedVarieties = crop.varieties.filter((v) => v.id !== varietyId);
      onSaveCrop({
        ...crop,
        varieties: updatedVarieties,
        updatedAt: new Date().toISOString()
      });
    }
  };

  if (!isOpen && !isFullPage) return null;

  const targetCropForVariety = crops.find((c) => c.id === varietyTargetCropId);

  const bodyContent = (
    <>
      {/* Quick Stats Bar */}
          <div className="register-header-controls">
            <div className="year-selector-group">
              {onSelectYear && (
                <>
                  <span className="year-label">
                    <Calendar size={15} />
                    <span>Hooaeg:</span>
                  </span>
                  <ToggleGroup variant="pills" aria-label="Hooaasta" value={String(selectedYear)} onValueChange={(v) => onSelectYear(Number(v))}>
                    {availableYearsList.map((yr) => {
                      const isLocked = seasons.find((s) => s.year === yr)?.isLocked ?? false;
                      return (
                        <ToggleGroupItem
                          key={yr}
                          value={String(yr)}
                          title={`${yr}. a hooaeg ${isLocked ? '(Suletud muudatusteks)' : '(Aktiivne)'}`}
                        >
                          {yr}
                          {isLocked && <Lock size={10} />}
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                </>
              )}
              <div className="register-io-buttons">
                <Button
                  size="sm"
                  onClick={handleExportCsv}
                  title="Ekspordi kultuuride register CSV failina"
                >
                  <Download size={14} />
                  <span>CSV Eksport</span>
                </Button>
                <Button variant="primary" size="sm" onClick={() => startCreateCrop()}>
                  <Plus size={14} />
                  <span>Lisa uus kultuur</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Otsing */}
          <div className="register-actions-bar">
            <SearchInput className="search-field" value={searchQuery} onChange={setSearchQuery} placeholder="Otsi kultuuri, sorti, aretajat või PRIA koodi..." aria-label="Otsi kultuuri, sorti, aretajat või PRIA koodi..." />
            <span className="crop-total-area" title={`${selectedYear}. a külvipind kokku (kuvatud kultuurid)`}>
              Kokku: <strong>{filteredHectares.toFixed(2)} ha</strong>
            </span>
          </div>

          {/* 1. Kultuuri lisamine/muutmine eraldi aknas registri peal */}
          {isEditingCrop && (
            <Dialog open onOpenChange={(open) => { if (!open) setIsEditingCrop(false); }}>
            <DialogContent size="lg" className="crop-edit-modal">
            <DialogForm onSubmit={handleSaveCropForm}>
              <DialogHeader
                icon={<Edit2 size={20} />}
                title={editCropId ? `Muuda kultuuri: ${editCropName}` : 'Lisa uus kultuur'}
              />

              <DialogBody>

              <SectionTitle ruled>
                <Sprout size={14} />
                <span>1. Kultuuri põhiandmed</span>
              </SectionTitle>
              <FormGrid>
                <Field label="Kultuuri nimetus *" htmlFor="crop-name">
                  <Input
                    id="crop-name"
                    type="text"
                    required
                    placeholder="nt Talinisu, Suvioder, Taliraps"
                    value={editCropName}
                    onChange={(e) => setEditCropName(e.target.value)}
                  />
                </Field>

                <Field label="Ladinakeelne nimi (botaaniline)" htmlFor="crop-scientific">
                  <Input
                    id="crop-scientific"
                    type="text"
                    placeholder="nt Triticum aestivum"
                    value={editCropScientific}
                    onChange={(e) => setEditCropScientific(e.target.value)}
                  />
                </Field>

                <Field label="Kultuurigrupp *" htmlFor="crop-group">
                  <Select
                    id="crop-group"
                    value={editCropGroup}
                    onValueChange={(v) => setEditCropGroup(v as CropGroup)}
                    options={Object.entries(CROP_GROUP_CONFIG).map(([grp, cfg]) => ({ value: grp, label: `${cfg.icon} ${cfg.label}` }))}
                  />
                </Field>

                <Field>
                  <CheckboxField
                    checked={editCropIsWinter}
                    onCheckedChange={(checked) => {
                      setEditCropIsWinter(checked);
                      if (editCropAutoColor) setEditCropColor(pickCropColor(checked, crops.map((c) => c.color)));
                    }}
                    label="Talivili (külvatakse sügisel)"
                  />
                </Field>

                <Field label="GDD baastemperatuur (°C)" htmlFor="crop-gdd" hint="Temperatuurisumma arvutatakse päeva keskmisest miinus see väärtus. Teravili ja raps 5, mais 10.">
                  <NumberInput id="crop-gdd" value={editCropGddBase} onChange={(v) => setEditCropGddBase(v ?? undefined)} min={0} max={15} />
                </Field>

                <Field label="Värv kaardil ja ikoon" htmlFor="crop-color">
                  <FieldRow>
                    <Input
                      id="crop-color"
                      type="color"
                      value={editCropColor}
                      onChange={(e) => {
                        setEditCropColor(e.target.value);
                        setEditCropAutoColor(false);
                      }}
                      title="Kultuuri värv kaardil"
                    />
                    <Input
                      type="text"
                      value={editCropIcon}
                      onChange={(e) => setEditCropIcon(e.target.value)}
                      className="crop-icon-input"
                      aria-label="Ikoon"
                      placeholder="🌾"
                      title="Emoji või sümbol"
                    />
                    <Input
                      type="text"
                      aria-label="PRIA kood"
                      placeholder="PRIA kood (nt TNS)"
                      value={editCropPriaCode}
                      onChange={(e) => setEditCropPriaCode(e.target.value)}
                    />
                  </FieldRow>
                  {editCropId === null && (
                    <span title="Talivili saab külma, suvivili sooja tooni, mida ükski kultuur veel ei kasuta">
                      <CheckboxField
                        className="crop-auto-color-toggle"
                        checked={editCropAutoColor}
                        onCheckedChange={(checked) => {
                          setEditCropAutoColor(checked);
                          if (checked) setEditCropColor(pickCropColor(editCropIsWinter, crops.map((c) => c.color)));
                        }}
                        label="Genereeri värv automaatselt (talivili külm, suvivili soe toon)"
                      />
                    </span>
                  )}
                </Field>

                <Field label="Vaikimisi külvinorm (kg/ha)" htmlFor="crop-seed-rate">
                  <NumberInput
                    id="crop-seed-rate"
                    decimals={1}
                    placeholder="nt 220"
                    value={editCropSeedRate === '' ? null : editCropSeedRate}
                    onChange={(v) => setEditCropSeedRate(v ?? '')}
                  />
                </Field>

                <Field label="Baas-saagiootus (t/ha)" htmlFor="crop-yield">
                  <NumberInput
                    id="crop-yield"
                    decimals={1}
                    placeholder="nt 7,5"
                    value={editCropYield === '' ? null : editCropYield}
                    onChange={(v) => setEditCropYield(v ?? '')}
                  />
                </Field>

                <Field label="Agrotehniline kirjeldus ja märkused" htmlFor="crop-description" span="full">
                  <Input
                    id="crop-description"
                    type="text"
                    placeholder="nt Nõudlik eelvilja suhtes, sobib varajaseks külviks..."
                    value={editCropDescription}
                    onChange={(e) => setEditCropDescription(e.target.value)}
                  />
                </Field>

                <Field label="PRIA nimetus" htmlFor="crop-pria-name" span="full">
                  <Input
                    id="crop-pria-name"
                    type="text"
                    placeholder={editCropName.trim() || 'nt Muu põlduba'}
                    value={editCropPria.name}
                    onChange={(e) => setEditCropPria({ ...editCropPria, name: e.target.value })}
                    title="Nimi PRIA põllumajanduskultuuride loetelust; tühi = kultuuri nimi. Põllu hooaja PRIA nimetus tuletatakse sellest."
                  />
                  <CheckboxField
                    checked={editCropPria.undersowing}
                    onCheckedChange={(checked) => setEditCropPria({ ...editCropPria, undersowing: checked })}
                    label="PRIA eristab allakülvi (nimele lisandub allakülvi variant)"
                  />
                </Field>

                {editCropPria.undersowing && (Object.keys(UNDERSOWING_LABELS) as Undersowing[]).map((u) => (
                  <Field label={`PRIA nimetus: ${UNDERSOWING_LABELS[u].toLowerCase()}`} htmlFor={`crop-pria-${u}`} span="full" key={u}>
                    <Input
                      id={`crop-pria-${u}`}
                      type="text"
                      placeholder={defaultPriaVariantName(editCropPria.name.trim() || editCropName.trim() || 'Kultuur', u)}
                      value={editCropPria[u]}
                      onChange={(e) => setEditCropPria({ ...editCropPria, [u]: e.target.value })}
                      title="Täida ainult siis, kui PRIA nimi erineb vaikimisi nimest"
                    />
                  </Field>
                ))}
              </FormGrid>

              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsEditingCrop(false)}>
                  Loobu
                </Button>
                <Button type="submit" variant="primary">
                  Salvesta kultuur
                </Button>
              </DialogFooter>
            </DialogForm>
            </DialogContent>
            </Dialog>
          )}

          {/* 2. Sordi lisamine/muutmine eraldi aknas registri peal */}
          {isEditingVariety && targetCropForVariety && (
            <Dialog open onOpenChange={(open) => { if (!open) setIsEditingVariety(false); }}>
            <DialogContent size="lg" className="crop-edit-modal">
            <DialogForm onSubmit={handleSaveVarietyForm}>
              <DialogHeader
                icon={<Tag size={20} />}
                title={editVarietyId ? `Muuda sorti: ${editVarietyName}` : `Lisa sort: ${targetCropForVariety.name}`}
              />

              <DialogBody>

              <SectionTitle ruled>
                <Sparkles size={14} />
                <span>Sordi omadused ja aretusandmed ({targetCropForVariety.name})</span>
              </SectionTitle>
              <FormGrid>
                <Field label="Sordinimi *" htmlFor="variety-name">
                  <Input
                    id="variety-name"
                    type="text"
                    required
                    placeholder="nt Skagen, Planet, Mercedes"
                    value={editVarietyName}
                    onChange={(e) => setEditVarietyName(e.target.value)}
                  />
                </Field>

                <Field label="Aretaja / Esindaja" htmlFor="variety-breeder">
                  <Input
                    id="variety-breeder"
                    type="text"
                    placeholder="nt Nordic Seed, KWS, Saaten-Union"
                    value={editVarietyBreeder}
                    onChange={(e) => setEditVarietyBreeder(e.target.value)}
                  />
                </Field>

                <Field label="Valmimisaeg / Kasvuea pikkus" htmlFor="variety-maturity">
                  <Input
                    id="variety-maturity"
                    type="text"
                    placeholder="nt Varajane, Keskvalmiv, 95 päeva"
                    value={editVarietyMaturity}
                    onChange={(e) => setEditVarietyMaturity(e.target.value)}
                  />
                </Field>

                <Field label="Talvekindlus" htmlFor="variety-hardiness">
                  <Input
                    id="variety-hardiness"
                    type="text"
                    placeholder="nt Väga hea, Hea, Kevadine"
                    value={editVarietyWinterHardiness}
                    onChange={(e) => setEditVarietyWinterHardiness(e.target.value)}
                  />
                </Field>

                <Field label="Soovituslik külvinorm (kg/ha)" htmlFor="variety-seed-rate">
                  <NumberInput
                    id="variety-seed-rate"
                    decimals={1}
                    placeholder="nt 210"
                    value={editVarietySeedRate === '' ? null : editVarietySeedRate}
                    onChange={(v) => setEditVarietySeedRate(v ?? '')}
                  />
                </Field>

                <Field label="Saagipotentsiaal (t/ha)" htmlFor="variety-yield">
                  <NumberInput
                    id="variety-yield"
                    decimals={1}
                    placeholder="nt 9,5"
                    value={editVarietyPotentialYield === '' ? null : editVarietyPotentialYield}
                    onChange={(v) => setEditVarietyPotentialYield(v ?? '')}
                  />
                </Field>

                <Field label="Kvaliteediklass / Sihtotstarve" htmlFor="variety-quality">
                  <Input
                    id="variety-quality"
                    type="text"
                    placeholder="nt Toiduvili (E), Õlleoder, Sööt"
                    value={editVarietyQualityClass}
                    onChange={(e) => setEditVarietyQualityClass(e.target.value)}
                  />
                </Field>

                <Field label="PRIA nimetus" htmlFor="variety-pria-name">
                  <Input
                    id="variety-pria-name"
                    type="text"
                    placeholder="tühi = kultuuri PRIA nimetus"
                    value={editVarietyPriaName}
                    onChange={(e) => setEditVarietyPriaName(e.target.value)}
                    title='Ainult siis, kui PRIA loetelus on sort eraldi (nt "Sangaste" rukis, põlduba "Jõgeva")'
                  />
                </Field>

                <Field label="Märkused sordi kohta" htmlFor="variety-notes">
                  <Input
                    id="variety-notes"
                    type="text"
                    placeholder="nt Kõrge proteiinisisaldus, vastupidav pruunroostele"
                    value={editVarietyNotes}
                    onChange={(e) => setEditVarietyNotes(e.target.value)}
                  />
                </Field>

              </FormGrid>

              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsEditingVariety(false)}>
                  Loobu
                </Button>
                <Button type="submit" variant="primary">
                  Salvesta sort
                </Button>
              </DialogFooter>
            </DialogForm>
            </DialogContent>
            </Dialog>
          )}

          {/* Kultuurid neljas veerus (teraviljad, õlikultuurid, kaunviljad, muud);
              sortide alamregister avaneb kultuuri rea alla */}
          <div className="crop-group-columns">
            {cropBlocks.map((block) => {
              const blockCrops = filteredCrops
                .filter((c) => block.groups.includes(c.group))
                .sort((a, b) => a.name.localeCompare(b.name, 'et'));
              const blockHa = blockCrops.reduce((sum, c) => sum + (cropAcreageMap[c.id] || 0), 0);
              const showGroupTag = block.groups.length > 1;

              return (
                <section key={block.key} className="crop-group-block">
                  <div className="crop-group-block-header">
                    <h4>
                      <span>{block.icon}</span>
                      <span>{block.label}</span>
                      <Badge>{blockCrops.length}</Badge>
                    </h4>
                    {blockHa > 0 && <span className="crop-group-ha">{blockHa.toFixed(2)} ha</span>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startCreateCrop(block.groups[0])}
                      title={`Lisa uus kultuur: ${block.label}`}
                    >
                      <Plus size={15} />
                    </Button>
                  </div>

                  {blockCrops.length > 0 ? (
                    <Table scroll="fill" bordered containerClassName="crop-register-wrap" className="crop-register-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Kultuur</TableHead>
                            <TableHead numeric>Pind</TableHead>
                            <TableHead numeric>Külvinorm</TableHead>
                            <TableHead numeric>Saagiootus</TableHead>
                            <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {blockCrops.map((crop) => {
                            const groupCfg = CROP_GROUP_CONFIG[crop.group] || CROP_GROUP_CONFIG.OTHER;
                            const acreageHa = cropAcreageMap[crop.id] || 0;
                            const cropStyle = { '--crop-color': crop.color } as React.CSSProperties;

                            return (
                              <React.Fragment key={crop.id}>
                                <TableRow className={`crop-row ${crop.varieties.length > 0 ? 'has-varieties' : ''}`}>
                                  <TableCell wrap className="crop-name-cell" style={cropStyle} title={crop.description || undefined}>
                                    <div className="field-title-line">
                                      <span className="field-name">{crop.name}</span>
                                    </div>
                                    {crop.scientificName && <div className="cell-sub crop-latin">{crop.scientificName}</div>}
                                    <div className="field-sub-tags">
                                      <Badge tone={crop.isWinterCrop ? 'info' : 'neutral'}>
                                        {crop.isWinterCrop ? '❄️ Talivili' : '☀️ Suvivili'}
                                      </Badge>
                                      {crop.priaCode && <Badge tone="info" className="num" title="PRIA toetuse kultuurikood">{crop.priaCode}</Badge>}
                                      {showGroupTag && <Badge>{groupCfg.icon} {groupCfg.label}</Badge>}
                                    </div>
                                  </TableCell>
                                  <TableCell numeric className={`${acreageHa > 0 ? '' : 'muted'}`}>
                                    {acreageHa > 0 ? `${acreageHa.toFixed(2)} ha` : '–'}
                                  </TableCell>
                                  <TableCell numeric className={`${crop.defaultSeedRateKgHa ? '' : 'muted'}`}>
                                    {crop.defaultSeedRateKgHa ? `${crop.defaultSeedRateKgHa} kg/ha` : '–'}
                                  </TableCell>
                                  <TableCell numeric className={`${crop.defaultYieldTonsHa ? '' : 'muted'}`}>
                                    {crop.defaultYieldTonsHa ? `${crop.defaultYieldTonsHa} t/ha` : '–'}
                                  </TableCell>
                                  <TableCell actions>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => startCreateVariety(crop)}
                                        title={`Lisa uus sort kultuurile "${crop.name}"`}
                                      >
                                        <Plus size={14} />
                                      </Button>
                                      <Button variant="ghost" size="icon-sm" onClick={() => startEditCrop(crop)} title="Muuda">
                                        <Edit2 size={14} />
                                      </Button>
                                      <Button
                                        variant="danger-ghost"
                                        size="icon-sm"
                                        onClick={async () => {
                                          if (await confirmDialog(`Kas soovid kindlasti kustutada kultuuri "${crop.name}" ja kõik selle sordid?`)) {
                                            onDeleteCrop(crop.id);
                                          }
                                        }}
                                        title="Kustuta kultuur registrist"
                                      >
                                        <Trash2 size={14} />
                                      </Button>
</TableCell>
                                </TableRow>

                                {/* Sordid kohe kultuuri all, nihkega */}
                                {crop.varieties.map((variety, vIdx) => {
                                  const details = [
                                    variety.breeder,
                                    variety.maturityDays,
                                    variety.winterHardiness && `talvekindlus: ${variety.winterHardiness}`,
                                    variety.qualityClass
                                  ].filter(Boolean).join(' · ');
                                  const isLast = vIdx === crop.varieties.length - 1;
                                  const varietyHa = cropAcreageMap[`${crop.id}|${variety.name.toLowerCase().trim()}`] || 0;
                                  return (
                                    <TableRow key={variety.id} className={`variety-row ${isLast ? 'last' : ''}`}>
                                      <TableCell wrap className="variety-name-cell" style={cropStyle} title={variety.notes || undefined}>
                                        <span className="variety-name">{variety.name}</span>
                                        {details && <div className="cell-sub">{details}</div>}
                                      </TableCell>
                                      <TableCell numeric className={`${varietyHa > 0 ? '' : 'muted'}`}>
                                        {varietyHa > 0 ? `${varietyHa.toFixed(2)} ha` : '–'}
                                      </TableCell>
                                      <TableCell numeric className={`${variety.recommendedSeedRateKgHa ? '' : 'muted'}`}>
                                        {variety.recommendedSeedRateKgHa ? `${variety.recommendedSeedRateKgHa} kg/ha` : '–'}
                                      </TableCell>
                                      <TableCell numeric className={`${variety.potentialYieldTonsHa ? '' : 'muted'}`}>
                                        {variety.potentialYieldTonsHa ? `${variety.potentialYieldTonsHa} t/ha` : '–'}
                                      </TableCell>
                                      <TableCell actions>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => startEditVariety(crop, variety)}
                                            title="Muuda sordi andmeid"
                                          >
                                            <Edit2 size={12} />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="danger-ghost"
                                            size="icon-sm"
                                            onClick={() => handleDeleteVariety(crop, variety.id, variety.name)}
                                            title="Kustuta sort"
                                          >
                                            <Trash2 size={12} />
                                          </Button>
</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                  ) : (
                    <div className="crop-group-empty">
                      {searchQuery ? 'Otsingule vastavaid kultuure pole' : 'Kultuure pole lisatud'}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
    </>
  );

  if (isFullPage) {
    return (
      <div className="fullpage-board-view">
        <main className="fullpage-board-main wide">
          <PageHeader icon={<Sprout />} title="Kultuurid" subtitle="Kultuuride ja sortide register, värvikoodid, külvinormid ja saagiootused" />
          <div className="fullpage-board-body">
            <div className="fullpage-board-content">
              {bodyContent}
            </div>
          </div>
          <div className="fullpage-board-footer">
            <span>
              Kuvatakse {filteredCrops.length} kultuuri {crops.length}-st &bull; Seotud hooaeg: {selectedYear}
            </span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="full" className="field-register-modal">
        <DialogHeader
          icon={<Sprout size={24} />}
          title="Kultuuride ja Sortide Register"
          description={`Põllukultuurid, sortide alamregistrid, külvinormid ja saagiootused (${stats.totalCrops} kultuuri, ${stats.totalVarieties} sorti)`}
        />

        <DialogBody>
          {bodyContent}
        </DialogBody>

        <DialogFooter>
          <div className="footer-left-info">
            <span className="secondary-note">
              Kuvatakse {filteredCrops.length} kultuuri {crops.length}-st &bull; Seotud hooaeg: {selectedYear}
            </span>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Sulge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
