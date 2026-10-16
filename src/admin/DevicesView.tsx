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
    <div className="glass-card admin-card">
      <h2>Seadmed</h2>
      {error && <div className="alert-box error">{error}</div>}
      {notice && <div className="alert-box">{notice}</div>}
      {!devices && !error && <div className="admin-muted">Laadin…</div>}
      {devices && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ettevõte</th>
                <th>Tüüp</th>
                <th>IMEI / MAC</th>
                <th>Mudel</th>
                <th>Registreeritud alates</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td>{d.tenantName}</td>
                  <td>{TYPE_LABEL[d.connectivityType] ?? d.connectivityType}</td>
                  <td>{[d.imei, d.macAddress].filter(Boolean).join(' / ')}</td>
                  <td>{d.model}</td>
                  <td>{formatTallinn(d.ownership?.validFrom ?? d.createdAt)}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy === d.id} onClick={() => void release(d)}>
                      Vabasta
                    </button>
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr><td colSpan={6} className="admin-muted">Seadmeid pole</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <h3>Viimased registreerimised</h3>
      {regs && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ettevõte</th>
                <th>Tunnus</th>
                <th>Kehtib alates</th>
                <th>Kehtib kuni</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r, i) => (
                <tr key={`${r.identifier}-${r.validFrom}-${i}`}>
                  <td>{r.tenantName}</td>
                  <td>{r.kind} {r.identifier}</td>
                  <td>{formatTallinn(r.validFrom)}</td>
                  <td>{r.validTo ? formatTallinn(r.validTo) : 'kehtib'}</td>
                </tr>
              ))}
              {regs.length === 0 && (
                <tr><td colSpan={4} className="admin-muted">Registreerimisi pole</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
