// src/components/ArticleCategoriesDialog.tsx — artikli liikide haldus (finantsjuht / admin).
// Süsteemset liiki saab ümber nimetada ja peita, mitte kustutada ega teise rühma viia.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tags, X, Plus, Trash2, Lock } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import type { ArticleCategory } from '../types/fieldWork';
import { ARTICLE_GROUPS, ARTICLE_GROUP_LABEL, type ArticleGroup } from '../services/articleRules';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

export const ArticleCategoriesDialog: React.FC<Props> = ({ onClose, onChanged }) => {
  const [rows, setRows] = useState<ArticleCategory[]>([]);
  const [draft, setDraft] = useState<{ name: string; group: ArticleGroup }>({ name: '', group: 'CONSUMABLE' });

  const reload = useCallback(() => {
    api.getArticleCategories().then(setRows).catch((err) => alertDialog(errorText(err)));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const save = async (c: Partial<ArticleCategory>) => {
    try {
      await api.saveArticleCategory(c);
      reload();
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
      reload();
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const maxSort = Math.max(0, ...rows.filter((r) => r.group === draft.group).map((r) => r.sortOrder));
    await save({ name: draft.name.trim(), group: draft.group, sortOrder: maxSort + 1 });
    setDraft({ ...draft, name: '' });
  };

  const remove = async (c: ArticleCategory) => {
    if (!(await confirmDialog(`Kas kustutan grupi "${c.name}"?`))) return;
    try {
      await api.deleteArticleCategory(c.id);
      reload();
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content animate-scale-up article-categories-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <Tags size={20} className="text-emerald" />
            <h3>Artikli grupid</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          {ARTICLE_GROUPS.map((g) => (
            <section key={g} className="article-categories-group">
              <h4>{ARTICLE_GROUP_LABEL[g]}</h4>
              <table className="register-table">
                <tbody>
                  {rows.filter((r) => r.group === g).map((c) => (
                    <tr key={c.id} className={c.isActive ? '' : 'inactive'}>
                      <td>
                        <input
                          className="form-input"
                          aria-label="Grupi nimi"
                          defaultValue={c.name}
                          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && void save({ ...c, name: e.target.value.trim() })}
                        />
                      </td>
                      <td className="num">{c.articleCount ?? 0}</td>
                      <td>
                        <label className="users-admin-checkbox">
                          <input type="checkbox" checked={c.isActive} onChange={(e) => void save({ ...c, isActive: e.target.checked })} />
                          <span>Aktiivne</span>
                        </label>
                      </td>
                      <td className="actions-col">
                        {c.systemKind
                          ? <span title="Süsteemne grupp: süsteem kasutab seda (PRIA, laoarvestus, kanded)"><Lock size={14} /></span>
                          : <button type="button" className="icon-btn-ghost" title="Kustuta grupp" onClick={() => void remove(c)} disabled={(c.articleCount ?? 0) > 0}><Trash2 size={14} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
          <form className="article-categories-add" onSubmit={add}>
            <select className="form-input" aria-label="Tüüp" value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value as ArticleGroup })}>
              {ARTICLE_GROUPS.map((g) => <option key={g} value={g}>{ARTICLE_GROUP_LABEL[g]}</option>)}
            </select>
            <input className="form-input" placeholder="Uue grupi nimi, nt Varuosad" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!draft.name.trim()}><Plus size={14} /><span>Lisa grupp</span></button>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Sulge</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
