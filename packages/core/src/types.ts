/**
 * Scene schema v1 — the contract between vision providers and the narration layer.
 * Kept provider-agnostic on purpose: SAM 3.1 returns masks, the adapter rasterises
 * them to polygons once so nothing downstream depends on model output format.
 */

export const SCENE_SCHEMA_VERSION = "1.0.0";

export type HazardTier = "critical" | "caution" | "informative";

export interface Point {
  /** Normalised 0..1, origin at top-left. */
  x: number;
  y: number;
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Detection {
  id: string;
  concept: string;
  confidence: number;
  bbox: BBox;
  areaRatio: number;
  maskPolygon: Point[];
}

export interface Scene {
  schemaVersion: string;
  frameId: number;
  timestampMs: number;
  detections: Detection[];
  provider: "mock" | "meta";
  latencyMs: number;
}

/** Geometry layer output: mask + heuristics converted into human meaning. */
export interface SpatialObject {
  id: string;
  concept: string;
  label: string;
  tier: HazardTier;
  confidence: number;
  /** Signed horizontal angle from the user's facing direction, degrees. */
  bearingDeg: number;
  /** Estimated distance in metres. A proxy, not a measurement — see geometry.ts. */
  distanceM: number | null;
  distanceBand: DistanceBand;
  /** Object sits inside the forward walking corridor. */
  inPath: boolean;
  /** Bottom of the mask is low in frame, so it is ground-level. */
  groundLevel: boolean;
  areaRatio: number;
  bbox: BBox;
  maskPolygon: Point[];
  /** Ordering score, highest first. */
  urgency: number;
}

export type DistanceBand = "near" | "mid" | "far" | "unknown";

export interface NarrationLine {
  id: string;
  text: string;
  concept: string;
  tier: HazardTier;
  bearingDeg: number;
  distanceBand: DistanceBand;
  timestampMs: number;
  /** Why this line fired — surfaced in the UI so the demo can explain itself. */
  trigger: "new" | "approaching" | "reappeared" | "manual";
}

