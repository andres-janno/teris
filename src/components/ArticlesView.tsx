// src/components/ArticlesView.tsx — laoarvestus täislehena: artiklid, laokanded, laod
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Plus, Download, Edit2, Trash2, Calendar, Lock, GitMerge, Tags } from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { ArticleFormDialog } from './ArticleFormDialog';
import { ArticleMergeDialog } from './ArticleMergeDialog';
import { ArticleCategoriesDialog } from './ArticleCategoriesDialog';
import type { FarmingSeason } from '../types/season';
import { seasonSelectorYears } from '../types/season';
import type { Article, ArticleCategory } from '../types/fieldWork';
import { NEW_ARTICLE } from '../types/fieldWork';
import { ARTICLE_GROUPS, ARTICLE_GROUP_LABEL, isGoods, type ArticleGroup } from '../services/articleRules';
import { warehouseFilterOptions } from './WarehouseOptions';
import { ArticleStockCard } from './ArticleStockCard';
import type { Warehouse } from '../types/stock';
import { StockDocumentsPanel } from './StockDocumentsPanel';
import { HarvestLotsPanel } from './HarvestLotsPanel';
import { WarehousesPanel } from './WarehousesPanel';

import { formatQty } from '../services/units';
import { Badge, Button, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, Tabs, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem, FilterClear, FilterSelect, SearchInput, PageHeader } from './ui';
import { boardViewClass, boardMainClass, boardBodyClass, boardContentClass, boardFooterClass, registerHeaderControlsClass, registerActionsBarClass, registerIoButtonsClass, searchFieldClass, yearSelectorGroupClass, yearLabelClass } from './ui/variants';
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

const fmtQty = formatQty;
const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const hasQty = (m: Article) => !!(m.plannedQty || m.usedQty);
const diffQty = (m: Article) => Math.round(((m.plannedQty ?? 0) - (m.usedQty ?? 0)) * 100) / 100;

interface ArticlesViewProps {
  selectedYear: number;
  onSelectYear: (year: number) => void;
  seasons: FarmingSeason[];
  canManageFinance: boolean;
  initialWarehouseId?: string | null; // kaardilt avatud lao filter
  onInitialWarehouseConsumed?: () => void;
}

export const ArticlesView: React.FC<ArticlesViewProps> = ({ selectedYear, onSelectYear, seasons, canManageFinance, initialWarehouseId, onInitialWarehouseConsumed }) => {
  const availableYearsList = useMemo(() => seasonSelectorYears(seasons), [seasons]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<ArticleGroup | 'all'>('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Partial<Article> | null>(null);

  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const reloadCategories = useCallback(() => {
    api.getArticleCategories().then(setCategories).catch((err) => alertDialog(errorText(err)));
  }, []);
  useEffect(() => { reloadCategories(); }, [reloadCategories]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>(initialWarehouseId ?? '');
  const [stockCard, setStockCard] = useState<Article | null>(null);
  const [merge, setMerge] = useState<Article | null>(null);
  const [selectedTab, setTab] = useState<'articles' | 'documents' | 'lots' | 'warehouses'>('articles');
  // Finantsõiguse kadumisel näita alati artikleid (muidu jääks vaade tühjaks)
  const tab = canManageFinance ? selectedTab : 'articles';

  useEffect(() => {
    if (initialWarehouseId) {
      setWarehouseId(initialWarehouseId);
      onInitialWarehouseConsumed?.();
    }
  }, [initialWarehouseId, onInitialWarehouseConsumed]);

  const reloadWarehouses = useCallback(() => {
    api.getWarehouses().then(setWarehouses).catch((err) => alertDialog(errorText(err)));
  }, []);
  useEffect(() => { reloadWarehouses(); }, [reloadWarehouses]);

  // Täpsustus: terade kultuur ja/või PRIA täpsustav liik
  const [cropNames, setCropNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    api.getCrops().then((cs) => setCropNames(new Map(cs.map((c) => [c.id, c.name])))).catch(() => setCropNames(new Map()));
  }, []);
  const refinement = (m: Article) => [m.cropId ? cropNames.get(m.cropId) : null, m.priaKind].filter(Boolean).join(" · ");

  const reload = useCallback(async () => {
    try {
      setArticles(await api.getArticles(selectedYear, warehouseId || undefined));
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [selectedYear, warehouseId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles
      .filter((m) => group === 'all' || m.category.group === group)
      .filter((m) => !categoryId || m.categoryId === categoryId)
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.manufacturer ?? '').toLowerCase().includes(q) || (m.composition ?? '').toLowerCase().includes(q) || (m.notes ?? '').toLowerCase().includes(q) || (m.priaKind ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'et'));
  }, [articles, group, categoryId, search]);


  const remove = async (m: Article) => {
    if (!(await confirmDialog(`Kas soovid kindlasti kustutada artikli "${m.name}"?`))) return;
    try {
      await api.deleteArticle(m.id);
      await reload();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  const exportCsv = () => {
    const headers = ['ID', 'Kategooria', 'Täpsustus', 'Nimetus', 'Tootja', 'Ühik', 'Laoseis', ...(canManageFinance ? ['Laoväärtus'] : []), 'Planeeritud', 'Kasutatud', 'Ala/ülekulu', 'Aktiivne', 'Kandeid', 'Märkus'];
    const rows = filtered.map((m) => [
      `"${m.id}"`,
      `"${m.category.name}"`,
      `"${refinement(m)}"`,
      `"${m.name}"`,
      `"${m.manufacturer ?? ''}"`,
      `"${m.unit}"`,
      m.stockQty ?? 0,
      ...(canManageFinance ? [m.stockValue ?? 0] : []),
      m.plannedQty ?? 0,
      m.usedQty ?? 0,
      diffQty(m),
      m.isActive ? 'jah' : 'ei',
      m.usageCount ?? 0,
      `"${m.notes ?? ''}"`
    ].join(','));
    const csvContent = 'data:text/csv;charset=utf-8,﻿' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'teris_materjalide_register.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className={boardViewClass}>
      <main className={boardMainClass}>
        <PageHeader icon={<Package />} title="Laoarvestus" subtitle="Artiklid (kulumaterjalid, teenused, toodang), laokanded ja laod" />

        <div className={boardBodyClass}>
          <div className={boardContentClass}>
            {canManageFinance && (
              <div className="articles-tabs">
                <Tabs activationMode="manual" value={tab} onValueChange={(next) => setTab(next as typeof selectedTab)}>
                  <TabsList>
                    <TabsTrigger value="articles">Artiklid</TabsTrigger>
                    <TabsTrigger value="documents">Laokanded</TabsTrigger>
                    <TabsTrigger value="lots">Saagipartiid</TabsTrigger>
                    <TabsTrigger value="warehouses">Laod</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
            {tab === 'documents' && canManageFinance && <StockDocumentsPanel warehouses={warehouses} articles={articles} onChanged={() => void reload()} />}
            {tab === 'lots' && canManageFinance && <HarvestLotsPanel warehouses={warehouses} articles={articles} onChanged={() => void reload()} />}
            {tab === 'warehouses' && canManageFinance && <WarehousesPanel warehouses={warehouses} onChanged={() => { reloadWarehouses(); void reload(); }} />}
            {tab === 'articles' && (<>
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
                  {canManageFinance && (
                    <Button size="sm" onClick={() => setShowCategories(true)} title="Artikli kategooriate haldus">
                      <Tags size={14} />
                      <span>Kategooriad</span>
                    </Button>
                  )}
                  <Button size="sm" onClick={exportCsv} title="Ekspordi materjalide register CSV failina">
                    <Download size={14} />
                    <span>CSV Eksport</span>
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setForm(NEW_ARTICLE)}>
                    <Plus size={14} />
                    <span>Lisa artikkel</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className={registerActionsBarClass}>
              <SearchInput className={searchFieldClass} value={search} onChange={setSearch} placeholder="Otsi materjali nime, tootjat või märkust..." aria-label="Otsi materjali nime, tootjat või märkust..." />
              <FilterClear active={!!warehouseId} onClear={() => setWarehouseId('')}>
                <FilterSelect ariaLabel="Ladu" value={warehouseId} onChange={setWarehouseId}
                  options={[{ value: '', label: 'Kõik laod' }, ...warehouseFilterOptions(warehouses, true)]} />
              </FilterClear>
              <ToggleGroup aria-label="Artikli grupp" value={group} onValueChange={(v) => { setGroup(v as typeof group); setCategoryId(''); }}>
                <ToggleGroupItem value="all">Kõik ({articles.length})</ToggleGroupItem>
                {ARTICLE_GROUPS.map((g) => {
                  const count = articles.filter((m) => m.category.group === g).length;
                  return (
                    <ToggleGroupItem key={g} value={g} disabled={count === 0}>
                      {ARTICLE_GROUP_LABEL[g]} ({count})
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
              <FilterClear active={!!categoryId} onClear={() => setCategoryId('')}>
                <FilterSelect ariaLabel="Kategooria" value={categoryId} onChange={setCategoryId}
                  options={[{ value: '', label: 'Kõik kategooriad' }, ...categories.filter((c) => group === 'all' || c.group === group).map((c) => ({ value: c.id, label: c.name }))]} />
              </FilterClear>
            </div>

            <Table scroll="fill" bordered>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategooria</TableHead>
                  <TableHead title="Terade kultuur, väetise ja taimekaitsevahendi täpsustus (PRIA)">Täpsustus</TableHead>
                  <TableHead>Nimetus</TableHead>
                  <TableHead>Tootja</TableHead>
                  <TableHead>Ühik</TableHead>
                  {canManageFinance && <TableHead numeric>Hind</TableHead>}
                  <TableHead numeric title="Tänane laoseis laoühikus (hooajast sõltumatu)">Laoseis</TableHead>
                  {canManageFinance && <TableHead numeric>Laoväärtus</TableHead>}
                  {canManageFinance && <TableHead numeric title="Laoväärtus / hinnatud laoseis">Keskm. hind</TableHead>}
                  <TableHead numeric>Planeeritud</TableHead>
                  <TableHead numeric>Kasutatud</TableHead>
                  <TableHead numeric title="Planeeritud miinus kasutatud; negatiivne = ülekulu">Ala/ülekulu</TableHead>
                  <TableHead numeric>Kandeid</TableHead>
                  <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && filtered.length === 0 && (
                  <TableEmpty colSpan={canManageFinance ? 14 : 11}>
                    {articles.length === 0
                      ? 'Artikleid pole. Lisa seemned, väetised, taimekaitsevahendid ja teenused.'
                      : 'Otsingule vastavaid artikleid ei leitud.'}
                  </TableEmpty>
                )}
                {filtered.map((m) => (
                  <TableRow key={m.id} tone={m.isActive ? undefined : 'muted'} onClick={() => (isGoods(m.category.group) ? setStockCard(m) : setForm(m))}>
                    <TableCell wrap>{m.category.name}</TableCell>
                    <TableCell wrap>{refinement(m)}</TableCell>
                    <TableCell wrap title={m.notes ?? undefined}>
                      <span>{m.name}</span>
                      {m.isDefaultService && <Badge className="cell-badge" title="Tööaja kategooria vaikimisi teenus">vaikimisi</Badge>}
                      {!m.isActive && <Badge className="cell-badge">Mitteaktiivne</Badge>}
                    </TableCell>
                    <TableCell wrap>{m.manufacturer ?? ''}</TableCell>
                    <TableCell>{m.unit}</TableCell>
                    {canManageFinance && (
                      <TableCell numeric>{!isGoods(m.category.group) && m.price != null ? `${fmtEur(m.price)} / ${m.unit}` : ''}</TableCell>
                    )}
                    {isGoods(m.category.group) ? (
                      <TableCell numeric className={`stock-qty ${(m.stockQty ?? 0) < 0 ? 'stock-qty-out' : (m.stockQty ?? 0) > 0 ? 'stock-qty-in' : ''}`}>
                        {fmtQty(m.stockQty ?? 0)}
                      </TableCell>
                    ) : <TableCell numeric>–</TableCell>}
                    {canManageFinance && <TableCell numeric>{isGoods(m.category.group) ? fmtEur(m.stockValue ?? 0) : '–'}</TableCell>}
                    {canManageFinance && (
                      <TableCell numeric>
                        {isGoods(m.category.group) && (m.pricedQty ?? 0) > 0 ? fmtEur((m.stockValue ?? 0) / m.pricedQty!) : '–'}
                      </TableCell>
                    )}
                    <TableCell numeric>{hasQty(m) ? fmtQty(m.plannedQty ?? 0) : '–'}</TableCell>
                    <TableCell numeric>{hasQty(m) ? fmtQty(m.usedQty ?? 0) : '–'}</TableCell>
                    <TableCell numeric className={diffQty(m) < 0 ? 'article-overuse' : ''}>{hasQty(m) ? fmtQty(diffQty(m)) : '–'}</TableCell>
                    <TableCell numeric>{m.usageCount ?? 0}</TableCell>
                    <TableCell actions>
                      <Button variant="ghost" size="icon-sm" title="Muuda" aria-label="Muuda" onClick={(e) => { e.stopPropagation(); setForm(m); }}>
                        <Edit2 size={15} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Asenda teise materjaliga (nt kirjaviga nimes)" aria-label="Asenda" onClick={(e) => { e.stopPropagation(); setMerge(m); }}>
                        <GitMerge size={15} />
                      </Button>
                      <Button variant="danger-ghost" size="icon-sm" title="Kustuta" aria-label="Kustuta" onClick={(e) => { e.stopPropagation(); void remove(m); }}>
                        <Trash2 size={15} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>)}
          </div>
        </div>
        {tab === 'articles' && (
        <div className={boardFooterClass}>
          <span>
            Kuvatakse <strong>{filtered.length}</strong> materjali <strong>{articles.length}</strong>-st
          </span>
        </div>
        )}
      </main>

      {stockCard && (
        <ArticleStockCard article={stockCard} warehouseId={warehouseId} warehouses={warehouses} canSeeMoney={canManageFinance} onClose={() => setStockCard(null)} />
      )}

      {merge && (
        <ArticleMergeDialog
          source={merge}
          articles={articles}
          onClose={() => setMerge(null)}
          onMerged={() => {
            setMerge(null);
            void reload();
          }}
        />
      )}

      {showCategories && <ArticleCategoriesDialog onClose={() => setShowCategories(false)} onChanged={() => { reloadCategories(); void reload(); }} />}

      {form && (
        <ArticleFormDialog
          initial={form}
          canManageFinance={canManageFinance}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void reload();
          }}
        />
      )}
    </div>
  );
};
