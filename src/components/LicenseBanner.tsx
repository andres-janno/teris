// Ülariba: aegunud litsents (kõigile) või peatne aegumine (adminile)
import type { AuthUser } from '../types/auth';
import { licenseBannerText } from '../services/license';

export function LicenseBanner({ user }: { user: AuthUser }) {
  const text = licenseBannerText(user.license, user.isAdmin);
  if (!text) return null;
  return (
    <div className={`license-banner ${user.license.readOnly ? 'expired' : 'warning'}`} role="status">
      {text}
    </div>
  );
}
