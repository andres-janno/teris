// src/components/FieldManagerModal.tsx
import React, { useState, useMemo } from 'react';
import {
  X,
  Layers,
  Calendar,
  Search,
  Plus,
  Edit2,
  Trash2,
  Crosshair,
  Download,
  Check,
  Sprout,
  History,
  AlertCircle
} from 'lucide-react';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { FieldFeature } from '../types/field';

interface FieldManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterFields: MasterField[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onFocusField: (fieldFeature: FieldFeature) => void;
  onUpdateField: (fieldId: number | string, fieldData: Partial<MasterField>, seasonData?: FieldYearlyRecord) => void;
  onAddNewSeasonToAll: (newYear: number) => void;
  onDeleteField: (fieldId: number | string) => void;
  onOpenUpload: () => void;
}

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023];

const POPULAR_CROPS = [
  { name: 'Talinisu (Skagen)', color: '#eab308' },
  { name: 'Suvioder (Planet)', color: '#d97706' },
  { name: 'Taliraps (Mercedes)', color: '#10b981' },
  { name: 'Põldhernes (Astronaute)', color: '#84cc16' },
  { name: 'Põlduba (Tiffany)', color: '#06b6d4' },
  { name: 'Kaer (Symphony)', color: '#f59e0b' },
  { name: 'Rukis (KWS Bono)', color: '#a16207' },
  { name: 'Punane ristik / Rohumaa', color: '#22c55e' },
  { name: 'Mustkesa', color: '#64748b' }
];

export const FieldManagerModal: React.FC<FieldManagerModalProps> = ({
  isOpen,
  onClose,
  masterFields,
  selectedYear,
  onSelectYear,
  onFocusField,
  onUpdateField,
  onAddNewSeasonToAll,
  onDeleteField,
  onOpenUpload
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [editingFieldId, setEditingFieldId] = useState<number | string | null>(null);

  // Edit form state: Master Field details
  const [editName, setEditName] = useState('');
  const [editNum, setEditNum] = useState('');
  const [editFieldCode, setEditFieldCode] = useState('');
  const [editCadastralCode, setEditCadastralCode] = useState('');
  const [editLandowner, setEditLandowner] = useState('');
  const [editSoilType, setEditSoilType] = useState('');

  // Edit form state: Yearly details
  const [editYear, setEditYear] = useState(selectedYear);
  const [editAreaHa, setEditAreaHa] = useState<number>(0);
  const [editCrop, setEditCrop] = useState('');
  const [editCropColor, setEditCropColor] = useState('#eab308');
  const [editVariety, setEditVariety] = useState('');
  const [editTargetYield, setEditTargetYield] = useState<number | undefined>(undefined);
  const [editActualYield, setEditActualYield] = useState<number | undefined>(undefined);
  const [editNotes, setEditNotes] = useState('');

  // Add new year season modal
  const [isAddYearOpen, setIsAddYearOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState(2027);

  // Filtered master fields
  const filteredFields = useMemo(() => {
    return masterFields.filter((f) => {
      const yearRecord = f.history.find(h => h.year === selectedYear) || f.history[0];
      const cropName = yearRecord ? yearRecord.crop : '';
      const q = searchQuery.toLowerCase();

      const matchesSearch =
        f.name.toLowerCase().includes(q) ||
        String(f.id).includes(q) ||
        (f.num && f.num.toLowerCase().includes(q)) ||
        f.fieldCode.toLowerCase().includes(q) ||
        (f.cadastralCode && f.cadastralCode.toLowerCase().includes(q)) ||
        cropName.toLowerCase().includes(q);

      const matchesCrop = cropFilter === 'all' || cropName.toLowerCase().includes(cropFilter.toLowerCase());

      return matchesSearch && matchesCrop;
    });
  }, [masterFields, selectedYear, searchQuery, cropFilter]);

  // Statistics for selected year
  const totalAreaHa = useMemo(() => {
    return masterFields.reduce((sum, f) => {
      const rec = f.history.find(h => h.year === selectedYear) || f.history[0];
      return sum + (rec ? rec.areaHa : 0);
    }, 0);
  }, [masterFields, selectedYear]);

  // Crops breakdown for selected year
  const cropsList = useMemo(() => {
    const cropsSet = new Set<string>();
    masterFields.forEach((f) => {
      const rec = f.history.find(h => h.year === selectedYear) || f.history[0];
      if (rec && rec.crop) cropsSet.add(rec.crop.split('(')[0].trim());
    });
    return Array.from(cropsSet);
  }, [masterFields, selectedYear]);

  if (!isOpen) return null;

  const startEdit = (field: MasterField) => {
    const currentRec = field.history.find(h => h.year === selectedYear) || field.history[0] || {
      year: selectedYear,
      areaHa: 5.0,
      crop: 'Talinisu (Skagen)',
      cropColor: '#eab308'
    };

    setEditingFieldId(field.id);
    setEditName(field.name);
    setEditNum(field.num || '');
    setEditFieldCode(field.fieldCode);
    setEditCadastralCode(field.cadastralCode || '');
    setEditLandowner(field.landowner || '');
    setEditSoilType(field.soilType || '');

    setEditYear(selectedYear);
    setEditAreaHa(currentRec.areaHa);
    setEditCrop(currentRec.crop);
    setEditCropColor(currentRec.cropColor || '#eab308');
    setEditVariety(currentRec.cropVariety || '');
    setEditTargetYield(currentRec.targetYieldTonsHa);
    setEditActualYield(currentRec.actualYieldTonsHa);
    setEditNotes(currentRec.notes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFieldId === null || editingFieldId === undefined) return;

    onUpdateField(
      editingFieldId,
      {
        name: editName.trim() || `Põld ${editNum || editingFieldId}`,
        num: editNum.trim() || undefined,
        fieldCode: editFieldCode.trim(),
        cadastralCode: editCadastralCode.trim() || undefined,
        landowner: editLandowner.trim() || undefined,
        soilType: editSoilType.trim() || undefined
      },
      {
        year: editYear,
        areaHa: Number(editAreaHa),
        crop: editCrop.trim() || 'Talinisu',
        cropVariety: editVariety.trim() || undefined,
        cropColor: editCropColor,
        targetYieldTonsHa: editTargetYield ? Number(editTargetYield) : undefined,
        actualYieldTonsHa: editActualYield ? Number(editActualYield) : undefined,
        notes: editNotes.trim() || undefined
      }
    );

    setEditingFieldId(null);
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Põllu Nimi', 'Põllu Nr (PRIA)', 'PRIA Massiiv', 'Kataster', 'Maaomanik', `Pindala ${selectedYear} (ha)`, `Kultuur ${selectedYear}`, 'Aastate Ajalugu'];
    const rows = masterFields.map((f) => {
      const yearRec = f.history.find(h => h.year === selectedYear) || f.history[0];
      const historyStr = f.history.map(h => `${h.year}: ${h.areaHa}ha (${h.crop})`).join('; ');
      return [
        `"${f.id}"`,
        `"${f.name}"`,
        `"${f.num || ''}"`,
        `"${f.fieldCode}"`,
        `"${f.cadastralCode || ''}"`,
        `"${f.landowner || ''}"`,
        yearRec ? yearRec.areaHa : 0,
        `"${yearRec ? yearRec.crop : ''}"`,
        `"${historyStr}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `agrimap_poldude_register_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card field-register-modal animate-scale-up">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Layers className="text-emerald" size={24} />
            <div>
              <h3>Põldude ja Maakasutuse Register</h3>
              <p className="modal-subtitle">
                Aastatepõhine külvikord, pindalade muutused ja PRIA massiivid ({masterFields.length} põldu)
              </p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Top Row: Year Season Switcher & Global Stats */}
          <div className="register-header-controls">
            {/* Year Selector Tabs */}
            <div className="year-selector-group">
              <span className="year-label">
                <Calendar size={15} className="text-blue" />
                <span>Hooaeg:</span>
              </span>
              <div className="year-tabs">
                {AVAILABLE_YEARS.map((yr) => (
                  <button
                    key={yr}
                    className={`year-tab ${selectedYear === yr ? 'active' : ''}`}
                    onClick={() => onSelectYear(yr)}
                  >
                    <span>{yr}</span>
                    {yr === 2026 && <span className="current-badge">Aktiivne</span>}
                  </button>
                ))}
                <button
                  className="btn btn-ghost btn-xs add-year-btn"
                  onClick={() => setIsAddYearOpen(true)}
                  title="Lisa uus põllumajandusaasta"
                >
                  <Plus size={13} />
                  <span>Lisa aasta</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="register-stats-pills">
              <div className="reg-stat-pill">
                <span className="lbl">Põlde:</span>
                <strong>{masterFields.length} tk</strong>
              </div>
              <div className="reg-stat-pill highlight">
                <span className="lbl">{selectedYear}. a kogupind:</span>
                <strong>{totalAreaHa.toFixed(2)} ha</strong>
              </div>
              <div className="reg-stat-pill">
                <span className="lbl">Keskmine suurus:</span>
                <strong>{(totalAreaHa / (masterFields.length || 1)).toFixed(2)} ha</strong>
              </div>
            </div>
          </div>

          {/* Search, Filter & Actions Row */}
          <div className="register-actions-bar">
            <div className="search-box-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Otsi põllu nime, koodi, katastrit või kultuuri..."
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

            {/* Crop filter */}
            <select
              className="form-input crop-filter-select"
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
            >
              <option value="all">Kõik kultuurid ({cropsList.length})</option>
              {cropsList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="actions-right">
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExportCsv}
                title="Ekspordi tabel CSV failina"
              >
                <Download size={14} />
                <span>CSV Eksport</span>
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose();
                  onOpenUpload();
                }}
              >
                <Plus size={14} />
                <span>Impordi PRIA ZIP</span>
              </button>
            </div>
          </div>

          {/* Add Year Season Sub-Modal */}
          {isAddYearOpen && (
            <div className="add-year-banner glass-card animate-slide-in">
              <div className="banner-content">
                <Sprout size={18} className="text-emerald" />
                <div>
                  <strong>Uue hooaja / aasta loomine</strong>
                  <p>Kopeerib kõigi {masterFields.length} põllu piirid uude aastasse ja võimaldab määrata uued kultuurid ja pindalad.</p>
                </div>
              </div>
              <div className="banner-inputs">
                <input
                  type="number"
                  min="2020"
                  max="2035"
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(Number(e.target.value))}
                  className="form-input"
                  style={{ width: '100px' }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    onAddNewSeasonToAll(newYearInput);
                    onSelectYear(newYearInput);
                    setIsAddYearOpen(false);
                  }}
                >
                  <Check size={14} />
                  <span>Kinnita hooaeg {newYearInput}</span>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setIsAddYearOpen(false)}>Loobu</button>
              </div>
            </div>
          )}

          {/* Edit Master Field & Season Drawer / Form */}
          {editingFieldId !== null && (
            <form onSubmit={handleSaveEdit} className="field-edit-season-card glass-card animate-slide-in">
              <div className="edit-card-header">
                <div className="edit-title">
                  <Edit2 size={16} className="text-emerald" />
                  <strong>
                    Muuda põllu andmeid: {editName || `Põld ${editNum || editingFieldId}`} (ID #{editingFieldId})
                  </strong>
                </div>
                <button className="icon-btn-ghost" type="button" onClick={() => setEditingFieldId(null)}>
                  <X size={16} />
                </button>
              </div>

              {/* General Master Field Data */}
              <div className="form-sub-header">
                <span>1. Põllu põhiandmed</span>
              </div>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Põllu nimi (kasutaja määratud) *</label>
                  <input
                    type="text"
                    required
                    placeholder="nt Loisu tagune, Kodu põld, Suur põld..."
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Põllu number (PRIA impordist nt 4, 4-1, 1A)</label>
                  <input
                    type="text"
                    placeholder="nt 4, 4-1, 1"
                    value={editNum}
                    onChange={(e) => setEditNum(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>PRIA massiivi number (fieldCode) *</label>
                  <input
                    type="text"
                    required
                    placeholder="nt 61144313542"
                    value={editFieldCode}
                    onChange={(e) => setEditFieldCode(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Katastritunnus</label>
                  <input
                    type="text"
                    placeholder="nt 89201:004:0140"
                    value={editCadastralCode}
                    onChange={(e) => setEditCadastralCode(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Maaomanik / Rentnik</label>
                  <input
                    type="text"
                    placeholder="nt Oma maa, Rent (OÜ Loisu)"
                    value={editLandowner}
                    onChange={(e) => setEditLandowner(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Seasonal Yearly Data */}
              <div className="form-sub-header" style={{ marginTop: '14px' }}>
                <span>2. Hooaja andmed ({editYear}. aasta külvikord ja saak)</span>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Hooaja aasta</label>
                  <select
                    value={editYear}
                    onChange={(e) => {
                      const yr = Number(e.target.value);
                      setEditYear(yr);
                      const f = masterFields.find(m => m.id === editingFieldId);
                      const yrRec = f?.history.find(h => h.year === yr);
                      if (yrRec) {
                        setEditAreaHa(yrRec.areaHa);
                        setEditCrop(yrRec.crop);
                        setEditCropColor(yrRec.cropColor);
                        setEditVariety(yrRec.cropVariety || '');
                        setEditTargetYield(yrRec.targetYieldTonsHa);
                        setEditActualYield(yrRec.actualYieldTonsHa);
                        setEditNotes(yrRec.notes || '');
                      }
                    }}
                    className="form-input"
                  >
                    {AVAILABLE_YEARS.map(yr => (
                      <option key={yr} value={yr}>{yr}. aasta</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Põllu pindala {editYear}. aastal (ha) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAreaHa}
                    onChange={(e) => setEditAreaHa(Number(e.target.value))}
                    className="form-input"
                    title="Põllu suurus võib igal aastal erineda kraaviäärte, puhverribade või külvipinna järgi"
                  />
                </div>

                <div className="form-group">
                  <label>Kultuur ja värv kaardil</label>
                  <div className="input-split">
                    <select
                      value={editCrop}
                      onChange={(e) => {
                        const selected = e.target.value;
                        setEditCrop(selected);
                        const match = POPULAR_CROPS.find(c => c.name === selected);
                        if (match) setEditCropColor(match.color);
                      }}
                      className="form-input"
                    >
                      {POPULAR_CROPS.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <input
                      type="color"
                      value={editCropColor}
                      onChange={(e) => setEditCropColor(e.target.value)}
                      className="form-input"
                      style={{ padding: '2px', height: '36px' }}
                      title="Kultuuri värv kaardil"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Saagiootus (t/ha) & Koristatud saak (t/ha)</label>
                  <div className="input-split">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Plaan t/ha"
                      value={editTargetYield || ''}
                      onChange={(e) => setEditTargetYield(e.target.value ? Number(e.target.value) : undefined)}
                      className="form-input"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Tegelik t/ha"
                      value={editActualYield || ''}
                      onChange={(e) => setEditActualYield(e.target.value ? Number(e.target.value) : undefined)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Hooaja märkmed (väetamine, taimekaitse, PRIA toetused)</label>
                  <input
                    type="text"
                    placeholder="nt NPK 8-20-30 250kg/ha sügisel, umbrohutõrje tehtud"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingFieldId(null)}>Loobu</button>
                <button type="submit" className="btn btn-primary btn-sm">Salvesta muudatused</button>
              </div>
            </form>
          )}

          {/* Fields List */}
          <div className="register-fields-list">
            {filteredFields.map((field) => {
              const currentYearRecord = field.history.find(h => h.year === selectedYear) || field.history[0];
              const area = currentYearRecord ? currentYearRecord.areaHa : 0;
              const crop = currentYearRecord ? currentYearRecord.crop : 'Määramata';
              const cropColor = currentYearRecord ? currentYearRecord.cropColor : '#94a3b8';

              return (
                <div key={field.id} className="master-field-card glass-card">
                  <div className="field-card-main-row">
                    {/* Left: Info */}
                    <div className="field-info-col">
                      <div className="field-title-line">
                        <span className="field-id-badge" title="Sisemine unikaalne ID (autoincrement)">#{field.id}</span>
                        <h4 className="field-name">{field.name}</h4>
                        {field.num && (
                          <span className="field-num-badge" title="PRIA põllu number">Nr {field.num}</span>
                        )}
                        <span className="field-code-badge" title="PRIA massiivi number">{field.fieldCode}</span>
                        {field.cadastralCode && (
                          <span className="cadastre-code" title="Katastritunnus">{field.cadastralCode}</span>
                        )}
                      </div>

                      {/* Soil & Landowner tags */}
                      <div className="field-sub-tags">
                        {field.soilType && (
                          <span className="sub-tag soil-tag">🌱 {field.soilType}</span>
                        )}
                        {field.landowner && (
                          <span className="sub-tag owner-tag">👤 {field.landowner}</span>
                        )}
                        {field.drainageSystem && (
                          <span className="sub-tag drainage-tag">💧 Drenaaž</span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Active Year Area & Crop */}
                    <div className="field-active-season-col">
                      <div className="season-area-box">
                        <span className="season-year-label">{selectedYear}. a suurus:</span>
                        <strong className="season-ha-val">{area.toFixed(2)} ha</strong>
                      </div>

                      <div className="season-crop-badge" style={{ borderColor: cropColor, backgroundColor: `${cropColor}18` }}>
                        <span className="crop-dot" style={{ backgroundColor: cropColor }}></span>
                        <span className="crop-name" style={{ color: 'var(--text-primary)' }}>{crop}</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="field-card-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(field)}
                        title="Muuda põllu nime, koodi või hooaja andmeid"
                      >
                        <Edit2 size={13} />
                        <span>Muuda</span>
                      </button>

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          const feature: FieldFeature = {
                            type: 'Feature',
                            id: field.id,
                            geometry: field.geometry,
                            properties: {
                              id: field.id,
                              num: field.num,
                              name: field.name,
                              fieldCode: field.fieldCode,
                              areaHa: area,
                              crop: crop,
                              cropColor: cropColor,
                              year: selectedYear,
                              status: currentYearRecord?.status || 'not_started'
                            }
                          };
                          onFocusField(feature);
                          onClose();
                        }}
                        title="Kuva kaardil ja suumi fookusesse"
                      >
                        <Crosshair size={13} />
                        <span>Kaardile</span>
                      </button>

                      <button
                        className="icon-btn-danger"
                        onClick={() => onDeleteField(field.id)}
                        title="Kustuta põld registrist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Multi-Year Rotation Timeline */}
                  <div className="field-history-row">
                    <div className="history-label">
                      <History size={12} className="text-secondary" />
                      <span>Külvikord & Pindala ajalugu:</span>
                    </div>

                    <div className="history-pills-list">
                      {field.history
                        .sort((a, b) => b.year - a.year)
                        .map((hist) => (
                          <div
                            key={hist.year}
                            className={`history-pill ${hist.year === selectedYear ? 'current' : ''}`}
                            onClick={() => onSelectYear(hist.year)}
                            title={`Klõpsa, et aktiveerida hooaeg ${hist.year}`}
                          >
                            <span className="h-year">{hist.year}:</span>
                            <span className="h-ha">{hist.areaHa} ha</span>
                            <span className="h-crop" style={{ color: hist.cropColor }}>{hist.crop.split('(')[0]}</span>
                            {hist.actualYieldTonsHa && (
                              <span className="h-yield">{hist.actualYieldTonsHa} t/ha</span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredFields.length === 0 && (
              <div className="empty-register-state glass-card">
                <AlertCircle size={28} className="text-amber" />
                <h4>Otsingule vastavaid põlde ei leitud</h4>
                <p>Proovi muuta otsingusõna või vali teine kultuurifilter.</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-left-info">
            <span>Kuvatakse <strong>{filteredFields.length}</strong> põldu <strong>{masterFields.length}</strong>-st &bull; Valitud aasta: <strong>{selectedYear}</strong></span>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Sulge</button>
        </div>
      </div>
    </div>
  );
};
