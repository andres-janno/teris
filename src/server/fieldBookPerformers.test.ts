import { describe, it, expect } from 'vitest';
import { resolveMissingPerformers, type PartyClientLike } from './fieldBookPerformers';

// Mälupõhine isikute register: ei puuduta andmebaasi
function fakeClient(initial: { id: string; name: string }[] = [], failOnCreate = 0) {
  const rows = [...initial];
  const created: { name: string; type: string; roles: string[] }[] = [];
  const client: PartyClientLike = {
    relatedParty: {
      findMany: async () => rows.map((r) => ({ ...r })),
      create: async ({ data }) => {
        if (failOnCreate && created.length + 1 === failOnCreate) throw new Error('loomine ebaõnnestus');
        created.push(data);
        const row = { id: `new-${rows.length + 1}`, name: data.name };
        rows.push(row);
        return row;
      }
    }
  };
  return { client, rows, created };
}

const op = (performerName: string | null, performerId: string | null = null) => ({ performerId, performerName, type: 'Kündmine' });
const file = () => [
  { operations: [op('Tamm Mari'), op('Kask Jüri'), op(null)] },
  { operations: [op('Mari Tamm'), op('Kask Jüri')] }
];

describe('resolveMissingPerformers', () => {
  it('loob puuduvad teostajad töötajana (DRIVER, eraisik) ja seob tööd nendega', async () => {
    const { client, created } = fakeClient();
    const r = await resolveMissingPerformers(client, file());
    expect(created).toEqual([
      { name: 'Tamm Mari', type: 'PERSON', roles: ['DRIVER'] },
      { name: 'Kask Jüri', type: 'PERSON', roles: ['DRIVER'] }
    ]);
    expect(r.created).toBe(2);
    const ops = r.fields.flatMap((f) => f.operations);
    expect(ops[0].performerId).toBe('new-1');
    expect(ops[1].performerId).toBe('new-2');
    expect(ops[2].performerId).toBeNull();
    // sama inimene teises nimejärjekorras ei tekita topeltisikut
    expect(ops[3].performerId).toBe('new-1');
    expect(ops[4].performerId).toBe('new-2');
  });

  it('kordusimport: registris olevaid ei lisata uuesti', async () => {
    const { client, rows, created } = fakeClient();
    await resolveMissingPerformers(client, file());
    const again = await resolveMissingPerformers(client, file());
    expect(again.created).toBe(0);
    expect(created).toHaveLength(2);
    expect(rows).toHaveLength(2);
    expect(again.fields[0].operations[0].performerId).toBe('new-1');
  });

  it('sobitab olemasoleva isiku olenemata rollist ega loo teda uuesti', async () => {
    const { client, created } = fakeClient([{ id: 'p-mari', name: 'Mari Tamm' }]);
    const r = await resolveMissingPerformers(client, [{ operations: [op('Tamm Mari')] }]);
    expect(created).toHaveLength(0);
    expect(r.fields[0].operations[0].performerId).toBe('p-mari');
  });

  it('ilma performerName-ita (märkimata ruut) ei puutu andmebaasi', async () => {
    const { client, created } = fakeClient();
    const input = [{ operations: [op(null), op(null, 'p-1')] }];
    const r = await resolveMissingPerformers(client, input);
    expect(created).toHaveLength(0);
    expect(r.created).toBe(0);
    expect(r.fields[0].operations.map((o) => o.performerId)).toEqual([null, 'p-1']);
  });

  it('loomise viga katkestab (tehing tühistab kogu impordi)', async () => {
    const { client } = fakeClient([], 2);
    await expect(resolveMissingPerformers(client, file())).rejects.toThrow('loomine ebaõnnestus');
  });
});
