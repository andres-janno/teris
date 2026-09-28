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
  AlertCircle,
  Tag,
  Sparkles
} from 'lucide-react';
import type { Crop, CropVariety, CropGroup } from '../types/crop';
import { CROP_GROUP_CONFIG } from '../types/crop';
import type { MasterField } from '../types/fieldRegister';

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
}

export const CropRegisterModal: React.FC<CropRegisterModalProps> = ({
  isOpen,
  onClose,
  crops,
  onSaveCrop,
  onDeleteCrop,
  masterFields = [],
  selectedYear = 2026,
  stacked = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');

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
      }
    });
    return map;
  }, [masterFields, crops, selectedYear]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalVarieties = 0;
    let totalHectares = 0;
    crops.forEach((c) => {
      totalVarieties += c.varieties?.length || 0;
      totalHectares += cropAcreageMap[c.id] || 0;
    });

    return {
      totalCrops: crops.length,
      totalVarieties,
      totalHectares: Math.round(totalHectares * 100) / 100
    };
  }, [crops, cropAcreageMap]);

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

      const matchesGroup = groupFilter === 'ALL' || crop.group === groupFilter;

      return matchesSearch && matchesGroup;
    });
  }, [crops, searchQuery, groupFilter]);

  // Handlers for Crop Form
  const startCreateCrop = () => {
    setEditCropId(null);
    setEditCropName('');
    setEditCropScientific('');
    setEditCropGroup('CEREAL');
    setEditCropColor('#eab308');
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

  const handleDeleteVariety = (crop: Crop, varietyId: string, varietyName: string) => {
    if (confirm(`Kas soovid kindlasti eemaldada sordi "${varietyName}" kultuurilt "${crop.name}"?`)) {
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

  if (!isOpen) return null;

  const targetCropForVariety = crops.find((c) => c.id === varietyTargetCropId);

  return (
    <div className={`modal-backdrop ${stacked ? 'stacked' : ''}`}>
      <div className="modal-content glass-card field-register-modal animate-scale-up">
        {/* Header - Identical to Field & Parties modals */}
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

        <div className="modal-body">
          {/* Quick Stats Bar */}
          <div className="register-header-controls">
            <div className="register-stats-pills">
              <div className="reg-stat-pill">
                <span className="lbl">Kultuure kokku:</span>
                <strong>{stats.totalCrops} tk</strong>
              </div>

              <div className="reg-stat-pill highlight">
                <span className="lbl">🌾 Registreeritud sorte:</span>
                <strong>{stats.totalVarieties} tk</strong>
                <span className="sub-val text-emerald">(alamregistrites)</span>
              </div>

              <div className="reg-stat-pill tenure-owned">
                <span className="lbl">{selectedYear}. a külvipind kokku:</span>
                <strong>{stats.totalHectares} ha</strong>
                <span className="sub-val text-blue">(põldude registrist)</span>
              </div>

              <div className="reg-stat-pill tenure-rented">
                <span className="lbl">Kultuurigruppe:</span>
                <strong>{Object.keys(CROP_GROUP_CONFIG).length} gruppi</strong>
              </div>
            </div>
          </div>

          {/* Search, Filter & Actions Toolbar */}
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

            {/* Group Filter */}
            <select
              className="form-input filter-select"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="ALL">Kõik grupid ({crops.length})</option>
              {Object.entries(CROP_GROUP_CONFIG).map(([grp, cfg]) => (
                <option key={grp} value={grp}>
                  {cfg.icon} {cfg.label} ({crops.filter((c) => c.group === grp).length})
                </option>
              ))}
            </select>

            <div className="actions-right">
              <button className="btn btn-primary btn-sm" onClick={startCreateCrop}>
                <Plus size={14} />
                <span>Lisa uus kultuur</span>
              </button>
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
                    <input type="checkbox" checked={editCropIsWinter} onChange={(e) => setEditCropIsWinter(e.target.checked)} />
                    <span>Talivili (külvatakse sügisel)</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Värv kaardil ja ikoon</label>
                  <div className="input-split" style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="color"
                      value={editCropColor}
                      onChange={(e) => setEditCropColor(e.target.value)}
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

          {/* Master Crops List */}
          <div className="register-fields-list">
            {filteredCrops.map((crop, idx) => {
              const groupCfg = CROP_GROUP_CONFIG[crop.group] || CROP_GROUP_CONFIG.OTHER;
              const acreageHa = cropAcreageMap[crop.id] || 0;

              return (
                <div
                  key={crop.id}
                  className="master-field-card glass-card"
                  style={{ borderLeft: `4px solid ${crop.color}` }}
                >
                  <div className="field-card-main-row">
                    {/* Left Info Col */}
                    <div className="field-info-col">
                      <div className="field-title-line">
                        <span className="field-id-badge">#{idx + 1}</span>
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{crop.icon || '🌾'}</span>
                        <h4 className="field-name">{crop.name}</h4>

                        {crop.scientificName && (
                          <span style={{ fontStyle: 'italic', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            ({crop.scientificName})
                          </span>
                        )}

                        <span
                          className="field-num-badge"
                          style={{
                            backgroundColor: groupCfg.bgColor,
                            color: groupCfg.color,
                            borderColor: `${groupCfg.color}40`
                          }}
                        >
                          {groupCfg.icon} {groupCfg.label}
                        </span>

                        {crop.priaCode && (
                          <span className="field-code-badge" title="PRIA toetuse kultuurikood">
                            PRIA: {crop.priaCode}
                          </span>
                        )}

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: `${crop.color}20`,
                            color: crop.color,
                            border: `1px solid ${crop.color}40`,
                            fontWeight: 600
                          }}
                        >
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: crop.color }}></span>
                          Kaardivärv
                        </span>
                      </div>

                      {/* Technical metadata tags */}
                      <div className="field-sub-tags">
                        <span className={`sub-tag ${crop.isWinterCrop ? 'winter-tag' : 'spring-tag'}`}>
                          {crop.isWinterCrop ? '❄️ Talivili (sügiskülv)' : '☀️ Suvivili / kevadkülv'}
                        </span>
                        {crop.defaultSeedRateKgHa && (
                          <span className="sub-tag soil-tag">
                            🌱 Külvinorm: {crop.defaultSeedRateKgHa} kg/ha
                          </span>
                        )}
                        {crop.defaultYieldTonsHa && (
                          <span className="sub-tag owner-tag">
                            ⚖️ Oodatav saak: {crop.defaultYieldTonsHa} t/ha
                          </span>
                        )}
                        <span className="sub-tag rent-tag">
                          🏷️ {crop.varieties.length} registreeritud sorti
                        </span>
                      </div>

                      {crop.description && (
                        <div className="field-change-reason-line">
                          <span>💬 {crop.description}</span>
                        </div>
                      )}
                    </div>

                    {/* Middle: Active Season Acreage */}
                    <div className="field-active-season-col">
                      <div className="season-area-box">
                        <span className="season-year-label">{selectedYear}. a külvipind:</span>
                        <strong className="season-ha-val" style={{ color: acreageHa > 0 ? crop.color : undefined }}>
                          {acreageHa.toFixed(2)} ha
                        </strong>
                        <span className="eligible-ha-sub">
                          {acreageHa > 0 ? `${selectedYear}. a külvikorras` : 'Sel hooajal ei külvata'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="field-card-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startCreateVariety(crop)}
                        title="Lisa sellele kultuurile uus sort"
                      >
                        <Plus size={13} />
                        <span>Lisa sort</span>
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEditCrop(crop)}
                        title="Muuda kultuuri andmeid"
                      >
                        <Edit2 size={13} />
                        <span>Muuda</span>
                      </button>

                      <button
                        className="icon-btn-danger"
                        onClick={() => {
                          if (confirm(`Kas soovid kindlasti kustutada kultuuri "${crop.name}" ja kõik selle sordid?`)) {
                            onDeleteCrop(crop.id);
                          }
                        }}
                        title="Kustuta kultuur registrist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Varieties Sub-Register Table */}
                  <div className="field-history-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span className="history-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        <Tag size={13} className="text-emerald" />
                        Sortide alamregister ({crop.varieties.length} tk):
                      </span>
                      <button
                        className="btn btn-secondary btn-xs"
                        onClick={() => startCreateVariety(crop)}
                        title={`Lisa uus sort kultuurile "${crop.name}"`}
                      >
                        <Plus size={11} />
                        <span>Lisa sort</span>
                      </button>
                    </div>

                    {crop.varieties.length > 0 ? (
                      <div className="varieties-table-wrap">
                        <table className="varieties-table">
                          <thead>
                            <tr>
                              <th>Sort</th>
                              <th>Aretaja / Esindaja</th>
                              <th>Valmimisaeg</th>
                              <th>Talvekindlus</th>
                              <th style={{ textAlign: 'right' }}>Külvinorm</th>
                              <th style={{ textAlign: 'right' }}>Saagipotentsiaal</th>
                              <th>Kvaliteediklass</th>
                              <th>Märkused</th>
                              <th style={{ textAlign: 'right' }}>Toimingud</th>
                            </tr>
                          </thead>
                          <tbody>
                            {crop.varieties.map((variety) => (
                              <tr key={variety.id}>
                                <td className="variety-name-cell">
                                  <strong>{variety.name}</strong>
                                </td>
                                <td>
                                  {variety.breeder ? (
                                    <span className="variety-breeder-cell">{variety.breeder}</span>
                                  ) : (
                                    <span className="variety-empty-cell">—</span>
                                  )}
                                </td>
                                <td>
                                  {variety.maturityDays ? (
                                    <span className="variety-badge-sm variety-badge-maturity">
                                      ⏱️ {variety.maturityDays}
                                    </span>
                                  ) : (
                                    <span className="variety-empty-cell">—</span>
                                  )}
                                </td>
                                <td>
                                  {variety.winterHardiness ? (
                                    <span className="variety-winter-text">
                                      {variety.winterHardiness.includes('Väga hea') ? '❄️ ' : ''}
                                      {variety.winterHardiness}
                                    </span>
                                  ) : (
                                    <span className="variety-empty-cell">—</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {variety.recommendedSeedRateKgHa ? (
                                    <span className="variety-seed-rate">{variety.recommendedSeedRateKgHa} kg/ha</span>
                                  ) : (
                                    <span className="variety-empty-cell">—</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {variety.potentialYieldTonsHa ? (
                                    <span className="variety-badge-sm variety-badge-yield">
                                      {variety.potentialYieldTonsHa} t/ha
                                    </span>
                                  ) : (
                                    <span className="variety-empty-cell">—</span>
                                  )}
                                </td>
                                <td>
                                  {variety.qualityClass ? (
                                    <span className="variety-badge-sm variety-badge-quality">
                                      {variety.qualityClass}
                                    </span>
                                  ) : (
                                    <span className="variety-empty-cell">—</span>
                                  )}
                                </td>
                                <td className="variety-notes-cell">
                                  {variety.notes || <span className="variety-empty-cell">—</span>}
                                </td>
                                <td>
                                  <div className="variety-table-actions">
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
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                        Sorte pole veel registreeritud. Klõpsa nupule "+ Lisa sort", et lisada sellele kultuurile sorte.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredCrops.length === 0 && (
              <div className="empty-register-state glass-card" style={{ padding: '32px', textAlign: 'center' }}>
                <AlertCircle size={28} className="text-amber" style={{ margin: '0 auto 8px auto' }} />
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>Otsingule vastavaid kultuure ei leitud</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Proovi muuta otsingusõna või vali teine kultuurigrupp.</p>
              </div>
            )}
          </div>
        </div>

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
