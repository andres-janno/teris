// Ilmapunktide laadimise olek (ERA5-Land) ja käsitsi uuesti laadimine.
import { Alert, Card, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '../components/ui';
import { useCallback, useEffect, useState } from 'react';
import { platformApi, type WeatherPointRow } from './platformApi.ts';
import { formatDate, formatTallinn } from './format.ts';
import { adminCardClass, adminH2Class, adminHintClass, adminMutedClass } from './adminUi.ts';

type WeatherStatus = { points: WeatherPointRow[]; failWarn: number; tenantsWithKey: number };

export function WeatherAdminView() {
  const [data, setData] = useState<WeatherStatus | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await platformApi.weatherStatus());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = async (id: number) => {
    setBusy(id);
    setNotice('');
    try {
      await platformApi.reloadWeatherPoint(id);
      setNotice('Laadimine käivitatud, olek uueneb mõne sekundi pärast');
      setError('');
      setTimeout(() => void load(), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const warn = (p: WeatherPointRow) => !!data && p.failCount >= data.failWarn;

  return (
    <Card className={adminCardClass}>
      <h2 className={adminH2Class}>Ilmaandmed (ERA5-Land)</h2>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}
      {data && data.tenantsWithKey === 0 && <Alert tone="error">Ühelgi ettevõttel pole Copernicuse (CDS) võtit, ilmaandmeid ei laeta. Võtme lisab ettevõtte administraator menüüs „Ilmaandmete ühendus“.</Alert>}
      {data && data.points.some(warn) && <Alert tone="warning">Mõne punkti laadimine on ebaõnnestunud {data.failWarn}+ korda järjest.</Alert>}
      {!data && !error && <div className={adminMutedClass}>Laadin…</div>}
      {data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Punkt</TableHead>
              <TableHead numeric>Hooaegu</TableHead>
              <TableHead>Võti</TableHead>
              <TableHead>Andmed</TableHead>
              <TableHead>Viimati õnnestus</TableHead>
              <TableHead numeric>Vigu järjest</TableHead>
              <TableHead>Viga</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.points.map((p) => (
              <TableRow key={p.id} tone={warn(p) ? 'warning' : undefined}>
                <TableCell>{p.lat.toFixed(1)}° N, {p.lon.toFixed(1)}° E{p.hasData === false && ' (üle vee, andmeid pole)'}</TableCell>
                <TableCell numeric>{p.fieldSeasonCount}</TableCell>
                <TableCell>{p.keyTenant ?? <span className="font-semibold text-warning-text">puudub</span>}</TableCell>
                <TableCell>{p.loadedFrom && p.loadedUntil ? `${formatDate(p.loadedFrom)} – ${formatDate(p.loadedUntil)}` : 'laadimata'}</TableCell>
                <TableCell>{p.lastSuccessAt ? formatTallinn(p.lastSuccessAt) : '–'}</TableCell>
                <TableCell numeric>{p.failCount}</TableCell>
                <TableCell title={p.lastError ?? ''}>{p.lastError ? p.lastError.slice(0, 60) : ''}</TableCell>
                <TableCell>
                  <Button size="sm" disabled={busy === p.id} onClick={() => void reload(p.id)}>
                    Lae uuesti
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data.points.length === 0 && (
              <TableEmpty colSpan={8}>Ilmapunkte pole</TableEmpty>
            )}
          </TableBody>
        </Table>
      )}
      <p className={adminHintClass}>
        Laadimine käib igal ööl Tallinna aja järgi kella 3 ja 7 vahel (kontroll kord tunnis, iga punkt kuni kord ~20 tunni jooksul). Esialgsed (viimase 90 päeva) andmed laetakse uuesti esmaspäeva öösel. „Lae uuesti“ laeb punkti kohe ja värskendab ka viimased 90 päeva.
      </p>
    </Card>
  );
}
