import type { Scene, SpatialObject } from "./types";

export interface GateConfig {
  /** Never go longer than this without a fresh segmentation. */
  maxSkipMs: number;
  /** Frame-to-frame motion that forces a re-segment. */
  motionThreshold: number;
  /** Ignore tiny jitter so a hand crossing the frame does not thrash the API. */
  deadzone: number;
}

export const DEFAULT_GATE: GateConfig = { maxSkipMs: 1_200, motionThreshold: 0.06, deadzone: 0.01 };

interface Signature {
  count: number;
  meanX: number;
  meanY: number;
  meanArea: number;
}

function signatureOf(objects: SpatialObject[]): Signature | null {
  if (objects.length === 0) return null;
  return {
    count: objects.length,
    meanX: objects.reduce((s, o) => s + o.bbox.x + o.bbox.w / 2, 0) / objects.length,
    meanY: objects.reduce((s, o) => s + o.bbox.y + o.bbox.h / 2, 0) / objects.length,
    meanArea: objects.reduce((s, o) => s + o.areaRatio, 0) / objects.length,
  };
}

function distance(a: Signature, b: Signature): number {
  // Object-count change is the strongest signal, so it is weighted hardest.
  const countDelta = Math.abs(a.count - b.count) * 0.15;
  const shift = Math.hypot(a.meanX - b.meanX, a.meanY - b.meanY);
  const scale = Math.abs(a.meanArea - b.meanArea);
  return countDelta + shift + scale;
}

/**
 * Segmentation is the expensive call. Rather than running it every frame at a fixed rate,
 * we run it when the tracked scene actually changed, or when we have been coasting on stale
 * masks for too long. This is what buys the latency budget for a usable live loop.
 */
export class KeyframeGate {
  private last: Signature | null = null;
  private lastRunAt = -Infinity;

  constructor(private cfg: GateConfig = DEFAULT_GATE) {}

  reset(): void {
    this.last = null;
    this.lastRunAt = -Infinity;
  }

  shouldSegment(nowMs: number, tracked: SpatialObject[]): boolean {
    if (nowMs - this.lastRunAt >= this.cfg.maxSkipMs) return true;
    const next = signatureOf(tracked);
    if (next === null) return this.last !== null;
    if (this.last === null) return true;
    const d = distance(this.last, next);
    return d > this.cfg.motionThreshold + this.cfg.deadzone;
  }

  markRun(nowMs: number, objects: SpatialObject[]): void {
    this.lastRunAt = nowMs;
    this.last = signatureOf(objects);
  }
}

/** Frame-drop guard: never queue more than one in-flight request. */
export function frameBudget(inFlight: boolean, lastFrameAt: number, nowMs: number, minIntervalMs: number) {
  if (inFlight) return "skip: request in flight";
  if (nowMs - lastFrameAt < minIntervalMs) return "skip: budget";
  return "run";
}

export type { Scene };
