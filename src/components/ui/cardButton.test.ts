import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardButton } from './Card';

const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(CardButton, props));

describe('CardButton aria-pressed', () => {
  it('selected=true/false annab aria-pressed', () => {
    expect(html({ selected: true })).toContain('aria-pressed="true"');
    expect(html({ selected: false })).toContain('aria-pressed="false"');
  });
  it('selected puudub: aria-pressed puudub', () => {
    expect(html({})).not.toContain('aria-pressed');
  });
  it('kutsuja enda aria-pressed võidab', () => {
    expect(html({ selected: true, 'aria-pressed': false })).toContain('aria-pressed="false"');
  });
});
