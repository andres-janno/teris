import { Card, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '../components/ui';
import { useCallback, useEffect, useState } from 'react';
import { platformApi, type DeviceRegistration, type DeviceRow } from './platformApi.ts';
import { formatTallinn } from './format.ts';

const TYPE_LABEL: Record<string, string> = { CELLULAR: 'Mobiilsidega', EYE_SENSOR: 'Eye andur' };

export function DevicesView() {
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [regs, setRegs] = useState<DeviceRegistration[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([platformApi.listDevices(), platformApi.listDeviceRegistrations()]);
      setDevices(d);
      setRegs(r);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const release = async (d: DeviceRow) => {
    if (!window.confirm(`Seade eemaldatakse ettevõtte ${d.tenantName} registrist ja selle andmed muutuvad uuele omanikule nähtavaks alates uuest registreerimisest. Jätkata?`)) return;
    setBusy(d.id);
    setNotice('');
    try {
      await platformApi.releaseDevice(d.id);
      setNotice('Seade vabastatud');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Card className="admin-card">
      <h2>Seadmed</h2>
      {error && <div className="alert-box error">{error}</div>}
      {notice && <div className="alert-box">{notice}</div>}
      {!devices && !error && <div className="admin-muted">Laadin…</div>}
      {devices && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ettevõte</TableHead>
              <TableHead>Tüüp</TableHead>
              <TableHead>IMEI / MAC</TableHead>
              <TableHead>Mudel</TableHead>
              <TableHead>Registreeritud alates</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.tenantName}</TableCell>
                <TableCell>{TYPE_LABEL[d.connectivityType] ?? d.connectivityType}</TableCell>
                <TableCell>{[d.imei, d.macAddress].filter(Boolean).join(' / ')}</TableCell>
                <TableCell>{d.model}</TableCell>
                <TableCell>{formatTallinn(d.ownership?.validFrom ?? d.createdAt)}</TableCell>
                <TableCell>
                  <Button size="sm" disabled={busy === d.id} onClick={() => void release(d)}>
                    Vabasta
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {devices.length === 0 && (
              <TableEmpty colSpan={6}>Seadmeid pole</TableEmpty>
            )}
          </TableBody>
        </Table>
      )}
      <h3>Viimased registreerimised</h3>
      {regs && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ettevõte</TableHead>
              <TableHead>Tunnus</TableHead>
              <TableHead>Kehtib alates</TableHead>
              <TableHead>Kehtib kuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regs.map((r, i) => (
              <TableRow key={`${r.identifier}-${r.validFrom}-${i}`}>
                <TableCell>{r.tenantName}</TableCell>
                <TableCell>{r.kind} {r.identifier}</TableCell>
                <TableCell>{formatTallinn(r.validFrom)}</TableCell>
                <TableCell>{r.validTo ? formatTallinn(r.validTo) : 'kehtib'}</TableCell>
              </TableRow>
            ))}
            {regs.length === 0 && (
              <TableEmpty colSpan={4}>Registreerimisi pole</TableEmpty>
            )}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
