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
import { UNDERSOWING_LABELS, type Undersowing } from '../services/priaCropName';
import { Button, Card, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, Badge, ToggleGroup, ToggleGroupItem, FilterClear, SearchInput, CheckboxField, Select, clickOnActivationKey, HelpHint, ChipButton, PageHeader, cornerActionClass, cn } from './ui';
import { cellSubStackedClass, tableNameClass, tableTitleLineClass, tableSubTagsClass, tableMutedClass, statChipLabelClass, statChipNumClass, statChipSubClass, boardViewClass, boardMainClass, boardBodyClass, boardContentClass, registerHeaderControlsClass, registerActionsBarClass, registerIoButtonsClass, searchFieldClass, yearSelectorGroupClass, yearLabelClass } from './ui/variants';

// Kultuurigrupi pealkiri ja pindala (täisleht: 13px / min-laius 240px, number 14px).
const GROUP_TITLE = 'mr-2 inline-flex min-w-[min(240px,100%)] items-baseline gap-1.5 text-sm font-semibold leading-natural text-muted-foreground';
const GROUP_NUM = 'ml-auto text-base font-semibold leading-natural tabular-nums';

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
      <div className="flex min-w-0 flex-1 basis-120 flex-col gap-1.5">
        {cropGroups.length === 0 && <span className="text-base leading-natural text-subtle">Selle hooaja kirjeid pole</span>}
        {cropGroups.map((g) => (
          <div key={g.kind} className="flex w-full flex-wrap items-center gap-2">
            <span className={GROUP_TITLE} title={g.title}>
              {g.label}: <strong className={cn(GROUP_NUM, g.kind === 'winter' && 'text-sky-text', g.kind === 'spring' && 'text-primary')}>{g.totalHa.toFixed(2)} ha</strong>
            </span>
            {g.rows.map((c) => (
              <ChipButton
                key={c.crop}
                variant="tint"
                accent={c.color}
                selected={cropFilter === c.crop}
                dimmed={cropFilter !== 'all' && cropFilter !== c.crop}
                onClick={() => setCropFilter(cropFilter === c.crop ? 'all' : c.crop)}
                title={`${c.crop}: ${c.areaHa.toFixed(2)} ha (${c.count} põldu) — ${cropFilter === c.crop ? 'klõps eemaldab filtri' : 'klõps filtreerib tabeli'}`}
              >
                <span>{c.crop}</span>
                <strong className={statChipNumClass}>{c.areaHa.toFixed(2)} ha</strong>
              </ChipButton>
            ))}
          </div>
        ))}
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-1.5">
          <span className={GROUP_TITLE}>
            Σ Kogupind: <strong className={GROUP_NUM}>{totalAreaHa.toFixed(2)} ha</strong>
          </span>
          <span className="text-base leading-natural text-subtle">{fieldsForSelectedYear.length} põldu</span>
        </div>
      </div>
      {/* Omandivormid paremal üksteise all; klikk filtreerib tabeli */}
      <div className="ml-auto flex flex-col items-stretch gap-1.5">
        <ChipButton
          variant="outline"
          accent="var(--emerald-500)"
          selected={tenureFilter === 'OWNED'}
          onClick={() => setTenureFilter(tenureFilter === 'OWNED' ? 'all' : 'OWNED')}
          title={tenureFilter === 'OWNED' ? 'Eemalda omandivormi filter' : 'Näita ainult oma maa põlde'}
        >
          <span className={statChipLabelClass}>🏛️ Oma maa:</span>
          <strong className={statChipNumClass}>{financialSummary.ownedHa} ha</strong>
          <span className={statChipSubClass}>({financialSummary.totalTax} €/a maamaks)</span>
        </ChipButton>
        <ChipButton
          variant="outline"
          accent="var(--blue-500)"
          selected={tenureFilter === 'RENTED'}
          onClick={() => setTenureFilter(tenureFilter === 'RENTED' ? 'all' : 'RENTED')}
          disabled={financialSummary.rentedHa === 0 && tenureFilter !== 'RENTED'}
          title={tenureFilter === 'RENTED' ? 'Eemalda omandivormi filter' : 'Näita ainult rendimaa põlde'}
        >
          <span className={statChipLabelClass}>🤝 Rendimaa:</span>
          <strong className={statChipNumClass}>{financialSummary.rentedHa} ha</strong>
          <span className={statChipSubClass}>({financialSummary.totalRent} €/a rent)</span>
        </ChipButton>
      </div>
    </>
  );

  const bodyContent = (
    <div className={boardContentClass}>
          {/* Top Row: Year Season Switcher & Global Stats */}
          <div className={registerHeaderControlsClass}>
            {/* Year Selector Tabs */}
            <div className={yearSelectorGroupClass}>
              <span className={yearLabelClass}>
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
              <div className={registerIoButtonsClass}>
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
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-subtle/30 bg-subtle/14 px-3 py-2 text-sm text-foreground">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock size={16} />
                <span>
                  <strong>Hooaeg {selectedYear} on muudatusteks suletud.</strong> Koristus on lõppenud ning põldude ja kultuuride andmed on arhiveeritud.
                </span>
              </div>
              {onOpenSeasonManager && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs underline"
                  onClick={onOpenSeasonManager}
                >
                  Ava hooajahaldur
                </Button>
              )}
            </div>
          )}

          {/* Valitud hooaja kultuuride kokkuvõte; kiibil klikk filtreerib tabeli */}
          <Card variant="tile" padding="sm" className="flex max-h-[30vh] shrink-0 flex-wrap items-start gap-x-4 gap-y-2.5 overflow-y-auto">
            {cropSummaryContent}
          </Card>

          {/* Search & Actions Row */}
          <div className={registerActionsBarClass}>
            <SearchInput className={searchFieldClass} value={searchQuery} onChange={setSearchQuery} placeholder="Otsi põllu nime, koodi, katastrit või omanikku..." aria-label="Otsi põllu nime, koodi, katastrit või omanikku..." />

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
                <TableHead pin="start" className="left-0 w-75 min-w-75 max-w-75">Põld</TableHead>
                <TableHead pin="start" className="left-75 w-27.5 min-w-27.5 pin-edge-end">Suurus</TableHead>
                {tableYears.map((yr) => (
                  <TableHead
                    key={yr}
                    className={cn('year-col cursor-pointer text-left hover:text-primary', yr === selectedYear && 'selected')}
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
                    <TableCell pin="start" wrap className="left-0 w-75 min-w-75 max-w-75 pr-8">
                      {/* Valitud aasta põllu kuju nupp lahtri paremas ülanurgas (nagu põllutööde tahvlil) */}
                      {selectedRec?.geometry && (
                        <Button variant="ghost" size="icon-xs" wrapperClassName={cornerActionClass}
                          title={`Näita ${selectedYear}. a põllu kuju`}
                          onClick={() => setShapeView({ fieldId: field.id, year: selectedYear })}
                        >
                          <Crosshair size={13} />
                        </Button>
                      )}
                      <div className={tableTitleLineClass}>
                        {field.num && <Badge tone="success" variant="outline" size="md" className="num" title="PRIA põllu number">Nr {field.num}</Badge>}
                        <span className={tableNameClass}>{field.name}</span>
                      </div>
                      <div className={tableSubTagsClass}>
                        <Badge tone="info" className="num" title="PRIA massiivi number">{field.fieldCode}</Badge>
                        {field.operatorName && <Badge>👤 {field.operatorName}</Badge>}
                        {field.soilType && <Badge title={SOIL_AUTO_HINT}>🌱 {field.soilType}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell
                      pin="start"
                      className={cn('left-75 w-27.5 min-w-27.5 pin-edge-end', !selectedRec && 'text-subtle')}
                      title={selectedRec ? selectedRec.areaChangeReason || undefined : sizeRec ? `${sizeRec.year}. a pindala` : undefined}
                    >
                      <div className="flex flex-col">
                        <strong className={cn('text-base font-normal leading-natural text-foreground', !selectedRec && 'text-subtle')}>{sizeRec ? `${sizeRec.areaHa.toFixed(2)} ha` : '–'}</strong>
                        {selectedRec?.eligibleAreaHa ? <span className="block text-2xs font-medium leading-natural text-subtle">PRIA: {selectedRec.eligibleAreaHa} ha</span> : null}
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
                          <TableCell key={yr} wrap className={cn('year-cell w-47.5 min-w-47.5 max-w-47.5', yr === selectedYear && 'selected')}>
                            <div ref={cropEditRef} className="flex flex-col gap-1">
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
                              <div className="flex justify-end gap-0.5">
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCropEdit(null)} title="Loobu (Esc)">
                                  <X size={15} />
                                </Button>
                                <Button type="button" variant="ghost" size="icon-sm" className="text-primary enabled:hover:text-primary" onClick={saveCropEdit} title="Salvesta">
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
                          className={cn('year-cell w-47.5 min-w-37.5 max-w-47.5', yr === selectedYear && 'selected', hasCrop && 'has-crop', editable && 'group/cell cursor-pointer')}
                          style={hasCrop ? ({ '--crop-color': rec.cropColor } as React.CSSProperties) : undefined}
                          title={editable ? (hasCrop ? 'Klõpsa kultuuri muutmiseks' : 'Klõpsa, et lisada selle aasta kultuur') : blockReason ?? undefined}
                          onClick={editable ? () => openCropEdit(field, yr, rec) : undefined}
                          tabIndex={editable ? 0 : undefined}
                          onKeyDown={editable ? clickOnActivationKey : undefined}
                        >
                          {rec ? (
                            <>
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                {hasCrop
                                  ? <span className="min-w-0 flex-1 truncate" title={rec.priaCropName ? `PRIA nimetus: ${rec.priaCropName}` : rec.crop}>{rec.crop}</span>
                                  : <span className={tableMutedClass}>–</span>}
                                {editable && <Edit2 size={11} className="shrink-0 text-muted-foreground opacity-0 group-hover/cell:opacity-100" />}
                                <Button variant="ghost" size="icon-xs" wrapperClassName="ml-auto shrink-0"
                                  title={`Näita ${yr}. a põllu kuju`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShapeView({ fieldId: field.id, year: yr });
                                  }}
                                >
                                  <Crosshair size={13} />
                                </Button>
                              </div>
                              {rec.cropVariety && <div className={cellSubStackedClass}>{rec.cropVariety}</div>}
                              {hasCrop && rec.undersowing && rec.undersowing !== 'NONE' && (
                                <div className={cellSubStackedClass}>{UNDERSOWING_LABELS[rec.undersowing]}</div>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className={tableMutedClass}>–</span>
                              {editable && <Edit2 size={11} className="shrink-0 text-muted-foreground opacity-0 group-hover/cell:opacity-100" />}
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
    <div className={boardViewClass}>
      <main className={boardMainClass}>
        <PageHeader icon={<Repeat />} title="Külvikord" subtitle="Aastatepõhine külvikord, PRIA pindalade muutused ja katastriandmed" />
        <div className={boardBodyClass}>
          {bodyContent}
        </div>
      </main>
    </div>
  );
};

