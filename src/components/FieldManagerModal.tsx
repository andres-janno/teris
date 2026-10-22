import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Layers,
  Calendar,
  Search,
  Edit2,
  Crosshair,
  Check,
  Download,
  AlertCircle,
  Lock,
  Info,
  Repeat
} from 'lucide-react';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import { compareFieldNumbers } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import { isCropUndetermined, seasonSelectorYears } from '../types/season';
import type { Crop } from '../types/crop';
import type { BaseMapLayerId } from '../types/map';
import { FieldShapeModal } from './FieldShapeModal';
import { HelpHint } from './HelpHint';

// Mullastik tuleb hiljem Maa- ja Ruumiameti andmetest põllu kuju järgi (praegu ainult vaatamiseks).
const SOIL_AUTO_HINT = 'Täidetakse hiljem automaatselt Maa- ja Ruumiameti mullastiku kaardi põhjal (põllu kuju järgi).';

interface FieldManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterFields: MasterField[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onUpdateField: (fieldId: number | string, fieldData: Partial<MasterField>, seasonData?: FieldYearlyRecord) => void;
  seasons?: FarmingSeason[];
  onOpenSeasonManager?: () => void;
  crops?: Crop[];
  baseMap?: BaseMapLayerId;
  isFullPage?: boolean;
  /** Avab põllu infoakna (sama mis kaardil põllule klikates) */
  onOpenFieldDetails?: (fieldId: number | string) => void;
}

export const FieldManagerModal: React.FC<FieldManagerModalProps> = ({
  isOpen,
  onClose,
  masterFields,
  selectedYear,
  onSelectYear,
  onUpdateField,
  seasons = [],
  onOpenSeasonManager,
  crops = [],
  baseMap = 'maaamet-pohikaart',
  isFullPage = false,
  onOpenFieldDetails,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [tenureFilter, setTenureFilter] = useState<'all' | 'OWNED' | 'RENTED'>('all');

  // Current season & locked status
  const currentSeason = seasons.find((s) => s.year === selectedYear);
  const isCurrentSeasonLocked = currentSeason?.isLocked ?? false;

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

  // Add new year season modal

  // Hooaja valik: vaikimisi hooaeg −4 … +3, ainult hooaegade tabelis olevad aastad
  const availableYearsList = useMemo(() => seasonSelectorYears(seasons), [seasons]);

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

// Kultuuride kokkuvõtte võti (sama, mille järgi kokkuvõtte kiibil klikates filtreeritakse).
function cropSummaryKey(cropText: string): string {
  if (isCropUndetermined(cropText)) return 'Määramata';
  return cropText.split('(')[0].trim() || 'Määramata';
}

  // Tabeli aastaveerud: valitud hooaeg −2 … +2 (alati 5 veergu), vanemad vasakul.
  const tableYears = useMemo(() => Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i), [selectedYear]);

  // Tabelis on kõik (operaatori filtriga) põllud; otsing ja filtrid rakenduvad valitud aasta andmetele.
  const filteredFields = useMemo(() => {
    return masterFields
      .filter((f) => {
        const yearRecord = f.history.find(h => h.year === selectedYear);
        const cropName = yearRecord ? yearRecord.crop : '';
        const q = searchQuery.toLowerCase();

        const parcels = yearRecord?.cadastralParcels || f.cadastralParcels || [];
        // Kataster-taseme omandi andmeteta põld loetakse oma maaks (nagu kokkuvõttes)
        const hasOwned = parcels.length === 0 || parcels.some(p => p.ownershipType === 'OWNED');
        const hasRented = parcels.some(p => p.ownershipType === 'RENTED');

        const matchesSearch =
          f.name.toLowerCase().includes(q) ||
          String(f.id).includes(q) ||
          (f.num && f.num.toLowerCase().includes(q)) ||
          f.fieldCode.toLowerCase().includes(q) ||
          (f.cadastralCode && f.cadastralCode.toLowerCase().includes(q)) ||
          parcels.some(p => p.cadastralCode.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q)) ||
          cropName.toLowerCase().includes(q);

        // Kultuuri ja omandivormi filtrid käivad valitud hooaja kokkuvõtte kohta
        const matchesCrop = cropFilter === 'all' || (!!yearRecord && cropSummaryKey(yearRecord.crop) === cropFilter);

        const matchesTenure =
          tenureFilter === 'all' ||
          (!!yearRecord && ((tenureFilter === 'OWNED' && hasOwned) || (tenureFilter === 'RENTED' && hasRented)));

        // Ainult põllud, millel on tabeli perioodis (valitud hooaeg ±2) vähemalt üks kirje.
        const inPeriod = f.history.some((h) => tableYears.includes(h.year));

        return inPeriod && matchesSearch && matchesCrop && matchesTenure;
      })
      .sort(compareFieldNumbers);
  }, [masterFields, selectedYear, searchQuery, cropFilter, tenureFilter, tableYears]);

  // Valitud hooaja pindalad kultuuride lõikes (tabeli kohal), suurimast väiksemani.
  // Grupeeritud kultuuride registri talivilja tunnuse järgi: sügiskülv (eelmine sügis) / kevadkülv.
  const cropGroups = useMemo(() => {
    type Row = { crop: string; color: string; areaHa: number; count: number };
    type Kind = 'winter' | 'spring' | 'unknown' | 'undetermined';
    const byKind: Record<Kind, Map<string, Row>> = { winter: new Map(), spring: new Map(), unknown: new Map(), undetermined: new Map() };
    fieldsForSelectedYear.forEach((f) => {
      const rec = f.history.find((h) => h.year === selectedYear);
      if (!rec) return;
      const undetermined = isCropUndetermined(rec.crop);
      const crop = cropSummaryKey(rec.crop);
      const registryCrop = undetermined ? undefined : findRegistryCrop(rec.crop);
      const kind: Kind = undetermined ? 'undetermined' : !registryCrop ? 'unknown' : registryCrop.isWinterCrop ? 'winter' : 'spring';
      const map = byKind[kind];
      const entry = map.get(crop) ?? { crop, color: undetermined ? '#94a3b8' : rec.cropColor || '#94a3b8', areaHa: 0, count: 0 };
      entry.areaHa += rec.areaHa || 0;
      entry.count += 1;
      map.set(crop, entry);
    });
    const group = (kind: Kind, label: string, title: string) => {
      const rows = Array.from(byKind[kind].values()).sort((a, b) => b.areaHa - a.areaHa);
      return { kind, label, title, rows, totalHa: rows.reduce((sum, r) => sum + r.areaHa, 0) };
    };
    return [
      group('winter', `❄️ Sügiskülv ${selectedYear - 1}`, 'Talivili külvatakse hooajale eelneval sügisel'),
      group('spring', `☀️ Kevadkülv ${selectedYear}`, 'Suvivili ja muud kultuurid — külv/tööd hooaja kevadel'),
      group('unknown', '❔ Kultuuriregistrist puudu', 'Kultuuri ei leitud registrist — talivilja tunnus teadmata'),
      group('undetermined', '⬜ Kultuur määramata', 'Põllud, millele selle hooaja kultuuri pole veel valitud')
    ].filter((g) => g.rows.length > 0);
  }, [fieldsForSelectedYear, selectedYear, crops]);

  // Kultuuri kiirmuutmine tabeli lahtrist (ainult avatud hooaeg ja ilma põlluraamatu tegevusteta).
  const [cropEdit, setCropEdit] = useState<{
    fieldId: number | string;
    year: number;
    crop: string;
    variety: string;
  } | null>(null);
  const cropEditRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cropEdit) return;
    const onPointerDown = (e: PointerEvent) => {
      if (cropEditRef.current && !cropEditRef.current.contains(e.target as Node)) setCropEdit(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCropEdit(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [cropEdit]);

  // Põllu ühe aasta kuju eraldi aknas.
  const [shapeView, setShapeView] = useState<{ fieldId: number | string; year: number } | null>(null);

  if (!isOpen && !isFullPage) return null;

  // Miks lahtri kultuuri ei saa otse muuta (null = saab).
  const cropEditBlockReason = (field: MasterField, rec: FieldYearlyRecord | undefined, year: number): string | null => {
    if (seasons.some((s) => s.year === year && s.isLocked)) return 'Hooaeg on lukus';
    if (rec && (rec.operationsCount ?? 0) > 0) return 'Põlluraamatus on selle aasta tegevused';
    if (!rec && field.history.length === 0) return 'Põllul pole ühegi aasta andmeid';
    return null;
  };

  const openCropEdit = (field: MasterField, year: number, rec?: FieldYearlyRecord) =>
    setCropEdit({ fieldId: field.id, year, crop: rec?.crop ?? '', variety: rec?.cropVariety ?? '' });

  const saveCropEdit = () => {
    if (!cropEdit) return;
    const field = masterFields.find((f) => f.id === cropEdit.fieldId);
    if (!field) return setCropEdit(null);
    const rec = field.history.find((h) => h.year === cropEdit.year);
    // Tühi valik: kultuur eemaldatakse, aasta kirje (pindala, piirid, katastrid) jääb alles.
    if (!cropEdit.crop) {
      if (rec && !isCropUndetermined(rec.crop)) {
        onUpdateField(field.id, {}, { ...rec, crop: '', cropVariety: undefined, cropColor: '#94a3b8' });
      }
      return setCropEdit(null);
    }
    const cropColor = findRegistryCrop(cropEdit.crop)?.color || rec?.cropColor || '#22c55e';

    if (rec) {
      onUpdateField(field.id, {}, { ...rec, crop: cropEdit.crop, cropVariety: cropEdit.variety || undefined, cropColor });
    } else {
      // Uus aasta kirje: pindala, piirid ja katastriüksused lähimast varasemast (või viimasest) aastast.
      const byYearDesc = [...field.history].sort((a, b) => b.year - a.year);
      const source = byYearDesc.find((h) => h.year < cropEdit.year) || byYearDesc[0];
      onUpdateField(field.id, {}, {
        year: cropEdit.year,
        areaHa: source.areaHa,
        eligibleAreaHa: source.eligibleAreaHa,
        crop: cropEdit.crop,
        cropVariety: cropEdit.variety || undefined,
        cropColor,
        workedAreaHa: 0,
        workProgress: 0,
        status: 'not_started',
        geometry: source.geometry || field.geometry,
        boundaryPointsCount: source.boundaryPointsCount,
        perimeterM: source.perimeterM,
        cadastralParcels: source.cadastralParcels ? [...source.cadastralParcels] : field.cadastralParcels ? [...field.cadastralParcels] : []
      });
    }
    setCropEdit(null);
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Põllu Nimi', 'Põllu Nr (PRIA)', 'PRIA Massiiv', 'Kataster', 'Operaator', `Pindala ${selectedYear} (ha)`, `Kultuur ${selectedYear}`, 'Aastate Ajalugu'];
    const rows = [...masterFields].sort(compareFieldNumbers).map((f) => {
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

  const cropSummaryContent = (
    <>
      <div className="register-crop-summary-groups">
        {cropGroups.length === 0 && <span className="muted">Selle hooaja kirjeid pole</span>}
        {cropGroups.map((g) => (
          <div key={g.kind} className={`register-crop-group ${g.kind}`}>
            <span className="register-crop-group-title" title={g.title}>
              {g.label}: <strong>{g.totalHa.toFixed(2)} ha</strong>
            </span>
            {g.rows.map((c) => (
              <button
                type="button"
                key={c.crop}
                className={`register-crop-stat${cropFilter === c.crop ? ' active' : ''}${cropFilter !== 'all' && cropFilter !== c.crop ? ' dimmed' : ''}`}
                style={{ '--crop-color': c.color } as React.CSSProperties}
                onClick={() => setCropFilter(cropFilter === c.crop ? 'all' : c.crop)}
                title={`${c.crop}: ${c.areaHa.toFixed(2)} ha (${c.count} põldu) — ${cropFilter === c.crop ? 'klõps eemaldab filtri' : 'klõps filtreerib tabeli'}`}
              >
                <span>{c.crop}</span>
                <strong>{c.areaHa.toFixed(2)} ha</strong>
              </button>
            ))}
          </div>
        ))}
        <div className="register-crop-group total">
          <span className="register-crop-group-title">
            Σ Kogupind: <strong>{totalAreaHa.toFixed(2)} ha</strong>
          </span>
          <span className="muted">{fieldsForSelectedYear.length} põldu</span>
        </div>
      </div>
      {/* Omandivormid paremal üksteise all; klikk filtreerib tabeli */}
      <div className="register-crop-summary-tenure">
        <button
          type="button"
          className={`reg-stat-pill tenure-owned is-filter${tenureFilter === 'OWNED' ? ' active' : ''}`}
          onClick={() => setTenureFilter(tenureFilter === 'OWNED' ? 'all' : 'OWNED')}
          title={tenureFilter === 'OWNED' ? 'Eemalda omandivormi filter' : 'Näita ainult oma maa põlde'}
        >
          <span className="lbl">🏛️ Oma maa:</span>
          <strong>{financialSummary.ownedHa} ha</strong>
          <span className="sub-val text-emerald">({financialSummary.totalTax} €/a maamaks)</span>
        </button>
        <button
          type="button"
          className={`reg-stat-pill tenure-rented is-filter${tenureFilter === 'RENTED' ? ' active' : ''}`}
          onClick={() => setTenureFilter(tenureFilter === 'RENTED' ? 'all' : 'RENTED')}
          disabled={financialSummary.rentedHa === 0 && tenureFilter !== 'RENTED'}
          title={tenureFilter === 'RENTED' ? 'Eemalda omandivormi filter' : 'Näita ainult rendimaa põlde'}
        >
          <span className="lbl">🤝 Rendimaa:</span>
          <strong>{financialSummary.rentedHa} ha</strong>
          <span className="sub-val text-blue">({financialSummary.totalRent} €/a rent)</span>
        </button>
      </div>
    </>
  );

  const bodyContent = (
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
                  <HelpHint helpKey="fields.register.export-csv" inline />
                </button>

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

          {/* Valitud hooaja kultuuride kokkuvõte; kiibil klikk filtreerib tabeli */}
          <div className="register-crop-summary">
            {cropSummaryContent}
          </div>

          {/* Search & Actions Row */}
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

            {(cropFilter !== 'all' || tenureFilter !== 'all') && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setCropFilter('all');
                  setTenureFilter('all');
                }}
              >
                <X size={14} />
                <span>Eemalda filtrid</span>
              </button>
            )}
          </div>

          {/* Põldude tabel: põhiandmed, suurus, aastate kultuurid, tegevused */}
          {shapeView && (() => {
            const field = masterFields.find((f) => f.id === shapeView.fieldId);
            const record = field?.history.find((h) => h.year === shapeView.year);
            if (!field || !record) return null;
            return (
              <FieldShapeModal
                field={field}
                record={record}
                baseMap={baseMap}
                onClose={() => setShapeView(null)}
              />
            );
          })()}

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
                      <span className="year-col-label">{yr}</span>
                    </th>
                  ))}
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
                          {onOpenFieldDetails && (
                            <button
                              type="button"
                              className="icon-btn-ghost field-info-btn"
                              onClick={() => onOpenFieldDetails(field.id)}
                              title="Ava põllu info"
                            >
                              <Info size={15} />
                            </button>
                          )}
                        </div>
                        <div className="field-sub-tags">
                          <span className="field-code-badge" title="PRIA massiivi number">{field.fieldCode}</span>
                          {field.operatorName && <span className="sub-tag owner-tag">👤 {field.operatorName}</span>}
                          {field.soilType && <span className="sub-tag soil-tag" title={SOIL_AUTO_HINT}>🌱 {field.soilType}</span>}
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
                        const hasCrop = !!rec && !isCropUndetermined(rec.crop);
                        const blockReason = cropEditBlockReason(field, rec, yr);
                        const editable = !blockReason;
                        const isEditing = cropEdit !== null && cropEdit.fieldId === field.id && cropEdit.year === yr;
                        if (isEditing && cropEdit) {
                          const varieties = (findRegistryCrop(cropEdit.crop)?.varieties || []).map((v) => v.name);
                          const varietyOptions =
                            cropEdit.variety && !varieties.includes(cropEdit.variety) ? [cropEdit.variety, ...varieties] : varieties;
                          return (
                            <td key={yr} className={`year-cell editing ${yr === selectedYear ? 'selected' : ''}`}>
                              <div ref={cropEditRef} className="crop-inline-edit">
                                <select
                                  className="form-input"
                                  value={cropEdit.crop}
                                  autoFocus
                                  onChange={(e) => setCropEdit({ ...cropEdit, crop: e.target.value, variety: '' })}
                                >
                                  <option value="">– Kultuur määramata –</option>
                                  {cropEdit.crop && !activeCrops.some((c) => c.name === cropEdit.crop) && (
                                    <option value={cropEdit.crop}>{cropEdit.crop}</option>
                                  )}
                                  {activeCrops.map((c) => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                  ))}
                                </select>
                                <select
                                  className="form-input"
                                  value={cropEdit.variety}
                                  onChange={(e) => setCropEdit({ ...cropEdit, variety: e.target.value })}
                                  disabled={varietyOptions.length === 0}
                                >
                                  <option value="">{varietyOptions.length === 0 ? 'Sorte pole' : 'Sort määramata'}</option>
                                  {varietyOptions.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                                <div className="crop-inline-edit-actions">
                                  <button type="button" className="icon-btn-ghost" onClick={() => setCropEdit(null)} title="Loobu (Esc)">
                                    <X size={15} />
                                  </button>
                                  <button type="button" className="icon-btn-ghost save" onClick={saveCropEdit} title="Salvesta">
                                    <Check size={15} />
                                  </button>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={yr}
                            className={`year-cell ${yr === selectedYear ? 'selected' : ''} ${editable ? 'editable' : ''} ${hasCrop ? 'has-crop' : ''}`}
                            style={hasCrop ? ({ '--crop-color': rec.cropColor } as React.CSSProperties) : undefined}
                            title={editable ? (hasCrop ? 'Klõpsa kultuuri muutmiseks' : 'Klõpsa, et lisada selle aasta kultuur') : blockReason ?? undefined}
                            onClick={editable ? () => openCropEdit(field, yr, rec) : undefined}
                          >
                            {rec ? (
                              <>
                                <div className="year-crop">
                                  {hasCrop
                                    ? <span className="year-crop-name" title={rec.crop}>{rec.crop}</span>
                                    : <span className="muted">–</span>}
                                  {editable && <Edit2 size={11} className="year-crop-edit-icon" />}
                                  <button
                                    type="button"
                                    className="year-shape-btn"
                                    title={`Näita ${yr}. a põllu kuju`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShapeView({ fieldId: field.id, year: yr });
                                    }}
                                  >
                                    <Crosshair size={13} />
                                  </button>
                                </div>
                                {rec.cropVariety && <div className="cell-sub">{rec.cropVariety}</div>}
                              </>
                            ) : (
                              <div className="year-crop">
                                <span className="muted">–</span>
                                {editable && <Edit2 size={11} className="year-crop-edit-icon" />}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredFields.length === 0 && (
              <div className="empty-register-state glass-card">
                <AlertCircle size={28} className="text-amber" />
                <h4>Otsingule vastavaid põlde ei leitud</h4>
                <p>Proovi muuta otsingusõna või eemalda kultuuri-/omandifilter.</p>
              </div>
            )}
          </div>
        </div>
  );

  if (isFullPage) {
    return (
      <div className="fullpage-board-view">
        <main className="fullpage-board-main wide">
          <div className="fullpage-board-header">
            <div className="fullpage-title-wrap">
              <Repeat className="text-emerald" size={26} />
              <div>
                <h2>Külvikord</h2>
                <p className="fullpage-subtitle">Aastatepõhine külvikord, PRIA pindalade muutused ja katastriandmed</p>
              </div>
            </div>
          </div>
          <div className="fullpage-board-body">
            {bodyContent}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card field-register-modal animate-scale-up">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Layers className="text-emerald" size={24} />
            <div>
              <h3>Põldude register</h3>
              <p className="modal-subtitle">
                Aastatepõhine külvikord, PRIA pindalade muutused.
              </p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {bodyContent}
      </div>
    </div>
  );
};

