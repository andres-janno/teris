// src/admin/LandingStatsView.tsx — landing'u külastused, allikad, robotid ja lehter valitud perioodil.
import { useEffect, useState } from 'react';
import { platformApi, type LandingStats } from './platformApi.ts';
import { DateInput } from '../components/DateInput.tsx';
import { formatDate, formatTallinn } from './format.ts';

const tallinnDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' }).format(d);
const CLASS_LABELS: Record<string, string> = { ai_bot: 'AI', search_bot: 'Otsing', other_bot: 'Muu' };
const DEVICE_LABELS: Record<string, string> = { desktop: 'Arvuti', mobile: 'Telefon', tablet: 'Tahvel' };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '–');

export function LandingStatsView() {
  const [from, setFrom] = useState(() => tallinnDay(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => tallinnDay(new Date()));
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setError('');
    platformApi
      .landingStats(from, to)
      .then((s) => !cancelled && setStats(s))
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const totalVisitors = stats?.daily.reduce((s, d) => s + d.visitors, 0) ?? 0;
  const totalViews = stats?.daily.reduce((s, d) => s + d.views, 0) ?? 0;

  return (
    <div className="glass-card admin-card">
      <h2>Landing</h2>
      <div className="admin-filter-row">
        <label htmlFor="ls-from">Alates</label>
        <DateInput id="ls-from" className="form-input" value={from} onChange={setFrom} />
        <label htmlFor="ls-to">Kuni</label>
        <DateInput id="ls-to" className="form-input" value={to} onChange={setTo} />
      </div>
      {error && <div className="alert-box error">{error}</div>}
      {stats && (
        <>
          <div className="admin-stat-row">
            <div className="admin-stat"><span>Külastajad</span><strong>{totalVisitors}</strong></div>
            <div className="admin-stat"><span>Vaatamised</span><strong>{totalViews}</strong></div>
            <div className="admin-stat"><span>„Tunnen huvi“ klõps</span><strong>{stats.funnel.clicked}</strong><small>{pct(stats.funnel.clicked, stats.funnel.viewed)}</small></div>
            <div className="admin-stat"><span>Saadetud vorm</span><strong>{stats.funnel.submitted}</strong><small>{pct(stats.funnel.submitted, stats.funnel.viewed)}</small></div>
          </div>

          <h3>Päevad</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Päev</th><th>Külastajad</th><th>Vaatamised</th></tr></thead>
              <tbody>
                {stats.daily.length === 0 && <tr><td colSpan={3}>Külastusi pole</td></tr>}
                {stats.daily.map((d) => <tr key={d.day}><td>{formatDate(d.day)}</td><td>{d.visitors}</td><td>{d.views}</td></tr>)}
              </tbody>
            </table>
          </div>

          <div className="admin-two-col">
            <div>
              <h3>Allikad</h3>
              <table className="admin-table">
                <thead><tr><th>Allikas</th><th>Külastajad</th></tr></thead>
                <tbody>{stats.sources.map((s) => <tr key={s.source}><td>{s.source}</td><td>{s.visitors}</td></tr>)}</tbody>
              </table>
            </div>
            <div>
              <h3>Seadmed</h3>
              <table className="admin-table">
                <thead><tr><th>Seade</th><th>Külastajad</th></tr></thead>
                <tbody>{stats.devices.map((d) => <tr key={d.device}><td>{DEVICE_LABELS[d.device] ?? d.device}</td><td>{d.visitors}</td></tr>)}</tbody>
              </table>
            </div>
          </div>

          <h3>Robotid ja AI-roomajad</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Tüüp</th><th>Nimi</th><th>Päringuid</th><th>llms.txt</th><th>llms.txt viimati</th><th>Viimati</th></tr></thead>
              <tbody>
                {stats.bots.length === 0 && <tr><td colSpan={6}>Roboteid pole</td></tr>}
                {stats.bots.map((b) => (
                  <tr key={`${b.visitorClass}-${b.botName}`}>
                    <td>{CLASS_LABELS[b.visitorClass] ?? b.visitorClass}</td><td>{b.botName}</td><td>{b.hits}</td><td>{b.llmsTxtHits}</td><td>{b.llmsTxtLastSeen ? formatTallinn(b.llmsTxtLastSeen) : '–'}</td><td>{formatTallinn(b.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
