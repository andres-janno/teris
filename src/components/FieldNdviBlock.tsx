// src/components/FieldNdviBlock.tsx — põllu kaardikaardi NDVI plokk: valitud satelliidipäeva keskmine ja taimkatte jaotus.
// Arvutus (computeFieldNdvi) käivitub ainult siis, kui plokk on ekraanil (kiht sees ja kuupäev valitud);
// kaardi sulgemine või kuupäeva vahetus tühistab pooleli arvutuse, vana tulemust ei näidata.
import React, { useEffect, useRef, useState } from 'react';
import type { Polygon, MultiPolygon } from 'geojson';
import { Loader2 } from 'lucide-react';
import { NDVI_CLASSES, type NdviSummary } from '../services/ndvi';
import { formatDate } from '../services/dateFormat';
import { formatQty } from '../services/units';
import { LegendItem, SectionTitle } from './ui';
import { loadingSpinnerClass } from './ui/variants';
import { NDVI_TEXT, coverageNote, formatPercent, ndviStateFor, scheduleNdviLoad, type NdviBlockState, type NdviEntry } from './fieldNdviState';

/** Plokk ilma arvutuseta (olek tuleb väljastpoolt) — eraldi, et olekuid saaks serveri-renderdusega testida. */
export const NdviBlockView: React.FC<{ date: string; state: NdviBlockState }> = ({ date, state }) => (
  <div className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="field-ndvi">
    <div className="flex items-center gap-1.5">
      <SectionTitle className="mb-0">{NDVI_TEXT.title}</SectionTitle>
      {state.status === 'loading' && <Loader2 size={12} className={loadingSpinnerClass} role="status" aria-label={NDVI_TEXT.loading} />}
      <span className="ml-auto text-sm tabular-nums text-muted-foreground">{formatDate(date)}</span>
    </div>
    {state.status === 'error' && <p className="m-0 text-sm text-destructive" role="alert">{NDVI_TEXT.error}</p>}
    {state.status === 'cloudy' && <p className="m-0 text-sm text-muted-foreground">{NDVI_TEXT.cloudy}</p>}
    {state.status === 'ready' && <NdviResult summary={state.summary} />}
  </div>
);

const NdviResult: React.FC<{ summary: NdviSummary }> = ({ summary }) => {
  const note = coverageNote(summary);
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums text-foreground">{formatQty(summary.mean)}</span>
        <span className="text-xs text-muted-foreground">{NDVI_TEXT.mean}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-sm bg-muted" title={NDVI_TEXT.barTitle}>
        {NDVI_CLASSES.map((c, i) => summary.classShares[i] > 0 && (
          <span key={c.key} style={{ width: formatPercent(summary.classShares[i]), backgroundColor: c.color }} />
        ))}
      </div>
      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {NDVI_CLASSES.map((c, i) => (
          <div key={c.key} className="flex items-center justify-between gap-2">
            <LegendItem color={c.color} label={c.label} />
            <strong className="tabular-nums text-foreground">{formatPercent(summary.classShares[i])}</strong>
          </div>
        ))}
      </div>
      {note && <p className={summary.coverage < 0.5 ? 'm-0 text-2xs text-warning-text' : 'm-0 text-2xs text-muted-foreground'}>{note}</p>}
      <p className="m-0 text-2xs text-muted-foreground">{NDVI_TEXT.excluded}</p>
    </>
  );
};

/** Põllu kaardi NDVI plokk: `date` on valitud satelliidipäev (ISO); puudub → plokki ei ole. Kutsuja annab `key`-ks põllu id. */
export const FieldNdviBlock: React.FC<{ geometry: Polygon | MultiPolygon; date: string | null }> = ({ geometry, date }) => {
  // Tulemus hoitakse koos päevaga: päeva vahetusel näidatakse laadimist kohe, mitte eelmise päeva tulemust
  const [entry, setEntry] = useState<NdviEntry | null>(null);
  // Geomeetria objekt vahetub andmete uuendamisel ka siis, kui põld on sama; arvutust käivitab ainult päeva vahetus
  // (teise põllu korral ehitatakse plokk `key` järgi uuesti)
  const geometryRef = useRef(geometry);
  useEffect(() => { geometryRef.current = geometry; });

  useEffect(() => {
    if (!date) return;
    return scheduleNdviLoad(geometryRef.current, date, (state) => setEntry({ date, state }));
  }, [date]);

  if (!date) return null;
  return <NdviBlockView date={date} state={ndviStateFor(entry, date)} />;
};
