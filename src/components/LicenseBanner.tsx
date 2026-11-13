// Ülariba: aegunud litsents (kõigile) või peatne aegumine (adminile)
import type { AuthUser } from '../types/auth';
import { licenseBannerText } from '../services/license';
import { formatDateTimeTallinn } from '../services/dateFormat';
import { Button } from './ui';

// Tugivaate riba: alati nähtav tugivaates, litsentsiriba kohal.
export function SupportBanner({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  if (!user.supportView) return null;
  return (
    <div className="license-banner support-banner" role="status">
      Tugivaade: {user.tenantName} — ainult lugemiseks, kehtib kuni {formatDateTimeTallinn(user.supportValidUntil)}
      <Button type="button" className="support-banner-end" onClick={onLogout}>
        Lõpeta tugivaade
      </Button>
    </div>
  );
}

export function LicenseBanner({ user }: { user: AuthUser }) {
  const text = licenseBannerText(user.license, user.isAdmin);
  if (!text) return null;
  return (
    <div className={`license-banner ${user.license?.readOnly ? 'expired' : 'warning'}`} role="status">
      {text}
    </div>
  );
}
