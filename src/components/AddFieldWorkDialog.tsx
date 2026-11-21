// src/components/AddFieldWorkDialog.tsx — põllule tööde lisamine (sama tegevust võib lisada mitu korda; eemaldamine tahvli töö paneelist).
import React, { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { api } from '../services/api';
import { PRIA_ACTIVITIES } from '../services/pria';
import { workTypeDisplayName } from '../services/workTypeName';
import { WORK_PHASES, WORK_PHASE_META, type FieldWork, type WorkPhase, type WorkType } from '../types/fieldWork';
import { Alert, Button, CardButton, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, Field, Input, cn, dialogStackBodyClass } from './ui';
import { phaseLabelClass } from './ui/variants';

interface AddFieldWorkDialogProps {
  fieldSeasonId: number;
  fieldLabel: string;
  workTypes: WorkType[];
  existing: FieldWork[]; // selle põllu hooaja tööd
  initialPhase?: WorkPhase;
  initialPlannedText?: string; // vaikimisi planeeritud aeg (nt "Sügis 2025" sügisploki veerust lisades)
  allowedPhases?: WorkPhase[];
  onClose: () => void;
  onSaved: () => void;
}

export const AddFieldWorkDialog: React.FC<AddFieldWorkDialogProps> = ({
  fieldSeasonId,
  fieldLabel,
  workTypes,
  existing,
  initialPhase,
  initialPlannedText,
  allowedPhases,
  onClose,
  onSaved
}) => {
  const [toAdd, setToAdd] = useState<Set<string>>(new Set());
  const [plannedText, setPlannedText] = useState(initialPlannedText ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sama tegevust võib põllul olla mitu tööd (iga töö = üks kord); olemasolevate arv on ainult vihje
  const existingCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of existing) map.set(w.workTypeId, (map.get(w.workTypeId) ?? 0) + 1);
    return map;
  }, [existing]);

  // PRIA tegevuste järjekord; PRIA-koodita tüübid lõppu
  const priaIndex = (w: WorkType): number => {
    const i = PRIA_ACTIVITIES.findIndex((p) => p.name === w.priaCode);
    return i < 0 ? PRIA_ACTIVITIES.length : i;
  };

  const toggle = (workTypeId: string) => {
    setToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(workTypeId)) next.delete(workTypeId);
      else next.add(workTypeId);
      return next;
    });
  };

  const save = async () => {
    if (toAdd.size === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Lisa valitud tööd (järjekord: põllu tööde lõppu)
      for (const id of toAdd) {
        await api.addFieldWork({
          fieldSeasonId,
          workTypeId: id,
          plannedText: plannedText.trim() || null
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tööde salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  // Valitud faas ettepoole, teised järgnevad (filtreeritud lubatud faaside järgi)
  const basePhases = allowedPhases ?? WORK_PHASES;
  const phases = initialPhase && basePhases.includes(initialPhase)
    ? [initialPhase, ...basePhases.filter((p) => p !== initialPhase)]
    : basePhases;

  const summaryText = toAdd.size === 0 ? 'Vali põllule lisatavad tööd' : `+${toAdd.size} lisatakse`;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md" dismissible={!busy}>
        <DialogHeader icon={<Plus size={20} />} title="Lisa põllule töid" description={fieldLabel} />
        <DialogBody className={dialogStackBodyClass}>
          {phases.map((phase) => {
            const list = workTypes
              .filter((w) => w.phase === phase && w.isActive)
              .sort((a, b) => priaIndex(a) - priaIndex(b) || (a.name || '').localeCompare(b.name || ''));
            if (list.length === 0) return null;
            return (
              <section key={phase} className="flex flex-col gap-1">
                <span className={phaseLabelClass} data-tone={WORK_PHASE_META[phase].tone}>
                  {WORK_PHASE_META[phase].label.toUpperCase()}
                </span>
                {list.map((w) => {
                  const count = existingCount.get(w.id) ?? 0;
                  const isAdding = toAdd.has(w.id);

                  const onField = !isAdding && count > 0;
                  const tagText = isAdding
                    ? (count > 0 ? `Lisatakse (põllul juba ${count})` : 'Lisatakse')
                    : onField ? `põllul juba ${count}` : '';

                  return (
                    <CardButton
                      key={w.id}
                      variant="option"
                      padding="none"
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 text-base leading-natural',
                        isAdding && 'border-primary-strong bg-primary-strong/8 hover:border-primary-strong hover:bg-primary-strong/8',
                        onField && 'border-primary-strong/35 bg-primary-strong/4 hover:border-primary-strong/35 hover:bg-primary-strong/4'
                      )}
                      aria-pressed={isAdding}
                      title={isAdding ? 'Kliki, et tühistada lisamine' : 'Kliki, et lisada töö plaanile'}
                      onClick={() => toggle(w.id)}
                    >
                      <span className={cn('inline-flex size-4.5 shrink-0 items-center justify-center rounded-sm border border-subtle text-white', isAdding && 'border-0 bg-primary-strong')}>
                        {isAdding && <Check size={11} strokeWidth={3.4} />}
                      </span>
                      <span className="flex-1 font-medium" title={w.name}>
                        {workTypeDisplayName(w)}
                        {w.shortName?.trim() && <small className="block font-normal text-muted-foreground">{w.name}</small>}
                      </span>
                      {tagText && <span className={'text-xs font-medium leading-natural text-success-text'}>{tagText}</span>}
                    </CardButton>
                  );
                })}
              </section>
            );
          })}
        </DialogBody>
        <DialogFooter className="flex-col items-stretch gap-2.5">
          {toAdd.size > 0 && (
            <Field label="Planeeritud aeg (uutele töödele)" htmlFor="aw-planned" className="animate-slide-in">
              <Input id="aw-planned" placeholder="nt mai 2027" value={plannedText} onChange={(e) => setPlannedText(e.target.value)} />
            </Field>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex items-center justify-end gap-2">
            <span className="flex-1 text-sm font-normal leading-natural text-muted-foreground">{summaryText}</span>
            <Button type="button" variant="ghost" onClick={onClose}>Loobu</Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy || toAdd.size === 0}
              onClick={() => void save()}
            >
              {busy ? 'Salvestan...' : 'Lisa tööd'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
