import { describe, it, expect } from 'vitest';
import { deleteOrder } from './tenantDelete';

describe('deleteOrder', () => {
  it('RESTRICT-seose laps enne vanemat; CASCADE ja SET NULL ei mõjuta', () => {
    const order = deleteOrder(['articles', 'categories', 'lines', 'parties'], [
      { child: 'articles', parent: 'categories', onDelete: 'r' },
      { child: 'lines', parent: 'articles', onDelete: 'a' },
      { child: 'parties', parent: 'articles', onDelete: 'n' },
      { child: 'articles', parent: 'parties', onDelete: 'n' }
    ]);
    expect(order.indexOf('lines')).toBeLessThan(order.indexOf('articles'));
    expect(order.indexOf('articles')).toBeLessThan(order.indexOf('categories'));
    expect(order).toHaveLength(4);
  });

  it('ignoreerib väliseid tabeleid ja eneseviidet; tsükkel annab vea', () => {
    expect(deleteOrder(['a'], [{ child: 'a', parent: 'a', onDelete: 'r' }, { child: 'x', parent: 'a', onDelete: 'r' }])).toEqual(['a']);
    expect(() => deleteOrder(['a', 'b'], [{ child: 'a', parent: 'b', onDelete: 'r' }, { child: 'b', parent: 'a', onDelete: 'r' }])).toThrow(/tsükkel/);
  });
});
