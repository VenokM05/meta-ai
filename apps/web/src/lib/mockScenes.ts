import type { Detection, Point, Scene } from "@roomguide/core";

/**
 * Scripted deterministic scene used when no Meta credentials are configured.
 *
 * It exists so the whole pipeline — gate, geometry, narration, sonar, audio — is
 * exercisable on a laptop with no network. The timings are authored to trigger real
 * state transitions: objects arrive, one closes the distance (so `approaching` fires),
 * one leaves and later returns (so `reappeared` fires). It is labelled MOCK in the UI
 * everywhere it is used, and it is never a stand-in for a measured result.
 */

const LOOP_MS = 34_000;

/** Deterministic hash so blob jitter is stable frame to frame. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function blob(cx: number, cy: number, w: number, h: number, seed: string): Point[] {
  const j = hash(seed);
  const steps = 10;
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wob = 0.82 + 0.18 * Math.sin(a * 3 + j * 6);
    pts.push({
      x: clamp01(cx + Math.cos(a) * (w / 2) * wob),
      y: clamp01(cy + Math.sin(a) * (h / 2) * wob),
    });
  }
  return pts;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface Actor {
  concept: string;
  from: number;
  to: number;
  /** 0..1 progress inside the window; returns the geometry at that moment. */
  path: (p: number) => { x: number; y: number; w: number; h: number };
  confidence: (p: number) => number;
}

const ACTORS: Actor[] = [
  {
    concept: "chair",
    from: 0,
    to: 9,
    path: () => ({ x: 0.1, y: 0.58, w: 0.17, h: 0.26 }),
    confidence: (p) => 0.62 + 0.2 * Math.sin(p * 3),
  },
  {
    concept: "curb",
    from: 4,
    to: 14,
    path: () => ({ x: 0.06, y: 0.86, w: 0.88, h: 0.05 }),
    confidence: () => 0.55,
  },
  {
    concept: "cup_liquid",
    from: 2,
    to: 12,
    path: () => ({ x: 0.79, y: 0.44, w: 0.06, h: 0.07 }),
    confidence: (p) => 0.48 + 0.22 * p,
  },
  {
    // Closes on the observer across its window — this is what drives the
    // "Moving closer" narration path.
    concept: "stairs",
    from: 8,
    to: 21,
    path: (p) => ({ x: 0.4 - p * 0.06, y: 0.54 + p * 0.1, w: 0.24 + p * 0.3, h: 0.14 + p * 0.26 }),
    confidence: (p) => 0.44 + 0.4 * p,
  },
  {
    concept: "person",
    from: 14,
    to: 24,
    path: () => ({ x: 0.66, y: 0.34, w: 0.13, h: 0.5 }),
    confidence: (p) => 0.7 + 0.2 * p,
  },
  {
    concept: "pole",
    from: 16,
    to: 26,
    path: () => ({ x: 0.88, y: 0.36, w: 0.03, h: 0.44 }),
    confidence: () => 0.58,
  },
  {
    concept: "cord",
    from: 20,
    to: 29,
    path: () => ({ x: 0.3, y: 0.85, w: 0.34, h: 0.05 }),
    confidence: (p) => 0.36 + 0.34 * p,
  },
  {
    concept: "doorway",
    from: 24,
    to: 34,
    path: () => ({ x: 0.08, y: 0.3, w: 0.19, h: 0.46 }),
    confidence: () => 0.66,
  },
  {
    concept: "open_door",
    from: 28,
    to: 34,
    path: () => ({ x: 0.44, y: 0.36, w: 0.22, h: 0.4 }),
    confidence: (p) => 0.4 + 0.3 * p,
  },
];

function detect(actor: Actor, p: number, tSec: number): Detection | null {
  const geo = actor.path(p);
  const confidence = Math.round(clamp01(actor.confidence(p)) * 100) / 100;
  const areaRatio = Math.round(geo.w * geo.h * 0.74 * 1e4) / 1e4;
  if (areaRatio <= 0.0002) return null;
  return {
    id: `${actor.concept}-${Math.floor(tSec / 2)}`,
    concept: actor.concept,
    confidence,
    bbox: geo,
    areaRatio,
    maskPolygon: blob(geo.x + geo.w / 2, geo.y + geo.h / 2, geo.w, geo.h, actor.concept),
  };
}

export function mockSceneAt(timestampMs: number, frameId: number): Scene {
  const tSec = (timestampMs % LOOP_MS) / 1000;
  const detections: Detection[] = [];
  for (const actor of ACTORS) {
    if (tSec < actor.from || tSec > actor.to) continue;
    const span = actor.to - actor.from;
    const d = detect(actor, (tSec - actor.from) / span, tSec);
    if (d) detections.push(d);
  }
  return {
    schemaVersion: "1.0.0",
    frameId,
    timestampMs,
    detections,
    provider: "mock",
    // Roughly what a concept-prompted segmentation round trip costs today; the
    // provider reports the true number once it is wired to the real API.
    latencyMs: 180 + Math.round(hash(`lat${frameId}`) * 90),
  };
}

export const MOCK_LOOP_MS = LOOP_MS;
