/**
 * Live segmentation against SAM 3.1 through the credential proxy.
 *
 * Two measured facts drive the shape of this file:
 *
 * 1. A single call takes ~1.6-2.2s (observed range 1.0-3.3s). Nothing about the loop can
 *    block on that, so a sweep runs as a background job while the guide coasts on the last
 *    known geometry.
 * 2. One call answers one concept. Verified live: the prompt "red square, green circle"
 *    returned zero matches on an image containing both, so there is no batch endpoint to
 *    collapse the vocabulary into a single request. A sweep is therefore N requests, and
 *    the only way to keep the refresh interval sane is to run them concurrently over a
 *    deliberately short list.
 */

import { CONCEPTS_BY_ID, parseSamText, type Detection, type Scene } from "@roomguide/core";

/**
 * The live watch list. Deliberately narrower than the full 12-class vocabulary: at ~1.8s per
 * concept, every extra class is another slot in the sweep, and a sweep that takes 20s is
 * worse than a sweep that watches the things you can fall on.
 *
 * These are vocabulary ids, not prompt strings. The provider translates each id to its
 * `prompt` before the request and tags detections with the id on the way back, so a class
 * such as `open_door` stays joined up with its label, tier, and rail row.
 */
export const LIVE_CONCEPTS = [
  "person",
  "stairs",
  "step",
  "cord",
  "open_door",
  "pole",
] as const;

/**
 * Frames are downscaled before upload. SAM resamples internally anyway, so a smaller upload
 * cuts request bytes and time-to-first-pixel without costing localisation quality — the
 * boxes come back in the coordinate space of whatever we sent, which we then normalise.
 */
const MAX_FRAME_EDGE = 640;
const JPEG_QUALITY = 0.7;
/** Beyond this a result is too old to narrate as current, so it is dropped instead. */
export const SWEEP_BUDGET_MS = 9_000;

export interface FrameGrab {
  dataUrl: string;
  width: number;
  height: number;
}

/** Grab the current video frame, downscaled and JPEG-encoded for upload. */
export function grabFrame(video: HTMLVideoElement): FrameGrab | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(vw, vh));
  const width = Math.max(1, Math.round(vw * scale));
  const height = Math.max(1, Math.round(vh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);

  return { dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), width, height };
}

export interface ConceptOutcome {
  concept: string;
  ok: boolean;
  detections: Detection[];
  /** Present when the proxy or upstream failed; shown verbatim in the degraded banner. */
  error?: string;
  latencyMs: number;
}

async function segmentOne(
  concept: string,
  frame: FrameGrab,
  signal: AbortSignal,
): Promise<ConceptOutcome> {
  const startedAt = performance.now();
  const prompt = CONCEPTS_BY_ID.get(concept)?.prompt ?? concept;
  try {
    const res = await fetch("/api/segment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ concept: prompt, imageDataUrl: frame.dataUrl }),
      signal,
    });

    const body = (await res.json()) as {
      ok?: boolean;
      text?: string;
      error?: string;
      status?: number;
      latencyMs?: number;
    };

    if (!res.ok || body.ok !== true) {
      return {
        concept,
        ok: false,
        detections: [],
        error: body.error ?? `http_${res.status}`,
        latencyMs: Math.round(performance.now() - startedAt),
      };
    }

    const parsed = parseSamText(body.text ?? "", { width: frame.width, height: frame.height }, concept);
    return {
      concept,
      ok: true,
      detections: parsed.detections,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      concept,
      ok: false,
      detections: [],
      error: error instanceof Error ? error.name.toLowerCase() : "unknown",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }
}

export interface SweepResult {
  scene: Scene | null;
  outcomes: ConceptOutcome[];
  /** True when every concept failed — the signal to enter degraded mode. */
  allFailed: boolean;
  durationMs: number;
}

/**
 * Run one sweep: every concept, bounded concurrency, one shared abort signal.
 *
 * Concurrency is capped rather than unlimited because the practical failure mode is not the
 * proxy queueing, it is a burst of parallel requests tripping upstream rate limits and
 * turning a slow sweep into a failed one.
 */
export async function runSweep(
  frame: FrameGrab,
  concepts: readonly string[],
  concurrency: number,
  signal: AbortSignal,
): Promise<SweepResult> {
  const startedAt = performance.now();
  const outcomes: ConceptOutcome[] = new Array(concepts.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      if (signal.aborted) return;
      const index = next++;
      if (index >= concepts.length) return;
      outcomes[index] = await segmentOne(concepts[index]!, frame, signal);
    }
  }

  const lanes = Math.max(1, Math.min(concurrency, concepts.length));
  await Promise.all(Array.from({ length: lanes }, () => worker()));

  const got = outcomes.filter(Boolean);
  const detections = got.flatMap((o) => o.detections);
  const allFailed = got.length > 0 && got.every((o) => !o.ok);
  const durationMs = Math.round(performance.now() - startedAt);

  const scene: Scene | null =
    got.length === 0 || allFailed
      ? null
      : {
          schemaVersion: "1.0.0",
          frameId: Math.round(startedAt),
          timestampMs: startedAt,
          detections,
          provider: "meta",
          // Reported latency is the sweep wall clock, not a single call: what the user
          // experiences is how long since the geometry on screen was last refreshed.
          latencyMs: durationMs,
        };

  return { scene, outcomes: got, allFailed, durationMs };
}
