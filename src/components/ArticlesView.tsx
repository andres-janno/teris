// src/components/ArticlesView.tsx — laoarvestus täislehena: artiklid, laokanded, laod
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Search, Plus, Download, Edit2, Trash2, Calendar, Lock, GitMerge, Tags } from 'lucide-react';
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
import { FilterClear } from './FilterClear';
import { ArticleStockCard } from './ArticleStockCard';
import type { Warehouse } from '../types/stock';
import { StockDocumentsPanel } from './StockDocumentsPanel';
import { HarvestLotsPanel } from './HarvestLotsPanel';
import { WarehousesPanel } from './WarehousesPanel';

import { formatQty } from '../services/units';
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
  const [tab, setTab] = useState<'articles' | 'documents' | 'lots' | 'warehouses'>('articles');

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
    const headers = ['ID', 'Grupp', 'Täpsustus', 'Nimetus', 'Tootja', 'Ühik', 'Laoseis', ...(canManageFinance ? ['Laoväärtus'] : []), 'Planeeritud', 'Kasutatud', 'Ala/ülekulu', 'Aktiivne', 'Kandeid', 'Märkus'];
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
    <div className="fullpage-board-view">
      <main className="fullpage-board-main wide">
        <div className="fullpage-board-header">
          <div className="fullpage-title-wrap">
            <Package className="text-emerald" size={26} />
            <div>
              <h2>Laoarvestus</h2>
              <p className="fullpage-subtitle">Artiklid (kulumaterjalid, teenused, toodang), laokanded ja laod</p>
            </div>
          </div>
        </div>

        <div className="fullpage-board-body">
          <div className="modal-body">
            {canManageFinance && (
              <div className="category-filter-tabs articles-tabs">
                <button type="button" className={`filter-tab ${tab === 'articles' ? 'active' : ''}`} onClick={() => setTab('articles')}>Artiklid</button>
                <button type="button" className={`filter-tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>Laokanded</button>
                {canManageFinance && <button type="button" className={`filter-tab ${tab === 'lots' ? 'active' : ''}`} onClick={() => setTab('lots')}>Saagipartiid</button>}
                <button type="button" className={`filter-tab ${tab === 'warehouses' ? 'active' : ''}`} onClick={() => setTab('warehouses')}>Laod</button>
              </div>
            )}
            {tab === 'documents' && canManageFinance && <StockDocumentsPanel warehouses={warehouses} articles={articles} onChanged={() => void reload()} />}
            {tab === 'lots' && canManageFinance && <HarvestLotsPanel warehouses={warehouses} articles={articles} onChanged={() => void reload()} />}
            {tab === 'warehouses' && canManageFinance && <WarehousesPanel warehouses={warehouses} onChanged={() => { reloadWarehouses(); void reload(); }} />}
            {tab === 'articles' && (<>
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
                  {canManageFinance && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowCategories(true)} title="Artikli gruppide haldus">
                      <Tags size={14} />
                      <span>Grupid</span>
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={exportCsv} title="Ekspordi materjalide register CSV failina">
                    <Download size={14} />
                    <span>CSV Eksport</span>
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setForm(NEW_ARTICLE)}>
                    <Plus size={14} />
                    <span>Lisa artikkel</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="register-actions-bar">
              <div className="search-box-wrap">
                <Search size={16} className="search-icon" />
                <FilterClear active={!!search} onClear={() => setSearch('')}>
                  <input
                    type="text"
                    placeholder="Otsi materjali nime, tootjat või märkust..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="form-input search-input"
                  />
                </FilterClear>
              </div>
              <FilterClear active={!!warehouseId} onClear={() => setWarehouseId('')}>
                <select className="form-input" aria-label="Ladu" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">Kõik laod</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.isActive ? '' : ' (mitteaktiivne)'}</option>)}
                </select>
              </FilterClear>
              <div className="category-filter-tabs">
                <button type="button" className={`filter-tab ${group === 'all' ? 'active' : ''}`} onClick={() => { setGroup('all'); setCategoryId(''); }}>
                  Kõik ({articles.length})
                </button>
                {ARTICLE_GROUPS.map((g) => {
                  const count = articles.filter((m) => m.category.group === g).length;
                  return (
                    <button key={g} type="button" className={`filter-tab ${group === g ? 'active' : ''}`} onClick={() => { setGroup(g); setCategoryId(''); }} disabled={count === 0}>
                      {ARTICLE_GROUP_LABEL[g]} ({count})
                    </button>
                  );
                })}
              </div>
              <FilterClear active={!!categoryId} onClear={() => setCategoryId('')}>
                <select className="form-input" aria-label="Grupp" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Kõik grupid</option>
                  {categories.filter((c) => group === 'all' || c.group === group).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FilterClear>
            </div>

            <div className="register-table-wrap">
              <table className="register-table articles-table">
                <thead>
                  <tr>
                    <th>Grupp</th>
                    <th title="Terade kultuur, väetise ja taimekaitsevahendi täpsustus (PRIA)">Täpsustus</th>
                    <th>Nimetus</th>
                    <th>Tootja</th>
                    <th>Ühik</th>
                    {canManageFinance && <th className="num">Hind</th>}
                    <th className="num" title="Tänane laoseis laoühikus (hooajast sõltumatu)">Laoseis</th>
                    {canManageFinance && <th className="num">Laoväärtus</th>}
                    {canManageFinance && <th className="num" title="Laoväärtus / hinnatud laoseis">Keskm. hind</th>}
                    <th className="num">Planeeritud</th>
                    <th className="num">Kasutatud</th>
                    <th className="num" title="Planeeritud miinus kasutatud; negatiivne = ülekulu">Ala/ülekulu</th>
                    <th className="num">Kandeid</th>
                    <th className="actions-col"><span className="sr-only">Tegevused</span></th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={canManageFinance ? 14 : 11} className="muted">
                        {articles.length === 0
                          ? 'Artikleid pole. Lisa seemned, väetised, taimekaitsevahendid ja teenused.'
                          : 'Otsingule vastavaid artikleid ei leitud.'}
                      </td>
                    </tr>
                  )}
                  {filtered.map((m) => (
                    <tr key={m.id} className={`clickable-row ${m.isActive ? '' : 'inactive'}`} onClick={() => (isGoods(m.category.group) ? setStockCard(m) : setForm(m))}>
                      <td>{m.category.name}</td>
                      <td>{refinement(m)}</td>
                      <td className="name-cell" title={m.notes ?? undefined}>
                        <span className="field-name">{m.name}</span>
                        {m.isDefaultService && <span className="article-default-badge" title="Tööaja liigi vaikimisi teenus">vaikimisi</span>}
                        {!m.isActive && <span className="users-admin-badge">Mitteaktiivne</span>}
                      </td>
                      <td>{m.manufacturer ?? ''}</td>
                      <td>{m.unit}</td>
                      {canManageFinance && (
                        <td className="num">{!isGoods(m.category.group) && m.price != null ? `${fmtEur(m.price)} / ${m.unit}` : ''}</td>
                      )}
                      {isGoods(m.category.group) ? (
                        <td className={`num stock-qty ${(m.stockQty ?? 0) < 0 ? 'stock-qty-out' : (m.stockQty ?? 0) > 0 ? 'stock-qty-in' : ''}`}>
                          {fmtQty(m.stockQty ?? 0)}
                        </td>
                      ) : <td className="num">–</td>}
                      {canManageFinance && <td className="num">{isGoods(m.category.group) ? fmtEur(m.stockValue ?? 0) : '–'}</td>}
                      {canManageFinance && (
                        <td className="num">
                          {isGoods(m.category.group) && (m.pricedQty ?? 0) > 0 ? fmtEur((m.stockValue ?? 0) / m.pricedQty!) : '–'}
                        </td>
                      )}
                      <td className="num">{hasQty(m) ? fmtQty(m.plannedQty ?? 0) : '–'}</td>
                      <td className="num">{hasQty(m) ? fmtQty(m.usedQty ?? 0) : '–'}</td>
                      <td className={`num ${diffQty(m) < 0 ? 'article-overuse' : ''}`}>{hasQty(m) ? fmtQty(diffQty(m)) : '–'}</td>
                      <td className="num">{m.usageCount ?? 0}</td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <button className="icon-btn-ghost" title="Muuda" aria-label="Muuda" onClick={(e) => { e.stopPropagation(); setForm(m); }}>
                            <Edit2 size={15} />
                          </button>
                          <button className="icon-btn-ghost" title="Asenda teise materjaliga (nt kirjaviga nimes)" aria-label="Asenda" onClick={(e) => { e.stopPropagation(); setMerge(m); }}>
                            <GitMerge size={15} />
                          </button>
                          <button className="icon-btn-danger" title="Kustuta" aria-label="Kustuta" onClick={(e) => { e.stopPropagation(); void remove(m); }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>)}
          </div>
        </div>
        {tab === 'articles' && (
        <div className="fullpage-board-footer">
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
