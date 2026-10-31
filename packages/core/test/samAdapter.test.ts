import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSamText } from "../src/samAdapter";
import type { FrameSize } from "../src/samAdapter";

/**
 * Fixtures are verbatim `output_text` captured from live `sam-3.1` calls, not hand-written
 * guesses at the grammar. The ground truth they encode:
 *   single      - one 64x64 red square at px (32,40)-(95,103) in a 128x128 frame
 *   two-objects - two 50x50 red squares at px (20,60) and (120,60) in a 200x200 frame
 */
const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}.txt`, import.meta.url)), "utf8");

const SINGLE: FrameSize = { width: 128, height: 128 };
const TWO: FrameSize = { width: 200, height: 200 };

describe("parseSamText", () => {
  it("normalises absolute pixel boxes against the frame we sent", () => {
    const { detections } = parseSamText(fixture("sam-single"), SINGLE, "red square");
    expect(detections).toHaveLength(1);
    const bbox = detections[0]!.bbox;
    expect(bbox.x).toBeCloseTo(32 / 128, 5);
    expect(bbox.y).toBeCloseTo(40 / 128, 5);
    expect(bbox.w).toBeCloseTo(64 / 128, 5);
    expect(bbox.h).toBeCloseTo(64 / 128, 5);
  });

  it("returns one detection per object id and keys ids by concept", () => {
    const { detections } = parseSamText(fixture("sam-two-objects"), TWO, "red square");
    expect(detections).toHaveLength(2);
    expect(detections.map((d) => d.id).sort()).toEqual(["red square:0", "red square:1"]);
    const xs = detections.map((d) => d.bbox.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0.1, 5);
    expect(xs[1]).toBeCloseTo(0.6, 5);
  });

  it("carries the reported confidence", () => {
    const { detections } = parseSamText(fixture("sam-single"), SINGLE, "red square");
    expect(detections[0]!.confidence).toBeCloseTo(0.8987, 3);
  });

  it("treats an omitted confidence as unknown rather than zero", () => {
    // The API only emits `c` when include_confidence is set; a bare match is still a match,
    // and scoring it 0 would silently drop every detection from a provider that stopped
    // reporting confidence.
    const stripped = fixture("sam-single").replace(/;c=[0-9.]+/g, "");
    expect(stripped).not.toContain(";c=");
    const { detections } = parseSamText(stripped, SINGLE, "red square");
    expect(detections).toHaveLength(1);
    expect(detections[0]!.confidence).toBe(1);
  });

  it("maps the mask contour into normalised frame space and simplifies it", () => {
    const { detections } = parseSamText(fixture("sam-single"), SINGLE, "red square");
    const poly = detections[0]!.maskPolygon;
    expect(poly.length).toBeGreaterThan(0);
    // A square's outline is 4 corners; RDP must collapse the ~250-point raw contour without
    // deleting the shape.
    expect(poly.length).toBeLessThanOrEqual(8);
    for (const p of poly) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it("keeps mask area within the bounding box", () => {
    const { detections } = parseSamText(fixture("sam-two-objects"), TWO, "red square");
    for (const d of detections) {
      expect(d.areaRatio).toBeLessThanOrEqual(d.bbox.w * d.bbox.h + 1e-9);
      expect(d.areaRatio).toBeGreaterThan(0);
    }
  });

  it("reports a clean no-match answer as empty instead of failing", () => {
    // Verified live: an unmatchable prompt returns status=completed with empty text, not an
    // error. The caller must be able to tell "nothing found" from "the call broke".
    const result = parseSamText("", SINGLE, "piano");
    expect(result.empty).toBe(true);
    expect(result.detections).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("surfaces parser diagnostics without throwing on malformed input", () => {
    const result = parseSamText("this is not a segmentation stream", SINGLE, "chair");
    expect(result.detections).toEqual([]);
    expect(result.empty).toBe(true);
  });

  it("scales inversely with the declared frame size", () => {
    // Guards the assumption that boxes are pixels of the frame we uploaded. If the provider
    // ever resizes server-side and reports the resized dimensions, this is where the skew
    // would show up as wrong distances.
    const text = fixture("sam-single");
    const at128 = parseSamText(text, { width: 128, height: 128 }, "red square").detections[0]!;
    const at256 = parseSamText(text, { width: 256, height: 256 }, "red square").detections[0]!;
    expect(at256.bbox.x).toBeCloseTo(at128.bbox.x / 2, 5);
    expect(at256.bbox.w).toBeCloseTo(at128.bbox.w / 2, 5);
  });
});
