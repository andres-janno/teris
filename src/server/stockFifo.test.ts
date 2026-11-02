import { describe, expect, it } from 'vitest';
import { fifoReplay, movementCost, sortMovements, stockAtDate, type Movement } from './stockFifo';

const A = 'wh-a';
const B = 'wh-b';
let seq = 0;
const inM = (ref: string, date: string, quantity: number, amount: number, warehouseId = A): Movement =>
  ({ ref, date, seq: seq++, kind: 'IN', warehouseId, quantity, amount });
const outM = (ref: string, date: string, quantity: number, warehouseId = A): Movement =>
  ({ ref, date, seq: seq++, kind: 'OUT', warehouseId, quantity });
const trM = (ref: string, date: string, quantity: number, from = A, to = B): Movement =>
  ({ ref, date, seq: seq++, kind: 'TRANSFER', warehouseId: from, toWarehouseId: to, quantity });

describe('sortMovements', () => {
  it('kuupäev, siis IN → TRANSFER → OUT, siis seq', () => {
    const m = [outM('o', '2026-05-01', 1), trM('t', '2026-05-01', 1), inM('i', '2026-05-01', 1, 1), inM('i0', '2026-04-30', 1, 1)];
    expect(sortMovements(m).map((x) => x.ref)).toEqual(['i0', 'i', 't', 'o']);
  });
});

describe('fifoReplay', () => {
  it('võtab vanimast partiist ja jätkab järgmisest', () => {
    const r = fifoReplay([
      inM('i1', '2026-01-01', 100, 100), // 1,00 €/kg
      inM('i2', '2026-02-01', 100, 200), // 2,00 €/kg
      outM('o1', '2026-03-01', 150)
    ]);
    expect(r.outs.get('o1')).toEqual({ cost: 200, unpricedQty: 0, shortageQty: 0, missingQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 50, value: 100, unpricedQty: 0, pricedQty: 50 });
  });

  it('sama päeva sissetulek kehtib enne väljaminekut, sõltumata sisestusjärjekorrast', () => {
    const r = fifoReplay([outM('o1', '2026-03-01', 10), inM('i1', '2026-03-01', 10, 50)]);
    expect(r.outs.get('o1')).toEqual({ cost: 50, unpricedQty: 0, shortageQty: 0, missingQty: 0 });
  });

  it('miinusseis jääb hindamata; hilisem sissetulek katab võla ja annab sellele hinna', () => {
    const r = fifoReplay([
      outM('o1', '2026-03-01', 30),
      inM('i1', '2026-04-01', 50, 150) // 3,00 €/kg
    ]);
    expect(r.outs.get('o1')).toEqual({ cost: 90, unpricedQty: 0, shortageQty: 0, missingQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 20, value: 60, unpricedQty: 0, pricedQty: 20 });
  });

  it('katmata võlg jääb laoseisu miinuseks ja hindamata koguseks', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10), outM('o1', '2026-02-01', 25)]);
    expect(r.outs.get('o1')).toEqual({ cost: 10, unpricedQty: 15, shortageQty: 0, missingQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: -15, value: 0, unpricedQty: 15, pricedQty: 0 });
  });

  it('tagantjärele lisatud varasem arve muudab hilisema väljamineku hinda', () => {
    const base = [inM('i2', '2026-05-01', 10, 50), outM('o1', '2026-06-01', 10)];
    expect(fifoReplay(base).outs.get('o1')!.cost).toBe(50);
    const withEarlier = [...base, inM('i1', '2026-01-01', 10, 20)];
    expect(fifoReplay(withEarlier).outs.get('o1')!.cost).toBe(20);
  });

  it('nullsummaga sissetulek annab nullhinnaga partii', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 5, 0), outM('o1', '2026-01-02', 5)]);
    expect(r.outs.get('o1')).toEqual({ cost: 0, unpricedQty: 0, shortageQty: 0, missingQty: 0 });
  });

  it('laod on eraldi', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10, A), outM('o1', '2026-01-02', 5, B)]);
    expect(r.outs.get('o1')).toEqual({ cost: 0, unpricedQty: 5, shortageQty: 0, missingQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 10, value: 10, unpricedQty: 0, pricedQty: 10 });
    expect(r.stock.get(B)).toEqual({ qty: -5, value: 0, unpricedQty: 5, pricedQty: 0 });
  });

  it('ülekanne kannab partii hinna sihtlattu', () => {
    const r = fifoReplay([
      inM('i1', '2026-01-01', 10, 10), // 1 €
      inM('i2', '2026-01-02', 10, 30), // 3 €
      trM('t1', '2026-02-01', 15),
      outM('o1', '2026-03-01', 12, B)
    ]);
    expect(r.outs.get('t1')).toEqual({ cost: 25, unpricedQty: 0, shortageQty: 0, missingQty: 0 });
    expect(r.outs.get('o1')).toEqual({ cost: 16, unpricedQty: 0, shortageQty: 0, missingQty: 0 }); // 10×1 + 2×3
    expect(r.stock.get(A)).toEqual({ qty: 5, value: 15, unpricedQty: 0, pricedQty: 5 });
    expect(r.stock.get(B)).toEqual({ qty: 3, value: 9, unpricedQty: 0, pricedQty: 3 });
  });

  it('ülekanne katab sihtlao võla', () => {
    const r = fifoReplay([
      outM('o1', '2026-01-01', 4, B),
      inM('i1', '2026-01-02', 10, 20),
      trM('t1', '2026-01-03', 10)
    ]);
    expect(r.outs.get('o1')).toEqual({ cost: 8, unpricedQty: 0, shortageQty: 0, missingQty: 0 });
    expect(r.stock.get(B)).toEqual({ qty: 6, value: 12, unpricedQty: 0, pricedQty: 6 });
  });

  it('ülekanne üle saadaoleva: puudujääk märgitakse, kogus liigub hindamatuna', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 5, 10), trM('t1', '2026-01-02', 8)]);
    expect(r.outs.get('t1')).toEqual({ cost: 10, unpricedQty: 3, shortageQty: 3, missingQty: 3 });
    expect(r.stock.get(A)).toEqual({ qty: -3, value: 0, unpricedQty: 3, pricedQty: 0 });
    expect(r.stock.get(B)).toEqual({ qty: 8, value: 10, unpricedQty: 3, pricedQty: 5 });
  });
});

describe('fifoReplay — piirjuhud', () => {
  it('hinnatud partiide kogus (pricedQty) laoti', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 5, 10), trM('t1', '2026-01-02', 8)]);
    expect(r.stock.get(A)!.pricedQty).toBe(0);
    expect(r.stock.get(B)!.pricedQty).toBe(5); // 8-st 3 tuli hindamatuna
  });

  it('ülekande puudujääk, mille hilisem arvele võtmine katab: ülekanne jääb maksumuseta', () => {
    const r = fifoReplay([
      inM('i1', '2026-01-01', 5, 10), // 2 €
      trM('t1', '2026-01-02', 8),
      inM('i2', '2026-01-03', 10, 30) // 3 € — katab lähtelao võla 3
    ]);
    // Praegune käitumine: võla katmine hindab ülekande lähtepoolel, sihtlao partii jääb hindamatuks
    expect(r.outs.get('t1')).toEqual({ cost: 19, unpricedQty: 0, shortageQty: 3, missingQty: 3 });
    expect(r.stock.get(A)).toEqual({ qty: 7, value: 21, unpricedQty: 0, pricedQty: 7 });
    expect(r.stock.get(B)).toEqual({ qty: 8, value: 10, unpricedQty: 3, pricedQty: 5 });
    // Kande maksumus jääb tühjaks, kuni puudujääk on olemas (muidu tekiks väärtuse auk)
    expect(movementCost('TRANSFER', r.outs.get('t1'))).toBeNull();
  });

  it('nullkogusega sissetulek ei loo partiid', () => {
    const r = fifoReplay([inM('z', '2026-01-01', 0, 5), outM('o1', '2026-01-02', 2)]);
    expect(r.outs.get('o1')).toEqual({ cost: 0, unpricedQty: 2, shortageQty: 0, missingQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: -2, value: 0, unpricedQty: 2, pricedQty: 0 });
  });

  it('sama päeva ülekanne toimub enne väljaminekut, sõltumata sisestusjärjekorrast', () => {
    const r = fifoReplay([
      inM('i1', '2026-01-01', 10, 10),
      outM('oB', '2026-01-02', 4, B), // sisestatud enne ülekannet
      outM('oA', '2026-01-02', 1, A),
      trM('t1', '2026-01-02', 10)
    ]);
    expect(r.outs.get('oB')).toEqual({ cost: 4, unpricedQty: 0, shortageQty: 0, missingQty: 0 });
    expect(r.outs.get('oA')).toEqual({ cost: 0, unpricedQty: 1, shortageQty: 0, missingQty: 0 });
    expect(r.outs.get('t1')).toEqual({ cost: 10, unpricedQty: 0, shortageQty: 0, missingQty: 0 });
  });
});

describe('movementCost', () => {
  it('hinnatud väljaminek annab maksumuse, hindamata või puuduv tulemus null', () => {
    expect(movementCost('OUT', { cost: 5, unpricedQty: 0, shortageQty: 0, missingQty: 0 })).toBe(5);
    expect(movementCost('OUT', { cost: 5, unpricedQty: 1, shortageQty: 0, missingQty: 0 })).toBeNull();
    expect(movementCost('OUT', undefined)).toBeNull();
    expect(movementCost('TRANSFER', { cost: 5, unpricedQty: 0, shortageQty: 0, missingQty: 0 })).toBe(5);
  });
});

const cntM = (ref: string, date: string, counted: number, warehouseId = A): Movement =>
  ({ ref, date, seq: seq++, kind: 'COUNT', warehouseId, quantity: counted });

describe('inventuur (COUNT)', () => {
  it('inventuur on päeva viimane liikumine', () => {
    const m = [cntM('c', '2026-05-01', 1), outM('o', '2026-05-01', 1), inM('i', '2026-05-01', 1, 1)];
    expect(sortMovements(m).map((x) => x.ref)).toEqual(['i', 'o', 'c']);
  });

  it('puudujääk kantakse maha FIFO järgi', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 100, 100), cntM('c', '2026-02-01', 70)]);
    expect(r.counts.get('c')).toEqual({ diffQty: -30, amount: null });
    expect(movementCost('OUT', r.outs.get('c'))).toBe(30);
    expect(r.stock.get(A)).toEqual({ qty: 70, value: 70, unpricedQty: 0, pricedQty: 70 });
  });

  it('0 kannab kogu seisu maha', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 20), cntM('c', '2026-02-01', 0)]);
    expect(r.counts.get('c')!.diffQty).toBe(-10);
    expect(movementCost('OUT', r.outs.get('c'))).toBe(20);
    expect(r.stock.get(A)!.qty).toBe(0);
  });

  it('ülejääk võetakse juurde lao keskmise hinnaga', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10), inM('i2', '2026-01-02', 10, 30), cntM('c', '2026-02-01', 25)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 5, amount: 10 }); // keskmine 2 €/kg
    expect(r.stock.get(A)).toEqual({ qty: 25, value: 50, unpricedQty: 0, pricedQty: 25 });
  });

  it('hinnatud partiita laos võtab ülejääk artikli viimase arvelevõtu hinna', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 40, B), cntM('c', '2026-02-01', 5)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 5, amount: 20 });
    expect(r.lastReceiptUnitCost).toBe(4);
  });

  it('hinnata ülejääk, kui arvelevõttu pole olnud', () => {
    const r = fifoReplay([cntM('c', '2026-02-01', 5)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 5, amount: null });
    expect(r.stock.get(A)).toEqual({ qty: 5, value: 0, unpricedQty: 5, pricedQty: 0 });
  });

  it('ülejääk katab miinusseisu võla ja annab sellele hinna', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10, B), outM('o', '2026-01-05', 4), cntM('c', '2026-02-01', 2)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 6, amount: 6 });
    expect(r.outs.get('o')).toEqual({ cost: 4, unpricedQty: 0, shortageQty: 0, missingQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 2, value: 2, unpricedQty: 0, pricedQty: 2 });
  });

  it('tagantjärele liikumine enne inventuuri muudab vahet, mitte tegelikku seisu', () => {
    const base = [inM('i1', '2026-01-01', 10, 10), cntM('c', '2026-03-01', 10)];
    expect(fifoReplay(base).counts.get('c')!.diffQty).toBe(0);
    const r = fifoReplay([...base, outM('o', '2026-02-01', 3)]);
    expect(r.counts.get('c')!.diffQty).toBe(3);
    expect(r.stock.get(A)!.qty).toBe(10);
  });

  it('vahe 0 ei tekita liikumist', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10), cntM('c', '2026-02-01', 10)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 0, amount: null });
    expect(r.outs.has('c')).toBe(false);
  });

  it('puudujääk ulatub mitme partii üle FIFO järgi', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10), inM('i2', '2026-01-02', 10, 30), cntM('c', '2026-02-01', 5)]);
    expect(r.counts.get('c')!.diffQty).toBe(-15);
    expect(movementCost('OUT', r.outs.get('c'))).toBe(25); // 10×1 + 5×3
    expect(r.stock.get(A)).toEqual({ qty: 5, value: 15, unpricedQty: 0, pricedQty: 5 });
  });

  it('viimane sissetulek loeb; ülekanne ei lähe sissetulekuna arvesse', () => {
    const r = fifoReplay([
      inM('i1', '2026-01-01', 10, 10, B), // 1 €
      inM('i2', '2026-01-02', 10, 50, B), // 5 €
      trM('t', '2026-01-03', 10, B, 'wh-c'),
      cntM('c', '2026-02-01', 2)
    ]);
    expect(r.counts.get('c')).toEqual({ diffQty: 2, amount: 10 }); // 2×5
    expect(r.lastReceiptUnitCost).toBe(5);
  });

  it('hindamata laos olev puudujääk jääb hindamata', () => {
    const r = fifoReplay([cntM('c0', '2026-01-01', 5), cntM('c1', '2026-02-01', 2)]);
    expect(r.counts.get('c1')!.diffQty).toBe(-3);
    expect(movementCost('OUT', r.outs.get('c1'))).toBeNull();
    expect(r.stock.get(A)!.unpricedQty).toBe(2);
  });

  it('sama päeva väljaminek loeb arvestuslikku seisu', () => {
    const r = fifoReplay([inM('i1', '2026-03-01', 10, 10), outM('o', '2026-03-01', 4), cntM('c', '2026-03-01', 6)]);
    expect(r.counts.get('c')!.diffQty).toBe(0);
  });
});

describe('stockAtDate', () => {
  const ms = [inM('i1', '2026-01-01', 10, 20), outM('o1', '2026-02-01', 4), inM('i2', '2026-03-01', 5, 50, B)];
  it('seis kuupäeval (kaasa arvatud) ja ülejäägi hind', () => {
    expect(stockAtDate(ms, A, '2026-02-01')).toEqual({ touched: true, qty: 6, surplusUnitCost: 2 });
    expect(stockAtDate(ms, A, '2026-01-31')).toEqual({ touched: true, qty: 10, surplusUnitCost: 2 });
  });
  it('välistatud liikumised ei loe; puutumata ladu', () => {
    expect(stockAtDate(ms, A, '2026-12-31', new Set(['o1'])).qty).toBe(10);
    expect(stockAtDate(ms, 'wh-c', '2026-12-31')).toEqual({ touched: false, qty: 0, surplusUnitCost: 10 });
  });
});

describe('hinnata sissetulek (kaalumine)', () => {
  const inU = (ref: string, date: string, quantity: number, warehouseId = A): Movement => ({ ref, date, seq: seq++, kind: 'IN', warehouseId, quantity });
  it('summata sissetulek on hinnata partii ega muuda viimase arvelevõtu hinda', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 5, 10), inU('w1', '2026-02-01', 10), outM('o1', '2026-03-01', 8)]);
    expect(r.outs.get('o1')).toEqual({ cost: 10, unpricedQty: 3, shortageQty: 0, missingQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 7, value: 0, unpricedQty: 7, pricedQty: 0 });
    expect(r.lastReceiptUnitCost).toBe(2);
  });
});
