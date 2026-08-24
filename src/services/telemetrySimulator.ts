import type { CultivationPass } from '../types/telemetry';
import { generateCultivationPolygon } from './geometryEngine';

export class TelemetrySimulator {
  private fullPass: CultivationPass;
  private currentPointIndex: number = 0;
  private isPlaying: boolean = false;
  private playbackSpeed: number = 2; // 2x default
  private timerId: number | null = null;
  private onUpdateCallback: ((currentPass: CultivationPass, activeVehiclePosition: [number, number], heading: number, speed: number, isWorking: boolean) => void) | null = null;

  constructor(fullPass: CultivationPass) {
    this.fullPass = fullPass;
    this.currentPointIndex = Math.min(Math.floor(fullPass.points.length * 0.75), fullPass.points.length - 1);
  }

  public setOnUpdate(callback: (currentPass: CultivationPass, activeVehiclePosition: [number, number], heading: number, speed: number, isWorking: boolean) => void) {
    this.onUpdateCallback = callback;
  }

  public getProgress(): number {
    if (this.fullPass.points.length === 0) return 0;
    return (this.currentPointIndex / (this.fullPass.points.length - 1)) * 100;
  }

  public setProgress(pct: number) {
    const targetIdx = Math.round((pct / 100) * (this.fullPass.points.length - 1));
    this.currentPointIndex = Math.max(0, Math.min(this.fullPass.points.length - 1, targetIdx));
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
      this.currentPointIndex = 0;
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
