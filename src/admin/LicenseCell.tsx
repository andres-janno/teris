import { formatDate } from './format.ts';
import { MODULES, type LicenseInfo } from './platformApi.ts';
import { adminMutedClass } from './adminUi.ts';

const moduleLabel = (id: string) => MODULES.find((m) => m.id === id)?.label ?? id;

/** Litsentsi kokkuvõte: kuni kuupäev (aegunud punane, ≤14 päeva kollane) + moodulid. */
export function LicenseCell({ license }: { license: LicenseInfo }) {
  const cls = license.readOnly ? 'font-semibold text-danger-text' : license.expiresSoon ? 'font-semibold text-warning-text' : '';
  return (
    <div>
      <div className={cls}>
        {license.validUntil ? `kuni ${formatDate(license.validUntil)}` : 'Litsents puudub'}
        {license.readOnly && license.validUntil ? ' (aegunud)' : ''}
      </div>
      <div className={adminMutedClass}>{license.modules.length ? license.modules.map(moduleLabel).join(', ') : 'Moodulid puuduvad'}</div>
    </div>
  );
}
