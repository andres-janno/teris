import { describe, expect, it } from 'vitest';
import { etToIso, isoToEt } from './EtDateInput.tsx';

describe('Eesti kuupäevaformaat', () => {
  it('ISO → pp.kk.aaaa', () => {
    expect(isoToEt('2099-12-31')).toBe('31.12.2099');
    expect(isoToEt('')).toBe('');
  });

  it('pp.kk.aaaa → ISO, ka ühekohalised päev/kuu', () => {
    expect(etToIso('31.12.2099')).toBe('2099-12-31');
    expect(etToIso('1.2.2027')).toBe('2027-02-01');
  });

  it('vigane või olematu kuupäev → null', () => {
    expect(etToIso('31.02.2027')).toBeNull();
    expect(etToIso('2027-02-01')).toBeNull();
    expect(etToIso('12/31/2099')).toBeNull();
    expect(etToIso('')).toBeNull();
  });
});
