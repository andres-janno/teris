import React, { useState, useMemo, useEffect } from 'react';
import type { Polygon, MultiPolygon } from 'geojson';
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
  AlertCircle,
  Lock,
  Landmark,
  Compass,
  ExternalLink
} from 'lucide-react';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import type { FieldFeature } from '../types/field';
import type { FarmingSeason } from '../types/season';
import type { FieldCadastralLink, LandTenureType } from '../types/cadastre';
import type { RelatedParty } from '../types/party';
import type { Crop } from '../types/crop';

interface FieldManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterFields: MasterField[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onFocusField: (fieldFeature: FieldFeature) => void;
  onUpdateField: (fieldId: number | string, fieldData: Partial<MasterField>, seasonData?: FieldYearlyRecord) => void;
  onDeleteField: (fieldId: number | string) => void;
  onOpenUpload: () => void;
  onOpenSoilUpload?: () => void;
  onOpenFieldBookUpload?: () => void;
  seasons?: FarmingSeason[];
  onOpenSeasonManager?: () => void;
  parties?: RelatedParty[];
  onOpenParties?: () => void;
  crops?: Crop[];
  onOpenCrops?: () => void;
}

export const FieldManagerModal: React.FC<FieldManagerModalProps> = ({
  isOpen,
  onClose,
  masterFields,
  selectedYear,
  onSelectYear,
  onFocusField,
  onUpdateField,
  onDeleteField,
  onOpenUpload,
  onOpenSoilUpload,
  onOpenFieldBookUpload,
  seasons = [],
  onOpenSeasonManager,
  parties = [],
  onOpenParties,
  crops = [],
  onOpenCrops
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [tenureFilter, setTenureFilter] = useState<'all' | 'OWNED' | 'RENTED'>('all');
  const [editingFieldId, setEditingFieldId] = useState<number | string | null>(null);

  // Current season & locked status
  const currentSeason = seasons.find((s) => s.year === selectedYear);
  const isCurrentSeasonLocked = currentSeason?.isLocked ?? false;

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

  // Add new year season modal

  // Dynamic available years (+3 forward and -4 history around active season).
  // Kaugemaid tühje hooaegu (nt DB-s ette loodud, aga veel deklareerimata
  // aastad) ei näidata, isegi kui need eksisteerivad.
  const availableYearsList = useMemo(() => {
    const activeYear = seasons.find((s) => s.status === 'active')?.year || 2026;
    const maxYear = activeYear + 3;
    const minYear = activeYear - 4;
    const set = new Set<number>();
    for (let y = maxYear; y >= minYear; y--) {
      set.add(y);
    }
    seasons.forEach((s) => { if (s.year <= maxYear && s.year >= minYear) set.add(s.year); });
    masterFields.forEach((mf) => mf.history.forEach((h) => { if (h.year <= maxYear && h.year >= minYear) set.add(h.year); }));
    return Array.from(set).sort((a, b) => a - b);
  }, [seasons, masterFields]);

  // Ainult põllud, millel on TÄPSELT valitud aasta kirje — vältimaks, et
  // registrisse jäänud, aga sel aastal (nt PRIA impordis) mitte
  // deklareeritud põllud paisutaksid statistikat mõne teise aasta andmega.
  const fieldsForSelectedYear = useMemo(() => {
    return masterFields.filter((f) => f.history.some((h) => h.year === selectedYear));
  }, [masterFields, selectedYear]);

  // Statistics for selected year
  const totalAreaHa = useMemo(() => {
    return fieldsForSelectedYear.reduce((sum, f) => {
      const rec = f.history.find(h => h.year === selectedYear);
      return sum + (rec ? rec.areaHa : 0);
    }, 0);
  }, [fieldsForSelectedYear, selectedYear]);

  // Financial summary (Oma maa vs Rent) based on active season
  const financialSummary = useMemo(() => {
    let ownedHa = 0;
    let rentedHa = 0;
    let totalTax = 0;
    let totalRent = 0;

    fieldsForSelectedYear.forEach((f) => {
      const rec = f.history.find(h => h.year === selectedYear);
      const fieldArea = rec ? rec.areaHa : 0;
      const parcels = rec?.cadastralParcels || f.cadastralParcels || [];

      if (parcels.length > 0) {
        parcels.forEach((p) => {
          if (p.ownershipType === 'OWNED') {
            ownedHa += p.fieldAreaHa;
            totalTax += p.landTaxEurYear !== undefined ? p.landTaxEurYear : (p.landTaxEurHa ? p.landTaxEurHa * p.fieldAreaHa : 0);
          } else {
            rentedHa += p.fieldAreaHa;
            totalRent += p.rentFeeEurYear !== undefined ? p.rentFeeEurYear : (p.rentFeeEurHa ? p.rentFeeEurHa * p.fieldAreaHa : 0);
          }
        });
      } else {
        // Kataster-taseme omandi andmed puuduvad — vaikimisi loeme oma maaks
        ownedHa += fieldArea;
        totalTax += fieldArea * 15;
      }
    });

    return {
      ownedHa: Math.round(ownedHa * 100) / 100,
      rentedHa: Math.round(rentedHa * 100) / 100,
      totalTax: Math.round(totalTax),
      totalRent: Math.round(totalRent)
    };
  }, [fieldsForSelectedYear, selectedYear]);

  // Tabeli aastaveerud: valitud hooaeg −2 … +2 (alati 5 veergu), vanemad vasakul.
  const tableYears = useMemo(() => Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i), [selectedYear]);

  // Tabelis on kõik (operaatori filtriga) põllud; otsing ja filtrid rakenduvad valitud aasta andmetele.
  const filteredFields = useMemo(() => {
    return masterFields.filter((f) => {
      const yearRecord = f.history.find(h => h.year === selectedYear);
      const cropName = yearRecord ? yearRecord.crop : '';
      const q = searchQuery.toLowerCase();

      const parcels = yearRecord?.cadastralParcels || f.cadastralParcels || [];
      const hasOwned = parcels.some(p => p.ownershipType === 'OWNED');
      const hasRented = parcels.some(p => p.ownershipType === 'RENTED');

      const matchesSearch =
        f.name.toLowerCase().includes(q) ||
        String(f.id).includes(q) ||
        (f.num && f.num.toLowerCase().includes(q)) ||
        f.fieldCode.toLowerCase().includes(q) ||
        (f.cadastralCode && f.cadastralCode.toLowerCase().includes(q)) ||
        parcels.some(p => p.cadastralCode.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q)) ||
        cropName.toLowerCase().includes(q);

      const matchesCrop = cropFilter === 'all' || cropName.toLowerCase().includes(cropFilter.toLowerCase());

      const matchesTenure =
        tenureFilter === 'all' ||
        (tenureFilter === 'OWNED' && hasOwned) ||
        (tenureFilter === 'RENTED' && hasRented);

      return matchesSearch && matchesCrop && matchesTenure;
    });
  }, [masterFields, selectedYear, searchQuery, cropFilter, tenureFilter]);

  // Crops breakdown for selected year
  const cropsList = useMemo(() => {
    const cropsSet = new Set<string>();
    fieldsForSelectedYear.forEach((f) => {
      const rec = f.history.find(h => h.year === selectedYear);
      if (rec && rec.crop) cropsSet.add(rec.crop.split('(')[0].trim());
    });
    return Array.from(cropsSet);
  }, [fieldsForSelectedYear, selectedYear]);

  // Valitud hooaja pindalad kultuuride lõikes (jaluses), suurimast väiksemani.
  const cropAreas = useMemo(() => {
    const byCrop = new Map<string, { crop: string; color: string; areaHa: number; count: number }>();
    fieldsForSelectedYear.forEach((f) => {
      const rec = f.history.find((h) => h.year === selectedYear);
      if (!rec) return;
      const crop = (rec.crop || 'Määramata').split('(')[0].trim() || 'Määramata';
      const entry = byCrop.get(crop) ?? { crop, color: rec.cropColor || '#94a3b8', areaHa: 0, count: 0 };
      entry.areaHa += rec.areaHa || 0;
      entry.count += 1;
      byCrop.set(crop, entry);
    });
    return Array.from(byCrop.values()).sort((a, b) => b.areaHa - a.areaHa);
  }, [fieldsForSelectedYear, selectedYear]);

  // Sync edit form with selectedYear whenever selectedYear changes
  useEffect(() => {
    if (editingFieldId !== null) {
      const field = masterFields.find((m) => m.id === editingFieldId);
      if (field) {
        const currentRec = field.history.find((h) => h.year === selectedYear) || {
          year: selectedYear,
          areaHa: field.history[0]?.areaHa || 5.0,
          crop: field.history[0]?.crop || 'Talinisu (Skagen)',
          cropColor: field.history[0]?.cropColor || '#eab308'
        };

        const rawParcels = currentRec.cadastralParcels
          ? [...currentRec.cadastralParcels]
          : (field.cadastralParcels ? [...field.cadastralParcels] : []);

        const initialParcels = rawParcels.map((p) => ({
          ...p,
          rentFeeEurHa: p.rentFeeEurHa ?? (p.rentFeeEurYear && p.fieldAreaHa > 0 ? Math.round((p.rentFeeEurYear / p.fieldAreaHa) * 10) / 10 : undefined),
          landTaxEurHa: p.landTaxEurHa ?? (p.landTaxEurYear && p.fieldAreaHa > 0 ? Math.round((p.landTaxEurYear / p.fieldAreaHa) * 10) / 10 : undefined)
        }));

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
        setEditCadastralParcels(initialParcels);
      }
    }
  }, [selectedYear]);

  if (!isOpen) return null;

  const startEdit = (field: MasterField) => {
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

    setEditingFieldId(field.id);
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
    if (editingFieldId === null || editingFieldId === undefined) return;

    if (isEditSeasonLocked) {
      alert(`Hooaeg ${editYear} on suletud ja arhiveeritud. Hooaja andmeid ega katastriüksuseid ei saa muuta.`);
      return;
    }

    const matchedCrop = findRegistryCrop(editCrop);
    const finalCropColor = matchedCrop?.color || selectedCropObj?.color || editCropColor || '#22c55e';

    onUpdateField(
      editingFieldId,
      {
        name: editName.trim() || `Põld ${editNum || editingFieldId}`,
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

    setEditingFieldId(null);
  };

  const handleAddCadastralParcelToEdit = () => {
    if (isEditSeasonLocked) {
      alert(`Hooaeg ${editYear} on suletud/lukustatud. Uute katastriüksuste lisamine on keelatud.`);
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

  const handleRemoveCadastralParcelFromEdit = (index: number) => {
    if (isEditSeasonLocked) {
      alert(`Hooaeg ${editYear} on suletud/lukustatud. Katastriüksuste kustutamine on keelatud!`);
      return;
    }
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


  // Näita põldu kaardil (valitud aasta või viimase kirje geomeetriaga).
  const focusOnMap = (field: MasterField) => {
    const rec = field.history.find((h) => h.year === selectedYear) || [...field.history].sort((a, b) => b.year - a.year)[0];
    const feature: FieldFeature = {
      type: 'Feature',
      id: field.id,
      geometry: (rec?.geometry || field.geometry || { type: 'Polygon', coordinates: [] }) as Polygon | MultiPolygon,
      properties: {
        id: field.id,
        num: field.num,
        name: field.name,
        fieldCode: field.fieldCode,
        areaHa: rec ? rec.areaHa : 0,
        eligibleAreaHa: rec?.eligibleAreaHa,
        areaChangeReason: rec?.areaChangeReason,
        crop: rec ? rec.crop : 'Määramata',
        cropVariety: rec?.cropVariety,
        cropColor: rec ? rec.cropColor : '#94a3b8',
        year: selectedYear,
        status: rec?.status || 'not_started',
        rawProperties: {
          cadastralParcels: field.cadastralParcels || []
        }
      }
    };
    onFocusField(feature);
    onClose();
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Põllu Nimi', 'Põllu Nr (PRIA)', 'PRIA Massiiv', 'Kataster', 'Operaator', `Pindala ${selectedYear} (ha)`, `Kultuur ${selectedYear}`, 'Aastate Ajalugu'];
    const rows = masterFields.map((f) => {
      const yearRec = f.history.find(h => h.year === selectedYear);
      const historyStr = f.history.map(h => `${h.year}: ${h.areaHa}ha (${h.crop})`).join('; ');
      return [
        `"${f.id}"`,
        `"${f.name}"`,
        `"${f.num || ''}"`,
        `"${f.fieldCode}"`,
        `"${f.cadastralCode || ''}"`,
        `"${f.operatorName || ''}"`,
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
                {availableYearsList.map((yr) => {
                  const sObj = seasons.find((s) => s.year === yr);
                  const isLocked = sObj?.isLocked ?? false;
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
              <div className="register-io-buttons">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportCsv}
                  title="Ekspordi tabel CSV failina"
                >
                  <Download size={14} />
                  <span>CSV Eksport</span>
                </button>

                {onOpenSoilUpload && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClose();
                      onOpenSoilUpload();
                    }}
                    title="Impordi mullaproovide punktid Shapefile ZIP-ist"
                  >
                    <Plus size={14} />
                    <span>Impordi mullaproovid</span>
                  </button>
                )}

                {onOpenFieldBookUpload && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClose();
                      onOpenFieldBookUpload();
                    }}
                    title="Impordi e-PRIA põlluraamatu väljavõte (.xls)"
                  >
                    <Plus size={14} />
                    <span>Impordi põlluraamat</span>
                  </button>
                )}

                <button
                  className="btn btn-secondary btn-sm"
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

            {/* Quick Stats & Financial Bar */}
            <div className="register-stats-pills">
              <div className="reg-stat-pill">
                <span className="lbl">Põlde:</span>
                <strong>{fieldsForSelectedYear.length} tk</strong>
              </div>
              <div className="reg-stat-pill highlight">
                <span className="lbl">Kogupind:</span>
                <strong>{totalAreaHa.toFixed(2)} ha</strong>
              </div>
              <div className="reg-stat-pill tenure-owned">
                <span className="lbl">🏛️ Oma maa:</span>
                <strong>{financialSummary.ownedHa} ha</strong>
                <span className="sub-val text-emerald">({financialSummary.totalTax} €/a maamaks)</span>
              </div>
              <div className="reg-stat-pill tenure-rented">
                <span className="lbl">🤝 Rendimaa:</span>
                <strong>{financialSummary.rentedHa} ha</strong>
                <span className="sub-val text-blue">({financialSummary.totalRent} €/a rent)</span>
              </div>
            </div>
          </div>

          {/* Locked Season Alert Banner */}
          {isCurrentSeasonLocked && (
            <div className="season-locked-global-alert">
              <div className="alert-left">
                <Lock size={16} />
                <span>
                  <strong>Hooaeg {selectedYear} on muudatusteks suletud.</strong> Koristus on lõppenud ning põldude ja kultuuride andmed on arhiveeritud.
                </span>
              </div>
              {onOpenSeasonManager && (
                <button
                  className="btn btn-ghost btn-xs btn-alert-action"
                  onClick={onOpenSeasonManager}
                >
                  Ava hooajahaldur
                </button>
              )}
            </div>
          )}

          {/* Search, Filter & Actions Row */}
          <div className="register-actions-bar">
            <div className="search-box-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Otsi põllu nime, koodi, katastrit või omanikku..."
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

            {/* Tenure filter */}
            <select
              className="form-input filter-select"
              value={tenureFilter}
              onChange={(e) => setTenureFilter(e.target.value as any)}
            >
              <option value="all">Kõik omandivormid</option>
              <option value="OWNED">🏛️ Ainult Oma maa ({financialSummary.ownedHa} ha)</option>
              <option value="RENTED">🤝 Ainult Rendimaa ({financialSummary.rentedHa} ha)</option>
            </select>

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

          </div>

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
                      value={editFieldCode}
                      onChange={(e) => setEditFieldCode(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Mullastiku tüüp</label>
                  <input
                    type="text"
                    placeholder="nt Leostunud liivsavi (LP)"
                    value={editSoilType}
                    onChange={(e) => setEditSoilType(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Operaator</label>
                  <select
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
                <button
                  type="button"
                  className="btn btn-ghost btn-xs add-cad-btn"
                  disabled={isEditSeasonLocked}
                  onClick={handleAddCadastralParcelToEdit}
                >
                  <Plus size={12} />
                  <span>Lisa katastriüksus</span>
                </button>
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
                          {parties.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name} {p.roles.includes('LANDOWNER') ? '(Maaomanik)' : `(${p.roles.join(', ')})`}
                            </option>
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
                        <button
                          type="button"
                          className="icon-btn-danger"
                          disabled={isEditSeasonLocked}
                          onClick={() => handleRemoveCadastralParcelFromEdit(pIdx)}
                          title={isEditSeasonLocked ? "Hooaeg on muudatusteks suletud" : "Eemalda see katastriüksus"}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingFieldId(null)}>Loobu</button>
                <button
                  type="submit"
                  disabled={isEditSeasonLocked}
                  className={`btn btn-primary btn-sm ${isEditSeasonLocked ? 'btn-disabled' : ''}`}
                >
                  Salvesta muudatused
                </button>
              </div>
            </form>
          )}

          {/* Põldude tabel: põhiandmed, suurus, aastate kultuurid, tegevused */}
          <div className="register-table-wrap">
            <table className="register-table">
              <thead>
                <tr>
                  <th className="sticky-name">Põld</th>
                  <th className="sticky-size">Suurus</th>
                  {tableYears.map((yr) => (
                    <th
                      key={yr}
                      className={`year-col ${yr === selectedYear ? 'selected' : ''}`}
                      onClick={() => onSelectYear(yr)}
                      title={`Vali hooaeg ${yr}`}
                    >
                      {yr}
                    </th>
                  ))}
                  <th className="actions-col">Tegevused</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.map((field) => {
                  const selectedRec = field.history.find((h) => h.year === selectedYear);
                  const latestRec = [...field.history].sort((a, b) => b.year - a.year)[0];
                  const sizeRec = selectedRec || latestRec;

                  return (
                    <tr key={field.id}>
                      <td className="name-cell sticky-name">
                        <div className="field-title-line">
                          {field.num && <span className="field-num-badge" title="PRIA põllu number">Nr {field.num}</span>}
                          <span className="field-name">{field.name}</span>
                        </div>
                        <div className="field-sub-tags">
                          <span className="field-code-badge" title="PRIA massiivi number">{field.fieldCode}</span>
                          {field.operatorName && <span className="sub-tag owner-tag">👤 {field.operatorName}</span>}
                          {field.soilType && <span className="sub-tag soil-tag">🌱 {field.soilType}</span>}
                          {field.drainageSystem && <span className="sub-tag drainage-tag">💧 Drenaaž</span>}
                        </div>
                      </td>
                      <td
                        className={`size-cell sticky-size ${selectedRec ? '' : 'muted'}`}
                        title={selectedRec ? selectedRec.areaChangeReason || undefined : sizeRec ? `${sizeRec.year}. a pindala` : undefined}
                      >
                        <div className="season-area-box">
                          <strong className="season-ha-val">{sizeRec ? `${sizeRec.areaHa.toFixed(2)} ha` : '–'}</strong>
                          {selectedRec?.eligibleAreaHa ? <span className="eligible-ha-sub">PRIA: {selectedRec.eligibleAreaHa} ha</span> : null}
                        </div>
                      </td>
                      {tableYears.map((yr) => {
                        const rec = field.history.find((h) => h.year === yr);
                        return (
                          <td key={yr} className={`year-cell ${yr === selectedYear ? 'selected' : ''}`}>
                            {rec ? (
                              <>
                                <div className="year-crop" title={rec.crop}>
                                  <span className="crop-dot" style={{ backgroundColor: rec.cropColor }}></span>
                                  <span>{rec.crop}</span>
                                </div>
                                {rec.cropVariety && <div className="cell-sub">{rec.cropVariety}</div>}
                              </>
                            ) : (
                              <span className="muted">–</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="actions-col">
                        <div className="row-actions">
                          <button className="icon-btn-ghost" onClick={() => startEdit(field)} title="Muuda">
                            <Edit2 size={15} />
                          </button>
                          <button className="icon-btn-ghost" onClick={() => focusOnMap(field)} title="Näita kaardil">
                            <Crosshair size={15} />
                          </button>
                          <button
                            className="icon-btn-danger"
                            disabled={isCurrentSeasonLocked}
                            onClick={() => {
                              const label = `${field.num ? `Nr ${field.num} ` : ''}${field.name}`;
                              if (confirm(`Kustutada põld "${label}" registrist koos kõigi aastate andmetega?`)) onDeleteField(field.id);
                            }}
                            title={isCurrentSeasonLocked ? 'Hooaeg on muudatusteks suletud' : 'Kustuta'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredFields.length === 0 && (
              <div className="empty-register-state glass-card">
                <AlertCircle size={28} className="text-amber" />
                <h4>Otsingule vastavaid põlde ei leitud</h4>
                <p>Proovi muuta otsingusõna või vali teine kultuuri-/omandifilter.</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer register-crop-footer">
          <span className="register-crop-footer-title">{selectedYear} kultuurid:</span>
          {cropAreas.length === 0 && <span className="muted">Selle hooaja kirjeid pole</span>}
          {cropAreas.map((c) => (
            <span key={c.crop} className="register-crop-stat" title={`${c.crop}: ${c.areaHa.toFixed(2)} ha (${c.count} põldu)`}>
              <span className="crop-dot" style={{ backgroundColor: c.color }}></span>
              <span>{c.crop}</span>
              <strong>{c.areaHa.toFixed(2)} ha</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

