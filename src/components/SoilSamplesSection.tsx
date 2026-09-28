// src/components/SoilSamplesSection.tsx
// Põllu aknas: mullaproovid, mille GPS-punkt jääb valitud hooaja põllu piiridesse.
import React, { useMemo, useState } from 'react';
import * as turf from '@turf/turf';
import type { Polygon, MultiPolygon } from 'geojson';
import { FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';
import type { SoilSample, SoilSampleMetricKey } from '../types/soilSample';
import { getSoilMetricColor } from '../types/soilSample';

interface SoilSamplesSectionProps {
  geometry: Polygon | MultiPolygon;
  samples: SoilSample[];
}

const METRICS: { key: SoilSampleMetricKey; label: string }[] = [
  { key: 'ph', label: 'pH' },
  { key: 'phosphorus', label: 'P' },
  { key: 'potassium', label: 'K' },
  { key: 'calcium', label: 'Ca' },
  { key: 'magnesium', label: 'Mg' },
  { key: 'organicCarbon', label: 'Corg' },
  { key: 'limeRequirement', label: 'Lubi' }
];

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '–' : String(Math.round(n * 100) / 100).replace('.', ',');

const average = (values: (number | null | undefined)[]): number | null => {
  const nums = values.filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};

const isInside = (s: SoilSample, geometry: Polygon | MultiPolygon) => {
  try {
    return turf.booleanPointInPolygon(turf.point([s.lng, s.lat]), geometry);
  } catch {
    return false; // tühi või vigane geomeetria
  }
};

export const SoilSamplesSection: React.FC<SoilSamplesSectionProps> = ({ geometry, samples }) => {
  const [openYears, setOpenYears] = useState<Set<number>>(new Set());

  const byYear = useMemo(() => {
    const inside = samples.filter((s) => isInside(s, geometry));
    const groups = new Map<number, SoilSample[]>();
    for (const s of inside) {
      const list = groups.get(s.year);
      if (list) list.push(s);
      else groups.set(s.year, [s]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [samples, geometry]);

  const toggleYear = (year: number) =>
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });

  const currentYear = new Date().getFullYear();

  return (
    <div className="detail-section">
      <div className="section-subtitle">
        <FlaskConical size={14} />
        <span>Mullaproovid</span>
      </div>

      {byYear.length === 0 ? (
        <p className="notes-text">Selle põllu piiridesse jäävaid mullaproove pole.</p>
      ) : (
        <div className="soil-table">
          <div className="soil-row soil-row-head">
            <span>Aasta</span>
            <span>Punkte</span>
            {METRICS.map((m) => (
              <span key={m.key}>{m.label}</span>
            ))}
          </div>

          {byYear.map(([year, list]) => {
            const age = currentYear - year;
            const isOpen = openYears.has(year);
            return (
              <React.Fragment key={year}>
                <button type="button" className="soil-row soil-row-year" onClick={() => toggleYear(year)} title="Näita punktide kaupa">
                  <span className="soil-year-cell">
                    {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    {year}
                    {age > 0 && <span className="soil-age" style={{ color: getSoilMetricColor('age', age) }}>{age} a</span>}
                  </span>
                  <span>{list.length}</span>
                  {METRICS.map((m) => {
                    const avg = average(list.map((s) => s[m.key as Exclude<SoilSampleMetricKey, 'age'>]));
                    return (
                      <span key={m.key} className="soil-value" style={{ color: getSoilMetricColor(m.key, avg) }}>
                        {fmt(avg)}
                      </span>
                    );
                  })}
                </button>

                {isOpen &&
                  list.map((s) => (
                    <div key={s.sampleNumber} className="soil-row soil-row-point">
                      <span>Proov {s.sampleNumber}</span>
                      <span />
                      {METRICS.map((m) => {
                        const v = s[m.key as Exclude<SoilSampleMetricKey, 'age'>];
                        return (
                          <span key={m.key} className="soil-value" style={{ color: getSoilMetricColor(m.key, v) }}>
                            {fmt(v)}
                          </span>
                        );
                      })}
                    </div>
                  ))}
              </React.Fragment>
            );
          })}
          <div className="soil-footnote">Keskmised; P, K, Ca, Mg mg/kg · Corg % · lubjatarve t/ha</div>
        </div>
      )}
    </div>
  );
};
