// src/components/ArticleCategoriesDialog.tsx — artikli liikide haldus (finantsjuht / admin).
// Süsteemset liiki saab ümber nimetada ja peita, mitte kustutada ega teise rühma viia.
import React, { useCallback, useEffect, useState } from 'react';
import { Tags, Plus, Trash2, Lock } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import type { ArticleCategory } from '../types/fieldWork';
import { ARTICLE_GROUPS, ARTICLE_GROUP_LABEL, type ArticleGroup } from '../services/articleRules';
import {
  Button, CheckboxField, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Input, Select, Table, TableBody, TableCell, TableRow
} from './ui';

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
      <DialogContent size="md">
        <DialogHeader icon={<Tags size={20} />} title="Artikli kategooriad" />
        <DialogBody>
          {ARTICLE_GROUPS.map((g) => (
            <section key={g}>
              <h4 className="mt-3 mb-1.5">{ARTICLE_GROUP_LABEL[g]}</h4>
              <Table scroll="none">
                <TableBody>
                  {rows.filter((r) => r.group === g).map((c) => (
                    <TableRow key={c.id} tone={c.isActive ? undefined : 'muted'}>
                      <TableCell className="w-3/5">
                        <Input
                          size="sm"
                          aria-label="Kategooria nimi"
                          defaultValue={c.name}
                          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && void save({ ...c, name: e.target.value.trim() })}
                        />
                      </TableCell>
                      <TableCell numeric>{c.articleCount ?? 0}</TableCell>
                      <TableCell>
                        <CheckboxField checked={c.isActive} onCheckedChange={(v) => void save({ ...c, isActive: v })} label="Aktiivne" />
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
          <form className="mt-4 flex gap-2" onSubmit={add}>
            <Select
              aria-label="Grupp"
              className="max-w-45"
              value={draft.group}
              onValueChange={(v) => setDraft({ ...draft, group: v as ArticleGroup })}
              options={ARTICLE_GROUPS.map((g) => ({ value: g, label: ARTICLE_GROUP_LABEL[g] }))}
            />
            <Input className="min-w-0 flex-1" placeholder="Uue kategooria nimi, nt Varuosad" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
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
