// src/components/FieldsTableView.tsx — Põldude üldandmete tabel (omandisuhe, katastrid, mullastik, operaator)
import React, { useMemo, useState } from 'react';
import { Layers, Calendar, Search, X, Lock, Download, Info, AlertCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import type { MasterField, FieldYearlyRecord } from '../types/fieldRegister';
import { compareFieldNumbers } from '../types/fieldRegister';
import type { FieldCadastralLink } from '../types/cadastre';
import type { FarmingSeason } from '../types/season';
import { isCropUndetermined, seasonSelectorYears } from '../types/season';
import type { RelatedParty } from '../types/party';
import type { Crop } from '../types/crop';
import { FieldEditDialog } from './FieldEditDialog';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { HelpHint } from './HelpHint';

interface FieldsTableViewProps {
  masterFields: MasterField[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  seasons?: FarmingSeason[];
  /** Avab põllu infoakna (sama mis kaardil põllule klikates) */
  onOpenFieldDetails?: (fieldId: number | string) => void;
  onUpdateField: (fieldId: number | string, fieldData: Partial<MasterField>, seasonData?: FieldYearlyRecord) => void;
  onDeleteField: (fieldId: number | string) => void;
  onOpenUpload?: () => void; // puudub mitteadminil (import ainult adminile)
  onOpenSoilUpload?: () => void;
  onOpenFieldBookUpload?: () => void;
  parties?: RelatedParty[];
  onOpenParties?: () => void;
  crops?: Crop[];
  onOpenCrops?: () => void;
}

type TenureKind = 'owned' | 'rented' | 'mixed' | 'unknown';
type TenureFilter = 'all' | TenureKind;

const TENURE_LABEL: Record<TenureKind, string> = {
  owned: 'Oma maa',
  rented: 'Rendimaa',
  mixed: 'Oma + rent',
  unknown: 'Teadmata'
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
    } else {
      rentedHa += p.fieldAreaHa;
      rentFeeEur += p.rentFeeEurYear ?? (p.rentFeeEurHa ? p.rentFeeEurHa * p.fieldAreaHa : 0);
    }
  });
  const hasOwned = parcels.some((p) => p.ownershipType === 'OWNED');
  const hasRented = parcels.some((p) => p.ownershipType === 'RENTED');
  const tenure: TenureKind = hasOwned && hasRented ? 'mixed' : hasOwned ? 'owned' : hasRented ? 'rented' : 'unknown';
  const owners = Array.from(new Set(parcels.map((p) => p.ownerName?.trim()).filter((n): n is string => !!n)));
  return { field, rec, parcels, tenure, ownedHa, rentedHa, landTaxEur, rentFeeEur, owners };
}

export const FieldsTableView: React.FC<FieldsTableViewProps> = ({
  masterFields,
  selectedYear,
  onSelectYear,
  seasons = [],
  onOpenFieldDetails,
  onUpdateField,
  onDeleteField,
  onOpenUpload,
  onOpenSoilUpload,
  onOpenFieldBookUpload,
  parties = [],
  onOpenParties,
  crops = [],
  onOpenCrops
}) => {
  const [searchQuery, setSearchQuery] = useState('');
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
    <div className="fullpage-board-view">
      <main className="fullpage-board-main wide">
        <div className="fullpage-board-header">
          <div className="fullpage-title-wrap">
            <Layers className="text-emerald" size={26} />
            <div>
              <h2>Põllud</h2>
              <p className="fullpage-subtitle">Põldude üldandmed valitud hooajal: pindalad, omandisuhe, katastriüksused, mullastik ja operaator</p>
            </div>
          </div>
        </div>

        <div className="fullpage-board-body">
          <div className="modal-body">
            <div className="register-header-controls">
              <div className="year-selector-group">
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
                <div className="register-io-buttons">
                  <button className="btn btn-secondary btn-sm" onClick={handleExportCsv} title="Ekspordi tabel CSV failina">
                    <Download size={14} />
                    <span>CSV Eksport</span>
                  </button>
                  {onOpenSoilUpload && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={onOpenSoilUpload}
                      title="Impordi mullaproovide punktid Shapefile ZIP-ist"
                    >
                      <Plus size={14} />
                      <span>Impordi mullaproovid</span>
                      <HelpHint helpKey="fields.register.import-soil-samples" inline />
                    </button>
                  )}

                  {onOpenFieldBookUpload && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={onOpenFieldBookUpload}
                      title="Impordi e-PRIA põlluraamatu väljavõte (.xls)"
                    >
                      <Plus size={14} />
                      <span>Impordi põlluraamat</span>
                      <HelpHint helpKey="fields.register.import-field-book" inline />
                    </button>
                  )}

                  {onOpenUpload && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={onOpenUpload}
                    >
                      <Plus size={14} />
                      <span>Impordi PRIA ZIP</span>
                      <HelpHint helpKey="fields.register.import-pria-zip" inline />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="register-actions-bar">
              <div className="search-box-wrap">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Otsi põllu nime, numbrit, katastrit, omanikku või operaatorit..."
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
              <div className="category-filter-tabs">
                {tenureFilters.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`filter-tab ${tenureFilter === t ? 'active' : ''}`}
                    onClick={() => setTenureFilter(t)}
                    disabled={t !== 'all' && tenureCounts[t] === 0}
                  >
                    {t === 'all' ? `Kõik (${rows.length})` : `${TENURE_LABEL[t]} (${tenureCounts[t]})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="register-table-wrap">
              <table className="register-table fields-table">
                <thead>
                  <tr>
                    <th className="sticky-name">Põld</th>
                    <th className="num-col">Pindala</th>
                    <th className="num-col">PRIA pind</th>
                    <th>Kultuur {selectedYear}</th>
                    <th>Omandisuhe</th>
                    <th>Omanik / rendileandja</th>
                    <th>Katastriüksused</th>
                    <th className="num-col">Maamaks</th>
                    <th className="num-col">Rent</th>
                    <th>Mullastik</th>
                    <th>Drenaaž</th>
                    <th>Operaator</th>
                    <th className="actions-col"><span className="sr-only">Tegevused</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const { field, rec } = r;
                    const hasCrop = !isCropUndetermined(rec.crop);
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
                          </div>
                        </td>
                        <td className="num-col" title={rec.areaChangeReason || undefined}>
                          <strong>{fmtHa(rec.areaHa || 0)} ha</strong>
                        </td>
                        <td className="num-col">{rec.eligibleAreaHa ? `${fmtHa(rec.eligibleAreaHa)} ha` : <span className="muted">–</span>}</td>
                        <td>
                          {hasCrop ? (
                            <span className="fields-table-crop" style={{ '--crop-color': rec.cropColor } as React.CSSProperties}>
                              {rec.crop}
                            </span>
                          ) : <span className="muted">–</span>}
                          {rec.cropVariety && <div className="cell-sub">{rec.cropVariety}</div>}
                        </td>
                        <td>
                          <span className={`tenure-badge ${r.tenure}`}>{TENURE_LABEL[r.tenure]}</span>
                          {r.tenure === 'mixed' && (
                            <div className="cell-sub">{fmtHa(r.ownedHa)} oma / {fmtHa(r.rentedHa)} rent</div>
                          )}
                        </td>
                        <td className="wrap-cell">{r.owners.length ? r.owners.join(', ') : <span className="muted">–</span>}</td>
                        <td>
                          {r.parcels.length ? r.parcels.map((p) => (
                            <div key={p.cadastralCode} title={`${p.parcelName ? `${p.parcelName}, ` : ''}${fmtHa(p.fieldAreaHa)} ha`}>
                              {p.cadastralCode}
                              {r.parcels.length > 1 && <span className="cell-sub-inline"> · {fmtHa(p.fieldAreaHa)} ha</span>}
                            </div>
                          )) : <span className="muted">–</span>}
                        </td>
                        <td className="num-col">{r.landTaxEur > 0 ? fmtEur(r.landTaxEur) : <span className="muted">–</span>}</td>
                        <td className="num-col">{r.rentFeeEur > 0 ? fmtEur(r.rentFeeEur) : <span className="muted">–</span>}</td>
                        <td className="wrap-cell">{field.soilType || <span className="muted">–</span>}</td>
                        <td>{field.drainageSystem === undefined ? <span className="muted">–</span> : field.drainageSystem ? 'Jah' : 'Ei'}</td>
                        <td>{field.operatorName || <span className="muted">–</span>}</td>
                        <td className="actions-col">
                          <div className="row-actions">
                            <button className="icon-btn-ghost" onClick={() => setEditingFieldId(field.id)} title="Muuda">
                              <Edit2 size={15} />
                            </button>
                            <button className="icon-btn-danger" onClick={() => handleDelete(field)} title="Kustuta">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filteredRows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td className="sticky-name"><strong>Kokku: {filteredRows.length} põldu</strong></td>
                      <td className="num-col"><strong>{fmtHa(totals.areaHa)} ha</strong></td>
                      <td className="num-col">{totals.eligibleHa > 0 ? `${fmtHa(totals.eligibleHa)} ha` : ''}</td>
                      <td></td>
                      <td>
                        <div className="cell-sub">Oma: {fmtHa(totals.ownedHa)} ha</div>
                        <div className="cell-sub">Rent: {fmtHa(totals.rentedHa)} ha</div>
                      </td>
                      <td></td>
                      <td></td>
                      <td className="num-col"><strong>{fmtEur(totals.landTaxEur)}</strong></td>
                      <td className="num-col"><strong>{fmtEur(totals.rentFeeEur)}</strong></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="actions-col"></td>
                    </tr>
                  </tfoot>
                )}
              </table>

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
                />
              )}

              {filteredRows.length === 0 && (
                <div className="empty-register-state glass-card">
                  <AlertCircle size={28} className="text-amber" />
                  <h4>{rows.length === 0 ? `Hooajal ${selectedYear} pole põlde` : 'Otsingule vastavaid põlde ei leitud'}</h4>
                  <p>{rows.length === 0 ? 'Vali teine hooaeg või impordi põllud PRIA ZIP-failist.' : 'Proovi muuta otsingusõna või omandisuhte filtrit.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
