// Ülariba: aegunud litsents (kõigile) või peatne aegumine (adminile)
import type { AuthUser } from '../types/auth';
import { licenseBannerText } from '../services/license';
import { formatDateTimeTallinn } from '../services/dateFormat';
import { Button, cn } from './ui';

// Riba on lehe ülaosas voolus (ei kata midagi), seega pooläbipaistev toonitaust jääb lehe tausta peale nagu vanas tumedas teemas.
const BANNER_CLASS = 'w-full shrink-0 px-4 py-1.5 text-center text-base leading-natural';
const BANNER_TONE = {
  support: 'bg-info/15 text-info-text',
  expired: 'bg-destructive/15 text-danger-text',
  warning: 'bg-warning/15 text-warning-text',
} as const;

// Tugivaate riba: alati nähtav tugivaates, litsentsiriba kohal.
export function SupportBanner({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  if (!user.supportView) return null;
  return (
    <div className={cn(BANNER_CLASS, BANNER_TONE.support)} role="status">
      Tugivaade: {user.tenantName} — ainult lugemiseks, kehtib kuni {formatDateTimeTallinn(user.supportValidUntil)}
      <Button type="button" size="sm" className="ml-3" onClick={onLogout}>
        Lõpeta tugivaade
      </Button>
    </div>
  );
}

export function LicenseBanner({ user }: { user: AuthUser }) {
  const text = licenseBannerText(user.license, user.isAdmin);
  if (!text) return null;
  return (
    <div className={cn(BANNER_CLASS, user.license?.readOnly ? BANNER_TONE.expired : BANNER_TONE.warning)} role="status">
      {text}
    </div>
  );
}
