// src/components/CropRegisterModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sprout,
  Search,
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

interface CropRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  crops: Crop[];
  onSaveCrop: (crop: Crop) => void;
  onDeleteCrop: (cropId: string) => void;
  masterFields?: MasterField[];
  selectedYear?: number;
  // Avatud teise akna (nt põllu muutmise) pealt — kuvatakse kõige peal.
  stacked?: boolean;
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
  stacked = false,
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
  const [editCropColor, setEditCropColor] = useState('#eab308');
  const [editCropIcon, setEditCropIcon] = useState('🌾');
  const [editCropPriaCode, setEditCropPriaCode] = useState('');
  const [editCropSeedRate, setEditCropSeedRate] = useState<number | ''>('');
  const [editCropYield, setEditCropYield] = useState<number | ''>('');
  const [editCropDescription, setEditCropDescription] = useState('');
  const [editCropIsWinter, setEditCropIsWinter] = useState(false);
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

  // Esc sulgeb ainult muutmisakna (register jääb avatuks).
  useEffect(() => {
    if (!isEditingCrop) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditingCrop(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isEditingCrop]);

  useEffect(() => {
    if (!isEditingVariety) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditingVariety(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isEditingVariety]);

  if (!isOpen && !isFullPage) return null;

  const targetCropForVariety = crops.find((c) => c.id === varietyTargetCropId);

  const bodyContent = (
    <div className="modal-body">
      {/* Quick Stats Bar */}
          <div className="register-header-controls">
            <div className="year-selector-group">
              {onSelectYear && (
                <>
                  <span className="year-label">
                    <Calendar size={15} className="text-blue" />
                    <span>Hooaeg:</span>
                  </span>
                  <div className="year-tabs">
                    {availableYearsList.map((yr) => {
                      const isLocked = seasons.find((s) => s.year === yr)?.isLocked ?? false;
                      return (
                        <button
                          key={yr}
                          className={`year-tab ${selectedYear === yr ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                          onClick={() => onSelectYear(yr)}
                          title={`${yr}. a hooaeg ${isLocked ? '(Suletud muudatusteks)' : '(Aktiivne)'}`}
                        >
                          <span>{yr}</span>
                          {isLocked && <Lock size={10} className="tab-lock-icon" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="register-io-buttons">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportCsv}
                  title="Ekspordi kultuuride register CSV failina"
                >
                  <Download size={14} />
                  <span>CSV Eksport</span>
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => startCreateCrop()}>
                  <Plus size={14} />
                  <span>Lisa uus kultuur</span>
                </button>
              </div>
            </div>
          </div>

          {/* Otsing */}
          <div className="register-actions-bar">
            <div className="search-box-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Otsi kultuuri, sorti, aretajat või PRIA koodi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input search-input"
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 1. Kultuuri lisamine/muutmine eraldi aknas registri peal (portal: registri aken on
              glass-card, mille backdrop-filter piiraks muidu position: fixed tausta) */}
          {isEditingCrop && createPortal(
            <div className={`modal-backdrop sub-modal ${stacked ? 'stacked' : ''}`}>
            <form onSubmit={handleSaveCropForm} className="modal-content crop-edit-modal animate-scale-up">
              <div className="modal-header">
                <div className="modal-title-group">
                  <Edit2 size={20} className="text-emerald" />
                  <h3>{editCropId ? `Muuda kultuuri: ${editCropName}` : 'Lisa uus kultuur'}</h3>
                </div>
                <button className="icon-btn-ghost" type="button" onClick={() => setIsEditingCrop(false)} title="Sulge (Esc)">
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">

              <div className="form-sub-header">
                <Sprout size={14} />
                <span>1. Kultuuri põhiandmed</span>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Kultuuri nimetus *</label>
                  <input
                    type="text"
                    required
                    placeholder="nt Talinisu, Suvioder, Taliraps"
                    value={editCropName}
                    onChange={(e) => setEditCropName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Ladinakeelne nimi (botaaniline)</label>
                  <input
                    type="text"
                    placeholder="nt Triticum aestivum"
                    value={editCropScientific}
                    onChange={(e) => setEditCropScientific(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Kultuurigrupp *</label>
                  <select
                    value={editCropGroup}
                    onChange={(e) => setEditCropGroup(e.target.value as CropGroup)}
                    className="form-input"
                  >
                    {Object.entries(CROP_GROUP_CONFIG).map(([grp, cfg]) => (
                      <option key={grp} value={grp}>
                        {cfg.icon} {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="crop-winter-toggle">
                    <input
                      type="checkbox"
                      checked={editCropIsWinter}
                      onChange={(e) => {
                        setEditCropIsWinter(e.target.checked);
                        if (editCropAutoColor) setEditCropColor(pickCropColor(e.target.checked, crops.map((c) => c.color)));
                      }}
                    />
                    <span>Talivili (külvatakse sügisel)</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Värv kaardil ja ikoon</label>
                  <div className="input-split" style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="color"
                      value={editCropColor}
                      onChange={(e) => {
                        setEditCropColor(e.target.value);
                        setEditCropAutoColor(false);
                      }}
                      className="form-input"
                      style={{ padding: '2px', height: '36px', width: '50px' }}
                      title="Kultuuri värv kaardil"
                    />
                    <input
                      type="text"
                      value={editCropIcon}
                      onChange={(e) => setEditCropIcon(e.target.value)}
                      className="form-input"
                      style={{ width: '60px', textAlign: 'center', fontSize: '1.2rem' }}
                      placeholder="🌾"
                      title="Emoji või sümbol"
                    />
                    <input
                      type="text"
                      placeholder="PRIA kood (nt TNS)"
                      value={editCropPriaCode}
                      onChange={(e) => setEditCropPriaCode(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  {editCropId === null && (
                    <label className="crop-winter-toggle crop-auto-color-toggle" title="Talivili saab külma, suvivili sooja tooni, mida ükski kultuur veel ei kasuta">
                      <input
                        type="checkbox"
                        checked={editCropAutoColor}
                        onChange={(e) => {
                          setEditCropAutoColor(e.target.checked);
                          if (e.target.checked) setEditCropColor(pickCropColor(editCropIsWinter, crops.map((c) => c.color)));
                        }}
                      />
                      <span>Genereeri värv automaatselt (talivili külm, suvivili soe toon)</span>
                    </label>
                  )}
                </div>

                <div className="form-group">
                  <label>Vaikimisi külvinorm (kg/ha)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="nt 220"
                    value={editCropSeedRate}
                    onChange={(e) => setEditCropSeedRate(e.target.value ? Number(e.target.value) : '')}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Baas-saagiootus (t/ha)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="nt 7.5"
                    value={editCropYield}
                    onChange={(e) => setEditCropYield(e.target.value ? Number(e.target.value) : '')}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Agrotehniline kirjeldus ja märkused</label>
                  <input
                    type="text"
                    placeholder="nt Nõudlik eelvilja suhtes, sobib varajaseks külviks..."
                    value={editCropDescription}
                    onChange={(e) => setEditCropDescription(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setIsEditingCrop(false)}>
                  Loobu
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvesta kultuur
                </button>
              </div>
            </form>
            </div>,
            document.body
          )}

          {/* 2. Sordi lisamine/muutmine eraldi aknas registri peal */}
          {isEditingVariety && targetCropForVariety && createPortal(
            <div className={`modal-backdrop sub-modal ${stacked ? 'stacked' : ''}`}>
            <form onSubmit={handleSaveVarietyForm} className="modal-content crop-edit-modal animate-scale-up" style={{ borderTop: '4px solid var(--blue-500)' }}>
              <div className="modal-header">
                <div className="modal-title-group">
                  <Tag size={20} className="text-blue" />
                  <h3>
                    {editVarietyId ? `Muuda sorti: ${editVarietyName}` : `Lisa sort: ${targetCropForVariety.name}`}
                  </h3>
                </div>
                <button className="icon-btn-ghost" type="button" onClick={() => setIsEditingVariety(false)} title="Sulge (Esc)">
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">

              <div className="form-sub-header">
                <Sparkles size={14} />
                <span>Sordi omadused ja aretusandmed ({targetCropForVariety.name})</span>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Sordinimi *</label>
                  <input
                    type="text"
                    required
                    placeholder="nt Skagen, Planet, Mercedes"
                    value={editVarietyName}
                    onChange={(e) => setEditVarietyName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Aretaja / Esindaja</label>
                  <input
                    type="text"
                    placeholder="nt Nordic Seed, KWS, Saaten-Union"
                    value={editVarietyBreeder}
                    onChange={(e) => setEditVarietyBreeder(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Valmimisaeg / Kasvuea pikkus</label>
                  <input
                    type="text"
                    placeholder="nt Varajane, Keskvalmiv, 95 päeva"
                    value={editVarietyMaturity}
                    onChange={(e) => setEditVarietyMaturity(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Talvekindlus</label>
                  <input
                    type="text"
                    placeholder="nt Väga hea, Hea, Kevadine"
                    value={editVarietyWinterHardiness}
                    onChange={(e) => setEditVarietyWinterHardiness(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Soovituslik külvinorm (kg/ha)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="nt 210"
                    value={editVarietySeedRate}
                    onChange={(e) => setEditVarietySeedRate(e.target.value ? Number(e.target.value) : '')}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Saagipotentsiaal (t/ha)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="nt 9.5"
                    value={editVarietyPotentialYield}
                    onChange={(e) => setEditVarietyPotentialYield(e.target.value ? Number(e.target.value) : '')}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Kvaliteediklass / Sihtotstarve</label>
                  <input
                    type="text"
                    placeholder="nt Toiduvili (E), Õlleoder, Sööt"
                    value={editVarietyQualityClass}
                    onChange={(e) => setEditVarietyQualityClass(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Märkused sordi kohta</label>
                  <input
                    type="text"
                    placeholder="nt Kõrge proteiinisisaldus, vastupidav pruunroostele"
                    value={editVarietyNotes}
                    onChange={(e) => setEditVarietyNotes(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setIsEditingVariety(false)}>
                  Loobu
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvesta sort
                </button>
              </div>
            </form>
            </div>,
            document.body
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
                      <span className="crop-group-count">{blockCrops.length}</span>
                    </h4>
                    {blockHa > 0 && <span className="crop-group-ha">{blockHa.toFixed(2)} ha</span>}
                    <button
                      type="button"
                      className="icon-btn-ghost"
                      onClick={() => startCreateCrop(block.groups[0])}
                      title={`Lisa uus kultuur: ${block.label}`}
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  {blockCrops.length > 0 ? (
                    <div className="register-table-wrap">
                      <table className="register-table crop-register-table">
                        <thead>
                          <tr>
                            <th>Kultuur</th>
                            <th className="num-col">Pind</th>
                            <th className="num-col">Külvinorm</th>
                            <th className="num-col">Saagiootus</th>
                            <th className="actions-col"><span className="sr-only">Tegevused</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {blockCrops.map((crop) => {
                            const groupCfg = CROP_GROUP_CONFIG[crop.group] || CROP_GROUP_CONFIG.OTHER;
                            const acreageHa = cropAcreageMap[crop.id] || 0;
                            const cropStyle = { '--crop-color': crop.color } as React.CSSProperties;

                            return (
                              <React.Fragment key={crop.id}>
                                <tr className={`crop-row ${crop.varieties.length > 0 ? 'has-varieties' : ''}`}>
                                  <td className="name-cell crop-name-cell" style={cropStyle} title={crop.description || undefined}>
                                    <div className="field-title-line">
                                      <span className="field-name">{crop.name}</span>
                                    </div>
                                    {crop.scientificName && <div className="cell-sub crop-latin">{crop.scientificName}</div>}
                                    <div className="field-sub-tags">
                                      <span className={`sub-tag ${crop.isWinterCrop ? 'winter-tag' : 'spring-tag'}`}>
                                        {crop.isWinterCrop ? '❄️ Talivili' : '☀️ Suvivili'}
                                      </span>
                                      {crop.priaCode && <span className="field-code-badge" title="PRIA toetuse kultuurikood">{crop.priaCode}</span>}
                                      {showGroupTag && <span className="sub-tag">{groupCfg.icon} {groupCfg.label}</span>}
                                    </div>
                                  </td>
                                  <td className={`num-col ${acreageHa > 0 ? '' : 'muted'}`}>
                                    {acreageHa > 0 ? <strong>{acreageHa.toFixed(2)} ha</strong> : '–'}
                                  </td>
                                  <td className={`num-col ${crop.defaultSeedRateKgHa ? '' : 'muted'}`}>
                                    {crop.defaultSeedRateKgHa ? `${crop.defaultSeedRateKgHa} kg/ha` : '–'}
                                  </td>
                                  <td className={`num-col ${crop.defaultYieldTonsHa ? '' : 'muted'}`}>
                                    {crop.defaultYieldTonsHa ? `${crop.defaultYieldTonsHa} t/ha` : '–'}
                                  </td>
                                  <td className="actions-col">
                                    <div className="row-actions">
                                      <button
                                        className="icon-btn-ghost"
                                        onClick={() => startCreateVariety(crop)}
                                        title={`Lisa uus sort kultuurile "${crop.name}"`}
                                      >
                                        <Plus size={14} />
                                      </button>
                                      <button className="icon-btn-ghost" onClick={() => startEditCrop(crop)} title="Muuda">
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        className="icon-btn-danger"
                                        onClick={async () => {
                                          if (await confirmDialog(`Kas soovid kindlasti kustutada kultuuri "${crop.name}" ja kõik selle sordid?`)) {
                                            onDeleteCrop(crop.id);
                                          }
                                        }}
                                        title="Kustuta kultuur registrist"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

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
                                    <tr key={variety.id} className={`variety-row ${isLast ? 'last' : ''}`}>
                                      <td className="name-cell variety-name-cell" style={cropStyle} title={variety.notes || undefined}>
                                        <span className="variety-name">{variety.name}</span>
                                        {details && <div className="cell-sub">{details}</div>}
                                      </td>
                                      <td className={`num-col ${varietyHa > 0 ? '' : 'muted'}`}>
                                        {varietyHa > 0 ? `${varietyHa.toFixed(2)} ha` : '–'}
                                      </td>
                                      <td className={`num-col ${variety.recommendedSeedRateKgHa ? '' : 'muted'}`}>
                                        {variety.recommendedSeedRateKgHa ? `${variety.recommendedSeedRateKgHa} kg/ha` : '–'}
                                      </td>
                                      <td className={`num-col ${variety.potentialYieldTonsHa ? '' : 'muted'}`}>
                                        {variety.potentialYieldTonsHa ? `${variety.potentialYieldTonsHa} t/ha` : '–'}
                                      </td>
                                      <td className="actions-col">
                                        <div className="row-actions">
                                          <button
                                            type="button"
                                            className="icon-btn-ghost"
                                            onClick={() => startEditVariety(crop, variety)}
                                            title="Muuda sordi andmeid"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            className="icon-btn-danger"
                                            onClick={() => handleDeleteVariety(crop, variety.id, variety.name)}
                                            title="Kustuta sort"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="crop-group-empty">
                      {searchQuery ? 'Otsingule vastavaid kultuure pole' : 'Kultuure pole lisatud'}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
  );

  if (isFullPage) {
    return (
      <div className="fullpage-board-view">
        <main className="fullpage-board-main wide">
          <div className="fullpage-board-header">
            <div className="fullpage-title-wrap">
              <Sprout className="text-emerald" size={26} />
              <div>
                <h2>Kultuurid</h2>
                <p className="fullpage-subtitle">Kultuuride ja sortide register, värvikoodid, külvinormid ja saagiootused</p>
              </div>
            </div>
          </div>
          <div className="fullpage-board-body">
            {bodyContent}
          </div>
          <div className="fullpage-board-footer">
            <span>
              Kuvatakse <strong>{filteredCrops.length}</strong> kultuuri <strong>{crops.length}</strong>-st &bull; Seotud hooaeg: <strong>{selectedYear}</strong>
            </span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`modal-backdrop ${stacked ? 'stacked' : ''}`}>
      <div className="modal-content glass-card field-register-modal animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <Sprout className="text-emerald" size={24} />
            <div>
              <h3>Kultuuride ja Sortide Register</h3>
              <p className="modal-subtitle">
                Põllukultuurid, sortide alamregistrid, külvinormid ja saagiootused ({stats.totalCrops} kultuuri, {stats.totalVarieties} sorti)
              </p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose} title="Sulge register">
            <X size={20} />
          </button>
        </div>

        {bodyContent}

        <div className="modal-footer">
          <div className="footer-left-info">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Kuvatakse <strong>{filteredCrops.length}</strong> kultuuri <strong>{crops.length}</strong>-st &bull; Seotud hooaeg: <strong>{selectedYear}</strong>
            </span>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Sulge
          </button>
        </div>
      </div>
    </div>
  );
};
