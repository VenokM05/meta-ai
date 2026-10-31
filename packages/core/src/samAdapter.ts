/**
 * Turns a SAM 3.1 response into the provider-agnostic `Detection` shape the rest of the
 * pipeline consumes.
 *
 * Two conversions matter here and neither is optional:
 *
 * - SAM returns boxes in **absolute source pixels**, while `Detection.bbox` is normalised
 *   0..1. The frame size used for the division is the one we sent, not one read back from
 *   the model, so a resized upload cannot silently skew every distance estimate.
 * - The mask contour from `decodeMaskToSVGPath` is in **raster space with half-pixel
 *   offsets** (contours run between pixel centres). It is placed onto the frame through the
 *   record's `bounds`, which is the half-open source-pixel box the raster covers.
 *
 * Mask decoding is delegated to Meta's own `@meta-sam/parser`. Owning the wire format would
 * be a liability; the geometry-to-language translation above it is the part worth owning.
 */

import {
  decodeMaskToRaster,
  decodeMaskToSVGPath,
  formats,
  recordsOfKind,
} from "@meta-sam/parser";
import type { SegmentationMaskRecord } from "@meta-sam/parser";
import type { BBox, Detection, Point } from "./types";

export interface FrameSize {
  width: number;
  height: number;
}

export interface SamParseResult {
  detections: Detection[];
  /** Parse warnings from the official parser, surfaced so a malformed reply is visible. */
  diagnostics: string[];
  /** True when the model answered cleanly but found nothing for this concept. */
  empty: boolean;
}

/**
 * Vertical line simplification (Rammer-Douglas-Peucker). A 64px mask edge arrives as ~64
 * collinear points; rendering those verbatim bloats the SVG for no visual gain.
 */
function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const a = points[first]!;
    const b = points[last]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let worst = -1;
    let worstDist = 0;
    for (let i = first + 1; i < last; i++) {
      const p = points[i]!;
      const dist =
        lenSq === 0
          ? Math.hypot(p.x - a.x, p.y - a.y)
          : Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.sqrt(lenSq);
      if (dist > worstDist) {
        worstDist = dist;
        worst = i;
      }
    }

    if (worst > 0 && worstDist > epsilon) {
      keep[worst] = 1;
      stack.push([first, worst], [worst, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Parse "M-0.5 0L0 -0.5…Z" into closed rings. A path may contain several subpaths (holes
 * and disjoint fragments); the longest is taken as the outer boundary, which is what the
 * sonar and mask overlay actually want.
 */
function ringsFromPath(path: string): Point[][] {
  const rings: Point[][] = [];
  let current: Point[] = [];
  const numbers = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

  const tokens = path.match(/[MLZ][^MLZ]*/gi) ?? [];
  for (const token of tokens) {
    const command = token[0]!.toUpperCase();
    if (command === "Z") {
      if (current.length > 0) rings.push(current);
      current = [];
      continue;
    }
    numbers.lastIndex = 0;
    const coords: number[] = [];
    for (let m = numbers.exec(token); m !== null; m = numbers.exec(token)) {
      coords.push(Number(m[0]));
    }
    for (let i = 0; i + 1 < coords.length; i += 2) {
      current.push({ x: coords[i]!, y: coords[i + 1]! });
    }
  }
  if (current.length > 0) rings.push(current);
  return rings;
}

/** Fraction of the mask raster that is on, used as the true footprint area. */
function maskOnRatio(record: SegmentationMaskRecord): number {
  const { mask } = record;
  const total = mask.width * mask.height;
  if (total <= 0) return 0;
  const raster = decodeMaskToRaster(mask);
  let on = 0;
  for (let i = 0; i < raster.length; i++) on += raster[i]!;
  return on / total;
}

function normalise(
  left: number,
  top: number,
  right: number,
  bottom: number,
  frame: FrameSize,
): BBox {
  return {
    x: left / frame.width,
    y: top / frame.height,
    w: (right - left) / frame.width,
    h: (bottom - top) / frame.height,
  };
}

export function parseSamText(text: string, frame: FrameSize, concept: string): SamParseResult {
  const parser = formats.segmentation.image().createParser();
  parser.push(text);
  const { result } = parser.finish({ status: "completed" });

  const diagnostics = result.diagnostics.map((d) => `${d.code} (line ${d.line}): ${d.message}`);
  const boxRecords = recordsOfKind(result.records, "box");
  const maskRecords = recordsOfKind(result.records, "mask");

  const masksById = new Map<string, SegmentationMaskRecord>();
  for (const m of maskRecords) masksById.set(m.objectId, m);

  const detections: Detection[] = [];
  for (const box of boxRecords) {
    const maskRecord = masksById.get(box.objectId);
    const bbox = normalise(box.left, box.top, box.right, box.bottom, frame);

    let polygon: Point[] = [];
    let areaRatio = bbox.w * bbox.h;
    if (maskRecord) {
      const { bounds } = maskRecord;
      const boxW = bounds.right - bounds.left;
      const boxH = bounds.bottom - bounds.top;
      const sx = boxW / maskRecord.mask.width;
      const sy = boxH / maskRecord.mask.height;

      const rings = ringsFromPath(decodeMaskToSVGPath(maskRecord.mask));
      const outer = rings.reduce<Point[]>((acc, r) => (r.length > acc.length ? r : acc), []);
      polygon = simplify(
        outer.map((p) => ({
          // +0.5 recentres the half-pixel contour offsets onto the bounds box.
          x: (bounds.left + (p.x + 0.5) * sx) / frame.width,
          y: (bounds.top + (p.y + 0.5) * sy) / frame.height,
        })),
        0.004,
      );

      // The mask is the real footprint; a tall thin bbox overstates area badly and that
      // feeds straight into the distance estimate.
      areaRatio = (bbox.w * bbox.h) * maskOnRatio(maskRecord);
    }

    detections.push({
      id: `${concept}:${box.objectId}`,
      concept,
      // Absent confidence means the API omitted `c`, not that the match is weak; we always
      // request include_confidence, so this only bites if that ever changes.
      confidence: box.confidence ?? maskRecord?.confidence ?? 1,
      bbox,
      areaRatio,
      maskPolygon: polygon,
    });
  }

  return { detections, diagnostics, empty: detections.length === 0 };
}
