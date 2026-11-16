// src/components/HarvestLotDialog.tsx — saagipartii vaade: kanded, kaalumised, kuivatuskulud, sulgemine
import React, { useCallback, useEffect, useState } from 'react';
import { Wheat, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { formatQty } from '../services/units';
import { formatDate, todayTallinn } from '../services/dateFormat';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import type { Article } from '../types/fieldWork';
import type { Crop } from '../types/crop';
import type { Warehouse } from '../types/stock';
import type { HarvestLotDetail } from '../types/harvestLot';
import { HARVEST_LOT_STATUS_LABEL } from '../types/harvestLot';
import {
  Button, Card, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow,
  DateInput, Field, Input, NumberInput, Select
} from './ui';

const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  lotId: string | null; // null = uus partii
  defaultYear: number;
  warehouses: Warehouse[];
  articles: Article[];
  onClose: () => void;
  onSaved: (closeDialog: boolean) => void;
}

export const HarvestLotDialog: React.FC<Props> = ({ lotId, defaultYear, warehouses, articles, onClose, onSaved }) => {
  const [lot, setLot] = useState<HarvestLotDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [name, setName] = useState('');
  const [year, setYear] = useState<number | null>(defaultYear);
  const [cropId, setCropId] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id ?? '');
  const [notes, setNotes] = useState('');
  const [wDate, setWDate] = useState(todayTallinn());
  const [wTonnes, setWTonnes] = useState<number | null>(null);
  const [wNotes, setWNotes] = useState('');
  const [cDate, setCDate] = useState(todayTallinn());
  const [cArticle, setCArticle] = useState('');
  const [cQty, setCQty] = useState<number | null>(null);
  const [cNotes, setCNotes] = useState('');

  const load = useCallback(async (id: string) => {
    const l = await api.getHarvestLot(id);
    setLot(l);
    setName(l.name);
    setWarehouseId(l.warehouseId);
    setNotes(l.notes ?? '');
    return l;
  }, []);

  useEffect(() => {
    if (lotId) load(lotId).catch((e) => void alertDialog(errorText(e)));
    else api.getCrops().then(setCrops).catch(() => setCrops([]));
  }, [lotId, load]);

  // Tegevus: lukk (busy), vea korral dialoog, õnnestumisel uuesti laadimine
  const run = async (fn: () => Promise<void>, refresh = true) => {
    setBusy(true);
    try {
      await fn();
      if (lotId && refresh) await load(lotId);
      onSaved(false);
    } catch (err) {
      void alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (lotId) {
        await api.saveHarvestLot({ id: lotId, name, warehouseId, notes: notes || null });
        await load(lotId);
        onSaved(false);
      } else {
        await api.saveHarvestLot({ name, year: year ?? 0, cropId, warehouseId, notes: notes || null });
        onSaved(true);
      }
    } catch (err) {
      void alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const closed = lot?.status === 'CLOSED';
  const dryingTotal = (lot?.costs ?? []).reduce((s, c) => s + (c.total ?? 0), 0);
  const dryingArticles = articles
    .filter((a) => a.isActive && (a.category.group !== 'SERVICE' || a.category.systemKind === 'DRYING_TIME'))
    .sort((a, b) => a.name.localeCompare(b.name, 'et'));
  const activeWarehouses = warehouses.filter((w) => (w.isActive && !w.fieldId) || w.id === warehouseId); // põllu ladu partii hoidlaks ei sobi

  const addWeighing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotId) return;
    void run(async () => {
      await api.addHarvestLotWeighing(lotId, { date: wDate, tonnes: wTonnes ?? '', notes: wNotes || null });
      setWTonnes(null);
      setWNotes('');
    });
  };
  const addCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotId) return;
    void run(async () => {
      await api.addHarvestLotCost(lotId, { date: cDate, articleId: cArticle, quantity: cQty ?? '', notes: cNotes || null });
      setCQty(null);
      setCNotes('');
    });
  };
  const closeLot = async () => {
    if (!lotId || !(await confirmDialog('Sulgen partii ja arvutan kannete tonnid punkri kaalu järgi?'))) return;
    void run(async () => { await api.closeHarvestLot(lotId); });
  };
  const removeLot = async () => {
    if (!lotId || !(await confirmDialog('Kas kustutan saagipartii?'))) return;
    setBusy(true);
    try {
      await api.deleteHarvestLot(lotId);
      onSaved(true);
    } catch (err) {
      void alertDialog(errorText(err));
      setBusy(false);
    }
  };

  const tile = (label: string, value: React.ReactNode) => (
    <Card variant="tile" padding="sm" className="finance-kpi-card"><span className="finance-kpi-label">{label}</span><span className="finance-kpi-value num">{value}</span></Card>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg" className="stock-doc-modal" dismissible={!busy}>
        <DialogHeader
          icon={<Wheat size={20} />}
          title={lot ? `Saagipartii: ${lot.name}` : 'Uus saagipartii'}
          description={lot ? `${lot.cropName} · ${lot.seasonYear} · ${HARVEST_LOT_STATUS_LABEL[lot.status]}` : undefined}
        />
        <DialogBody className="harvest-lot-body">
          <form onSubmit={save} className="harvest-lot-head">
            <Field label="Nimi *" htmlFor="hl-name">
              <Input id="hl-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {!lot && (
              <>
                <Field label="Kultuur *" htmlFor="hl-crop">
                  <Select id="hl-crop" required placeholder="– vali –" value={cropId} onValueChange={setCropId}
                    options={crops.map((c) => ({ value: c.id, label: c.name }))} />
                </Field>
                <Field label="Hooaeg *" htmlFor="hl-year">
                  <NumberInput id="hl-year" required integer value={year} onChange={setYear} />
                </Field>
              </>
            )}
            <Field label="Ladu *" htmlFor="hl-wh">
              <Select id="hl-wh" required placeholder="– vali –" value={warehouseId} onValueChange={setWarehouseId}
                options={activeWarehouses.map((w) => ({ value: w.id, label: w.name }))} />
            </Field>
            <Field label="Märkus" htmlFor="hl-notes">
              <Input id="hl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button type="submit" size="sm" disabled={busy}>{lot ? 'Salvesta' : 'Loo partii'}</Button>
          </form>

          {lot && (
            <>
              <div className="harvest-lot-tiles">
                {tile('Punkreid', lot.bunkers)}
                {tile('Kaalutud', `${formatQty(lot.weighedTonnes)} t`)}
                {tile('Punkri kaal', closed && lot.bunkerTonnes != null ? `${formatQty(lot.bunkerTonnes)} t` : '–')}
                {tile('Kuivatuskulu', fmtEur(dryingTotal))}
              </div>

              <section className="harvest-lot-section">
                <h4>Kanded</h4>
                <Table scroll="sm" bordered>
                  <TableHeader>
                    <TableRow><TableHead>Kuupäev</TableHead><TableHead>Põld</TableHead><TableHead numeric>Punkreid</TableHead><TableHead numeric>Tonnid</TableHead><TableHead>Finants</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {lot.entries.length === 0 && <TableEmpty colSpan={5}>Kandeid pole.</TableEmpty>}
                    {lot.entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{formatDate(e.date)}</TableCell>
                        <TableCell wrap>{e.fieldName}</TableCell>
                        <TableCell numeric>{e.bunkers ?? '–'}</TableCell>
                        <TableCell numeric>
                          {e.manual && <span className="muted" title="Tonnid sisestatud käsitsi">käsitsi </span>}
                          {!e.manual && !(e.tonnes != null && e.tonnes > 0) ? <span className="muted">kaalumata</span> : formatQty(e.tonnes ?? 0)}
                        </TableCell>
                        <TableCell>{e.financeStatus ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>

              <section className="harvest-lot-section">
                <h4>Kaalumised</h4>
                <Table scroll="sm" bordered>
                  <TableHeader>
                    <TableRow><TableHead>Kuupäev</TableHead><TableHead numeric>Tonnid</TableHead><TableHead>Märkus</TableHead><TableHead actions><span className="sr-only">Tegevused</span></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {lot.weighings.length === 0 && <TableEmpty colSpan={4}>Kaalumisi pole.</TableEmpty>}
                    {lot.weighings.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{formatDate(w.date)}</TableCell>
                        <TableCell numeric>{formatQty(w.tonnes)}</TableCell>
                        <TableCell wrap>{w.notes ?? ''}</TableCell>
                        <TableCell actions>
                          {!closed && (
                            <Button type="button" variant="danger-ghost" size="icon-sm" title="Kustuta" aria-label="Kustuta kaalumine" disabled={busy}
                              onClick={() => void run(async () => { await api.deleteHarvestLotWeighing(lot.id, w.id); })}><Trash2 size={15} /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!closed && (
                  <form className="harvest-lot-add harvest-lot-add-weighing" onSubmit={addWeighing}>
                    <Field label="Kuupäev" htmlFor="hl-w-date">
                      <DateInput id="hl-w-date" value={wDate} onChange={setWDate} required />
                    </Field>
                    <Field label="Tonnid" htmlFor="hl-w-t">
                      <NumberInput id="hl-w-t" required decimals={6} value={wTonnes} onChange={setWTonnes} />
                    </Field>
                    <Field label="Märkus" htmlFor="hl-w-notes">
                      <Input id="hl-w-notes" value={wNotes} onChange={(e) => setWNotes(e.target.value)} />
                    </Field>
                    <Button type="submit" size="sm" disabled={busy}>Lisa kaalumine</Button>
                  </form>
                )}
              </section>

              <section className="harvest-lot-section">
                <h4>Kuivatuskulud</h4>
                <Table scroll="sm" bordered>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kuupäev</TableHead><TableHead>Artikkel</TableHead><TableHead numeric>Kogus</TableHead><TableHead numeric>Ühikuhind</TableHead><TableHead numeric>Summa</TableHead>
                      <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lot.costs.length === 0 && <TableEmpty colSpan={6}>Kuivatuskulusid pole.</TableEmpty>}
                    {lot.costs.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{formatDate(c.date)}</TableCell>
                        <TableCell wrap>{c.articleName}</TableCell>
                        <TableCell numeric>{formatQty(c.quantity)} {c.unit}</TableCell>
                        <TableCell numeric>{c.unitPrice == null ? <span className="muted">hindamata</span> : fmtEur(c.unitPrice)}</TableCell>
                        <TableCell numeric>{c.total == null ? <span className="muted">hindamata</span> : fmtEur(c.total)}</TableCell>
                        <TableCell actions>
                          <Button type="button" variant="danger-ghost" size="icon-sm" title="Kustuta" aria-label="Kustuta kuivatuskulu" disabled={busy}
                            onClick={() => void run(async () => { await api.deleteHarvestLotCost(lot.id, c.id); })}><Trash2 size={15} /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <form className="harvest-lot-add harvest-lot-add-cost" onSubmit={addCost}>
                  <Field label="Kuupäev" htmlFor="hl-c-date">
                    <DateInput id="hl-c-date" value={cDate} onChange={setCDate} required />
                  </Field>
                  <Field label="Artikkel" htmlFor="hl-c-art">
                    <Select id="hl-c-art" required placeholder="– vali –" value={cArticle} onValueChange={setCArticle}
                      options={dryingArticles.map((a) => ({ value: a.id, label: `${a.name} (${a.unit})` }))} />
                  </Field>
                  <Field label="Kogus" htmlFor="hl-c-qty">
                    <NumberInput id="hl-c-qty" required decimals={6} value={cQty} onChange={setCQty} />
                  </Field>
                  <Field label="Märkus" htmlFor="hl-c-notes">
                    <Input id="hl-c-notes" value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
                  </Field>
                  <Button type="submit" size="sm" disabled={busy}>Lisa kulu</Button>
                </form>
              </section>
            </>
          )}
        </DialogBody>
        {lot && (
          <DialogFooter>
            {lot.entries.length === 0 && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void removeLot()}>Kustuta partii</Button>
            )}
            {closed
              ? <Button type="button" disabled={busy} onClick={() => void run(async () => { await api.reopenHarvestLot(lot.id); })}>Ava uuesti</Button>
              : <Button type="button" variant="primary" disabled={busy} onClick={() => void closeLot()}>Sulge partii</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
