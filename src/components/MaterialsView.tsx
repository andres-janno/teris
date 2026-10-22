// src/components/MaterialsView.tsx — kulumaterjalide register täislehena (seemned, väetised, taimekaitse jm)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Search, X, Plus, Download, Edit2, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { MaterialFormDialog } from './MaterialFormDialog';
import type { Material, MaterialCategory } from '../types/fieldWork';
import { MATERIAL_CATEGORY_LABEL, NEW_MATERIAL } from '../types/fieldWork';

type ActiveFilter = 'all' | 'active' | 'inactive';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

export const MaterialsView: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<MaterialCategory | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Partial<Material> | null>(null);

  const reload = useCallback(async () => {
    try {
      setMaterials(await api.getMaterials());
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials
      .filter((m) => category === 'all' || m.category === category)
      .filter((m) => activeFilter === 'all' || (activeFilter === 'active' ? m.isActive : !m.isActive))
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.notes ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'et'));
  }, [materials, category, activeFilter, search]);

  const usedCount = materials.filter((m) => (m.usageCount ?? 0) > 0).length;
  const activeCount = materials.filter((m) => m.isActive).length;

  const remove = async (m: Material) => {
    if (!(await confirmDialog(`Kas soovid kindlasti kustutada materjali "${m.name}"?`))) return;
    try {
      await api.deleteMaterial(m.id);
      await reload();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  const exportCsv = () => {
    const headers = ['ID', 'Materjal', 'Liik', 'Ühik', 'Aktiivne', 'Kandeid', 'Märkus'];
    const rows = filtered.map((m) => [
      `"${m.id}"`,
      `"${m.name}"`,
      `"${MATERIAL_CATEGORY_LABEL[m.category]}"`,
      `"${m.unit}"`,
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
              <h2>Kulumaterjalid</h2>
              <p className="fullpage-subtitle">Kulumaterjalide register: seemned, väetised, taimekaitsevahendid ja muu, mida kannetes kasutatakse</p>
            </div>
          </div>
        </div>

        <div className="fullpage-board-body">
          <div className="modal-body">
            <div className="register-header-controls">
              <div className="year-selector-group">
                <div className="category-filter-tabs">
                  <button type="button" className={`filter-tab ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>
                    Kõik ({materials.length})
                  </button>
                  {(Object.keys(MATERIAL_CATEGORY_LABEL) as MaterialCategory[]).map((c) => (
                    <button key={c} type="button" className={`filter-tab ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
                      <span>{MATERIAL_CATEGORY_LABEL[c]}</span>
                      <span className="count-pill">{materials.filter((m) => m.category === c).length}</span>
                    </button>
                  ))}
                </div>
                <div className="register-io-buttons">
                  <button className="btn btn-secondary btn-sm" onClick={exportCsv} title="Ekspordi materjalide register CSV failina">
                    <Download size={14} />
                    <span>CSV Eksport</span>
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setForm(NEW_MATERIAL)}>
                    <Plus size={14} />
                    <span>Lisa materjal</span>
                  </button>
                </div>
              </div>
              <div className="register-stats-pills">
                <div className="reg-stat-pill">
                  <span className="lbl">Materjale:</span>
                  <strong>{materials.length} tk</strong>
                </div>
                <div className="reg-stat-pill highlight">
                  <span className="lbl">Aktiivseid:</span>
                  <strong>{activeCount} tk</strong>
                </div>
                <div className="reg-stat-pill">
                  <span className="lbl">Kannetes kasutusel:</span>
                  <strong>{usedCount} tk</strong>
                </div>
              </div>
            </div>

            <div className="register-actions-bar">
              <div className="search-box-wrap">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Otsi materjali nime või märkust..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input search-input"
                />
                {search && (
                  <button className="clear-search-btn" onClick={() => setSearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <select className="form-input filter-select" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}>
                <option value="all">Kõik olekud</option>
                <option value="active">Ainult aktiivsed</option>
                <option value="inactive">Ainult mitteaktiivsed</option>
              </select>
            </div>

            <div className="register-table-wrap">
              <table className="register-table materials-table">
                <thead>
                  <tr>
                    <th>Materjal</th>
                    <th>Liik</th>
                    <th>Ühik</th>
                    <th className="num">Kandeid</th>
                    <th>Märkus</th>
                    <th className="actions-col"><span className="sr-only">Tegevused</span></th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">
                        {materials.length === 0
                          ? 'Materjale pole. Lisa seemned, väetised ja taimekaitsevahendid, et töötajad saaksid neid kannetes valida.'
                          : 'Otsingule vastavaid materjale ei leitud.'}
                      </td>
                    </tr>
                  )}
                  {filtered.map((m) => (
                    <tr key={m.id} className={m.isActive ? '' : 'inactive'}>
                      <td className="name-cell">
                        <span className="field-name">{m.name}</span>
                        {!m.isActive && <span className="users-admin-badge">Mitteaktiivne</span>}
                      </td>
                      <td>{MATERIAL_CATEGORY_LABEL[m.category]}</td>
                      <td>{m.unit}</td>
                      <td className="num">{m.usageCount ?? 0}</td>
                      <td className="muted">{m.notes ?? ''}</td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <button className="icon-btn-ghost" title="Muuda" aria-label="Muuda" onClick={() => setForm(m)}>
                            <Edit2 size={15} />
                          </button>
                          <button className="icon-btn-danger" title="Kustuta" aria-label="Kustuta" onClick={() => remove(m)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="fullpage-board-footer">
          <span>
            Kuvatakse <strong>{filtered.length}</strong> materjali <strong>{materials.length}</strong>-st
          </span>
        </div>
      </main>

      {form && (
        <MaterialFormDialog
          initial={form}
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
