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
import { Button, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogForm, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui';

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
  return (
    <span className="work-phase-badge" style={{ color: m.color, backgroundColor: m.bg }}>
      {m.label}
    </span>
  );
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
                        {!w.isActive && <span className="users-admin-badge">Mitteaktiivne</span>}
                      </TableCell>
                      <TableCell>{w.shortName?.trim() || '–'}</TableCell>
                      <TableCell><PhaseBadge phase={w.phase} /></TableCell>
                      <TableCell>
                        <div className="field-sub-tags">
                          {entryInputs(w).map((i) => <span key={i} className="sub-tag">{i}</span>)}
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
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="wt-name">PRIA tegevus</label>
                  <input id="wt-name" className="form-input" readOnly value={workForm.name ?? ''} />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="wt-short">Lühinimi</label>
                  <input id="wt-short" className="form-input" maxLength={60} placeholder="nt Umbrohutõrje" value={workForm.shortName ?? ''} onChange={(e) => setWorkForm({ ...workForm, shortName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="wt-phase">Faas</label>
                  <select id="wt-phase" className="form-input" value={workForm.phase} onChange={(e) => setWorkForm({ ...workForm, phase: e.target.value as WorkPhase })}>
                    {WORK_PHASES.map((p) => <option key={p} value={p}>{WORK_PHASE_META[p].label}</option>)}
                  </select>
                </div>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={workForm.usesMaterials ?? false} onChange={(e) => setWorkForm({ ...workForm, usesMaterials: e.target.checked })} />
                  <span>Kandes küsitakse kulumaterjale (seeme, väetis, taimekaitsevahend)</span>
                </label>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={workForm.isActive ?? true} onChange={(e) => setWorkForm({ ...workForm, isActive: e.target.checked })} />
                  <span>Aktiivne (mitteaktiivset tööd põldudele ei lisata)</span>
                </label>
              </div>
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
