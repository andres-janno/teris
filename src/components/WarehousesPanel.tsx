// src/components/WarehousesPanel.tsx — ladude register (finantsjuht ja admin): nimi, põhiladu, aktiivsus, asukoht kaardil
import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import type { PointOfInterest } from '../types/poi';
import type { Warehouse } from '../types/stock';
import {
  Badge, Button, CheckboxField, Dialog, DialogBody, DialogContent, DialogFooter, DialogForm, DialogHeader, Field, FormGrid, Input, Select,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from './ui';
import { registerActionsBarClass, registerIoButtonsClass, tableNameClass, tableMutedClass, cellBadgeClass } from './ui/variants';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  warehouses: Warehouse[];
  onChanged: () => void;
}

export const WarehousesPanel: React.FC<Props> = ({ warehouses, onChanged }) => {
  const [form, setForm] = useState<Partial<Warehouse> | null>(null);
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getPois().then(setPois).catch(() => setPois([]));
  }, []);

  // Laohooned eespool; juba teise laoga seotud huvipunktid välja
  const takenPoi = new Set(warehouses.filter((w) => w.id !== form?.id && w.poiId).map((w) => w.poiId));
  const poiOptions = pois
    .filter((p) => !takenPoi.has(p.id))
    .sort((a, b) => Number(b.category === 'warehouse') - Number(a.category === 'warehouse') || a.name.localeCompare(b.name, 'et'));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      await api.saveWarehouse(form);
      setForm(null);
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (w: Warehouse) => {
    if (!(await confirmDialog(`Kas kustutan lao "${w.name}"?`))) return;
    try {
      await api.deleteWarehouse(w.id);
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  const mainWarehouses = warehouses.filter((w) => !w.fieldId);
  const fieldWarehouses = warehouses.filter((w) => w.fieldId);
  const editingField = !!form?.id && !!warehouses.find((w) => w.id === form.id)?.fieldId;

  const row = (w: Warehouse) => (
    <TableRow key={w.id} tone={w.isActive ? undefined : 'muted'}>
      <TableCell wrap>
        <span className={tableNameClass}>{w.name}</span>
        {w.isDefault && <Badge tone="info" className={cellBadgeClass}>Põhiladu</Badge>}
        {!w.isActive && <Badge className={cellBadgeClass}>Mitteaktiivne</Badge>}
      </TableCell>
      <TableCell>{w.poiName ? <><MapPin size={13} /> {w.poiName}</> : <span className={tableMutedClass}>–</span>}</TableCell>
      <TableCell wrap className={tableMutedClass}>{w.notes ?? ''}</TableCell>
      <TableCell actions>
        <Button variant="ghost" size="icon-sm" title="Muuda" aria-label="Muuda" onClick={() => setForm(w)}><Edit2 size={15} /></Button>
        {!w.isDefault && !w.fieldId && <Button variant="danger-ghost" size="icon-sm" title="Kustuta" aria-label="Kustuta" onClick={() => remove(w)}><Trash2 size={15} /></Button>}
      </TableCell>
    </TableRow>
  );

  return (
    <>
      <div className={registerActionsBarClass}>
        <div className={registerIoButtonsClass}>
          <Button variant="primary" size="sm" onClick={() => setForm({ isActive: true, isDefault: false })}><Plus size={14} /><span>Lisa ladu</span></Button>
        </div>
      </div>
      <Table scroll="fill" bordered>
        <TableHeader>
          <TableRow>
            <TableHead>Ladu</TableHead>
            <TableHead>Asukoht</TableHead>
            <TableHead>Märkus</TableHead>
            <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mainWarehouses.map(row)}
          {fieldWarehouses.length > 0 && (
            <TableRow tone="group">
              <TableCell wrap colSpan={4}>
                <strong>Põllu laod</strong>
                <span className={tableMutedClass}> — koristatud punkrid enne vedu; tekivad esimesel koristusel automaatselt</span>
              </TableCell>
            </TableRow>
          )}
          {fieldWarehouses.map(row)}
        </TableBody>
      </Table>

      {form && (
        <Dialog open onOpenChange={(open) => { if (!open) setForm(null); }}>
          <DialogContent size="md" dismissible={!busy}>
            <DialogForm onSubmit={save}>
            <DialogHeader icon={<WarehouseIcon size={20} />} title={form.id ? `Muuda ladu: ${form.name}` : 'Lisa ladu'} />
            <DialogBody>
              <FormGrid>
                <Field span="full" label="Nimi *" htmlFor="wh-name">
                  <Input id="wh-name" required value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field span="full" label="Asukoht kaardil (huvipunkt)" htmlFor="wh-poi">
                  <Select id="wh-poi" value={form.poiId ?? ''} onValueChange={(v) => setForm({ ...form, poiId: v || null })}
                    options={[
                      { value: '', label: '– pole –' },
                      ...poiOptions.map((p) => ({ value: p.id, label: `${p.name}${p.category === 'warehouse' ? ' (laohoone)' : ''}` }))
                    ]} />
                </Field>
                <Field span="full" label="Märkus" htmlFor="wh-notes">
                  <Input id="wh-notes" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
                {!editingField && (
                  <Field span="full">
                    <CheckboxField
                      checked={form.isDefault ?? false}
                      disabled={!!warehouses.find((w) => w.id === form.id)?.isDefault}
                      onCheckedChange={(v) => setForm({ ...form, isDefault: v, isActive: v ? true : form.isActive })}
                      label="Põhiladu (põllutöö kannete vaikimisi ladu)"
                    />
                  </Field>
                )}
                <Field span="full">
                  <CheckboxField checked={form.isActive ?? true} disabled={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Aktiivne (kannetes valitav)" />
                </Field>
              </FormGrid>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Loobu</Button>
              <Button type="submit" variant="primary" disabled={busy}>Salvesta</Button>
            </DialogFooter>
            </DialogForm>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
