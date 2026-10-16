import { formatDate } from './format.ts';
import { MODULES, type LicenseInfo } from './platformApi.ts';

const moduleLabel = (id: string) => MODULES.find((m) => m.id === id)?.label ?? id;

/** Litsentsi kokkuvõte: kuni kuupäev (aegunud punane, ≤14 päeva kollane) + moodulid. */
export function LicenseCell({ license }: { license: LicenseInfo }) {
  const cls = license.readOnly ? 'admin-expired' : license.expiresSoon ? 'admin-soon' : '';
  return (
    <div>
      <div className={cls}>
        {license.validUntil ? `kuni ${formatDate(license.validUntil)}` : 'Litsents puudub'}
        {license.readOnly && license.validUntil ? ' (aegunud)' : ''}
      </div>
      <div className="admin-muted">{license.modules.length ? license.modules.map(moduleLabel).join(', ') : 'Moodulid puuduvad'}</div>
    </div>
  );
}
