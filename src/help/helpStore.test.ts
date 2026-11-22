// Juhendi hoidla: ebaõnnestunud värskendus ei tohi olemasolevat seisu tühjendada.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { peekHelp, reloadHelp } from './helpStore';

const reply = (ok: boolean, body: unknown) => vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response);

describe('reloadHelp', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('õnnestunud laadimine salvestab peatükid ja kohtjuhendid', async () => {
    vi.stubGlobal('fetch', reply(true, { articles: { a: 'x' }, guideLinks: { a: 'guide.fields' }, chapters: { 'guide.fields': '<p>t</p>' } }));
    await reloadHelp();
    expect(peekHelp().chapters).toEqual({ 'guide.fields': '<p>t</p>' });
    expect(peekHelp().loaded).toBe(true);
  });

  it('vigane vastus (500) jätab eelmise seisu alles', async () => {
    vi.stubGlobal('fetch', reply(false, {}));
    await reloadHelp();
    expect(peekHelp().chapters).toEqual({ 'guide.fields': '<p>t</p>' });
    expect(peekHelp().articles).toEqual({ a: 'x' });
  });
});
