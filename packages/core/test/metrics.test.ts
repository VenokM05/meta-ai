import { describe, expect, it } from "vitest";
import { aggregate, finalize, iou, scoreImage } from "../src/metrics";

const box = (x: number, y: number, w = 0.2, h = 0.2) => ({ x, y, w, h });

describe("IoU", () => {
  it("is 1 for an identical box", () => {
    expect(iou(box(0, 0), box(0, 0))).toBeCloseTo(1);
  });
  it("is 0 for disjoint boxes", () => {
    expect(iou(box(0, 0), box(0.8, 0.8))).toBe(0);
  });
  it("is 0.2 for a half-overlap of equal areas", () => {
    expect(iou(box(0, 0), box(0.1, 0))).toBeCloseTo(1 / 3, 2);
  });
});

describe("per-image scoring", () => {
  it("counts a hit within the IoU threshold", () => {
    const r = scoreImage("a.jpg", [{ concept: "chair", bbox: box(0.4, 0.4), hazard: true }], [
      { concept: "chair", bbox: box(0.42, 0.42), confidence: 0.9 },
    ]);
    expect(r.perClass.chair!.tp).toBe(1);
    expect(r.missed).toHaveLength(0);
  });

  it("counts a miss as a false negative and lists it under missedHazards", () => {
    const r = scoreImage("a.jpg", [{ concept: "stairs", bbox: box(0.1, 0.6), hazard: true }], []);
    expect(r.perClass.stairs!.fn).toBe(1);
    expect(r.missedHazards).toHaveLength(1);
  });

  it("does not double-credit two predictions for one truth", () => {
    const r = scoreImage(
      "a.jpg",
      [{ concept: "chair", bbox: box(0.4, 0.4), hazard: false }],
      [
        { concept: "chair", bbox: box(0.4, 0.4), confidence: 0.9 },
        { concept: "chair", bbox: box(0.41, 0.41), confidence: 0.7 },
      ],
    );
    expect(r.perClass.chair!.tp).toBe(1);
    expect(r.perClass.chair!.fp).toBe(1);
  });

  it("keeps a wrong-concept overlap out of the right class", () => {
    const r = scoreImage("a.jpg", [{ concept: "cord", bbox: box(0.4, 0.4), hazard: true }], [
      { concept: "chair", bbox: box(0.4, 0.4), confidence: 0.9 },
    ]);
    expect(r.perClass.cord!.fn).toBe(1);
    expect(r.perClass.chair!.fp).toBe(1);
    expect(r.missedHazards).toHaveLength(1);
  });

  it("returns zero rates instead of NaN for an empty class", () => {
    const s = finalize({ tp: 0, fp: 0, fn: 0, recall: 0, precision: 0, falseNegativeRate: 0 });
    expect(Number.isNaN(s.recall)).toBe(false);
    expect(s.recall).toBe(0);
  });
});

describe("aggregate report", () => {
  const results = [
    scoreImage("a.jpg", [
      { concept: "stairs", bbox: box(0.1, 0.6), hazard: true },
      { concept: "chair", bbox: box(0.6, 0.4), hazard: false },
    ], [
      { concept: "stairs", bbox: box(0.1, 0.6), confidence: 0.9 },
    ]),
    scoreImage("b.jpg", [
      { concept: "cord", bbox: box(0.3, 0.8), hazard: true },
    ], []),
  ];

  it("sums counts across images", () => {
    const report = aggregate(results);
    expect(report.images).toBe(2);
    expect(report.totalTruth).toBe(3);
    expect(report.overall.tp).toBe(1);
    expect(report.overall.fn).toBe(2);
  });

  it("reports hazard recall as the headline safety number", () => {
    const report = aggregate(results);
    // Two hazard truths (stairs, cord); cord missed.
    expect(report.hazardRecall).toBeCloseTo(0.5);
  });

  it("exposes per-tier stats that the UI draws as bullet charts", () => {
    const report = aggregate(results);
    expect(report.perTier.critical!.recall).toBeCloseTo(0.5);
    expect(report.perTier.informative!.recall).toBeCloseTo(0);
  });

  it("carries the missed hazards forward so the report is auditable", () => {
    const report = aggregate(results);
    const missed = report.results.flatMap((r) => r.missedHazards.map((m) => m.concept));
    expect(missed).toContain("cord");
  });
});
