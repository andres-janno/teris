// src/admin/LandingStatsView.tsx — landing'u külastused, allikad, robotid ja lehter valitud perioodil.
import { useEffect, useState } from 'react';
import { platformApi, type LandingStats } from './platformApi.ts';
import { Alert, DateInput, Card, StatTile, Button, TableEmpty, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui';
import { formatDate, formatTallinn } from './format.ts';
import { VisitsChart } from './VisitsChart.tsx';

const tallinnDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' }).format(d);
const CLASS_LABELS: Record<string, string> = {
  ai_bot: 'AI', search_bot: 'Otsing', seo_bot: 'SEO', social_bot: 'Lingi eelvaade', script: 'Skript', other_bot: 'Muu'
};
const DEVICE_LABELS: Record<string, string> = { desktop: 'Arvuti', mobile: 'Telefon', tablet: 'Tahvel' };
const daysAgo = (n: number) => tallinnDay(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
// Perioodi kiirvalikud; vaikimisi viimased 30 päeva (täna kaasa arvatud)
const PRESETS = [
  { days: 7, label: '7 päeva' },
  { days: 30, label: '30 päeva' },
  { days: 90, label: '90 päeva' },
  { days: 365, label: '12 kuud' }
];
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '–');

export function LandingStatsView() {
  const [from, setFrom] = useState(() => daysAgo(29));
  const [to, setTo] = useState(() => daysAgo(0));
  const today = daysAgo(0);
  const applyPreset = (days: number) => {
    setFrom(daysAgo(days - 1));
    setTo(today);
  };
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
    <Card className="admin-card">
      <h2>Landing</h2>
      <div className="admin-filter-row">
        <span>Periood</span>
        <div className="admin-preset-group">
          {PRESETS.map((p) => (
            <Button
              key={p.days}
              size="sm"
              variant={to === today && from === daysAgo(p.days - 1) ? 'primary' : 'secondary'}
              onClick={() => applyPreset(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <label htmlFor="ls-from">Alates</label>
        <DateInput id="ls-from" value={from} onChange={setFrom} />
        <label htmlFor="ls-to">Kuni</label>
        <DateInput id="ls-to" value={to} onChange={setTo} />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {stats && (
        <>
          <div className="admin-stat-row">
            <StatTile label="Külastajad" value={totalVisitors} note="Unikaalsed inimesed päeva kaupa (brauser + IP päevase räsina), kelle brauseris leht päriselt avanes. Robotid ei lähe arvesse. Sama inimene eri päevadel loetakse mitu korda." />
            <StatTile label="Vaatamised" value={totalViews} note="Kõik inimeste lehe avamised (avaleht ja privaatsusleht), sh korduvad avamised ja värskendused." />
            <StatTile label="„Tunnen huvi“ klõps" value={stats.funnel.clicked} sub={<>{pct(stats.funnel.clicked, stats.funnel.viewed)} külastajatest</>} note="Külastajad, kes vajutasid vähemalt korra mõnda „Tunnen huvi“ nuppu (päis, hero, sammud, jalus). „Logi sisse“ klõpse ei arvestata." />
            <StatTile label="Saadetud vorm" value={stats.funnel.submitted} sub={<>{pct(stats.funnel.submitted, stats.funnel.viewed)} külastajatest</>} note="Külastajad, kelle „Tunnen huvi“ vormi saatmine õnnestus. Päris päringud on vaates „Huvilised“; spämmifiltri kinni peetud saatmised võivad siin olla, aga seal mitte." />
          </div>

          <h3>Külastajad</h3>
          <VisitsChart daily={stats.daily} from={stats.from.slice(0, 10)} to={stats.to.slice(0, 10)} />
          <details className="admin-details">
            <summary>Näita tabelina</summary>
            <Table>
              <TableHeader><TableRow><TableHead>Päev</TableHead><TableHead numeric>Külastajad</TableHead><TableHead numeric>Vaatamised</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats.daily.length === 0 && <TableEmpty colSpan={3}>Külastusi pole</TableEmpty>}
                {stats.daily.map((d) => <TableRow key={d.day}><TableCell>{formatDate(d.day)}</TableCell><TableCell numeric>{d.visitors}</TableCell><TableCell numeric>{d.views}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </details>

          <div className="admin-two-col">
            <div>
              <h3>Allikad</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Allikas</TableHead><TableHead numeric>Külastajad</TableHead></TableRow></TableHeader>
                <TableBody>{stats.sources.map((s) => <TableRow key={s.source}><TableCell>{s.source}</TableCell><TableCell numeric>{s.visitors}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <div>
              <h3>Seadmed</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Seade</TableHead><TableHead numeric>Külastajad</TableHead></TableRow></TableHeader>
                <TableBody>{stats.devices.map((d) => <TableRow key={d.device}><TableCell>{DEVICE_LABELS[d.device] ?? d.device}</TableCell><TableCell numeric>{d.visitors}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </div>

          <h3>Robotid ja AI-roomajad</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Tüüp</TableHead><TableHead>Nimi</TableHead><TableHead numeric>Päringuid</TableHead><TableHead numeric>llms.txt</TableHead><TableHead>llms.txt viimati</TableHead><TableHead>Viimati</TableHead></TableRow></TableHeader>
            <TableBody>
              {stats.bots.length === 0 && <TableEmpty colSpan={6}>Roboteid pole</TableEmpty>}
              {stats.bots.map((b) => (
                <TableRow key={`${b.visitorClass}-${b.botName}`}>
                  <TableCell>{CLASS_LABELS[b.visitorClass] ?? b.visitorClass}</TableCell><TableCell>{b.botName}</TableCell><TableCell numeric>{b.hits}</TableCell><TableCell numeric>{b.llmsTxtHits}</TableCell><TableCell>{b.llmsTxtLastSeen ? formatTallinn(b.llmsTxtLastSeen) : '–'}</TableCell><TableCell>{formatTallinn(b.lastSeen)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Card>
  );
}
