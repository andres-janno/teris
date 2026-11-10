// Ilmapunktide laadimise olek (ERA5-Land) ja käsitsi uuesti laadimine.
import { useCallback, useEffect, useState } from 'react';
import { platformApi, type WeatherPointRow } from './platformApi.ts';
import { formatDate, formatTallinn } from './format.ts';

type WeatherStatus = { points: WeatherPointRow[]; failWarn: number; keyConfigured: boolean };

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
    <div className="glass-card admin-card">
      <h2>Ilmaandmed (ERA5-Land)</h2>
      {error && <div className="alert-box error">{error}</div>}
      {notice && <div className="alert-box">{notice}</div>}
      {data && !data.keyConfigured && <div className="alert-box error">CDS_API_KEY puudub serveri seadistuses, laadimine ei tööta.</div>}
      {data && data.points.some(warn) && <div className="alert-box warning">Mõne punkti laadimine on ebaõnnestunud {data.failWarn}+ korda järjest.</div>}
      {!data && !error && <div className="admin-muted">Laadin…</div>}
      {data && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Punkt</th>
                <th className="num">Hooaegu</th>
                <th>Andmed</th>
                <th>Viimati õnnestus</th>
                <th className="num">Vigu järjest</th>
                <th>Viga</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.points.map((p) => (
                <tr key={p.id} className={warn(p) ? 'row-warning' : ''}>
                  <td>{p.lat.toFixed(1)}° N, {p.lon.toFixed(1)}° E{p.hasData === false && ' (üle vee, andmeid pole)'}</td>
                  <td className="num">{p.fieldSeasonCount}</td>
                  <td>{p.loadedFrom && p.loadedUntil ? `${formatDate(p.loadedFrom)} – ${formatDate(p.loadedUntil)}` : 'laadimata'}</td>
                  <td>{p.lastSuccessAt ? formatTallinn(p.lastSuccessAt) : '–'}</td>
                  <td className="num">{p.failCount}</td>
                  <td title={p.lastError ?? ''}>{p.lastError ? p.lastError.slice(0, 60) : ''}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy === p.id} onClick={() => void reload(p.id)}>
                      Lae uuesti
                    </button>
                  </td>
                </tr>
              ))}
              {data.points.length === 0 && (
                <tr><td colSpan={7} className="admin-muted">Ilmapunkte pole</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-hint">
        Laadimine käib igal ööl Tallinna aja järgi kella 3 ja 7 vahel (kontroll kord tunnis, iga punkt kuni kord ~20 tunni jooksul). Esialgsed (viimase 90 päeva) andmed laetakse uuesti esmaspäeva öösel. „Lae uuesti“ laeb punkti kohe ja värskendab ka viimased 90 päeva.
      </p>
    </div>
  );
}
