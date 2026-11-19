// src/components/SoilSamplesSection.tsx
// Põllu aknas: mullaproovid, mille GPS-punkt jääb valitud hooaja põllu piiridesse.
import React, { useMemo, useState } from 'react';
import * as turf from '@turf/turf';
import type { Polygon, MultiPolygon } from 'geojson';
import { FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';
import type { SoilSample, SoilSampleMetricKey } from '../types/soilSample';
import { getSoilMetricColor, getSoilMetricLevel } from '../types/soilSample';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SectionTitle, soilValueClass, soilFootnoteClass, soilYearCellClass } from './ui';

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
      <SectionTitle>
        <FlaskConical size={14} />
        <span>Mullaproovid</span>
      </SectionTitle>

      {byYear.length === 0 ? (
        <p className="notes-text">Selle põllu piiridesse jäävaid mullaproove pole.</p>
      ) : (
        <>
          <Table dense bordered>
            <TableHeader>
              <TableRow>
                <TableHead>Aasta</TableHead>
                <TableHead numeric>Punkte</TableHead>
                {METRICS.map((m) => (
                  <TableHead key={m.key} numeric>{m.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {byYear.map(([year, list]) => {
                const age = currentYear - year;
                const isOpen = openYears.has(year);
                return (
                  <React.Fragment key={year}>
                    <TableRow onClick={() => toggleYear(year)} aria-expanded={isOpen} title="Näita punktide kaupa">
                      <TableCell>
                        <span className={soilYearCellClass}>
                          {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          {year}
                          {age > 0 && (
                            <span className="text-2xs font-normal leading-natural">
                              {age} a<span className="ml-1 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: getSoilMetricColor('age', age) }} />
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell numeric>{list.length}</TableCell>
                      {METRICS.map((m) => {
                        const avg = average(list.map((s) => s[m.key as Exclude<SoilSampleMetricKey, 'age'>]));
                        return (
                          <TableCell key={m.key} numeric className={soilValueClass} data-level={getSoilMetricLevel(m.key, avg)}>
                            {fmt(avg)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {isOpen &&
                      list.map((s) => (
                        <TableRow key={s.sampleNumber} tone="muted">
                          <TableCell>Proov {s.sampleNumber}</TableCell>
                          <TableCell numeric />
                          {METRICS.map((m) => {
                            const v = s[m.key as Exclude<SoilSampleMetricKey, 'age'>];
                            return (
                              <TableCell key={m.key} numeric className={soilValueClass} data-level={getSoilMetricLevel(m.key, v)}>
                                {fmt(v)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          <p className={soilFootnoteClass}>Keskmised; P, K, Ca, Mg mg/kg · Corg % · lubjatarve t/ha</p>
        </>
      )}
    </div>
  );
};
