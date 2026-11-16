import { describe, expect, it, vi } from 'vitest';
import { handleActivationKey, type ActivationKeyEvent } from './keyActivation';

const target = {} as EventTarget;
const ev = (key: string, over: Partial<ActivationKeyEvent> = {}): ActivationKeyEvent => {
  const e: ActivationKeyEvent = {
    key, target, currentTarget: target, defaultPrevented: false,
    preventDefault() { e.defaultPrevented = true; }, ...over,
  };
  return e;
};

describe('handleActivationKey', () => {
  it('Enter ja tühik käivitavad ja keelavad vaikimisi tegevuse (lehe kerimine)', () => {
    for (const key of ['Enter', ' ']) {
      const fn = vi.fn();
      const e = ev(key);
      expect(handleActivationKey(e, fn)).toBe(true);
      expect(fn).toHaveBeenCalledOnce();
      expect(e.defaultPrevented).toBe(true);
    }
  });
  it('hoitud klahv (repeat) ja modifikaatorid ei käivita', () => {
    const fn = vi.fn();
    for (const over of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(handleActivationKey(ev('Enter', over), fn)).toBe(false);
    }
    expect(fn).not.toHaveBeenCalled();
  });
  it('muud klahvid ei käivita', () => {
    const fn = vi.fn();
    expect(handleActivationKey(ev('a'), fn)).toBe(false);
    expect(handleActivationKey(ev('Tab'), fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
  it('rea sees oleva nupu/välja Enter ei käivita rida', () => {
    const fn = vi.fn();
    expect(handleActivationKey(ev('Enter', { target: {} as EventTarget }), fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
  it('kutsuja preventDefault eelnevalt → ei käivita', () => {
    const fn = vi.fn();
    expect(handleActivationKey(ev('Enter', { defaultPrevented: true }), fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
