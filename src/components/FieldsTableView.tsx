// src/components/FieldsTableView.tsx — Põldude üldandmete tabel (omandisuhe, katastrid, mullastik, operaator)
import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Calendar, Lock, Download, Crosshair, Plus, Edit2, Trash2 } from 'lucide-react';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import { compareFieldNumbers } from '../types/fieldRegister';
import type { FieldCadastralLink } from '../types/cadastre';
import type { FarmingSeason } from '../types/season';
import { isCropUndetermined, seasonSelectorYears } from '../types/season';
import type { RelatedParty } from '../types/party';
import type { Crop } from '../types/crop';
import type { BaseMapLayerId } from '../types/map';
import type { SoilSample } from '../types/soilSample';
import { FieldEditDialog } from './FieldEditDialog';
import { FieldShapeModal } from './FieldShapeModal';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { fmt0 } from '../services/weatherFormat';
import { Button, Table, TableBody, TableCell, TableEmpty, TableFooter, TableHead, TableHeader, TableRow, Badge, ToggleGroup, ToggleGroupItem, SearchInput, HelpHint, PageHeader, cornerActionClass, cn } from './ui';
import type { BadgeTone } from './ui';
import { boardViewClass, boardMainClass, boardBodyClass, boardContentClass, registerHeaderControlsClass, registerIoButtonsClass, registerActionsBarClass, searchFieldClass, yearSelectorGroupClass, yearLabelClass, cellSubClass, cellSubStackedClass, tableNameClass, tableTitleLineClass, tableSubTagsClass, tableMutedClass } from './ui/variants';

// Kinnitatud Põllu veerg (laius 240px kõigis kolmes kohas), tekstiveerg ja jaluse kinnitatud lahtrid (z 3 kerimisel teiste jaluselahtrite kohal)
const PIN_NAME_CELL = 'w-60 min-w-60 max-w-60 pin-edge-end';
const WRAP_CELL = 'min-w-35 max-w-55';
const FOOT_PIN_Z = 'z-3!';

interface FieldsTableViewProps {
  masterFields: MasterField[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  seasons?: FarmingSeason[];
  /** Aluskaart põllu kuju aknale */
  baseMap?: BaseMapLayerId;
  onUpdateField: (fieldId: number | string, fieldData: Partial<MasterField>, seasonData?: FieldYearlyRecord) => void;
  onDeleteField: (fieldId: number | string) => void;
  onOpenUpload?: () => void; // puudub mitteadminil (import ainult adminile)
  onOpenSoilUpload?: () => void;
  onOpenFieldBookUpload?: () => void;
  parties?: RelatedParty[];
  onOpenParties?: () => void;
  crops?: Crop[];
  onOpenCrops?: () => void;
  soilSamples?: SoilSample[]; // põllu muutmise aknas näidatakse põllu piiridesse jäävad
  weatherEnabled?: boolean; // ilmamoodul: GDD ja sademete veerud
}

type TenureKind = 'owned' | 'rented' | 'mixed' | 'unknown';
type TenureFilter = 'all' | TenureKind;

const TENURE_LABEL: Record<TenureKind, string> = {
  owned: 'Oma maa',
  rented: 'Rendimaa',
  mixed: 'Oma + rent',
  unknown: 'Teadmata'
};

// Omandivormi märgi toon
const TENURE_TONE: Record<TenureKind, BadgeTone> = {
  owned: 'success',
  rented: 'info',
  mixed: 'warning',
  unknown: 'neutral'
};

interface FieldRow {
  field: MasterField;
  rec: FieldYearlyRecord;
  parcels: FieldCadastralLink[];
  tenure: TenureKind;
  ownedHa: number;
  rentedHa: number;
  landTaxEur: number;
  rentFeeEur: number;
  owners: string[];
}

const fmtHa = (v: number) => v.toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEur = (v: number) => `${Math.round(v).toLocaleString('et-EE')} €`;

function buildRow(field: MasterField, rec: FieldYearlyRecord): FieldRow {
  const parcels = rec.cadastralParcels || field.cadastralParcels || [];
  let ownedHa = 0;
  let rentedHa = 0;
  let landTaxEur = 0;
  let rentFeeEur = 0;
  parcels.forEach((p) => {
    if (p.ownershipType === 'OWNED') {
      ownedHa += p.fieldAreaHa;
      landTaxEur += p.landTaxEurYear ?? (p.landTaxEurHa ? p.landTaxEurHa * p.fieldAreaHa : 0);
    } else if (p.ownershipType === 'RENTED') {
      rentedHa += p.fieldAreaHa;
      rentFeeEur += p.rentFeeEurYear ?? (p.rentFeeEurHa ? p.rentFeeEurHa * p.fieldAreaHa : 0);
    }
  });
  const hasOwned = parcels.some((p) => p.ownershipType === 'OWNED');
  const hasRented = parcels.some((p) => p.ownershipType === 'RENTED');
  // Kui mõne katastriüksuse omandivorm on teadmata, ei saa ka põllu oma teada olla
  const hasUnknown = parcels.length === 0 || parcels.some((p) => p.ownershipType === 'UNKNOWN');
  const tenure: TenureKind = hasUnknown ? 'unknown' : hasOwned && hasRented ? 'mixed' : hasOwned ? 'owned' : 'rented';
  const owners = Array.from(new Set(parcels.map((p) => p.ownerName?.trim()).filter((n): n is string => !!n)));
  return { field, rec, parcels, tenure, ownedHa, rentedHa, landTaxEur, rentFeeEur, owners };
}

export const FieldsTableView: React.FC<FieldsTableViewProps> = ({
  masterFields,
  selectedYear,
  onSelectYear,
  seasons = [],
  baseMap = 'maaamet-pohikaart',
  onUpdateField,
  onDeleteField,
  onOpenUpload,
  onOpenSoilUpload,
  onOpenFieldBookUpload,
  parties = [],
  onOpenParties,
  crops = [],
  onOpenCrops,
  soilSamples = [],
  weatherEnabled = false
}) => {
  // Hooaja ilmakokkuvõte (külvist koristuseni) põllu hooaja kirje järgi
  const [weatherBySeason, setWeatherBySeason] = useState<Map<number, { gdd: number; precipMm: number }>>(new Map());
  useEffect(() => {
    if (!weatherEnabled) return;
    let cancelled = false;
    api.getWeatherSeasons(selectedYear)
      .then((rows) => { if (!cancelled) setWeatherBySeason(new Map(rows.map((r) => [r.fieldSeasonId, r]))); })
      .catch(() => { if (!cancelled) setWeatherBySeason(new Map()); });
    return () => { cancelled = true; };
  }, [weatherEnabled, selectedYear]);
  const [searchQuery, setSearchQuery] = useState('');
  const [shapeView, setShapeView] = useState<{ field: MasterField; record: FieldYearlyRecord } | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<number | string | null>(null);
  const editingField = editingFieldId === null ? null : masterFields.find((f) => f.id === editingFieldId) ?? null;
  const closeEdit = React.useCallback(() => setEditingFieldId(null), []);
  const [tenureFilter, setTenureFilter] = useState<TenureFilter>('all');

  const availableYearsList = useMemo(() => seasonSelectorYears(seasons), [seasons]);

  // Ainult põllud, millel on valitud aasta kirje (pindala ja katastrid on hooajapõhised)
  const rows = useMemo(() => {
    return masterFields
      .map((f) => {
        const rec = f.history.find((h) => h.year === selectedYear);
        return rec ? buildRow(f, rec) : null;
      })
      .filter((r): r is FieldRow => r !== null)
      .sort((a, b) => compareFieldNumbers(a.field, b.field));
  }, [masterFields, selectedYear]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((r) => {
      if (tenureFilter !== 'all' && r.tenure !== tenureFilter) return false;
      if (!q) return true;
      const f = r.field;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.num ?? '').toLowerCase().includes(q) ||
        f.fieldCode.toLowerCase().includes(q) ||
        (f.operatorName ?? '').toLowerCase().includes(q) ||
        (f.soilType ?? '').toLowerCase().includes(q) ||
        r.rec.crop.toLowerCase().includes(q) ||
        r.parcels.some((p) => p.cadastralCode.toLowerCase().includes(q) || (p.parcelName ?? '').toLowerCase().includes(q)) ||
        r.owners.some((o) => o.toLowerCase().includes(q))
      );
    });
  }, [rows, searchQuery, tenureFilter]);

  const tenureCounts = useMemo(() => {
    const counts: Record<TenureKind, number> = { owned: 0, rented: 0, mixed: 0, unknown: 0 };
    rows.forEach((r) => { counts[r.tenure] += 1; });
    return counts;
  }, [rows]);

  const totals = useMemo(() => filteredRows.reduce(
    (acc, r) => ({
      areaHa: acc.areaHa + (r.rec.areaHa || 0),
      eligibleHa: acc.eligibleHa + (r.rec.eligibleAreaHa || 0),
      ownedHa: acc.ownedHa + r.ownedHa,
      rentedHa: acc.rentedHa + r.rentedHa,
      landTaxEur: acc.landTaxEur + r.landTaxEur,
      rentFeeEur: acc.rentFeeEur + r.rentFeeEur
    }),
    { areaHa: 0, eligibleHa: 0, ownedHa: 0, rentedHa: 0, landTaxEur: 0, rentFeeEur: 0 }
  ), [filteredRows]);

  const handleExportCsv = () => {
    const esc = (v: string | number | undefined | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Nr', 'Põld', 'PRIA massiiv', `Pindala ${selectedYear} (ha)`, 'PRIA pindala (ha)', 'Kultuur', 'Omandisuhe',
      'Oma maa (ha)', 'Rendimaa (ha)', 'Omanik / rendileandja', 'Katastriüksused', 'Maamaks (€/a)', 'Rent (€/a)', 'Mullastik', 'Drenaaž', 'Operaator'];
    const lines = filteredRows.map((r) => [
      esc(r.field.num), esc(r.field.name), esc(r.field.fieldCode), r.rec.areaHa ?? '', r.rec.eligibleAreaHa ?? '',
      esc(isCropUndetermined(r.rec.crop) ? '' : r.rec.crop), esc(TENURE_LABEL[r.tenure]),
      Math.round(r.ownedHa * 100) / 100, Math.round(r.rentedHa * 100) / 100, esc(r.owners.join('; ')),
      esc(r.parcels.map((p) => p.cadastralCode).join('; ')), Math.round(r.landTaxEur), Math.round(r.rentFeeEur),
      esc(r.field.soilType), esc(r.field.drainageSystem === undefined ? '' : r.field.drainageSystem ? 'Jah' : 'Ei'), esc(r.field.operatorName)
    ].join(','));
    const blob = new Blob(['﻿' + [headers.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teris_pollud_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Lukustatud hooajad, milles põllul on andmeid — selliseid põlde ei kustutata
  // (kustutamine eemaldaks ka arhiveeritud aastate kirjed).
  const lockedYearsOf = (field: MasterField): number[] =>
    [...new Set(field.history.map((h) => h.year))]
      .filter((y) => seasons.some((s) => s.year === y && s.isLocked))
      .sort((a, b) => a - b);

  const handleDelete = async (field: MasterField) => {
    const label = `${field.num ? `Nr ${field.num} ` : ''}${field.name}`;
    const locked = lockedYearsOf(field);
    if (locked.length > 0) {
      alertDialog(`Põldu "${label}" ei saa kustutada: sellel on andmeid lukustatud hooaegades ${locked.join(', ')}.`);
      return;
    }
    // Enne kinnitust küsitakse serverilt, kas põllul on kandeid (siis kustutada ei saa)
    let check: { entries: { year: number; count: number }[]; plannedWorks: number };
    try {
      check = await api.getFieldDeleteCheck(field.id);
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Põllu kontroll ebaõnnestus');
      return;
    }
    if (check.entries.length > 0) {
      alertDialog(`Põldu "${label}" ei saa kustutada: sellel on kandeid (${check.entries.map((e) => `${e.year}: ${e.count}`).join(', ')}). Kustuta enne kanded või jäta põld alles.`);
      return;
    }
    const works = check.plannedWorks > 0 ? ` Kustutatakse ka ${check.plannedWorks} planeeritud tööd.` : '';
    if (await confirmDialog(`Kustutada põld "${label}" registrist koos kõigi aastate andmetega?${works}`)) onDeleteField(field.id);
  };

  const tenureFilters: TenureFilter[] = ['all', 'owned', 'rented', 'mixed', 'unknown'];

  return (
    <div className={boardViewClass}>
      <main className={boardMainClass}>
        <PageHeader icon={<Layers />} title="Põllud" helpKey="view.fields" subtitle="Põldude üldandmed valitud hooajal: pindalad, omandisuhe, katastriüksused, mullastik ja operaator" />

        <div className={boardBodyClass}>
          <div className={boardContentClass}>
            <div className={registerHeaderControlsClass}>
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
                  <Button size="sm" onClick={handleExportCsv} title="Ekspordi tabel CSV failina">
                    <Download size={14} />
                    <span>CSV Eksport</span>
                  </Button>
                  {onOpenSoilUpload && (
                    <Button
                      size="sm"
                      onClick={onOpenSoilUpload}
                      title="Impordi mullaproovide punktid Shapefile ZIP-ist"
                    >
                      <Plus size={14} />
                      <span>Impordi mullaproovid</span>
                      <HelpHint helpKey="fields.register.import-soil-samples" inline />
                    </Button>
                  )}

                  {onOpenFieldBookUpload && (
                    <Button
                      size="sm"
                      onClick={onOpenFieldBookUpload}
                      title="Impordi e-PRIA põlluraamatu väljavõte (.xls)"
                    >
                      <Plus size={14} />
                      <span>Impordi põlluraamat</span>
                      <HelpHint helpKey="fields.register.import-field-book" inline />
                    </Button>
                  )}

                  {onOpenUpload && (
                    <Button
                      size="sm"
                      onClick={onOpenUpload}
                    >
                      <Plus size={14} />
                      <span>Impordi PRIA ZIP</span>
                      <HelpHint helpKey="fields.register.import-pria-zip" inline />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className={registerActionsBarClass}>
              <SearchInput className={searchFieldClass} value={searchQuery} onChange={setSearchQuery} placeholder="Otsi põllu nime, numbrit, katastrit, omanikku või operaatorit..." aria-label="Otsi põllu nime, numbrit, katastrit, omanikku või operaatorit..." />
              <ToggleGroup aria-label="Omandivorm" value={tenureFilter} onValueChange={(v) => setTenureFilter(v as TenureFilter)}>
                {tenureFilters.map((t) => (
                  <ToggleGroupItem key={t} value={t} disabled={t !== 'all' && tenureCounts[t] === 0}>
                    {t === 'all' ? `Kõik (${rows.length})` : `${TENURE_LABEL[t]} (${tenureCounts[t]})`}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Table scroll="fill" bordered className="[&>tfoot>tr>td]:border-t">
              <TableHeader>
                <TableRow>
                  <TableHead pin="start" className={PIN_NAME_CELL}>Põld</TableHead>
                  <TableHead numeric>Pindala</TableHead>
                  <TableHead numeric>PRIA pind</TableHead>
                  <TableHead>Kultuur {selectedYear}</TableHead>
                  {weatherEnabled && <TableHead numeric title="Temperatuurisumma külvist koristuseni (kultuuri baastemperatuuriga)">GDD</TableHead>}
                  {weatherEnabled && <TableHead numeric title="Sademed külvist koristuseni">Sademed, mm</TableHead>}
                  <TableHead>Omandisuhe</TableHead>
                  <TableHead>Omanik / rendileandja</TableHead>
                  <TableHead>Katastriüksused</TableHead>
                  <TableHead numeric>Maamaks</TableHead>
                  <TableHead numeric>Rent</TableHead>
                  <TableHead>Mullastik</TableHead>
                  <TableHead>Drenaaž</TableHead>
                  <TableHead>Operaator</TableHead>
                  <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 && (
                  <TableEmpty colSpan={weatherEnabled ? 15 : 13}>
                    {rows.length === 0
                      ? `Hooajal ${selectedYear} pole põlde. Vali teine hooaeg või impordi põllud PRIA ZIP-failist.`
                      : 'Otsingule vastavaid põlde ei leitud. Proovi muuta otsingusõna või omandisuhte filtrit.'}
                  </TableEmpty>
                )}
                {filteredRows.map((r) => {
                  const { field, rec } = r;
                  const hasCrop = !isCropUndetermined(rec.crop);
                  return (
                    <TableRow key={field.id}>
                      <TableCell pin="start" wrap className={cn(PIN_NAME_CELL, 'pr-8')}>
                        {/* Põllu kuju nupp lahtri paremas ülanurgas (nagu põllutööde tahvlil) */}
                        {rec.geometry && (
                          <Button variant="ghost" size="icon-xs" wrapperClassName={cornerActionClass}
                            onClick={() => setShapeView({ field, record: rec })}
                            title={`Näita ${selectedYear}. a põllu kuju`}
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
                        </div>
                      </TableCell>
                      <TableCell numeric title={rec.areaChangeReason || undefined}>
                        {fmtHa(rec.areaHa || 0)} ha
                      </TableCell>
                      <TableCell numeric>{rec.eligibleAreaHa ? `${fmtHa(rec.eligibleAreaHa)} ha` : <span className={tableMutedClass}>–</span>}</TableCell>
                      <TableCell>
                        {hasCrop ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-2 shrink-0 rounded-sm bg-subtle" style={rec.cropColor ? { background: rec.cropColor } : undefined} />
                            {rec.crop}
                          </span>
                        ) : <span className={tableMutedClass}>–</span>}
                        {rec.cropVariety && <div className={cellSubStackedClass}>{rec.cropVariety}</div>}
                      </TableCell>
                      {weatherEnabled && <TableCell numeric>{fmt0(weatherBySeason.get(rec.fieldSeasonId ?? -1)?.gdd)}</TableCell>}
                      {weatherEnabled && <TableCell numeric>{fmt0(weatherBySeason.get(rec.fieldSeasonId ?? -1)?.precipMm)}</TableCell>}
                      <TableCell>
                        <Badge tone={TENURE_TONE[r.tenure]}>{TENURE_LABEL[r.tenure]}</Badge>
                        {r.tenure === 'mixed' && (
                          <div className={cellSubStackedClass}>{fmtHa(r.ownedHa)} oma / {fmtHa(r.rentedHa)} rent</div>
                        )}
                      </TableCell>
                      <TableCell wrap className={WRAP_CELL}>{r.owners.length ? r.owners.join(', ') : <span className={tableMutedClass}>–</span>}</TableCell>
                      <TableCell>
                        {r.parcels.length ? r.parcels.map((p, i) => (
                          <div key={i} title={`${p.parcelName ? `${p.parcelName}, ` : ''}${fmtHa(p.fieldAreaHa)} ha`}>
                            {p.cadastralCode}
                            {r.parcels.length > 1 && <span className={cellSubClass}> · {fmtHa(p.fieldAreaHa)} ha</span>}
                          </div>
                        )) : <span className={tableMutedClass}>–</span>}
                      </TableCell>
                      <TableCell numeric>{r.landTaxEur > 0 ? fmtEur(r.landTaxEur) : <span className={tableMutedClass}>–</span>}</TableCell>
                      <TableCell numeric>{r.rentFeeEur > 0 ? fmtEur(r.rentFeeEur) : <span className={tableMutedClass}>–</span>}</TableCell>
                      <TableCell wrap className={WRAP_CELL}>{field.soilType || <span className={tableMutedClass}>–</span>}</TableCell>
                      <TableCell>{field.drainageSystem === undefined ? <span className={tableMutedClass}>–</span> : field.drainageSystem ? 'Jah' : 'Ei'}</TableCell>
                      <TableCell wrap>{field.operatorName || <span className={tableMutedClass}>–</span>}</TableCell>
                      <TableCell actions>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditingFieldId(field.id)} title="Muuda">
                          <Edit2 size={15} />
                        </Button>
                        <Button variant="danger-ghost" size="icon-sm" onClick={() => handleDelete(field)} title="Kustuta">
                          <Trash2 size={15} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {filteredRows.length > 0 && (
                <TableFooter sticky>
                  <TableRow>
                    <TableCell pin="start" className={cn(PIN_NAME_CELL, FOOT_PIN_Z)}><strong>Kokku: {filteredRows.length} põldu</strong></TableCell>
                    <TableCell numeric><strong>{fmtHa(totals.areaHa)} ha</strong></TableCell>
                    <TableCell numeric>{totals.eligibleHa > 0 ? `${fmtHa(totals.eligibleHa)} ha` : ''}</TableCell>
                    <TableCell />
                    {weatherEnabled && <TableCell />}
                    {weatherEnabled && <TableCell />}
                    <TableCell>
                      <div className={cellSubStackedClass}>Oma: {fmtHa(totals.ownedHa)} ha</div>
                      <div className={cellSubStackedClass}>Rent: {fmtHa(totals.rentedHa)} ha</div>
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell numeric><strong>{fmtEur(totals.landTaxEur)}</strong></TableCell>
                    <TableCell numeric><strong>{fmtEur(totals.rentFeeEur)}</strong></TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell actions className={FOOT_PIN_Z} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>

            {shapeView && (
              <FieldShapeModal
                field={shapeView.field}
                record={shapeView.record}
                baseMap={baseMap}
                onClose={() => setShapeView(null)}
              />
            )}

            {editingField && (
              <FieldEditDialog
                field={editingField}
                selectedYear={selectedYear}
                seasons={seasons}
                parties={parties}
                onOpenParties={onOpenParties}
                crops={crops}
                onOpenCrops={onOpenCrops}
                onUpdateField={onUpdateField}
                onClose={closeEdit}
                soilSamples={soilSamples}
                weatherEnabled={weatherEnabled}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
