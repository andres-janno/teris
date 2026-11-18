/** Protsent vahemikku 0–100; NaN → 0. Kasutab ProgressBar. */
export const clampPercent = (value: number): number => (Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value)));
