// src/components/FinanceModal.tsx — põllutööde finantsid ja kuluarvestus (finantsjuht / admin).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Euro,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowUpDown,
  Clock,
  Tractor,
  Wrench,
  Fuel,
  Package,
  Wheat,
  Save,
  Check,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { formatDate } from '../services/dateFormat';
import type { FinanceEntry, FieldResult, WorkEntryLineKind, FinanceStatus } from '../types/fieldWork';

interface FinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  initialEntryId?: string | null;
  onEntryUpdated?: () => void;
}

type Tab = 'entries' | 'results';
type StatusFilter = 'ACTION_NEEDED' | 'ALL' | 'PENDING' | 'CONFIRMED' | 'CHANGED';
type SortCol = 'field' | 'crop' | 'area' | 'cost' | 'revenue' | 'profit' | 'profitPerHa';

const LINE_KIND_INFO: Record<WorkEntryLineKind, { label: string; icon: React.FC<{ size?: number; className?: string }>; color: string; bg: string; defaultUnitHint: string }> = {
  LABOR: { label: 'Tööjõud', icon: Clock, color: '#0284c7', bg: '#e0f2fe', defaultUnitHint: '€/h' },
  MACHINE: { label: 'Masin', icon: Tractor, color: '#d97706', bg: '#fef3c7', defaultUnitHint: '€/h' },
  IMPLEMENT: { label: 'Haakeriist', icon: Wrench, color: '#475569', bg: '#f1f5f9', defaultUnitHint: '€/h' },
  FUEL: { label: 'Kütus', icon: Fuel, color: '#ea580c', bg: '#ffedd5', defaultUnitHint: '€/l' },
  MATERIAL: { label: 'Kulumaterjal', icon: Package, color: '#16a34a', bg: '#dcfce7', defaultUnitHint: '€/ühik' },
  HARVEST: { label: 'Saagitulu', icon: Wheat, color: '#059669', bg: '#ecfdf5', defaultUnitHint: '€/t' },
  // Seire leid (hinnata, finantsridades ei kuvata)
  OBSERVATION: { label: 'Seire leid', icon: Package, color: '#64748b', bg: '#f1f5f9', defaultUnitHint: '' }
};

const STATUS_LABELS: Record<FinanceStatus, { label: string; className: string }> = {
  PENDING: { label: 'Ootab finantsi', className: 'pending' },
  CHANGED: { label: 'Muudetud – kinnita uuesti', className: 'changed' },
  CONFIRMED: { label: 'Kinnitatud', className: 'confirmed' }
};

const fmtCur = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '0,00 €';
  return `${n.toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};

const fmtHa = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '0';
  return n.toLocaleString('et-EE', { maximumFractionDigits: 2 });
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

export const FinanceModal: React.FC<FinanceModalProps> = ({
  isOpen,
  onClose,
  year,
  initialEntryId,
  onEntryUpdated
}) => {
  const [tab, setTab] = useState<Tab>('entries');

  // Kanded
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTION_NEEDED');
  const [search, setSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState<string>('all');

  // Valitud kande hinnastamise vorm
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [financeNotes, setFinanceNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Põldude tulemused
  const [results, setResults] = useState<FieldResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsSearch, setResultsSearch] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('profit');
  const [sortAsc, setSortAsc] = useState(false);

  // Laadi kanded
  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    setEntriesError(null);
    try {
      const data = await api.getFinanceEntries(year);
      setEntries(data);
    } catch (err) {
      setEntriesError(errorText(err));
    } finally {
      setLoadingEntries(false);
    }
  }, [year]);

  // Laadi põldude tulemused
  const loadResults = useCallback(async () => {
    setLoadingResults(true);
    setResultsError(null);
    try {
      const data = await api.getFieldResults(year);
      setResults(data);
    } catch (err) {
      setResultsError(errorText(err));
    } finally {
      setLoadingResults(false);
    }
  }, [year]);

  useEffect(() => {
    if (isOpen) {
      void loadEntries();
      void loadResults();
      if (initialEntryId) {
        setSelectedEntryId(initialEntryId);
        setTab('entries');
      }
    }
  }, [isOpen, loadEntries, loadResults, initialEntryId]);

  // Kui kanded laaditud ja pole valitud, vali esimene või initial
  useEffect(() => {
    if (!isOpen || entries.length === 0) return;
    if (selectedEntryId && entries.some((e) => e.id === selectedEntryId)) return;
    if (initialEntryId && entries.some((e) => e.id === initialEntryId)) {
      setSelectedEntryId(initialEntryId);
      return;
    }
    // Vali esimene kinnitamist vajav kanne, muidu esimene kanne
    const firstPending = entries.find((e) => e.financeStatus === 'PENDING' || e.financeStatus === 'CHANGED');
    setSelectedEntryId(firstPending ? firstPending.id : entries[0].id);
  }, [isOpen, entries, selectedEntryId, initialEntryId]);

  // Valitud kanne
  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedEntryId) || null,
    [entries, selectedEntryId]
  );

  // Initsialiseeri vorm kui valitud kanne muutub
  useEffect(() => {
    if (!selectedEntry) {
      setPrices({});
      setFinanceNotes('');
      setSaveSuccess(null);
      setSaveError(null);
      return;
    }
    const initialPrices: Record<string, string> = {};
    for (const line of selectedEntry.lines || []) {
      initialPrices[line.id] = line.unitPrice != null ? String(line.unitPrice) : '';
    }
    setPrices(initialPrices);
    setFinanceNotes(selectedEntry.financeNotes || '');
    setSaveSuccess(null);
    setSaveError(null);
  }, [selectedEntry]);

  // Filtreeri kanded nimekirjas
  const filteredEntries = useMemo(() => {
    let list = entries;

    if (statusFilter === 'ACTION_NEEDED') {
      list = list.filter((e) => e.financeStatus === 'PENDING' || e.financeStatus === 'CHANGED');
    } else if (statusFilter !== 'ALL') {
      list = list.filter((e) => e.financeStatus === statusFilter);
    }

    if (fieldFilter !== 'all') {
      list = list.filter((e) => String(e.fieldSeasonId) === fieldFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.fieldName.toLowerCase().includes(q) ||
          (e.fieldNum && e.fieldNum.toLowerCase().includes(q)) ||
          e.workTypeName.toLowerCase().includes(q) ||
          (e.workerName && e.workerName.toLowerCase().includes(q)) ||
          (e.crop && e.crop.toLowerCase().includes(q))
      );
    }

    return list;
  }, [entries, statusFilter, fieldFilter, search]);

  // Unikaalsed põllud filtriribal
  const uniqueFields = useMemo(() => {
    const map = new Map<number, { id: number; num: string | null; name: string }>();
    for (const e of entries) {
      if (!map.has(e.fieldSeasonId)) {
        map.set(e.fieldSeasonId, { id: e.fieldSeasonId, num: e.fieldNum, name: e.fieldName });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'et'));
  }, [entries]);

  // Hinnastamise ridade kalkulatsioonid reaalajas
  const lineCalculations = useMemo(() => {
    if (!selectedEntry || !selectedEntry.lines) return [];
    return selectedEntry.lines.map((l) => {
      const priceStr = prices[l.id] ?? '';
      const numPrice = priceStr !== '' ? parseFloat(priceStr.replace(',', '.')) : null;
      const valid = numPrice != null && Number.isFinite(numPrice) && numPrice >= 0;
      const total = valid ? l.quantity * (numPrice as number) : 0;
      return {
        ...l,
        parsedPrice: valid ? (numPrice as number) : null,
        total,
        isRevenue: l.kind === 'HARVEST'
      };
    });
  }, [selectedEntry, prices]);

  const entryCostTotal = useMemo(
    () => lineCalculations.filter((l) => !l.isRevenue).reduce((acc, l) => acc + l.total, 0),
    [lineCalculations]
  );

  const entryRevenueTotal = useMemo(
    () => lineCalculations.filter((l) => l.isRevenue).reduce((acc, l) => acc + l.total, 0),
    [lineCalculations]
  );

  const entryNetTotal = entryRevenueTotal - entryCostTotal;

  const allLinesPriced = useMemo(() => {
    if (lineCalculations.length === 0) return false;
    return lineCalculations.every((l) => l.parsedPrice != null);
  }, [lineCalculations]);

  // Salvesta või kinnita kande finants
  const handleSave = async (confirm: boolean) => {
    if (!selectedEntry) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    if (confirm && !allLinesPriced) {
      setSaveError('Finantsi kinnitamiseks peab igal real olema sisestatud kehtiv ühikuhind.');
      setSaving(false);
      return;
    }

    try {
      const payloadPrices: Record<string, number | null> = {};
      for (const line of selectedEntry.lines || []) {
        const val = prices[line.id];
        if (val !== undefined && val !== '') {
          const p = parseFloat(val.replace(',', '.'));
          payloadPrices[line.id] = Number.isFinite(p) ? p : null;
        } else {
          payloadPrices[line.id] = null;
        }
      }

      await api.saveFinanceEntry(selectedEntry.id, {
        prices: payloadPrices,
        financeNotes: financeNotes.trim() || null,
        confirm
      });

      setSaveSuccess(confirm ? 'Kanne edukalt kinnitatud!' : 'Hinnad salvestatud mustandina.');
      await loadEntries();
      await loadResults();
      onEntryUpdated?.();
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  // Põldude tulemuste statistika
  const resultsSummary = useMemo(() => {
    let totalArea = 0;
    let totalCost = 0;
    let totalRevenue = 0;
    let totalLabor = 0;
    let totalEquipment = 0;
    let totalFuel = 0;
    let totalMaterials = 0;
    let totalEntries = 0;
    let totalConfirmed = 0;

    for (const r of results) {
      totalArea += r.areaHa;
      totalCost += r.costTotal;
      totalRevenue += r.revenue;
      totalLabor += r.labor;
      totalEquipment += r.equipment;
      totalFuel += r.fuel;
      totalMaterials += r.materials;
      totalEntries += r.entriesTotal;
      totalConfirmed += r.entriesConfirmed;
    }

    const totalProfit = totalRevenue - totalCost;
    const profitPerHa = totalArea > 0 ? totalProfit / totalArea : 0;
    const costPerHa = totalArea > 0 ? totalCost / totalArea : 0;
    const revPerHa = totalArea > 0 ? totalRevenue / totalArea : 0;

    return {
      fieldCount: results.length,
      totalArea,
      totalCost,
      totalRevenue,
      totalProfit,
      profitPerHa,
      costPerHa,
      revPerHa,
      totalLabor,
      totalEquipment,
      totalFuel,
      totalMaterials,
      totalEntries,
      totalConfirmed
    };
  }, [results]);

  // Sorteeritud ja filtreeritud põllutulemused
  const sortedResults = useMemo(() => {
    let list = results;
    if (resultsSearch.trim()) {
      const q = resultsSearch.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.fieldName.toLowerCase().includes(q) ||
          (r.fieldNum && r.fieldNum.toLowerCase().includes(q)) ||
          r.crop.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let va = 0;
      let vb = 0;
      if (sortCol === 'field') {
        const fa = parseFloat(String(a.fieldNum || '').replace(',', '.')) || 999999;
        const fb = parseFloat(String(b.fieldNum || '').replace(',', '.')) || 999999;
        if (fa !== fb) return sortAsc ? fa - fb : fb - fa;
        return sortAsc ? a.fieldName.localeCompare(b.fieldName) : b.fieldName.localeCompare(a.fieldName);
      }
      if (sortCol === 'crop') return sortAsc ? a.crop.localeCompare(b.crop) : b.crop.localeCompare(a.crop);
      if (sortCol === 'area') { va = a.areaHa; vb = b.areaHa; }
      else if (sortCol === 'cost') { va = a.costTotal; vb = b.costTotal; }
      else if (sortCol === 'revenue') { va = a.revenue; vb = b.revenue; }
      else if (sortCol === 'profit') { va = a.profit; vb = b.profit; }
      else if (sortCol === 'profitPerHa') {
        va = a.areaHa > 0 ? a.profit / a.areaHa : 0;
        vb = b.areaHa > 0 ? b.profit / b.areaHa : 0;
      }
      return sortAsc ? va - vb : vb - va;
    });
  }, [results, resultsSearch, sortCol, sortAsc]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const actionNeededCount = useMemo(
    () => entries.filter((e) => e.financeStatus === 'PENDING' || e.financeStatus === 'CHANGED').length,
    [entries]
  );

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content finance-modal animate-scale-up">
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-badge finance-icon-badge">
              <Euro size={20} />
            </div>
            <div>
              <div className="finance-title-row">
                <h3>Põllutööde finantsid ja kuluarvestus</h3>
                <span className="finance-year-badge">{year}. a hooaeg</span>
              </div>
              <p className="modal-subtitle">
                Kannete ühikuhindade määramine, kinnitamine ja põllupõhine tasuvus.
              </p>
            </div>
          </div>

          <div className="season-header-actions">
            <div className="work-register-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'entries'}
                className={tab === 'entries' ? 'active' : ''}
                onClick={() => setTab('entries')}
              >
                <span>Hinnastamine</span>
                {actionNeededCount > 0 && (
                  <span className="finance-tab-badge" title={`${actionNeededCount} kannet ootab tegevust`}>
                    {actionNeededCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'results'}
                className={tab === 'results' ? 'active' : ''}
                onClick={() => setTab('results')}
              >
                <span>Põldude tasuvus</span>
              </button>
            </div>
            <button className="icon-btn" onClick={onClose} title="Sulge">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body finance-modal-body">
          {tab === 'entries' && (
            <div className="finance-entries-layout">
              {/* Left Column: Entries List & Filters */}
              <div className="finance-entries-sidebar">
                <div className="finance-sidebar-controls">
                  <div className="finance-search-box">
                    <Search size={14} />
                    <input
                      type="search"
                      placeholder="Otsi põldu, tööd või tegijat..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="finance-filter-row">
                    <div className="finance-filter-chips">
                      <button
                        type="button"
                        className={`finance-filter-chip ${statusFilter === 'ACTION_NEEDED' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('ACTION_NEEDED')}
                      >
                        Ootab ({actionNeededCount})
                      </button>
                      <button
                        type="button"
                        className={`finance-filter-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('ALL')}
                      >
                        Kõik ({entries.length})
                      </button>
                      <button
                        type="button"
                        className={`finance-filter-chip ${statusFilter === 'CONFIRMED' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('CONFIRMED')}
                      >
                        Kinnitatud
                      </button>
                    </div>

                    {uniqueFields.length > 1 && (
                      <select
                        className="form-input finance-field-select"
                        value={fieldFilter}
                        onChange={(e) => setFieldFilter(e.target.value)}
                      >
                        <option value="all">Kõik põllud ({uniqueFields.length})</option>
                        {uniqueFields.map((f) => (
                          <option key={f.id} value={String(f.id)}>
                            {f.num ? `Nr ${f.num} · ${f.name}` : f.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {entriesError && (
                  <div className="alert-box error finance-alert">
                    <AlertCircle size={14} />
                    <span>{entriesError}</span>
                  </div>
                )}

                <div className="finance-entries-list" aria-busy={loadingEntries}>
                  {loadingEntries && entries.length === 0 && (
                    <div className="finance-empty-state">Laadin kandeid…</div>
                  )}

                  {!loadingEntries && filteredEntries.length === 0 && (
                    <div className="finance-empty-state">
                      {statusFilter === 'ACTION_NEEDED'
                        ? 'Kõik kanded on kinnitatud! Vali "Kõik", et vaadata varem kinnitatuid.'
                        : 'Ühtegi filtritele vastavat kannet ei leitud.'}
                    </div>
                  )}

                  {filteredEntries.map((e) => {
                    const isSelected = e.id === selectedEntryId;
                    const st = STATUS_LABELS[e.financeStatus];
                    const entryCost = (e.lines || [])
                      .filter((l) => l.kind !== 'HARVEST')
                      .reduce((acc, l) => acc + l.quantity * (l.unitPrice ?? 0), 0);
                    const isConfirmed = e.financeStatus === 'CONFIRMED';

                    return (
                      <button
                        key={e.id}
                        type="button"
                        className={`finance-entry-card ${isSelected ? 'selected' : ''} ${e.financeStatus.toLowerCase()}`}
                        onClick={() => setSelectedEntryId(e.id)}
                      >
                        <div className="finance-entry-card-header">
                          <div className="finance-entry-field-name">
                            {e.fieldNum && <span className="finance-field-badge">Nr {e.fieldNum}</span>}
                            <strong>{e.fieldName}</strong>
                          </div>
                          <span className={`fw-finance-chip ${st.className}`}>{st.label}</span>
                        </div>

                        <div className="finance-entry-card-body">
                          <div className="finance-entry-work-name">
                            <span>{e.workTypeName}</span>
                            {e.occurrenceNo ? <span className="finance-occurrence">({e.occurrenceNo}. kord)</span> : null}
                          </div>
                          <div className="finance-entry-meta">
                            <span>{formatDate(e.date)}</span>
                            {e.areaHa && <span> · {fmtHa(e.areaHa)} ha</span>}
                            {e.workerName && <span> · {e.workerName}</span>}
                          </div>
                        </div>

                        <div className="finance-entry-card-footer">
                          <span className="finance-entry-lines-count">
                            {e.lines?.length || 0} {e.lines?.length === 1 ? 'rida' : 'rida'}
                          </span>
                          {isConfirmed && entryCost > 0 && (
                            <span className="finance-entry-cost">{fmtCur(entryCost)}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Entry Pricing Form */}
              <div className="finance-entry-detail-pane">
                {selectedEntry ? (
                  <div className="finance-detail-content">
                    {/* Detail Header */}
                    <div className="finance-detail-header">
                      <div className="finance-detail-title-group">
                        <div className="finance-detail-main-title">
                          <h4>
                            {selectedEntry.fieldNum && <span>Nr {selectedEntry.fieldNum} · </span>}
                            {selectedEntry.fieldName}
                          </h4>
                          <span className="finance-detail-work-type">{selectedEntry.workTypeName}</span>
                          <span className={`fw-finance-chip ${STATUS_LABELS[selectedEntry.financeStatus].className}`}>
                            {STATUS_LABELS[selectedEntry.financeStatus].label}
                          </span>
                        </div>

                        <div className="finance-detail-sub-meta">
                          <span><strong>Kuupäev:</strong> {formatDate(selectedEntry.date)}</span>
                          {selectedEntry.areaHa && <span><strong>Tehtud:</strong> {fmtHa(selectedEntry.areaHa)} ha</span>}
                          {selectedEntry.crop && <span><strong>Kultuur:</strong> {selectedEntry.crop}</span>}
                          {selectedEntry.workerName && <span><strong>Töötaja:</strong> {selectedEntry.workerName}</span>}
                          {[selectedEntry.vehicleName, selectedEntry.implementName].filter(Boolean).length > 0 && (
                            <span>
                              <strong>Tehnika:</strong> {[selectedEntry.vehicleName, selectedEntry.implementName].filter(Boolean).join(' + ')}
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedEntry.financeConfirmedAt && (
                        <div className="finance-confirmed-meta">
                          <CheckCircle2 size={14} className="text-emerald" />
                          <span>Kinnitatud {formatDate(selectedEntry.financeConfirmedAt)}</span>
                        </div>
                      )}
                    </div>

                    {selectedEntry.financeStatus === 'CHANGED' && (
                      <div className="alert-box warning finance-changed-warning">
                        <AlertCircle size={16} />
                        <div>
                          <strong>Kande koguseid on pärast kinnitamist muudetud!</strong>
                          <p>Kontrolli allolevad read ja kinnita kanne uuesti, et värskendatud andmed kajastuksid tulemustes.</p>
                        </div>
                      </div>
                    )}

                    {saveError && (
                      <div className="alert-box error finance-alert">
                        <AlertCircle size={14} />
                        <span>{saveError}</span>
                      </div>
                    )}

                    {saveSuccess && (
                      <div className="alert-box success finance-alert">
                        <Check size={14} />
                        <span>{saveSuccess}</span>
                      </div>
                    )}

                    {/* Lines Pricing Table */}
                    <div className="finance-lines-section">
                      <div className="finance-lines-heading">
                        <h5>Kande kulu- ja tuluread</h5>
                        <span className="text-muted text-xs">Määra ühikuhinnad kulu ja saagitulu arvutamiseks</span>
                      </div>

                      {lineCalculations.length === 0 ? (
                        <div className="finance-empty-lines">
                          <Info size={16} />
                          <span>Töötaja ei sisestanud sellele kandele tunde, kütust ega materjale. Hinnastatavaid ridu pole.</span>
                        </div>
                      ) : (
                        <div className="finance-lines-table-wrap">
                          <table className="finance-lines-table">
                            <thead>
                              <tr>
                                <th>Liik</th>
                                <th>Nimetus / Kirjeldus</th>
                                <th className="num">Kogus</th>
                                <th>Ühikuhind (€)</th>
                                <th className="num">Summa kokku</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineCalculations.map((line) => {
                                const info = LINE_KIND_INFO[line.kind] || LINE_KIND_INFO.MATERIAL;
                                const Icon = info.icon;
                                const isHarvest = line.isRevenue;
                                const isMissing = line.parsedPrice == null;

                                return (
                                  <tr key={line.id} className={isHarvest ? 'harvest-row' : ''}>
                                    <td>
                                      <span
                                        className="finance-kind-badge"
                                        style={{ color: info.color, backgroundColor: info.bg }}
                                      >
                                        <Icon size={12} />
                                        <span>{info.label}</span>
                                      </span>
                                    </td>
                                    <td className="finance-line-label">
                                      <strong>{line.label}</strong>
                                    </td>
                                    <td className="num finance-line-qty">
                                      <span>{line.quantity.toLocaleString('et-EE', { maximumFractionDigits: 2 })}</span>
                                      <span className="finance-line-unit">{line.unit}</span>
                                    </td>
                                    <td className="finance-price-cell">
                                      <div className={`finance-price-input-wrap ${isMissing ? 'missing' : ''}`}>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          placeholder="0,00"
                                          className="form-input finance-price-input"
                                          value={prices[line.id] ?? ''}
                                          onChange={(e) => {
                                            setPrices({ ...prices, [line.id]: e.target.value });
                                            setSaveError(null);
                                            setSaveSuccess(null);
                                          }}
                                        />
                                        <span className="finance-unit-suffix">€/{line.unit}</span>
                                      </div>
                                    </td>
                                    <td className={`num finance-line-total ${isHarvest ? 'revenue-text' : ''}`}>
                                      {isHarvest ? '+' : ''}{fmtCur(line.total)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Notes & Summary */}
                    <div className="finance-detail-bottom-grid">
                      <div className="finance-notes-box">
                        <label htmlFor="fin-notes" className="finance-notes-label">
                          <span>Finantsmärkmed</span>
                          <small className="text-muted">(arve nr, palgaviide jne)</small>
                        </label>
                        <textarea
                          id="fin-notes"
                          rows={2}
                          className="form-input finance-notes-textarea"
                          placeholder="Sisesta vajadusel finantsalased märkused..."
                          value={financeNotes}
                          onChange={(e) => setFinanceNotes(e.target.value)}
                        />
                        {selectedEntry.notes && (
                          <div className="finance-worker-notes">
                            <span className="text-muted">Töötaja märkus: </span>
                            <span>{selectedEntry.notes}</span>
                          </div>
                        )}
                      </div>

                      <div className="finance-summary-card">
                        <div className="finance-summary-row">
                          <span className="text-muted">Kulud kokku:</span>
                          <strong className="text-red-700">{fmtCur(entryCostTotal)}</strong>
                        </div>
                        {entryRevenueTotal > 0 && (
                          <div className="finance-summary-row">
                            <span className="text-muted">Saagitulu kokku:</span>
                            <strong className="text-emerald-700">+{fmtCur(entryRevenueTotal)}</strong>
                          </div>
                        )}
                        <div className="finance-summary-divider" />
                        <div className="finance-summary-row total">
                          <span>Puhastulemus:</span>
                          <span className={`finance-net-result ${entryNetTotal >= 0 ? 'positive' : 'negative'}`}>
                            {entryNetTotal >= 0 ? '+' : ''}{fmtCur(entryNetTotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="finance-actions-bar">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={saving}
                        onClick={() => handleSave(false)}
                      >
                        <Save size={14} />
                        <span>Salvesta mustand</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm finance-confirm-btn"
                        disabled={saving || lineCalculations.length === 0}
                        onClick={() => handleSave(true)}
                      >
                        <CheckCircle2 size={14} />
                        <span>Kinnita finants</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="finance-no-selection">
                    <Euro size={32} className="text-muted" />
                    <p>Vali vasakult nimekirjast kanne, mida hinnastada või kinnitada.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'results' && (
            <div className="finance-results-layout">
              {/* Summary KPI Cards */}
              <div className="finance-kpis-grid">
                <div className="finance-kpi-card">
                  <span className="finance-kpi-label">Põllud kokku</span>
                  <div className="finance-kpi-value">
                    {resultsSummary.fieldCount} <small className="text-muted">põldu</small>
                  </div>
                  <div className="finance-kpi-sub">
                    Pindala: <strong>{fmtHa(resultsSummary.totalArea)} ha</strong>
                  </div>
                </div>

                <div className="finance-kpi-card">
                  <span className="finance-kpi-label">Kulud kokku</span>
                  <div className="finance-kpi-value text-red-600">
                    {fmtCur(resultsSummary.totalCost)}
                  </div>
                  <div className="finance-kpi-sub">
                    Keskmiselt: <strong>{fmtCur(resultsSummary.costPerHa)} / ha</strong>
                  </div>
                </div>

                <div className="finance-kpi-card">
                  <span className="finance-kpi-label">Saagitulu kokku</span>
                  <div className="finance-kpi-value text-emerald-600">
                    {fmtCur(resultsSummary.totalRevenue)}
                  </div>
                  <div className="finance-kpi-sub">
                    Keskmiselt: <strong>{fmtCur(resultsSummary.revPerHa)} / ha</strong>
                  </div>
                </div>

                <div className={`finance-kpi-card result ${resultsSummary.totalProfit >= 0 ? 'profit' : 'loss'}`}>
                  <span className="finance-kpi-label">Tegevustulemus</span>
                  <div className="finance-kpi-value">
                    {resultsSummary.totalProfit >= 0 ? '+' : ''}{fmtCur(resultsSummary.totalProfit)}
                  </div>
                  <div className="finance-kpi-sub">
                    Tulemus: <strong>{fmtCur(resultsSummary.profitPerHa)} / ha</strong>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="finance-results-status-bar">
                <div className="finance-confirmed-progress">
                  <Info size={14} className="text-emerald" />
                  <span>
                    Summades kajastuvad ainult kinnitatud kanded: <strong>{resultsSummary.totalConfirmed}</strong> / {resultsSummary.totalEntries} kannet kinnitatud ({resultsSummary.totalEntries > 0 ? Math.round((resultsSummary.totalConfirmed / resultsSummary.totalEntries) * 100) : 0}%).
                  </span>
                </div>
                {resultsSummary.totalEntries > resultsSummary.totalConfirmed && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => {
                      setStatusFilter('ACTION_NEEDED');
                      setTab('entries');
                    }}
                  >
                    Kinnita puuduvad kanded ({resultsSummary.totalEntries - resultsSummary.totalConfirmed}) →
                  </button>
                )}
              </div>

              {/* Cost breakdown pill bar */}
              {resultsSummary.totalCost > 0 && (
                <div className="finance-cost-breakdown-bar">
                  <div className="finance-cost-item">
                    <span className="dot" style={{ backgroundColor: '#0284c7' }} />
                    <span className="label">Tööjõud:</span>
                    <strong>{fmtCur(resultsSummary.totalLabor)}</strong>
                    <small>({Math.round((resultsSummary.totalLabor / resultsSummary.totalCost) * 100)}%)</small>
                  </div>
                  <div className="finance-cost-item">
                    <span className="dot" style={{ backgroundColor: '#d97706' }} />
                    <span className="label">Masinapark:</span>
                    <strong>{fmtCur(resultsSummary.totalEquipment)}</strong>
                    <small>({Math.round((resultsSummary.totalEquipment / resultsSummary.totalCost) * 100)}%)</small>
                  </div>
                  <div className="finance-cost-item">
                    <span className="dot" style={{ backgroundColor: '#ea580c' }} />
                    <span className="label">Kütus:</span>
                    <strong>{fmtCur(resultsSummary.totalFuel)}</strong>
                    <small>({Math.round((resultsSummary.totalFuel / resultsSummary.totalCost) * 100)}%)</small>
                  </div>
                  <div className="finance-cost-item">
                    <span className="dot" style={{ backgroundColor: '#16a34a' }} />
                    <span className="label">Kulumaterjalid:</span>
                    <strong>{fmtCur(resultsSummary.totalMaterials)}</strong>
                    <small>({Math.round((resultsSummary.totalMaterials / resultsSummary.totalCost) * 100)}%)</small>
                  </div>
                </div>
              )}

              {/* Table search & header */}
              <div className="finance-results-toolbar">
                <div className="finance-search-box">
                  <Search size={14} />
                  <input
                    type="search"
                    placeholder="Otsi põllu nime, numbri või kultuuri järgi..."
                    value={resultsSearch}
                    onChange={(e) => setResultsSearch(e.target.value)}
                  />
                </div>
                <div className="text-muted text-xs">
                  Klõpsa päisel, et veergu sorteerida. Klõpsa põllul, et avada selle kanded.
                </div>
              </div>

              {/* Field Results Table */}
              <div className="finance-results-table-wrap" aria-busy={loadingResults}>
                <table className="finance-results-table">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort('field')} className="sortable">
                        <div className="th-content">
                          <span>Põld</span>
                          {sortCol === 'field' && <ArrowUpDown size={12} />}
                        </div>
                      </th>
                      <th onClick={() => toggleSort('crop')} className="sortable">
                        <div className="th-content">
                          <span>Kultuur</span>
                          {sortCol === 'crop' && <ArrowUpDown size={12} />}
                        </div>
                      </th>
                      <th onClick={() => toggleSort('area')} className="num sortable">
                        <div className="th-content num">
                          <span>Pindala</span>
                          {sortCol === 'area' && <ArrowUpDown size={12} />}
                        </div>
                      </th>
                      <th className="num">Tööjõud</th>
                      <th className="num">Masinad</th>
                      <th className="num">Kütus</th>
                      <th className="num">Materjalid</th>
                      <th onClick={() => toggleSort('cost')} className="num sortable">
                        <div className="th-content num">
                          <span>Kulu kokku</span>
                          {sortCol === 'cost' && <ArrowUpDown size={12} />}
                        </div>
                      </th>
                      <th onClick={() => toggleSort('revenue')} className="num sortable">
                        <div className="th-content num">
                          <span>Saagitulu</span>
                          {sortCol === 'revenue' && <ArrowUpDown size={12} />}
                        </div>
                      </th>
                      <th onClick={() => toggleSort('profit')} className="num sortable">
                        <div className="th-content num">
                          <span>Tulemus (€)</span>
                          {sortCol === 'profit' && <ArrowUpDown size={12} />}
                        </div>
                      </th>
                      <th onClick={() => toggleSort('profitPerHa')} className="num sortable">
                        <div className="th-content num">
                          <span>Tulemus (€/ha)</span>
                          {sortCol === 'profitPerHa' && <ArrowUpDown size={12} />}
                        </div>
                      </th>
                      <th className="num">Kanded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="text-center py-6 text-muted">
                          {resultsError ? resultsError : 'Tulemusi ei leitud.'}
                        </td>
                      </tr>
                    ) : (
                      sortedResults.map((r) => {
                        const profitPerHa = r.areaHa > 0 ? r.profit / r.areaHa : 0;
                        const isProfitable = r.profit >= 0;

                        return (
                          <tr
                            key={r.fieldSeasonId}
                            className="clickable-row"
                            onClick={() => {
                              setFieldFilter(String(r.fieldSeasonId));
                              setStatusFilter('ALL');
                              setTab('entries');
                            }}
                            title="Klõpsa, et näha selle põllu kandeid hinnastamises"
                          >
                            <td className="finance-field-cell">
                              {r.fieldNum && <span className="field-num-badge">Nr {r.fieldNum}</span>}
                              <strong>{r.fieldName}</strong>
                            </td>
                            <td>
                              <span
                                className="finance-crop-pill"
                                style={r.cropColor ? { borderLeftColor: r.cropColor } : undefined}
                              >
                                {r.crop}
                              </span>
                            </td>
                            <td className="num">{fmtHa(r.areaHa)} ha</td>
                            <td className="num text-muted">{r.labor > 0 ? fmtCur(r.labor) : '–'}</td>
                            <td className="num text-muted">{r.equipment > 0 ? fmtCur(r.equipment) : '–'}</td>
                            <td className="num text-muted">{r.fuel > 0 ? fmtCur(r.fuel) : '–'}</td>
                            <td className="num text-muted">{r.materials > 0 ? fmtCur(r.materials) : '–'}</td>
                            <td className="num font-semibold">{fmtCur(r.costTotal)}</td>
                            <td className="num text-emerald-700 font-semibold">{r.revenue > 0 ? fmtCur(r.revenue) : '–'}</td>
                            <td className={`num font-bold ${isProfitable ? 'text-emerald-700' : 'text-red-700'}`}>
                              {isProfitable && r.profit > 0 ? '+' : ''}{fmtCur(r.profit)}
                            </td>
                            <td className={`num font-semibold ${isProfitable ? 'text-emerald-700' : 'text-red-700'}`}>
                              {isProfitable && profitPerHa > 0 ? '+' : ''}{fmtCur(profitPerHa)}
                            </td>
                            <td className="num">
                              <span className={`finance-count-badge ${r.entriesConfirmed === r.entriesTotal ? 'all-done' : ''}`}>
                                {r.entriesConfirmed}/{r.entriesTotal}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
