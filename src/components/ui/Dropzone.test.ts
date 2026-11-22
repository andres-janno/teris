import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dropzone } from './Dropzone';
import { dropzoneClass } from './variants';

type DzProps = { onKeyDown: (e: unknown) => void; className: string; role: string; tabIndex: number };
const propsOf = (p: React.ComponentProps<typeof Dropzone>): DzProps => (Dropzone(p) as React.ReactElement<DzProps>).props;

const keyEvent = (key: string) => {
  const target = { click: vi.fn() };
  const e = { key, target, currentTarget: target, defaultPrevented: false, preventDefault: vi.fn() };
  return { e, target };
};

describe('Dropzone', () => {
  it('on fookustatav nupp: role, tabindex ja data-slot', () => {
    const html = renderToStaticMarkup(React.createElement(Dropzone, null, 'x'));
    expect(html).toContain('data-slot="dropzone"');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });
  it('Enter ja tühik käivitavad klõpsu (failivaliku avamine)', () => {
    for (const key of ['Enter', ' ']) {
      const { e, target } = keyEvent(key);
      propsOf({}).onKeyDown(e);
      expect(target.click, key).toHaveBeenCalledOnce();
    }
  });
  it('muu klahv ei käivita, kutsuja onKeyDown jookseb alati', () => {
    const own = vi.fn();
    const { e, target } = keyEvent('a');
    propsOf({ onKeyDown: own }).onKeyDown(e);
    expect(target.click).not.toHaveBeenCalled();
    expect(own).toHaveBeenCalledOnce();
  });
  it('lohistamise ja valitud faili olek ning kutsuja className liituvad', () => {
    const idle = propsOf({}).className;
    const drag = propsOf({ dragging: true }).className;
    const file = propsOf({ hasFile: true, className: 'mt-3' }).className;
    expect(drag).toContain(dropzoneClass({ dragging: true }).split(' ').find((c) => c.includes('primary'))!);
    expect(drag).not.toBe(idle);
    expect(file).not.toBe(drag);
    expect(file).toContain('mt-3');
  });
});

describe('Dropzone pesastatud laps', () => {
  it('lapse (nt sees olev nupp või väli) Enter/tühik ei käivita kasti klõpsu', () => {
    const own = { click: vi.fn() };
    const child = { click: vi.fn() };
    const e = { key: 'Enter', target: child, currentTarget: own, defaultPrevented: false, preventDefault: vi.fn() };
    propsOf({}).onKeyDown(e);
    expect(own.click).not.toHaveBeenCalled();
    expect(child.click).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
