import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';
import type { CultivationPass } from '../types/telemetry';
import { generateCultivationPolygon } from './geometryEngine';

// Mitu punkti ühte geomeetriaplokki koondatakse. Lõpetatud plokid liidetakse
// ühendpolügooni ainult üks kord, nii et taasesituse samm ei arvuta kogu rada uuesti.
const SWATH_BLOCK_SIZE = 50;

export class TelemetrySimulator {
  private fullPass: CultivationPass;
  private currentPointIndex: number = 0;
  private startPointIndex: number = 0;
  private isPlaying: boolean = false;
  private playbackSpeed: number = 2; // 2x default
  private timerId: number | null = null;
  // Inkrementaalne harimisala vahemälu
  private cumulativeDistanceKm: number[] = [];
  private mergedSwath: Feature<Polygon | MultiPolygon> | null = null;
  private mergedAreaHa = 0;
  private mergedBlockCount = 0;
  private onUpdateCallback: ((currentPass: CultivationPass, activeVehiclePosition: [number, number], heading: number, speed: number, isWorking: boolean) => void) | null = null;

  constructor(fullPass: CultivationPass, initialStartIndex?: number) {
    this.fullPass = fullPass;
    this.cumulativeDistanceKm = new Array(fullPass.points.length).fill(0);
    for (let i = 1; i < fullPass.points.length; i++) {
      const a = fullPass.points[i - 1];
      const b = fullPass.points[i];
      this.cumulativeDistanceKm[i] = this.cumulativeDistanceKm[i - 1]
        + turf.distance([a.lng, a.lat], [b.lng, b.lat], { units: 'kilometers' });
    }
    if (typeof initialStartIndex === 'number' && initialStartIndex >= 0) {
      this.startPointIndex = Math.min(initialStartIndex, Math.max(0, fullPass.points.length - 1));
      this.currentPointIndex = this.startPointIndex;
    } else {
      this.startPointIndex = 0;
      this.currentPointIndex = Math.min(Math.floor(fullPass.points.length * 0.75), Math.max(0, fullPass.points.length - 1));
    }
  }

  public setOnUpdate(callback: (currentPass: CultivationPass, activeVehiclePosition: [number, number], heading: number, speed: number, isWorking: boolean) => void) {
    this.onUpdateCallback = callback;
  }

  public getProgress(): number {
    if (this.fullPass.points.length <= 1) return 0;
    return (this.currentPointIndex / (this.fullPass.points.length - 1)) * 100;
  }

  public setProgress(pct: number) {
    if (this.fullPass.points.length === 0) return;
    const targetIdx = Math.round((pct / 100) * (this.fullPass.points.length - 1));
    this.currentPointIndex = Math.max(0, Math.min(this.fullPass.points.length - 1, targetIdx));
    this.emitCurrentState();
  }

  public getStartTime(): string {
    return this.fullPass.startTime || this.fullPass.points[0]?.timestamp || '';
  }

  public getEndTime(): string {
    return this.fullPass.endTime || this.fullPass.points[this.fullPass.points.length - 1]?.timestamp || '';
  }

  public getCurrentTime(): string {
    return this.fullPass.points[this.currentPointIndex]?.timestamp || '';
  }

  public getFullPass(): CultivationPass {
    return this.fullPass;
  }

  public getStartPointIndex(): number {
    return this.startPointIndex;
  }

  public getCurrentPointIndex(): number {
    return this.currentPointIndex;
  }

  public findPointIndexByTime(timeStr: string): number {
    if (!this.fullPass.points || this.fullPass.points.length === 0) return 0;
    const clean = timeStr.trim();
    if (!clean) return 0;

    // ISO või kuupäevaga formaat (YYYY-MM-DD või T)
    if (clean.includes('-') || clean.includes('T')) {
      const targetMs = new Date(clean).getTime();
      if (!isNaN(targetMs)) {
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < this.fullPass.points.length; i++) {
          const ptMs = new Date(this.fullPass.points[i].timestamp).getTime();
          const diff = Math.abs(ptMs - targetMs);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }
        return closestIdx;
      }
    }

    // HH:mm või HH:mm:ss formaat (nt kohalik kellaaeg)
    const parts = clean.split(':').map((p) => Number(p));
    if (!isNaN(parts[0]) && !isNaN(parts[1])) {
      const targetSec = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < this.fullPass.points.length; i++) {
        const d = new Date(this.fullPass.points[i].timestamp);
        if (isNaN(d.getTime())) continue;
        const ptSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
        const diff = Math.abs(ptSec - targetSec);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      return closestIdx;
    }

    return 0;
  }

  public setPlaybackStartTime(timeStr: string): number {
    const idx = this.findPointIndexByTime(timeStr);
    this.startPointIndex = idx;
    this.currentPointIndex = idx;
    this.emitCurrentState();
    return idx;
  }

  public setPlaybackStartIndex(idx: number) {
    const bounded = Math.max(0, Math.min(this.fullPass.points.length - 1, idx));
    this.startPointIndex = bounded;
    this.currentPointIndex = bounded;
    this.emitCurrentState();
  }

  public reset(toBeginning: boolean = false) {
    this.pause();
    if (toBeginning || this.currentPointIndex === this.startPointIndex) {
      this.currentPointIndex = 0;
      this.startPointIndex = 0;
    } else {
      this.currentPointIndex = this.startPointIndex;
    }
    this.emitCurrentState();
  }

  public setPlaybackSpeed(speed: number) {
    this.playbackSpeed = speed;
    if (this.isPlaying) {
      this.stopTimer();
      this.startTimer();
    }
  }

  public getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  public play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    if (this.currentPointIndex >= this.fullPass.points.length - 1) {
      this.currentPointIndex = this.startPointIndex;
    }
    this.startTimer();
  }

  public pause() {
    this.isPlaying = false;
    this.stopTimer();
  }

  public togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Järgmine samm ajastatakse alles pärast eelmise lõppu (mitte setInterval), et aeglase
  // sammu korral ei kuhjuks sammud järjekorda ja brauser saaks vahepeal kasutaja sisendit töödelda.
  private startTimer() {
    const intervalMs = Math.max(50, 400 / this.playbackSpeed);
    const tick = () => {
      if (!this.isPlaying) return;
      if (this.currentPointIndex < this.fullPass.points.length - 1) {
        this.currentPointIndex++;
        this.emitCurrentState();
        if (this.isPlaying) this.timerId = window.setTimeout(tick, intervalMs);
      } else {
        this.pause();
      }
    };
    this.timerId = window.setTimeout(tick, intervalMs);
  }

  private stopTimer() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /** Ploki b harimisala punktideni [b * SWATH_BLOCK_SIZE, endIdx] (lõpp-punkt jagatakse järgmise plokiga). */
  private buildBlockSwath(block: number, endIdx: number): Feature<Polygon | MultiPolygon> | null {
    const startIdx = block * SWATH_BLOCK_SIZE;
    if (endIdx <= startIdx) return null;
    const swath = generateCultivationPolygon(this.fullPass.points.slice(startIdx, endIdx + 1)).swathPolygon;
    // Ühtne ringide suund (välimine CCW, augud CW), et nonzero-täide ei teeks ülekatetesse auke
    return swath ? turf.rewind(swath, { mutate: true }) as Feature<Polygon | MultiPolygon> : null;
  }

  /** Liidab ühendpolügooni kõik plokid, mis on punktiks idx lõpetatud. Tagasikerimisel alustab nullist. */
  private advanceMergedSwath(idx: number) {
    const completedBlocks = Math.floor(idx / SWATH_BLOCK_SIZE);
    if (completedBlocks < this.mergedBlockCount) {
      this.mergedSwath = null;
      this.mergedAreaHa = 0;
      this.mergedBlockCount = 0;
    }
    while (this.mergedBlockCount < completedBlocks) {
      const b = this.mergedBlockCount;
      const blockSwath = this.buildBlockSwath(b, (b + 1) * SWATH_BLOCK_SIZE);
      if (blockSwath) {
        let mergedSwath = this.mergedSwath ?? blockSwath;
        if (this.mergedSwath) {
          try {
            const merged = turf.union(turf.featureCollection([this.mergedSwath, blockSwath]));
            if (merged) mergedSwath = turf.rewind(merged, { mutate: true }) as Feature<Polygon | MultiPolygon>;
          } catch (e) {
            // Keeruliste iselõikumiste korral jätka eelmise ühendiga
          }
        }
        this.mergedSwath = mergedSwath;
        this.mergedAreaHa = turf.area(mergedSwath) / 10000;
      }
      this.mergedBlockCount++;
    }
  }

  public emitCurrentState() {
    const idx = this.currentPointIndex;
    const currentPoints = this.fullPass.points.slice(0, idx + 1);
    const activePoint = this.fullPass.points[idx] || this.fullPass.points[0];

    this.advanceMergedSwath(idx);
    const openSwath = this.buildBlockSwath(this.mergedBlockCount, idx);

    // Lõpetatud ühend + pooleli plokk kuvatakse ühe MultiPolygonina (kaardil nonzero täitereegliga).
    // Pindala on kahe osa summa; nende väike ülekate liidetakse alles ploki lõppedes täpselt.
    let swathPolygon: Feature<Polygon | MultiPolygon> | null = this.mergedSwath;
    let workedAreaHa = this.mergedAreaHa;
    if (openSwath) {
      workedAreaHa += turf.area(openSwath) / 10000;
      if (swathPolygon) {
        const polygonsOf = (f: Feature<Polygon | MultiPolygon>): Position[][][] =>
          f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        swathPolygon = turf.multiPolygon([...polygonsOf(swathPolygon), ...polygonsOf(openSwath)]);
      } else {
        swathPolygon = openSwath;
      }
    }

    const trailLine = currentPoints.length >= 2
      ? turf.lineString(currentPoints.map((p) => [p.lng, p.lat]))
      : null;

    const updatedPass: CultivationPass = {
      ...this.fullPass,
      points: currentPoints,
      swathPolygon: swathPolygon || undefined,
      trailLine: trailLine || undefined,
      distanceKm: Math.round((this.cumulativeDistanceKm[idx] ?? 0) * 100) / 100,
      workedAreaHa: Math.round(workedAreaHa * 100) / 100
    };

    if (this.onUpdateCallback && activePoint) {
      this.onUpdateCallback(
        updatedPass,
        [activePoint.lat, activePoint.lng],
        activePoint.heading,
        activePoint.speedKmH,
        activePoint.isWorking
      );
    }
  }

  public destroy() {
    this.stopTimer();
    this.onUpdateCallback = null;
  }
}

/** Kogu läbisõidu valmis harimisala, rada, pindala ja vahemaa (sama arvutus mis taasesituse lõpus). */
export function buildCompletedPass(pass: CultivationPass): CultivationPass {
  const sim = new TelemetrySimulator(pass, 0);
  let completed = pass;
  sim.setOnUpdate((updatedPass) => { completed = updatedPass; });
  sim.setProgress(100);
  sim.destroy();
  return completed;
}
