// src/components/FinanceModal.tsx — põllutööde finantsid ja kuluarvestus (finantsjuht / admin).
import { FINANCE_COST_COLOR } from '../lib/dataColors';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Euro,
  CheckCircle2,
  AlertCircle,
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
import { formatQty } from '../services/units';
import { FINANCE_STATUS_BADGE, type FinanceEntry, type FieldResult, type WorkEntryLineKind, type FinanceStatus } from '../types/fieldWork';
import { Badge, Card, CardButton, Button, Dialog, DialogContent, DialogHeader, DialogBody, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, Tabs, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem, FilterClear, FilterSelect, SearchInput, NumberInput, Textarea, StatTile, LegendItem, KeyValueRow, cn } from './ui';

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

const LINE_KIND_INFO: Record<WorkEntryLineKind, { label: string; icon: React.FC<{ size?: number; className?: string }>; defaultUnitHint: string }> = {
  LABOR: { label: 'Tööjõud', icon: Clock, defaultUnitHint: '€/h' },
  MACHINE: { label: 'Masin', icon: Tractor, defaultUnitHint: '€/h' },
  IMPLEMENT: { label: 'Haakeriist', icon: Wrench, defaultUnitHint: '€/h' },
  FUEL: { label: 'Kütus', icon: Fuel, defaultUnitHint: '€/l' },
  MATERIAL: { label: 'Kulumaterjal', icon: Package, defaultUnitHint: '€/ühik' },
  HARVEST: { label: 'Saagitulu', icon: Wheat, defaultUnitHint: '€/t' },
  // Seire leid (hinnata, finantsridades ei kuvata)
  OBSERVATION: { label: 'Seire leid', icon: Package, defaultUnitHint: '' }
};

const STATUS_LABELS: Record<FinanceStatus, string> = {
  PENDING: 'Ootab finantsi',
  CHANGED: 'Muudetud – kinnita uuesti',
  CONFIRMED: 'Kinnitatud'
};

// Kande vasak riba oleku järgi (vana .finance-entry-card.pending/.changed/.confirmed; !important tuli Card ääriselt, cn() lahendab selle)
const ENTRY_STATUS_BAR: Record<FinanceStatus, string> = {
  PENDING: 'border-l-3 border-l-warning',
  CHANGED: 'border-l-3 border-l-info',
  CONFIRMED: 'border-l-3 border-l-primary-strong',
};

const FinanceStatusBadge: React.FC<{ status: FinanceStatus }> = ({ status }) => (
  <Badge tone={FINANCE_STATUS_BADGE[status].tone} variant={FINANCE_STATUS_BADGE[status].variant}>{STATUS_LABELS[status]}</Badge>
);

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
  const [prices, setPrices] = useState<Record<string, number | null>>({});
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
    const initialPrices: Record<string, number | null> = {};
    for (const line of selectedEntry.lines || []) {
      const p = line.unitPrice != null ? parseFloat(String(line.unitPrice)) : null;
      initialPrices[line.id] = p != null && Number.isFinite(p) ? p : null;
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
      const numPrice = prices[l.id] ?? null;
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

    if (confirm && (selectedEntry.lines || []).some((l) => l.kind === 'FUEL' && !l.articleId)) {
      setSaveError('Kütuse artikkel määramata. Määra masinale vaikimisi kütus või jäta aktiivseks ainult üks kütus ja salvesta kanne uuesti.');
      setSaving(false);
      return;
    }

    if (confirm && !allLinesPriced) {
      setSaveError('Finantsi kinnitamiseks peab igal real olema sisestatud kehtiv ühikuhind.');
      setSaving(false);
      return;
    }

    try {
      const payloadPrices: Record<string, number | null> = {};
      for (const line of selectedEntry.lines || []) {
        if (line.kind === 'MATERIAL' || line.kind === 'FUEL') continue; // kulumaterjali ja kütuse hind tuleb laost (FIFO)
        payloadPrices[line.id] = prices[line.id] ?? null;
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
    let totalArticles = 0;
    let totalEntries = 0;
    let totalConfirmed = 0;

    for (const r of results) {
      totalArea += r.areaHa;
      totalCost += r.costTotal;
      totalRevenue += r.revenue;
      totalLabor += r.labor;
      totalEquipment += r.equipment;
      totalFuel += r.fuel;
      totalArticles += r.articles;
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
      totalArticles,
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

  const sortState = (col: SortCol): 'asc' | 'desc' | 'none' => (sortCol === col ? (sortAsc ? 'asc' : 'desc') : 'none');

  const actionNeededCount = useMemo(
    () => entries.filter((e) => e.financeStatus === 'PENDING' || e.financeStatus === 'CHANGED').length,
    [entries]
  );

  if (!isOpen) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="xl" fillHeight dismissible={!saving}>
        <DialogHeader
          icon={<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-success-text"><Euro size={20} /></div>}
          title={
            <span className="flex items-center gap-2.5">
              <span>Põllutööde finantsid ja kuluarvestus</span>
              <Badge>{year}. a hooaeg</Badge>
            </span>
          }
          description="Kannete ühikuhindade määramine, kinnitamine ja põllupõhine tasuvus."
        >
          <div className="season-header-actions">
            {/* Käsitsi aktiveerimine: sakivahetus laeb andmeid, nooleklahv ei tohi seda käivitada */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} activationMode="manual">
              <TabsList>
                <TabsTrigger value="entries">
                  Hinnastamine
                  {actionNeededCount > 0 && (
                    <Badge tone="warning" variant="solid" title={`${actionNeededCount} kannet ootab tegevust`}>
                      {actionNeededCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="results">Põldude tasuvus</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>

        <DialogBody className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {tab === 'entries' && (
            <div className="grid h-full min-h-0 grid-cols-[360px_minmax(0,1fr)] gap-4">
              {/* Left Column: Entries List & Filters */}
              <div className="flex h-full min-h-0 flex-col gap-2.5 border-r border-border pr-3">
                <div className="flex flex-col gap-2">
                  <SearchInput value={search} onChange={setSearch} placeholder="Otsi põldu, tööd või tegijat..." aria-label="Otsi põldu, tööd või tegijat..." />

                  <div className="flex flex-col gap-1.5">
                    <ToggleGroup aria-label="Kannete olek" value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                      <ToggleGroupItem value="ACTION_NEEDED">Ootab ({actionNeededCount})</ToggleGroupItem>
                      <ToggleGroupItem value="ALL">Kõik ({entries.length})</ToggleGroupItem>
                      <ToggleGroupItem value="CONFIRMED">Kinnitatud</ToggleGroupItem>
                    </ToggleGroup>

                    {uniqueFields.length > 1 && (
                      <FilterClear active={fieldFilter !== 'all'} onClear={() => setFieldFilter('all')}>
                        <FilterSelect
                          value={fieldFilter}
                          defaultValue="all"
                          onChange={setFieldFilter}
                          options={[
                            { value: 'all', label: `Kõik põllud (${uniqueFields.length})` },
                            ...uniqueFields.map((f) => ({ value: String(f.id), label: f.num ? `Nr ${f.num} · ${f.name}` : f.name }))
                          ]}
                        />
                      </FilterClear>
                    )}
                  </div>
                </div>

                {entriesError && (
                  <div className="alert-box error is-compact">
                    <AlertCircle size={14} />
                    <span>{entriesError}</span>
                  </div>
                )}

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1" aria-busy={loadingEntries}>
                  {loadingEntries && entries.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm leading-[normal] text-subtle">Laadin kandeid…</div>
                  )}

                  {!loadingEntries && filteredEntries.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm leading-[normal] text-subtle">
                      {statusFilter === 'ACTION_NEEDED'
                        ? 'Kõik kanded on kinnitatud! Vali "Kõik", et vaadata varem kinnitatuid.'
                        : 'Ühtegi filtritele vastavat kannet ei leitud.'}
                    </div>
                  )}

                  {filteredEntries.map((e) => {
                    const isSelected = e.id === selectedEntryId;
                    const entryCost = (e.lines || [])
                      .filter((l) => l.kind !== 'HARVEST')
                      .reduce((acc, l) => acc + l.quantity * (l.unitPrice ?? 0), 0);
                    const isConfirmed = e.financeStatus === 'CONFIRMED';

                    return (
                      <CardButton key={e.id} variant="tile" padding="sm" selected={isSelected}
                        className={cn('relative flex flex-col items-stretch gap-1.5', ENTRY_STATUS_BAR[e.financeStatus])}
                        onClick={() => setSelectedEntryId(e.id)}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex min-w-0 items-center gap-1.5 text-sm leading-[normal]">
                            {e.fieldNum && <Badge tone="success" variant="outline" size="md">Nr {e.fieldNum}</Badge>}
                            <strong className="truncate">{e.fieldName}</strong>
                          </div>
                          <FinanceStatusBadge status={e.financeStatus} />
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 text-sm leading-[normal] font-medium text-foreground"><span>{e.workTypeName}</span></div>
                          <div className="text-xs leading-[normal] text-subtle">
                            <span>{formatDate(e.date)}</span>
                            {e.areaHa && <span> · {fmtHa(e.areaHa)} ha</span>}
                            {e.workerName && <span> · {e.workerName}</span>}
                          </div>
                        </div>

                        <div className="mt-0.5 flex items-center justify-between border-t border-border pt-1 text-xs leading-[normal] text-muted-foreground">
                          <span>{e.lines?.length || 0} rida</span>
                          {isConfirmed && entryCost > 0 && (
                            <span className="font-medium text-foreground">{fmtCur(entryCost)}</span>
                          )}
                        </div>
</CardButton>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Entry Pricing Form */}
              <div className="flex h-full min-h-0 flex-col overflow-y-auto pr-1.5">
                {selectedEntry ? (
                  <div className="flex flex-col gap-3">
                    {/* Detail Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="m-0 text-lg font-semibold text-foreground leading-[normal]">
                            {selectedEntry.fieldNum && <span>Nr {selectedEntry.fieldNum} · </span>}
                            {selectedEntry.fieldName}
                          </h4>
                          <span className="text-base font-medium text-success-text leading-[normal]">{selectedEntry.workTypeName}</span>
                          <FinanceStatusBadge status={selectedEntry.financeStatus} />
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground leading-[normal]">
                          <span><span className="text-subtle">Kuupäev:</span> {formatDate(selectedEntry.date)}</span>
                          {selectedEntry.areaHa && <span><span className="text-subtle">Tehtud:</span> {fmtHa(selectedEntry.areaHa)} ha</span>}
                          {selectedEntry.crop && <span><span className="text-subtle">Kultuur:</span> {selectedEntry.crop}</span>}
                          {selectedEntry.workerName && <span><span className="text-subtle">Töötaja:</span> {selectedEntry.workerName}</span>}
                          {[selectedEntry.vehicleName, selectedEntry.implementName].filter(Boolean).length > 0 && (
                            <span>
                              <span className="text-subtle">Tehnika:</span> {[selectedEntry.vehicleName, selectedEntry.implementName].filter(Boolean).join(' + ')}
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedEntry.financeConfirmedAt && (
                        <Badge tone="success" variant="soft" size="md">
                          <CheckCircle2 size={14} />
                          Kinnitatud {formatDate(selectedEntry.financeConfirmedAt)}
                        </Badge>
                      )}
                    </div>

                    {selectedEntry.financeStatus === 'CHANGED' && (
                      <div className="alert-box warning m-0 flex items-start gap-2.5">
                        <AlertCircle size={16} />
                        <div>
                          <strong>Kande koguseid on pärast kinnitamist muudetud!</strong>
                          <p className="mt-0.5 text-xs leading-[normal]">Kontrolli allolevad read ja kinnita kanne uuesti, et värskendatud andmed kajastuksid tulemustes.</p>
                        </div>
                      </div>
                    )}

                    {saveError && (
                      <div className="alert-box error is-compact">
                        <AlertCircle size={14} />
                        <span>{saveError}</span>
                      </div>
                    )}

                    {saveSuccess && (
                      <div className="alert-box success is-compact">
                        <Check size={14} />
                        <span>{saveSuccess}</span>
                      </div>
                    )}

                    {/* Lines Pricing Table */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2.5">
                        <h5 className="m-0 text-base font-semibold leading-[normal]">Kande kulu- ja tuluread</h5>
                        <span className="text-xs leading-[normal]">Määra ühikuhinnad kulu ja saagitulu arvutamiseks</span>
                      </div>

                      {lineCalculations.length === 0 ? (
                        <div className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground leading-[normal]">
                          <Info size={16} />
                          <span>Töötaja ei sisestanud sellele kandele tunde, kütust ega materjale. Hinnastatavaid ridu pole.</span>
                        </div>
                      ) : (
                          <Table scroll="none" bordered>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Liik</TableHead>
                                <TableHead>Nimetus / Kirjeldus</TableHead>
                                <TableHead numeric>Kogus</TableHead>
                                <TableHead>Ühikuhind (€)</TableHead>
                                <TableHead numeric>Summa kokku</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lineCalculations.map((line) => {
                                const info = LINE_KIND_INFO[line.kind] || LINE_KIND_INFO.MATERIAL;
                                const Icon = info.icon;
                                const isHarvest = line.isRevenue;
                                const isMissing = line.parsedPrice == null;

                                return (
                                  <TableRow key={line.id} tone={isHarvest ? 'success' : undefined}>
                                    <TableCell>
                                      <Badge><Icon size={12} />{info.label}</Badge>
                                    </TableCell>
                                    <TableCell wrap className="font-medium">
                                      <strong>{line.label}</strong>
                                    </TableCell>
                                    <TableCell numeric className="font-normal tabular-nums">
                                      <span>{formatQty(line.quantity)}</span>
                                      <span className="ml-0.5 text-xs font-medium text-subtle">{line.unit}</span>
                                    </TableCell>
                                    <TableCell className="w-45">
                                      {line.kind === 'MATERIAL' || line.kind === 'FUEL' ? (
                                        <span className={cn('text-sm text-subtle', (isMissing || (line.kind === 'FUEL' && !line.articleId)) && 'text-warning-text')} title="Hind tuleb laost (FIFO)">
                                          {line.kind === 'FUEL' && !line.articleId
                                            ? 'Kütuse artikkel määramata'
                                            : isMissing ? 'ootab arvele võtmist' : `${line.parsedPrice!.toLocaleString('et-EE', { maximumFractionDigits: 4 })} €/${line.unit} · FIFO laost`}
                                        </span>
                                      ) : (
                                      <NumberInput
                                        size="sm"
                                        decimals={4}
                                        placeholder="0,00"
                                        aria-label={`Ühikuhind: ${line.label}`}
                                        className={isMissing ? 'border-warning bg-warning/12' : undefined}
                                        end={`€/${line.unit}`}
                                        value={prices[line.id] ?? null}
                                        onChange={(n) => {
                                          setPrices({ ...prices, [line.id]: n });
                                          setSaveError(null);
                                          setSaveSuccess(null);
                                        }}
                                      />
                                      )}
                                    </TableCell>
                                    <TableCell numeric className={cn('font-semibold tabular-nums', isHarvest && 'text-success-text')}>
                                      {isHarvest ? '+' : ''}{fmtCur(line.total)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                      )}
                    </div>

                    {/* Notes & Summary */}
                    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="fin-notes" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground leading-[normal]">
                          <span>Finantsmärkmed</span>
                          <small>(arve nr, palgaviide jne)</small>
                        </label>
                        <Textarea
                          id="fin-notes"
                          rows={2}
                          className="resize-y"
                          placeholder="Sisesta vajadusel finantsalased märkused..."
                          value={financeNotes}
                          onChange={(e) => setFinanceNotes(e.target.value)}
                        />
                        {selectedEntry.notes && (
                          <div className="rounded-r-sm border-l-2 border-border bg-muted px-2 py-1 text-xs leading-[normal]">
                            <span>Töötaja märkus: </span>
                            <span>{selectedEntry.notes}</span>
                          </div>
                        )}
                      </div>

                      <Card variant="tile" padding="sm" className="flex flex-col gap-2">
                        <KeyValueRow label="Kulud kokku:"><strong className="font-semibold text-destructive">{fmtCur(entryCostTotal)}</strong></KeyValueRow>
                        {entryRevenueTotal > 0 && (
                          <KeyValueRow label="Saagitulu kokku:"><strong className="font-semibold text-primary">+{fmtCur(entryRevenueTotal)}</strong></KeyValueRow>
                        )}
                        <div className="my-0.5 h-px bg-border" />
                        <KeyValueRow label="Puhastulemus:" className="font-semibold">
                          <span className={cn(entryNetTotal >= 0 ? 'text-success-text' : 'text-danger-text')}>
                            {entryNetTotal >= 0 ? '+' : ''}{fmtCur(entryNetTotal)}
                          </span>
                        </KeyValueRow>
                      </Card>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 border-t border-border pt-3">
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving}
                        onClick={() => handleSave(false)}
                      >
                        <Save size={14} />
                        <span>Salvesta mustand</span>
                      </Button>

                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={saving || lineCalculations.length === 0}
                        onClick={() => handleSave(true)}
                      >
                        <CheckCircle2 size={14} />
                        <span>Kinnita finants</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2.5 text-center text-base text-subtle leading-[normal]">
                    <Euro size={32} />
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
                <StatTile label="Põllud kokku" value={<>{resultsSummary.fieldCount} <small>põldu</small></>}
                  sub={<>Pindala: <strong>{fmtHa(resultsSummary.totalArea)} ha</strong></>} />
                <StatTile label="Kulud kokku" tone="cost" value={fmtCur(resultsSummary.totalCost)}
                  sub={<>Keskmiselt: <strong>{fmtCur(resultsSummary.costPerHa)} / ha</strong></>} />
                <StatTile label="Saagitulu kokku" tone="revenue" value={fmtCur(resultsSummary.totalRevenue)}
                  sub={<>Keskmiselt: <strong>{fmtCur(resultsSummary.revPerHa)} / ha</strong></>} />
                <StatTile label="Tegevustulemus" tone={resultsSummary.totalProfit >= 0 ? 'profit' : 'loss'}
                  value={<>{resultsSummary.totalProfit >= 0 ? '+' : ''}{fmtCur(resultsSummary.totalProfit)}</>}
                  sub={<>Tulemus: <strong>{fmtCur(resultsSummary.profitPerHa)} / ha</strong></>} />
              </div>

              {/* Status Banner */}
              <Card variant="tile" padding="sm" className="finance-results-status-bar">
                <div className="finance-confirmed-progress">
                  <Info size={14} />
                  <span>
                    Summades kajastuvad ainult kinnitatud kanded: <strong>{resultsSummary.totalConfirmed}</strong> / {resultsSummary.totalEntries} kannet kinnitatud ({resultsSummary.totalEntries > 0 ? Math.round((resultsSummary.totalConfirmed / resultsSummary.totalEntries) * 100) : 0}%).
                  </span>
                </div>
                {resultsSummary.totalEntries > resultsSummary.totalConfirmed && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setStatusFilter('ACTION_NEEDED');
                      setTab('entries');
                    }}
                  >
                    Kinnita puuduvad kanded ({resultsSummary.totalEntries - resultsSummary.totalConfirmed}) →
                  </Button>
                )}
              </Card>

              {/* Cost breakdown pill bar */}
              {resultsSummary.totalCost > 0 && (
                <div className="finance-cost-breakdown-bar">
                  <LegendItem color={FINANCE_COST_COLOR.labor} value={fmtCur(resultsSummary.totalLabor)}
                    note={`(${Math.round((resultsSummary.totalLabor / resultsSummary.totalCost) * 100)}%)`}>Tööjõud:</LegendItem>
                  <LegendItem color={FINANCE_COST_COLOR.equipment} value={fmtCur(resultsSummary.totalEquipment)}
                    note={`(${Math.round((resultsSummary.totalEquipment / resultsSummary.totalCost) * 100)}%)`}>Masinapark:</LegendItem>
                  <LegendItem color={FINANCE_COST_COLOR.fuel} value={fmtCur(resultsSummary.totalFuel)}
                    note={`(${Math.round((resultsSummary.totalFuel / resultsSummary.totalCost) * 100)}%)`}>Kütus:</LegendItem>
                  <LegendItem color={FINANCE_COST_COLOR.articles} value={fmtCur(resultsSummary.totalArticles)}
                    note={`(${Math.round((resultsSummary.totalArticles / resultsSummary.totalCost) * 100)}%)`}>Kulumaterjalid:</LegendItem>
                </div>
              )}

              {/* Table search & header */}
              <div className="finance-results-toolbar">
                <SearchInput className="search-field" value={resultsSearch} onChange={setResultsSearch} placeholder="Otsi põllu nime, numbri või kultuuri järgi..." aria-label="Otsi põllu nime, numbri või kultuuri järgi..." />
                <div className="text-xs">
                  Klõpsa päisel, et veergu sorteerida. Klõpsa põllul, et avada selle kanded.
                </div>
              </div>

              {/* Field Results Table */}
              <Table bordered className="finance-results-table" aria-busy={loadingResults}>
                  <TableHeader>
                    <TableRow>
                      <TableHead onClick={() => toggleSort('field')} sort={sortState('field')}>
                        <div className="th-content">
                          <span>Põld</span>
                          {sortCol === 'field' && <ArrowUpDown size={12} />}
                        </div>
                      </TableHead>
                      <TableHead onClick={() => toggleSort('crop')} sort={sortState('crop')}>
                        <div className="th-content">
                          <span>Kultuur</span>
                          {sortCol === 'crop' && <ArrowUpDown size={12} />}
                        </div>
                      </TableHead>
                      <TableHead numeric onClick={() => toggleSort('area')} sort={sortState('area')}>
                        <div className="th-content num">
                          <span>Pindala</span>
                          {sortCol === 'area' && <ArrowUpDown size={12} />}
                        </div>
                      </TableHead>
                      <TableHead numeric>Tööjõud</TableHead>
                      <TableHead numeric>Masinad</TableHead>
                      <TableHead numeric>Kütus</TableHead>
                      <TableHead numeric>Materjalid</TableHead>
                      <TableHead numeric>Kuivatamine</TableHead>
                      <TableHead numeric onClick={() => toggleSort('cost')} sort={sortState('cost')}>
                        <div className="th-content num">
                          <span>Kulu kokku</span>
                          {sortCol === 'cost' && <ArrowUpDown size={12} />}
                        </div>
                      </TableHead>
                      <TableHead numeric onClick={() => toggleSort('revenue')} sort={sortState('revenue')}>
                        <div className="th-content num">
                          <span>Saagitulu</span>
                          {sortCol === 'revenue' && <ArrowUpDown size={12} />}
                        </div>
                      </TableHead>
                      <TableHead numeric onClick={() => toggleSort('profit')} sort={sortState('profit')}>
                        <div className="th-content num">
                          <span>Tulemus (€)</span>
                          {sortCol === 'profit' && <ArrowUpDown size={12} />}
                        </div>
                      </TableHead>
                      <TableHead numeric onClick={() => toggleSort('profitPerHa')} sort={sortState('profitPerHa')}>
                        <div className="th-content num">
                          <span>Tulemus (€/ha)</span>
                          {sortCol === 'profitPerHa' && <ArrowUpDown size={12} />}
                        </div>
                      </TableHead>
                      <TableHead numeric>Kanded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedResults.length === 0 ? (
                      <TableEmpty colSpan={13}>
                        {resultsError ? resultsError : 'Tulemusi ei leitud.'}
                      </TableEmpty>
                    ) : (
                      sortedResults.map((r) => {
                        const profitPerHa = r.areaHa > 0 ? r.profit / r.areaHa : 0;
                        const isProfitable = r.profit >= 0;

                        return (
                          <TableRow
                            key={r.fieldSeasonId}
                            onClick={() => {
                              setFieldFilter(String(r.fieldSeasonId));
                              setStatusFilter('ALL');
                              setTab('entries');
                            }}
                            title="Klõpsa, et näha selle põllu kandeid hinnastamises"
                          >
                            <TableCell>
                              <div className="finance-field-cell">
                                {r.fieldNum && <Badge tone="success" variant="outline" size="md">Nr {r.fieldNum}</Badge>}
                                <strong>{r.fieldName}</strong>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge dot={r.cropColor || undefined}>{r.crop}</Badge>
                            </TableCell>
                            <TableCell numeric>{fmtHa(r.areaHa)} ha</TableCell>
                            <TableCell numeric className="muted">{r.labor > 0 ? fmtCur(r.labor) : '–'}</TableCell>
                            <TableCell numeric className="muted">{r.equipment > 0 ? fmtCur(r.equipment) : '–'}</TableCell>
                            <TableCell numeric className="muted">{r.fuel > 0 ? fmtCur(r.fuel) : '–'}</TableCell>
                            <TableCell numeric className="muted">{r.articles > 0 ? fmtCur(r.articles) : '–'}</TableCell>
                            <TableCell numeric className="muted" title={r.dryingLots.map((l) => `Kuivatamine (${l.name}): ${fmtCur(l.amount)}`).join('\n')}>{r.drying > 0 ? fmtCur(r.drying) : '–'}</TableCell>
                            <TableCell numeric className="cost-total">{fmtCur(r.costTotal)}</TableCell>
                            <TableCell numeric className="profit-pos">{r.revenue > 0 ? fmtCur(r.revenue) : '–'}</TableCell>
                            <TableCell numeric className={isProfitable ? 'profit-pos' : 'profit-neg'}>
                              {isProfitable && r.profit > 0 ? '+' : ''}{fmtCur(r.profit)}
                            </TableCell>
                            <TableCell numeric className={isProfitable ? 'profit-pos' : 'profit-neg'}>
                              {isProfitable && profitPerHa > 0 ? '+' : ''}{fmtCur(profitPerHa)}
                            </TableCell>
                            <TableCell numeric>
                              <Badge tone={r.entriesConfirmed === r.entriesTotal ? 'success' : 'neutral'}>
                                {r.entriesConfirmed}/{r.entriesTotal}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
              </Table>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
