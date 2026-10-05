import type { CultivationPass } from '../types/telemetry';
import { generateCultivationPolygon } from './geometryEngine';

export class TelemetrySimulator {
  private fullPass: CultivationPass;
  private currentPointIndex: number = 0;
  private startPointIndex: number = 0;
  private isPlaying: boolean = false;
  private playbackSpeed: number = 2; // 2x default
  private timerId: number | null = null;
  private onUpdateCallback: ((currentPass: CultivationPass, activeVehiclePosition: [number, number], heading: number, speed: number, isWorking: boolean) => void) | null = null;

  constructor(fullPass: CultivationPass, initialStartIndex?: number) {
    this.fullPass = fullPass;
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

  private startTimer() {
    const intervalMs = Math.max(50, 400 / this.playbackSpeed);
    this.timerId = window.setInterval(() => {
      if (this.currentPointIndex < this.fullPass.points.length - 1) {
        this.currentPointIndex++;
        this.emitCurrentState();
      } else {
        this.pause();
      }
    }, intervalMs);
  }

  private stopTimer() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public emitCurrentState() {
    const currentPoints = this.fullPass.points.slice(0, this.currentPointIndex + 1);
    const activePoint = this.fullPass.points[this.currentPointIndex] || this.fullPass.points[0];

    const { swathPolygon, trailLine, totalDistanceKm, totalWorkedAreaHa } = generateCultivationPolygon(currentPoints);

    const updatedPass: CultivationPass = {
      ...this.fullPass,
      points: currentPoints,
      swathPolygon: swathPolygon || undefined,
      trailLine: trailLine || undefined,
      distanceKm: totalDistanceKm,
      workedAreaHa: totalWorkedAreaHa
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
