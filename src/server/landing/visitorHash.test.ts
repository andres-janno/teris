// src/server/landing/visitorHash.test.ts
import { describe, it, expect } from 'vitest';
import { createVisitorHasher } from './visitorHash.ts';

describe('createVisitorHasher', () => {
  it('stabiilne päeva sees, uus sool järgmisel Tallinna päeval', () => {
    let now = new Date('2026-10-19T10:00:00Z');
    let n = 0;
    const hash = createVisitorHasher(() => now, () => Buffer.alloc(32, ++n));
    const a = hash('1.2.3.4', 'UA');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(hash('1.2.3.4', 'UA')).toBe(a);
    expect(hash('1.2.3.5', 'UA')).not.toBe(a);
    now = new Date('2026-10-19T20:59:00Z'); // Tallinnas 23:59
    expect(hash('1.2.3.4', 'UA')).toBe(a);
    now = new Date('2026-10-19T21:01:00Z'); // Tallinnas järgmine päev
    expect(hash('1.2.3.4', 'UA')).not.toBe(a);
  });
  it('räsi ei sisalda IP-d', () => {
    const hash = createVisitorHasher(() => new Date(), () => Buffer.alloc(32, 7));
    expect(hash('10.0.0.1', 'UA')).not.toContain('10.0.0.1');
  });
});
