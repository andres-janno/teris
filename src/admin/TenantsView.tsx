import { Alert, Badge, Card, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '../components/ui';
import { useEffect, useState } from 'react';
import { platformApi, type TenantSummary } from './platformApi.ts';
import { LicenseCell } from './LicenseCell.tsx';
import { formatHa, formatTallinn } from './format.ts';
import { adminBadgeTone, adminCardClass, adminH2Class, adminMutedClass, adminToolbarClass } from './adminUi.ts';

export function StatusBadge({ status }: { status: TenantSummary['status'] }) {
  return status === 'ACTIVE' ? <Badge tone={adminBadgeTone('ok')}>Aktiivne</Badge> : <Badge tone={adminBadgeTone('off')}>Peatatud</Badge>;
}

export function TenantsView({ onOpen, onNew, notice }: { onOpen: (id: string) => void; onNew: () => void; notice?: string }) {
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    platformApi
      .listTenants()
      .then((t) => !cancelled && setTenants(t))
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className={adminCardClass}>
      <div className={adminToolbarClass}>
        <h2 className={adminH2Class}>Ettevõtted</h2>
        <Button variant="primary" onClick={onNew}>
          Uus ettevõte
        </Button>
      </div>
      {notice && <Alert>{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {!tenants && !error && <div className={adminMutedClass}>Laadin…</div>}
      {tenants && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nimi</TableHead>
              <TableHead>Registrikood</TableHead>
              <TableHead>Staatus</TableHead>
              <TableHead>Litsents</TableHead>
              <TableHead numeric>Kasutajad</TableHead>
              <TableHead numeric>Põlde</TableHead>
              <TableHead numeric>Pindala (ha)</TableHead>
              <TableHead>Viimane sisselogimine</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id} onClick={() => onOpen(t.id)}>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.registryCode ?? '–'}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell><LicenseCell license={t.license} /></TableCell>
                <TableCell numeric>{t.activeUserCount}/{t.userCount}</TableCell>
                <TableCell numeric>{t.fieldCount}</TableCell>
                <TableCell numeric>{formatHa(t.areaHa)}</TableCell>
                <TableCell>{formatTallinn(t.lastLoginAt)}</TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && (
              <TableEmpty colSpan={8}>Ettevõtteid pole</TableEmpty>
            )}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
