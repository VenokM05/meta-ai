import { CONCEPTS_BY_ID } from "./vocabulary";
import type { Detection, DistanceBand, HazardTier, Scene, SpatialObject } from "./types";

export interface CameraModel {
  /** Horizontal field of view, degrees. Typical laptop/phone camera is 60-70. */
  hfovDeg: number;
  /** Vertical field of view, degrees. Drives the pinhole focal length. */
  vfovDeg: number;
  /** Half-angle of the forward walking corridor, degrees. */
  pathHalfWidthDeg: number;
  /** Normalised frame row at/below which a mask bottom edge counts as ground level. */
  groundRowThreshold: number;
}

export const DEFAULT_CAMERA: CameraModel = {
  hfovDeg: 65,
  vfovDeg: 50,
  pathHalfWidthDeg: 12,
  groundRowThreshold: 0.62,
};

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/** Focal length expressed in normalised-frame units (frame height = 1). */
function focalUnits(cam: CameraModel): number {
  return 0.5 / Math.tan(rad(cam.vfovDeg) / 2);
}

function bearingOf(cx: number, cam: CameraModel): number {
  return (cx - 0.5) * cam.hfovDeg;
}

function bandOf(distanceM: number | null): DistanceBand {
  if (distanceM === null) return "unknown";
  if (distanceM < 1.5) return "near";
  if (distanceM < 3.5) return "mid";
  return "far";
}

/**
 * Pinhole distance proxy.
 *
 * This is an estimate from apparent size alone, with no depth sensor, so it is wrong
 * whenever the class reference width is wrong. Objects lying flat on the ground are the
 * worst case: perspective foreshortening collapses their apparent height, so we fall
 * back to the square root of mask area and widen the reported uncertainty.
 *
 * Every downstream consumer must treat `distanceM` as a hint for phrasing, never as
 * a measurement. The eval harness reports the error distribution rather than hiding it.
 */
export function estimateDistance(d: Detection, groundLevel: boolean, cam: CameraModel): number | null {
  const spec = CONCEPTS_BY_ID.get(d.concept);
  if (!spec) return null;

  const apparent = groundLevel && d.bbox.h < 0.18 ? Math.max(Math.sqrt(d.areaRatio), 0.02) : d.bbox.h;
  if (apparent <= 0.005) return null;

  const distance = (focalUnits(cam) * spec.referenceWidthM) / apparent;
  if (!Number.isFinite(distance) || distance <= 0 || distance > 40) return null;
  return Math.round(distance * 10) / 10;
}

const TIER_WEIGHT: Record<HazardTier, number> = { critical: 1000, caution: 500, informative: 100 };

function urgencyOf(tier: HazardTier, distanceM: number | null, inPath: boolean, confidence: number): number {
  const proximity = distanceM === null ? 1 : Math.max(0, 4 - distanceM);
  return TIER_WEIGHT[tier] + (inPath ? 200 : 0) + proximity * 60 + confidence * 40;
}

export function toSpatial(d: Detection, cam: CameraModel = DEFAULT_CAMERA): SpatialObject | null {
  const spec = CONCEPTS_BY_ID.get(d.concept);
  if (!spec) return null;
  if (d.confidence < spec.minConfidence) return null;

  const cx = d.bbox.x + d.bbox.w / 2;
  const cy = d.bbox.y + d.bbox.h / 2;
  const bottom = d.bbox.y + d.bbox.h;

  const bearingDeg = Math.round(bearingOf(cx, cam) * 10) / 10;
  const groundLevel = bottom >= cam.groundRowThreshold;
  const inPath = Math.abs(bearingDeg) <= cam.pathHalfWidthDeg && cy >= 0.45;
  const distanceM = estimateDistance(d, groundLevel, cam);

  return {
    id: d.id,
    concept: d.concept,
    label: spec.label,
    tier: spec.tier,
    confidence: d.confidence,
    bearingDeg,
    distanceM,
    distanceBand: bandOf(distanceM),
    inPath,
    groundLevel,
    areaRatio: d.areaRatio,
    bbox: d.bbox,
    maskPolygon: d.maskPolygon,
    urgency: urgencyOf(spec.tier, distanceM, inPath, d.confidence),
  };
}

export function sceneToSpatial(scene: Scene, cam: CameraModel = DEFAULT_CAMERA): SpatialObject[] {
  return scene.detections
    .map((d) => toSpatial(d, cam))
    .filter((o): o is SpatialObject => o !== null)
    .sort((a, b) => b.urgency - a.urgency);
}

/** Coarse, honest distance language. Never a precise number — that would over-claim. */
export function distancePhrase(band: DistanceBand, distanceM: number | null): string {
  if (distanceM === null) return "ahead";
  if (distanceM < 0.9) return "at your feet";
  if (distanceM < 1.6) return "one step ahead";
  if (distanceM < 2.6) return "a few steps ahead";
  if (distanceM < 4) return "further ahead";
  return "in the distance";
}

export function bearingPhrase(bearingDeg: number): string {
  const a = Math.abs(bearingDeg);
  if (a < 8) return "straight ahead";
  const side = bearingDeg < 0 ? "left" : "right";
  if (a < 25) return `slightly ${side}`;
  if (a < 45) return `${side}`;
  return `well to your ${side}`;
}

/**
 * The one line the whole product rests on: we describe what was detected, never what
 * was not. "Path is clear" is a false-negative claim wearing a friendly voice, and this
 * codebase has no way to justify it.
 */
export function summarizeScene(objects: SpatialObject[]): string {
  if (objects.length === 0) {
    return "No tracked objects recognised. This does not mean the area is clear.";
  }
  const critical = objects.filter((o) => o.tier === "critical").length;
  const top = objects[0];
  const head = critical > 0 ? `${critical} hazard${critical > 1 ? "s" : ""} in view. ` : "";
  return `${head}Nearest: ${top ? top.label.toLowerCase() : "none"}.`;
}

export { deg, rad, focalUnits, bandOf };
