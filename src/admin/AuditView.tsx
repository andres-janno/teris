import { useEffect, useState } from 'react';
import { platformApi, type AuditEntry } from './platformApi.ts';
import { formatDate, formatTallinn } from './format.ts';

const ACTIONS: Record<string, string> = {
  TENANT_CREATE: 'Ettevõte loodud',
  LICENSE_UPDATE: 'Litsents muudetud',
  TENANT_SUSPEND: 'Ettevõte peatatud',
  TENANT_ACTIVATE: 'Ettevõte taasaktiveeritud',
  INVITE_RESEND: 'Kutse saadetud uuesti',
  CATALOG_UPDATE: 'Algkataloogi muudatus',
  HELP_UPDATE: 'Juhend muudetud',
  DEVICE_RELEASE: 'Seade vabastatud',
  LOGIN: 'Sisselogimine',
  SUPPORT_SESSION_START: 'Tugivaade avatud',
  PLATFORM_USER_ADD: 'Platvormi kasutaja lisatud',
  PLATFORM_USER_RESET_TOTP: 'Platvormi kasutaja TOTP lähtestatud'
};

const CATALOG_ENTITY: Record<string, string> = { crop: 'Kultuur', variety: 'Sort', workType: 'Tööliik', template: 'Mall' };
const CATALOG_OP: Record<string, string> = { create: 'lisatud', update: 'muudetud', delete: 'kustutatud', replace: 'asendatud' };

function detailsText(e: AuditEntry): string {
  const d = (e.details ?? {}) as Record<string, any>;
  switch (e.action) {
    case 'TENANT_CREATE':
      return `${d.name ?? ''}, admin ${d.adminUsername ?? ''}, kuni ${formatDate(d.validUntil)}`;
    case 'LICENSE_UPDATE':
      return `${d.old ? `kuni ${formatDate(d.old.validUntil)} → ` : ''}kuni ${formatDate(d.new?.validUntil)} (${(d.new?.modules ?? []).join(', ') || 'moodulid puuduvad'})`;
    case 'INVITE_RESEND':
      return `${d.username ?? ''}${d.sent === false ? ' (saatmine ebaõnnestus)' : ''}`;
    case 'PLATFORM_USER_ADD':
    case 'PLATFORM_USER_RESET_TOTP':
      return String(d.username ?? '');
    case 'DEVICE_RELEASE':
      return `${d.kind ?? ''} ${d.identifier ?? ''}`.trim();
    case 'HELP_UPDATE':
      return `${d.key ?? ''}${d.op === 'delete' ? ' (kustutatud)' : ''}`;
    case 'CATALOG_UPDATE':
      return `${CATALOG_ENTITY[d.entity] ?? d.entity ?? ''} ${CATALOG_OP[d.op] ?? d.op ?? ''}: ${d.name ?? ''}`;
    default:
      return '';
  }
}

export function AuditView({ tenantId, tenantNames }: { tenantId?: string; tenantNames?: Map<string, string> }) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(tenantNames ?? new Map());
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    platformApi
      .listAudit(tenantId)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError((err as Error).message));
    if (!tenantId && !tenantNames) {
      platformApi
        .listTenants()
        .then((t) => !cancelled && setNames(new Map(t.map((x) => [x.id, x.name]))))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [tenantId, tenantNames]);

  return (
    <div className="admin-table-wrap">
      {error && <div className="alert-box error">{error}</div>}
      {!rows && !error && <div className="admin-muted">Laadin…</div>}
      {rows && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Aeg</th>
              <th>Tegija</th>
              <th>Tegevus</th>
              {!tenantId && <th>Ettevõte</th>}
              <th>Üksikasjad</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTallinn(r.createdAt)}</td>
                <td>{r.platformUsername ?? '–'}</td>
                <td>{ACTIONS[r.action] ?? r.action}</td>
                {!tenantId && <td>{r.targetTenantId ? names.get(r.targetTenantId) ?? r.targetTenantId : '–'}</td>}
                <td>{detailsText(r)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={tenantId ? 4 : 5} className="admin-muted">Kirjeid pole</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
