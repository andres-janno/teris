// src/components/WorkRegisterModal.tsx — tööde register: põllutööde liigid (kulumaterjalid on laoarvestuse artiklites).
import React, { useCallback, useEffect, useState } from 'react';
import { ListChecks, Edit2, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import {
  WORK_PHASES,
  WORK_PHASE_META,
  type WorkPhase,
  type WorkType
} from '../types/fieldWork';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogForm, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Field, FormGrid, Input, Select, CheckboxField } from './ui';

interface WorkRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

// Mida kandes küsitakse (töötaja sisestab ainult kogused).
const entryInputs = (w: WorkType) => [
  'Tööaeg',
  'Masin + haakeriist (h)',
  'Kütus',
  ...(w.usesMaterials ? ['Kulumaterjalid'] : []),
  ...(w.phase === 'HARVEST' ? ['Saak (t)'] : [])
];

const PhaseBadge: React.FC<{ phase: WorkPhase }> = ({ phase }) => {
  const m = WORK_PHASE_META[phase];
  return <Badge tone={m.tone}>{m.label}</Badge>;
};

export const WorkRegisterModal: React.FC<WorkRegisterModalProps> = ({ isOpen, onClose }) => {
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setWorkTypes(await api.getWorkTypes());
    } catch (err) {
      alertDialog(errorText(err));
    }
  }, []);

  useEffect(() => {
    if (isOpen) void reload();
  }, [isOpen, reload]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // --- Töö vorm ---
  const [workForm, setWorkForm] = useState<Partial<WorkType> | null>(null);
  const saveWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workForm) return;
    void run(async () => {
      await api.saveWorkType(workForm);
      setWorkForm(null);
    });
  };
  const deleteWork = async (w: WorkType) => {
    if (!await confirmDialog(`Kas soovid kindlasti kustutada töö "${w.name}" registrist?`)) return;
    void run(() => api.deleteWorkType(w.id));
  };

  if (!isOpen) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="xl" className="work-register-modal">
        <DialogHeader
          icon={<ListChecks size={20} className="text-emerald" />}
          title="Tööde register"
          description="Põllutööde liigid. PRIA põlluraamatust lahus. Kulumaterjalid on laoarvestuse artiklites."
        />

        <DialogBody className="work-register-body">
          {/* tööliigid on PRIA e-põlluraamatu 29 tegevust; uusi ei lisata, muuta saab faasi ja materjalide küsimist */}
          <Table scroll="md" bordered>
            <TableHeader>
              <TableRow>
                <TableHead>PRIA tegevus</TableHead>
                <TableHead>Lühinimi</TableHead>
                <TableHead>Faas</TableHead>
                <TableHead>Kandes küsitakse (kogused)</TableHead>
                <TableHead numeric>Põldudel</TableHead>
                <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {[...workTypes]
                  .sort((a, b) => WORK_PHASES.indexOf(a.phase) - WORK_PHASES.indexOf(b.phase) || a.sortOrder - b.sortOrder)
                  .map((w) => (
                    <TableRow key={w.id} tone={w.isActive ? undefined : 'muted'}>
                      <TableCell wrap className="work-name-cell">
                        {w.name}
                        {!w.isActive && <Badge>Mitteaktiivne</Badge>}
                      </TableCell>
                      <TableCell>{w.shortName?.trim() || '–'}</TableCell>
                      <TableCell><PhaseBadge phase={w.phase} /></TableCell>
                      <TableCell>
                        <div className="field-sub-tags">
                          {entryInputs(w).map((i) => <Badge key={i}>{i}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell numeric>{w.fieldWorkCount ?? 0}</TableCell>
                      <TableCell actions>
                          <Button variant="ghost" size="icon-sm" title="Muuda" aria-label="Muuda" onClick={() => setWorkForm(w)}>
                            <Edit2 size={15} />
                          </Button>
                          <Button variant="danger-ghost" size="icon-sm" title="Kustuta" aria-label="Kustuta" disabled={busy} onClick={() => deleteWork(w)}>
                            <Trash2 size={15} />
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </DialogBody>
      </DialogContent>

      {workForm && (
        <Dialog open onOpenChange={(open) => { if (!open) setWorkForm(null); }}>
          <DialogContent size="md" dismissible={!busy} className="work-form-modal">
            <DialogForm onSubmit={saveWork}>
              <DialogHeader icon={<Edit2 size={20} className="text-emerald" />} title={`Muuda tööd: ${workForm.name}`} />
              <DialogBody>
              <FormGrid>
                <Field label="PRIA tegevus" htmlFor="wt-name" span="full">
                  <Input id="wt-name" readOnly value={workForm.name ?? ''} />
                </Field>
                <Field label="Lühinimi" htmlFor="wt-short" span="full">
                  <Input id="wt-short" maxLength={60} placeholder="nt Umbrohutõrje" value={workForm.shortName ?? ''} onChange={(e) => setWorkForm({ ...workForm, shortName: e.target.value })} />
                </Field>
                <Field label="Faas" htmlFor="wt-phase">
                  <Select id="wt-phase" value={workForm.phase ?? ''} onValueChange={(v) => setWorkForm({ ...workForm, phase: v as WorkPhase })}
                    options={WORK_PHASES.map((p) => ({ value: p, label: WORK_PHASE_META[p].label }))} />
                </Field>
                <Field span="full">
                  <CheckboxField checked={workForm.usesMaterials ?? false} onCheckedChange={(c) => setWorkForm({ ...workForm, usesMaterials: c })}
                    label="Kandes küsitakse kulumaterjale (seeme, väetis, taimekaitsevahend)" />
                </Field>
                <Field span="full">
                  <CheckboxField checked={workForm.isActive ?? true} onCheckedChange={(c) => setWorkForm({ ...workForm, isActive: c })}
                    label="Aktiivne (mitteaktiivset tööd põldudele ei lisata)" />
                </Field>
              </FormGrid>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setWorkForm(null)}>Loobu</Button>
                <Button type="submit" variant="primary" disabled={busy}>Salvesta</Button>
              </DialogFooter>
            </DialogForm>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};
