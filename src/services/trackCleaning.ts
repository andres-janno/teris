// src/services/trackCleaning.ts
// GPS-jälje puhastus enne harimise taasesitust. Seisva masina GPS hüpleb paar meetrit
// ja kiirus kõigub 0 ja 1 km/h vahel, mistõttu kiiruse järgi määratud "töötab" olek
// lülitub pidevalt ja tekib sadu pisikesi töölõike samasse kohta.
import type { TelemetryPoint } from '../types/telemetry';

const EARTH_RADIUS_M = 6371000;

function distanceM(a: TelemetryPoint, b: TelemetryPoint): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface TrackCleaningOptions {
  /** Punkt jäetakse vahele, kui see on viimasest säilitatud punktist lähemal (meetrites). */
  minStepM?: number;
  /** Töölõik, mille läbitud teepikkus on sellest lühem, loetakse mitte-töötavaks (meetrites). */
  minWorkRunM?: number;
}

export function cleanTrack(points: TelemetryPoint[], options: TrackCleaningOptions = {}): TelemetryPoint[] {
  const { minStepM = 2, minWorkRunM = 10 } = options;
  if (points.length <= 2) return points;

  // 1. Seismise müra välja: säilita punkt ainult siis, kui masin on vahepeal liikunud.
  //    Viimane punkt jääb alati alles, et taasesitus lõppeks masina tegelikus asukohas.
  const kept: TelemetryPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (distanceM(kept[kept.length - 1], points[i]) >= minStepM) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);

  // 2. Lühikesed töölõigud (nt kiiruse kõikumine paigal seistes) märgitakse mitte-töötavaks.
  const result = kept.slice();
  let runStart = -1;
  let runLengthM = 0;
  const closeRun = (endExclusive: number) => {
    if (runStart < 0) return;
    if (runLengthM < minWorkRunM) {
      for (let j = runStart; j < endExclusive; j++) result[j] = { ...result[j], isWorking: false };
    }
    runStart = -1;
    runLengthM = 0;
  };
  for (let i = 0; i < kept.length; i++) {
    if (kept[i].isWorking) {
      if (runStart < 0) runStart = i;
      else runLengthM += distanceM(kept[i - 1], kept[i]);
    } else {
      closeRun(i);
    }
  }
  closeRun(kept.length);

  return result;
}
