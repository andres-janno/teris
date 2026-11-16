import { UNDETERMINED_CROP_COLOR, DEFAULT_VEHICLE_COLOR } from '../lib/dataColors';
import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Calendar,
  Edit2,
  Crosshair,
  Check,
  Download,
  Lock,
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
import { UNDERSOWING_LABELS, type Undersowing } from '../services/priaCropName';
import { Button, Card, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, Badge, ToggleGroup, ToggleGroupItem, FilterClear, SearchInput, CheckboxField, Select, clickOnActivationKey } from './ui';

// Mullastik tuleb hiljem Maa- ja Ruumiameti andmetest põllu kuju järgi (praegu ainult vaatamiseks).
const SOIL_AUTO_HINT = 'Täidetakse hiljem automaatselt Maa- ja Ruumiameti mullastiku kaardi põhjal (põllu kuju järgi).';

interface FieldManagerModalProps {
  isOpen: boolean;
  masterFields: MasterField[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onUpdateField: (fieldId: number | string, fieldData: Partial<MasterField>, seasonData?: FieldYearlyRecord) => void;
  seasons?: FarmingSeason[];
  onOpenSeasonManager?: () => void;
  crops?: Crop[];
  baseMap?: BaseMapLayerId;
}

export const FieldManagerModal: React.FC<FieldManagerModalProps> = ({
  isOpen,
  masterFields,
  selectedYear,
  onSelectYear,
  onUpdateField,
  seasons = [],
  onOpenSeasonManager,
  crops = [],
  baseMap = 'maaamet-pohikaart',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Vaikimisi peidetakse põllud, millel valitud aasta kohta hooajakirjet pole (nt varasemad PRIA põllud)
  const [showMissingInYear, setShowMissingInYear] = useState(false);
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
      const parcels = rec?.cadastralParcels || f.cadastralParcels || [];

      if (parcels.length > 0) {
        parcels.forEach((p) => {
          if (p.ownershipType === 'OWNED') {
            ownedHa += p.fieldAreaHa;
            totalTax += p.landTaxEurYear !== undefined ? p.landTaxEurYear : (p.landTaxEurHa ? p.landTaxEurHa * p.fieldAreaHa : 0);
          } else if (p.ownershipType === 'RENTED') {
            rentedHa += p.fieldAreaHa;
            totalRent += p.rentFeeEurYear !== undefined ? p.rentFeeEurYear : (p.rentFeeEurHa ? p.rentFeeEurHa * p.fieldAreaHa : 0);
          }
        });
      }
      // Katastriüksusteta või teadmata omandiga pind ei lähe oma ega rendimaa alla
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

        // Kultuuri ja omandivormi filtrid käivad valitud hooaja kokkuvõtte kohta
        const matchesCrop = cropFilter === 'all' || (!!yearRecord && cropSummaryKey(yearRecord.crop) === cropFilter);

        const matchesTenure =
          tenureFilter === 'all' ||
          (!!yearRecord && ((tenureFilter === 'OWNED' && hasOwned) || (tenureFilter === 'RENTED' && hasRented)));

        // Ainult põllud, millel on tabeli perioodis (valitud hooaeg ±2) vähemalt üks kirje.
        const inPeriod = f.history.some((h) => tableYears.includes(h.year));
        // Valitud aastal puuduvad põllud ainult lülitiga
        const inSelectedYear = showMissingInYear || !!yearRecord;

        return inPeriod && inSelectedYear && matchesSearch && matchesCrop && matchesTenure;
      })
      .sort(compareFieldNumbers);
  }, [masterFields, selectedYear, searchQuery, cropFilter, tenureFilter, tableYears, showMissingInYear]);

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
      const entry = map.get(crop) ?? { crop, color: undetermined ? UNDETERMINED_CROP_COLOR : rec.cropColor || UNDETERMINED_CROP_COLOR, areaHa: 0, count: 0 };
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
    undersowing: Undersowing;
  } | null>(null);
  const cropEditRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cropEdit) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      // Rippmenüü valikud on portaalis (väljaspool rida) — need ei tohi redigeerimist sulgeda.
      if (target.closest?.('[data-radix-popper-content-wrapper], [role="listbox"]')) return;
      if (cropEditRef.current && !cropEditRef.current.contains(target)) setCropEdit(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Esc sulgeb esmalt avatud rippmenüü, mitte kogu rida. Kontrolli sündmuse sihtmärki (fookus on avatud
      // loendis), mitte dokumenti: Radix sulgeb loendi juba enne seda kuulajat.
      if (e.key === 'Escape' && !(e.target as Element | null)?.closest?.('[data-radix-popper-content-wrapper], [role="listbox"]')) setCropEdit(null);
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

  if (!isOpen) return null;

  // Miks lahtri kultuuri ei saa otse muuta (null = saab).
  const cropEditBlockReason = (field: MasterField, rec: FieldYearlyRecord | undefined, year: number): string | null => {
    if (seasons.some((s) => s.year === year && s.isLocked)) return 'Hooaeg on lukus';
    if (!rec && field.history.length === 0) return 'Põllul pole ühegi aasta andmeid';
    return null;
  };

  const openCropEdit = (field: MasterField, year: number, rec?: FieldYearlyRecord) =>
    setCropEdit({ fieldId: field.id, year, crop: rec?.crop ?? '', variety: rec?.cropVariety ?? '', undersowing: rec?.undersowing ?? 'NONE' });

  const saveCropEdit = () => {
    if (!cropEdit) return;
    const field = masterFields.find((f) => f.id === cropEdit.fieldId);
    if (!field) return setCropEdit(null);
    const rec = field.history.find((h) => h.year === cropEdit.year);
    // Tühi valik: kultuur eemaldatakse, aasta kirje (pindala, piirid, katastrid) jääb alles.
    if (!cropEdit.crop) {
      if (rec && !isCropUndetermined(rec.crop)) {
        onUpdateField(field.id, {}, { ...rec, crop: '', cropVariety: undefined, cropColor: UNDETERMINED_CROP_COLOR });
      }
      return setCropEdit(null);
    }
    const cropColor = findRegistryCrop(cropEdit.crop)?.color || rec?.cropColor || DEFAULT_VEHICLE_COLOR;

    if (rec) {
      onUpdateField(field.id, {}, { ...rec, crop: cropEdit.crop, cropVariety: cropEdit.variety || undefined, undersowing: cropEdit.undersowing, cropColor });
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
        undersowing: cropEdit.undersowing,
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
          <span className="sub-val">({financialSummary.totalTax} €/a maamaks)</span>
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
          <span className="sub-val">({financialSummary.totalRent} €/a rent)</span>
        </button>
      </div>
    </>
  );

  const bodyContent = (
    <div className="fullpage-board-content">
          {/* Top Row: Year Season Switcher & Global Stats */}
          <div className="register-header-controls">
            {/* Year Selector Tabs */}
            <div className="year-selector-group">
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
              <div className="register-io-buttons">
                <Button
                  size="sm"
                  onClick={handleExportCsv}
                  title="Ekspordi tabel CSV failina"
                >
                  <Download size={14} />
                  <span>CSV Eksport</span>
                  <HelpHint helpKey="fields.register.export-csv" inline />
                </Button>

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
                <Button
                  variant="ghost"
                  size="sm"
                  className="alert-action"
                  onClick={onOpenSeasonManager}
                >
                  Ava hooajahaldur
                </Button>
              )}
            </div>
          )}

          {/* Valitud hooaja kultuuride kokkuvõte; kiibil klikk filtreerib tabeli */}
          <Card variant="tile" padding="sm" className="register-crop-summary">
            {cropSummaryContent}
          </Card>

          {/* Search & Actions Row */}
          <div className="register-actions-bar">
            <SearchInput className="search-field" value={searchQuery} onChange={setSearchQuery} placeholder="Otsi põllu nime, koodi, katastrit või omanikku..." aria-label="Otsi põllu nime, koodi, katastrit või omanikku..." />

            <FilterClear inline active={showMissingInYear} onClear={() => setShowMissingInYear(false)}>
              <CheckboxField checked={showMissingInYear} onCheckedChange={setShowMissingInYear} label={`Näita ka ${selectedYear}. aastal puuduvaid põlde`} />
            </FilterClear>

            {(cropFilter !== 'all' || tenureFilter !== 'all') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCropFilter('all');
                  setTenureFilter('all');
                }}
              >
                <X size={14} />
                <span>Eemalda filtrid</span>
              </Button>
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

          <Table scroll="fill" bordered>
            <TableHeader>
              <TableRow>
                <TableHead pin="start" className="sticky-name">Põld</TableHead>
                <TableHead pin="start" className="sticky-size">Suurus</TableHead>
                {tableYears.map((yr) => (
                  <TableHead
                    key={yr}
                    className={`year-col ${yr === selectedYear ? 'selected' : ''}`}
                    onClick={() => onSelectYear(yr)}
                    title={`Vali hooaeg ${yr}`}
                  >
                    <span className="year-col-label">{yr}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFields.length === 0 && (
                <TableEmpty colSpan={2 + tableYears.length}>
                  Otsingule vastavaid põlde ei leitud. Proovi muuta otsingusõna või eemalda kultuuri-/omandifilter.
                </TableEmpty>
              )}
              {filteredFields.map((field) => {
                const selectedRec = field.history.find((h) => h.year === selectedYear);
                const latestRec = [...field.history].sort((a, b) => b.year - a.year)[0];
                const sizeRec = selectedRec || latestRec;

                return (
                  <TableRow key={field.id}>
                    <TableCell pin="start" wrap className="name-cell sticky-name has-corner-btn">
                      {/* Valitud aasta põllu kuju nupp lahtri paremas ülanurgas (nagu põllutööde tahvlil) */}
                      {selectedRec?.geometry && (
                        <Button variant="ghost" size="icon-xs" wrapperClassName="fw-field-shape-corner"
                          title={`Näita ${selectedYear}. a põllu kuju`}
                          onClick={() => setShapeView({ fieldId: field.id, year: selectedYear })}
                        >
                          <Crosshair size={13} />
                        </Button>
                      )}
                      <div className="field-title-line">
                        {field.num && <Badge tone="success" variant="outline" size="md" className="num" title="PRIA põllu number">Nr {field.num}</Badge>}
                        <span className="field-name">{field.name}</span>
                      </div>
                      <div className="field-sub-tags">
                        <Badge tone="info" className="num" title="PRIA massiivi number">{field.fieldCode}</Badge>
                        {field.operatorName && <Badge>👤 {field.operatorName}</Badge>}
                        {field.soilType && <Badge title={SOIL_AUTO_HINT}>🌱 {field.soilType}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell
                      pin="start"
                      className={`size-cell sticky-size ${selectedRec ? '' : 'muted'}`}
                      title={selectedRec ? selectedRec.areaChangeReason || undefined : sizeRec ? `${sizeRec.year}. a pindala` : undefined}
                    >
                      <div className="season-area-box">
                        <strong className="season-ha-val">{sizeRec ? `${sizeRec.areaHa.toFixed(2)} ha` : '–'}</strong>
                        {selectedRec?.eligibleAreaHa ? <span className="eligible-ha-sub">PRIA: {selectedRec.eligibleAreaHa} ha</span> : null}
                      </div>
                    </TableCell>
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
                          <TableCell key={yr} wrap className={`year-cell editing ${yr === selectedYear ? 'selected' : ''}`}>
                            <div ref={cropEditRef} className="crop-inline-edit">
                              <Select
                                size="sm"
                                value={cropEdit.crop}
                                autoFocus
                                aria-label="Kultuur"
                                onValueChange={(v) => setCropEdit({ ...cropEdit, crop: v, variety: '', undersowing: 'NONE' })}
                                options={[
                                  { value: '', label: '– Kultuur määramata –' },
                                  ...(cropEdit.crop && !activeCrops.some((c) => c.name === cropEdit.crop) ? [{ value: cropEdit.crop, label: cropEdit.crop }] : []),
                                  ...activeCrops.map((c) => ({ value: c.name, label: c.name }))
                                ]}
                              />
                              <Select
                                size="sm"
                                value={cropEdit.variety}
                                aria-label="Sort"
                                onValueChange={(v) => setCropEdit({ ...cropEdit, variety: v })}
                                disabled={varietyOptions.length === 0}
                                options={[
                                  { value: '', label: varietyOptions.length === 0 ? 'Sorte pole' : 'Sort määramata' },
                                  ...varietyOptions.map((v) => ({ value: v, label: v }))
                                ]}
                              />
                              {findRegistryCrop(cropEdit.crop)?.priaUndersowing && (
                                <Select
                                  size="sm"
                                  value={cropEdit.undersowing}
                                  aria-label="Allakülv"
                                  onValueChange={(v) => setCropEdit({ ...cropEdit, undersowing: v as Undersowing })}
                                  options={(Object.keys(UNDERSOWING_LABELS) as Undersowing[]).map((u) => ({ value: u, label: UNDERSOWING_LABELS[u] }))}
                                />
                              )}
                              <div className="crop-inline-edit-actions">
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCropEdit(null)} title="Loobu (Esc)">
                                  <X size={15} />
                                </Button>
                                <Button type="button" variant="ghost" size="icon-sm" className="save" onClick={saveCropEdit} title="Salvesta">
                                  <Check size={15} />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell
                          key={yr}
                          className={`year-cell ${yr === selectedYear ? 'selected' : ''} ${editable ? 'editable' : ''} ${hasCrop ? 'has-crop' : ''}`}
                          style={hasCrop ? ({ '--crop-color': rec.cropColor } as React.CSSProperties) : undefined}
                          title={editable ? (hasCrop ? 'Klõpsa kultuuri muutmiseks' : 'Klõpsa, et lisada selle aasta kultuur') : blockReason ?? undefined}
                          onClick={editable ? () => openCropEdit(field, yr, rec) : undefined}
                          tabIndex={editable ? 0 : undefined}
                          onKeyDown={editable ? clickOnActivationKey : undefined}
                        >
                          {rec ? (
                            <>
                              <div className="year-crop">
                                {hasCrop
                                  ? <span className="year-crop-name" title={rec.priaCropName ? `PRIA nimetus: ${rec.priaCropName}` : rec.crop}>{rec.crop}</span>
                                  : <span className="muted">–</span>}
                                {editable && <Edit2 size={11} className="year-crop-edit-icon" />}
                                <Button variant="ghost" size="icon-xs" wrapperClassName="year-shape-btn"
                                  title={`Näita ${yr}. a põllu kuju`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShapeView({ fieldId: field.id, year: yr });
                                  }}
                                >
                                  <Crosshair size={13} />
                                </Button>
                              </div>
                              {rec.cropVariety && <div className="cell-sub">{rec.cropVariety}</div>}
                              {hasCrop && rec.undersowing && rec.undersowing !== 'NONE' && (
                                <div className="cell-sub">{UNDERSOWING_LABELS[rec.undersowing]}</div>
                              )}
                            </>
                          ) : (
                            <div className="year-crop">
                              <span className="muted">–</span>
                              {editable && <Edit2 size={11} className="year-crop-edit-icon" />}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
  );

  return (
    <div className="fullpage-board-view">
      <main className="fullpage-board-main wide">
        <div className="fullpage-board-header">
          <div className="fullpage-title-wrap">
            <Repeat size={26} />
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
};

