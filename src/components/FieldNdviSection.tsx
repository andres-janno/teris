// src/components/FieldNdviSection.tsx
// Põllu aknas: valitud satelliidipildi kuupäeva NDVI kokkuvõte (keskmine ja taimkatte jaotus põllul).
import React, { useEffect, useState } from 'react';
import type { Polygon, MultiPolygon } from 'geojson';
import { Satellite, Loader2 } from 'lucide-react';
import { computeFieldNdvi } from '../services/fieldNdvi';
import { NDVI_CLASSES, type NdviSummary } from '../services/ndvi';

interface FieldNdviSectionProps {
  geometry: Polygon | MultiPolygon;
  date: string;
}

const pct = (share: number) => `${Math.round(share * 100)}%`;
const fmtDate = (iso: string) => iso.split('-').reverse().join('.');

export const FieldNdviSection: React.FC<FieldNdviSectionProps> = ({ geometry, date }) => {
  const [state, setState] = useState<{ loading: boolean; summary: NdviSummary | null; error: string | null }>({
    loading: true,
    summary: null,
    error: null
  });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, summary: null, error: null });
    computeFieldNdvi(geometry, date)
      .then((summary) => !cancelled && setState({ loading: false, summary, error: null }))
      .catch((err) => !cancelled && setState({
        loading: false,
        summary: null,
        error: err instanceof Error ? err.message : 'NDVI arvutamine ebaõnnestus'
      }));
    return () => {
      cancelled = true;
    };
  }, [geometry, date]);

  const { loading, summary, error } = state;

  return (
    <div className="detail-section">
      <div className="section-subtitle">
        <Satellite size={14} />
        <span>Taimkate satelliidipildil (NDVI) · {fmtDate(date)}</span>
        {loading && <Loader2 size={12} className="layer-loading-spinner" aria-label="Arvutamine" />}
      </div>

      {error ? (
        <p className="notes-text">{error}</p>
      ) : loading ? null : !summary ? (
        <p className="notes-text">Sel päeval põld pildil ei paista (pilves või satelliidi lennuribast väljas). Vali kaardil teine kuupäev.</p>
      ) : (
        <div className="field-ndvi">
          <div className="field-ndvi-main">
            <span className="field-ndvi-value">{summary.mean.toFixed(2).replace('.', ',')}</span>
            <span className="field-ndvi-caption">keskmine NDVI</span>
          </div>
          <div className="field-ndvi-bar" title="Põllu pinna jaotus taimkatte tiheduse järgi">
            {NDVI_CLASSES.map((c, i) => summary.classShares[i] > 0 && (
              <span key={c.key} style={{ width: pct(summary.classShares[i]), backgroundColor: c.color }} />
            ))}
          </div>
          <div className="field-ndvi-classes">
            {NDVI_CLASSES.map((c, i) => (
              <span key={c.key}>
                <i style={{ backgroundColor: c.color }} />
                {c.label} <strong>{pct(summary.classShares[i])}</strong>
              </span>
            ))}
          </div>
          {summary.coverage < 0.9 && (
            <p className={`field-ndvi-note ${summary.coverage < 0.5 ? 'warn' : ''}`}>
              Arvestatud {pct(summary.coverage)} põllust
              {summary.cloudShare > 0.01 ? `, ${pct(summary.cloudShare)} oli pilves` : ''}
              {summary.coverage < 0.5 ? ' — tulemus pole usaldusväärne.' : '.'}
            </p>
          )}
          <p className="field-ndvi-note">
            Väärtus loetakse Satiladu NDVI pildi värvist (täpsus ~0,01); põllu 10 m serv jäetakse välja.
            Võrdle sama põldu eri kuupäevadel — eri kultuuride NDVI ei ole omavahel võrreldav.
          </p>
        </div>
      )}
    </div>
  );
};
