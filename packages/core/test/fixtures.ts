import type { Detection, SpatialObject } from "../src/types";

export function det(partial: Partial<Detection> & Pick<Detection, "concept">): Detection {
  return {
    id: partial.id ?? partial.concept,
    confidence: partial.confidence ?? 0.8,
    bbox: partial.bbox ?? { x: 0.4, y: 0.6, w: 0.2, h: 0.3 },
    areaRatio: partial.areaRatio ?? 0.06,
    maskPolygon: partial.maskPolygon ?? [
      { x: 0.4, y: 0.6 },
      { x: 0.6, y: 0.6 },
      { x: 0.6, y: 0.9 },
      { x: 0.4, y: 0.9 },
    ],
    ...partial,
    concept: partial.concept,
  } as Detection;
}

export function scene(detections: Detection[], frameId = 0, timestampMs = 0) {
  return {
    schemaVersion: "1.0.0",
    frameId,
    timestampMs,
    detections,
    provider: "mock" as const,
    latencyMs: 120,
  };
}

export function obj(partial: Partial<SpatialObject> & Pick<SpatialObject, "concept">): SpatialObject {
  return {
    id: partial.id ?? partial.concept,
    concept: partial.concept,
    label: partial.label ?? partial.concept,
    tier: partial.tier ?? "caution",
    confidence: partial.confidence ?? 0.8,
    bearingDeg: partial.bearingDeg ?? 0,
    distanceM: partial.distanceM === undefined ? 2 : partial.distanceM,
    distanceBand: partial.distanceBand ?? "mid",
    inPath: partial.inPath ?? true,
    groundLevel: partial.groundLevel ?? true,
    areaRatio: partial.areaRatio ?? 0.05,
    bbox: partial.bbox ?? { x: 0.4, y: 0.6, w: 0.2, h: 0.3 },
    maskPolygon: partial.maskPolygon ?? [],
    urgency: partial.urgency ?? 500,
  };
}
