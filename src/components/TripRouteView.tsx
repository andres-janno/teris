// src/components/TripRouteView.tsx — telemeetria sõidu teekond: algus, läbitud kohad ja lõpp.
// Taaskasutatav: compact-režiimis üks rida + "Teekond" lüliti, laiendatult vertikaalne loend.
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { TripRoute, TripStop } from '../types/fieldWork';

interface TripRouteViewProps {
  route: TripRoute;
  compact?: boolean;
  highlightPlaceId?: string;
}

const timeFmt = new Intl.DateTimeFormat('et-EE', { timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit', hour12: false });
const hm = (iso: string) => timeFmt.format(new Date(iso));
const coords = (s: TripStop) => `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`;

function StopLabel({ stop, highlightPlaceId }: { stop: TripStop; highlightPlaceId?: string }) {
  if (!stop.place) {
    return (
      <span className="trip-route-unknown" title={`Koordinaadid: ${coords(stop)}`}>
        tundmatu koht ({coords(stop)})
      </span>
    );
  }
  return <span className={stop.place.id === highlightPlaceId ? 'trip-route-current' : undefined}>{stop.place.label}</span>;
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
    <div className={`trip-route ${compact ? 'compact' : ''}`}>
      {compact && (
        <div className="trip-route-summary">
          <span className="trip-route-line">
            {hm(route.start.time)} <StopLabel stop={route.start} highlightPlaceId={highlightPlaceId} /> → {hm(route.end.time)}{' '}
            <StopLabel stop={route.end} highlightPlaceId={highlightPlaceId} />
          </span>
          <span role="button" tabIndex={0} aria-expanded={expanded} className="trip-route-toggle" onClick={toggle} onKeyDown={onKey}>
            Teekond {expanded ? '▴' : '▾'}
          </span>
        </div>
      )}
      {expanded && (
        <ol className="trip-route-list">
          <li>
            <span className="trip-route-time">{hm(route.start.time)}</span> algus: <StopLabel stop={route.start} highlightPlaceId={highlightPlaceId} />
          </li>
          {route.visits.map((v, i) => (
            <li key={`${v.place.id}-${i}`} className={v.place.id === highlightPlaceId ? 'trip-route-current' : undefined}>
              <span className="trip-route-time">
                {hm(v.arrive)}–{hm(v.leave)}
              </span>{' '}
              {v.place.label}
            </li>
          ))}
          <li>
            <span className="trip-route-time">{hm(route.end.time)}</span> lõpp: <StopLabel stop={route.end} highlightPlaceId={highlightPlaceId} />
          </li>
        </ol>
      )}
    </div>
  );
}
