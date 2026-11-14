// src/components/ArticleCategoriesDialog.tsx — artikli liikide haldus (finantsjuht / admin).
// Süsteemset liiki saab ümber nimetada ja peita, mitte kustutada ega teise rühma viia.
import React, { useCallback, useEffect, useState } from 'react';
import { Tags, Plus, Trash2, Lock } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import type { ArticleCategory } from '../types/fieldWork';
import { ARTICLE_GROUPS, ARTICLE_GROUP_LABEL, type ArticleGroup } from '../services/articleRules';
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Table, TableBody, TableCell, TableRow } from './ui';

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
    if (!(await confirmDialog(`Kas kustutan kategooria "${c.name}"?`))) return;
    try {
      await api.deleteArticleCategory(c.id);
      reload();
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md" className="article-categories-modal">
        <DialogHeader icon={<Tags size={20} className="text-emerald" />} title="Artikli kategooriad" />
        <DialogBody>
          {ARTICLE_GROUPS.map((g) => (
            <section key={g} className="article-categories-group">
              <h4>{ARTICLE_GROUP_LABEL[g]}</h4>
              <Table scroll="none">
                <TableBody>
                  {rows.filter((r) => r.group === g).map((c) => (
                    <TableRow key={c.id} tone={c.isActive ? undefined : 'muted'}>
                      <TableCell>
                        <input
                          className="form-input"
                          aria-label="Kategooria nimi"
                          defaultValue={c.name}
                          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && void save({ ...c, name: e.target.value.trim() })}
                        />
                      </TableCell>
                      <TableCell numeric>{c.articleCount ?? 0}</TableCell>
                      <TableCell>
                        <label className="users-admin-checkbox">
                          <input type="checkbox" checked={c.isActive} onChange={(e) => void save({ ...c, isActive: e.target.checked })} />
                          <span>Aktiivne</span>
                        </label>
                      </TableCell>
                      <TableCell actions>
                        {c.systemKind
                          ? <span title="Süsteemne kategooria: süsteem kasutab seda (PRIA, laoarvestus, kanded)"><Lock size={14} /></span>
                          : <Button type="button" variant="ghost" size="icon-sm" title="Kustuta kategooria" onClick={() => void remove(c)} disabled={(c.articleCount ?? 0) > 0}><Trash2 size={14} /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
          <form className="article-categories-add" onSubmit={add}>
            <select className="form-input" aria-label="Grupp" value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value as ArticleGroup })}>
              {ARTICLE_GROUPS.map((g) => <option key={g} value={g}>{ARTICLE_GROUP_LABEL[g]}</option>)}
            </select>
            <input className="form-input" placeholder="Uue kategooria nimi, nt Varuosad" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Button type="submit" variant="primary" size="sm" disabled={!draft.name.trim()}><Plus size={14} /><span>Lisa kategooria</span></Button>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Sulge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
