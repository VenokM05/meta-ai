import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA,
  bearingPhrase,
  distancePhrase,
  estimateDistance,
  sceneToSpatial,
  summarizeScene,
  toSpatial,
} from "../src/geometry";
import { scene } from "./fixtures";
import { det } from "./fixtures";

describe("distance proxy", () => {
  it("reads a large near object as closer than a small far one", () => {
    const near = det({ concept: "chair", bbox: { x: 0.4, y: 0.55, w: 0.3, h: 0.4 } });
    const far = det({
      concept: "chair",
      bbox: { x: 0.47, y: 0.4, w: 0.05, h: 0.07 },
      areaRatio: 0.004,
    });
    const dn = estimateDistance(near, true, DEFAULT_CAMERA)!;
    const df = estimateDistance(far, true, DEFAULT_CAMERA)!;
    expect(dn).toBeLessThan(df);
  });

  it("returns null rather than a wild number for an implausible blob", () => {
    const sliver = det({ concept: "chair", bbox: { x: 0.5, y: 0.5, w: 0.001, h: 0.001 } });
    expect(estimateDistance(sliver, false, DEFAULT_CAMERA)).toBeNull();
  });

  it("treats an unseen concept as unknown distance", () => {
    const ghost = det({ concept: "not_in_vocabulary" });
    expect(estimateDistance(ghost, false, DEFAULT_CAMERA)).toBeNull();
  });
});

describe("spatial meaning", () => {
  it("drops detections below the per-class confidence floor", () => {
    expect(toSpatial(det({ concept: "cup_liquid", confidence: 0.1 }))).toBeNull();
  });

  it("marks an object in the forward corridor as in-path", () => {
    const o = toSpatial(det({ concept: "chair", bbox: { x: 0.44, y: 0.6, w: 0.12, h: 0.3 } }))!;
    expect(o.inPath).toBe(true);
    expect(Math.abs(o.bearingDeg)).toBeLessThanOrEqual(12);
  });

  it("does not mark an object at the frame edge as in-path", () => {
    const o = toSpatial(det({ concept: "chair", bbox: { x: 0.02, y: 0.6, w: 0.1, h: 0.3 } }))!;
    expect(o.inPath).toBe(false);
    expect(o.bearingDeg).toBeLessThan(0);
  });

  it("sorts critical hazards above informative objects", () => {
    const s = scene([
      det({ concept: "cup_liquid", confidence: 0.9 }),
      det({ concept: "stairs", confidence: 0.9 }),
    ]);
    const objects = sceneToSpatial(s);
    expect(objects[0]!.tier).toBe("critical");
  });
});

describe("language", () => {
  it("keeps bearing phrasing coarse and symmetric", () => {
    expect(bearingPhrase(2)).toBe("straight ahead");
    expect(bearingPhrase(-30)).toBe("left");
    expect(bearingPhrase(30)).toBe("right");
  });

  it("bands distance into human steps", () => {
    expect(distancePhrase("near", 0.5)).toBe("at your feet");
    expect(distancePhrase("mid", 2.0)).toBe("a few steps ahead");
    expect(distancePhrase("unknown", null)).toBe("ahead");
  });

  // The load-bearing honesty rule.
  // The load-bearing honesty rule: an empty scene must never read as a safety claim.
  it("disclaims rather than claiming the area is clear", () => {
    const summary = summarizeScene([]);
    expect(summary).toMatch(/does not mean/i);
    expect(summary).toMatch(/not/i);
    // A bare assertion of clarity, in any wording, is the failure we are guarding against.
    expect(summary).not.toMatch(/^(the\s+)?(area|path)\s+is\s+clear/i);
    expect(summary).not.toMatch(/\ball\s+clear\b/i);
  });
});
