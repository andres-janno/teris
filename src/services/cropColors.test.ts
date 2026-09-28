import { describe, expect, it } from 'vitest';
import { SPRING_PALETTE, WINTER_PALETTE, pickCropColor } from './cropColors';

describe('pickCropColor', () => {
  it('talivili saab külma, suvivili sooja paleti esimese vaba värvi', () => {
    expect(pickCropColor(true, [])).toBe(WINTER_PALETTE[0]);
    expect(pickCropColor(false, [])).toBe(SPRING_PALETTE[0]);
  });

  it('jätab kasutusel olevad värvid vahele (tõstutundetult)', () => {
    expect(pickCropColor(true, ['#2563EB'])).toBe(WINTER_PALETTE[1]);
    expect(pickCropColor(false, [SPRING_PALETTE[0], SPRING_PALETTE[1]])).toBe(SPRING_PALETTE[2]);
  });

  it('paleti lõppedes genereerib uue värvi, mida pole kasutusel', () => {
    const winter = pickCropColor(true, WINTER_PALETTE);
    expect(winter).toMatch(/^#[0-9a-f]{6}$/);
    expect(WINTER_PALETTE).not.toContain(winter);
    const spring = pickCropColor(false, SPRING_PALETTE);
    expect(SPRING_PALETTE).not.toContain(spring);
  });
});
