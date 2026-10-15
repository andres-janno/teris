// src/services/license.ts — ettevõtte litsents kliendis (moodulite nähtavus, ülariba tekst)
import type { AuthUser, AuthLicense, LicenseModule } from '../types/auth';
import { formatDate } from './dateFormat';

export function hasModule(user: AuthUser | null, m: LicenseModule): boolean {
  return !!user && user.license.modules.includes(m);
}

export function licenseBannerText(license: AuthLicense, isAdmin: boolean): string | null {
  if (license.readOnly) {
    return license.validUntil
      ? `Litsents aegus ${formatDate(license.validUntil)}. Andmed on ainult lugemiseks — pikendamiseks võtke ühendust teenusepakkujaga.`
      : 'Ettevõttel puudub kehtiv litsents. Andmed on ainult lugemiseks — võtke ühendust teenusepakkujaga.';
  }
  if (license.expiresSoon && isAdmin && license.validUntil) {
    return `Litsents aegub ${formatDate(license.validUntil)}. Pikendamiseks võtke ühendust teenusepakkujaga.`;
  }
  return null;
}
