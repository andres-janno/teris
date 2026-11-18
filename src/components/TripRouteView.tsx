// src/components/TripRouteView.tsx — telemeetria sõidu teekond: algus, läbitud kohad ja lõpp.
// Taaskasutatav: compact-režiimis üks rida + "Teekond" lüliti, laiendatult vertikaalne loend.
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { TripRoute, TripStop } from '../types/fieldWork';
import { cn } from './ui';

interface TripRouteViewProps {
  route: TripRoute;
  compact?: boolean;
  highlightPlaceId?: string;
}

const timeFmt = new Intl.DateTimeFormat('et-EE', { timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit', hour12: false });
const hm = (iso: string) => timeFmt.format(new Date(iso));
// Teekond soovituse nupu sees: aktiivne koht rohelisena, tundmatu koht kaldkirjas. Aktiivse koha värv oli --basemap-active-color.
const CURRENT = 'font-medium text-success-text';
const UNKNOWN = 'italic text-subtle';

const coords = (s: TripStop) => `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`;

function StopLabel({ stop, highlightPlaceId }: { stop: TripStop; highlightPlaceId?: string }) {
  if (!stop.place && stop.near) {
    return (
      <span className={UNKNOWN} title={`Koordinaadid: ${coords(stop)}`}>
        {stop.near.label} lähedal ({stop.near.distanceM} m)
      </span>
    );
  }
  if (!stop.place) {
    return (
      <span className={UNKNOWN} title={`Koordinaadid: ${coords(stop)}`}>
        tundmatu koht ({coords(stop)})
      </span>
    );
  }
  return <span className={stop.place.id === highlightPlaceId ? CURRENT : undefined}>{stop.place.label}</span>;
}

export default function TripRouteView({ route, compact = false, highlightPlaceId }: TripRouteViewProps) {
  const [expanded, setExpanded] = useState(!compact);

  // Lüliti asub soovituse nupu sees — klõps ei tohi soovitust valida
  const toggle = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpanded((v) => !v);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') toggle(e);
  };

  return (
    <div className={cn('min-w-0 text-xs leading-natural text-muted-foreground', compact && 'basis-full')}>
      {compact && (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate">
            {hm(route.start.time)} <StopLabel stop={route.start} highlightPlaceId={highlightPlaceId} /> → {hm(route.end.time)}{' '}
            <StopLabel stop={route.end} highlightPlaceId={highlightPlaceId} />
          </span>
          <span role="button" tabIndex={0} aria-expanded={expanded} className="shrink-0 cursor-pointer whitespace-nowrap rounded-sm border border-secondary-border bg-secondary px-1.5 font-medium text-muted-foreground hover:bg-secondary-hover" onClick={toggle} onKeyDown={onKey}>
            Teekond {expanded ? '▴' : '▾'}
          </span>
        </div>
      )}
      {expanded && (
        <ol className="mt-1 flex list-none flex-col gap-0.5 border-l-2 border-border pl-2">
          <li>
            <span className="tabular-nums text-foreground">{hm(route.start.time)}</span> algus: <StopLabel stop={route.start} highlightPlaceId={highlightPlaceId} />
          </li>
          {route.visits.map((v, i) => (
            <li key={`${v.place.id}-${i}`} className={v.place.id === highlightPlaceId ? CURRENT : undefined}>
              <span className="tabular-nums text-foreground">
                {hm(v.arrive)}–{hm(v.leave)}
              </span>{' '}
              {v.place.label}
            </li>
          ))}
          <li>
            <span className="tabular-nums text-foreground">{hm(route.end.time)}</span> lõpp: <StopLabel stop={route.end} highlightPlaceId={highlightPlaceId} />
          </li>
        </ol>
      )}
    </div>
  );
}
