// src/components/ArticleMergeDialog.tsx — kulumaterjali asendamine teisega (nt PRIA kirjaviga "Stabilan 750SL" → "Stabilan 750 SL")
import React, { useMemo, useState } from 'react';
import { GitMerge } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog } from './ConfirmDialog';
import type { Article } from '../types/fieldWork';
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogForm, DialogHeader, Field, Select } from './ui';

// Võrdlusvõti: tõstutundetu, tühikute ja kirjavahemärkideta ("Stabilan 750SL" = "Stabilan 750 SL")
const looseKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

interface Props {
  source: Article;
  articles: Article[];
  onClose: () => void;
  onMerged: () => void;
}

export const ArticleMergeDialog: React.FC<Props> = ({ source, articles, onClose, onMerged }) => {
  // Sama liigi materjalid; sarnase nimega eespool
  const options = useMemo(() => {
    const key = looseKey(source.name);
    const similar = (m: Article) => {
      const k = looseKey(m.name);
      return k === key || k.startsWith(key) || key.startsWith(k) ? 0 : 1;
    };
    return articles
      .filter((m) => m.id !== source.id && m.categoryId === source.categoryId)
      .sort((a, b) => similar(a) - similar(b) || a.name.localeCompare(b.name, 'et'));
  }, [articles, source]);
  const [targetId, setTargetId] = useState(() => {
    const first = options[0];
    return first && looseKey(first.name) === looseKey(source.name) ? first.id : '';
  });
  const [busy, setBusy] = useState(false);
  const target = options.find((m) => m.id === targetId);

  const merge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    try {
      const r = await api.mergeArticle(source.id, target.id);
      await alertDialog(`Asendatud: ${r.plans} plaanirida, ${r.entries} kanderida, ${r.stockLines} laokande rida. "${source.name}" on kustutatud.`);
      onMerged();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Materjali asendamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md" dismissible={!busy}>
        <DialogForm onSubmit={merge}>
        <DialogHeader icon={<GitMerge size={20} />} title={`Asenda materjal: ${source.name}`} />
        <DialogBody>
          <Field label="Asenda materjaliga *" htmlFor="mm-target">
            <Select
              id="mm-target"
              required
              autoFocus
              placeholder={`– vali ${source.category.name.toLowerCase()} –`}
              value={targetId}
              onValueChange={setTargetId}
              options={options.map((m) => ({ value: m.id, label: `${m.name}${m.unit !== source.unit ? ` (${m.unit})` : ''}` }))}
            />
          </Field>
          <p className="article-merge-info">
            Kõigis töödes, kannetes ja laokannetes pannakse „{source.name}“ asemele {target ? `„${target.name}“` : 'valitud materjal'}.
            „{source.name}“ kustutatakse ja tema nimi jääb valitud materjalile varunimeks, et PRIA uuesti importimisel seotaks see kohe õige materjaliga.
            {target && target.unit !== source.unit && ` Ühikud erinevad (${source.unit} → ${target.unit}): laokannete kogused teisendatakse, kannete kogused jäävad oma ühikusse.`}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Loobu</Button>
          <Button type="submit" variant="primary" disabled={busy || !target}>Asenda</Button>
        </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
};
