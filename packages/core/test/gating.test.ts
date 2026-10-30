import { describe, expect, it } from "vitest";
import { DEFAULT_GATE, KeyframeGate } from "../src/gating";
import { obj } from "./fixtures";

const one = obj({ id: "a", concept: "chair" });
const two = [one, obj({ id: "b", concept: "pole", bearingDeg: 40, urgency: 510 })];
const moved = obj({ id: "a", concept: "chair", bbox: { x: 0.7, y: 0.7, w: 0.2, h: 0.2 } });

describe("keyframe gate", () => {
  it("always segments the first frame", () => {
    const g = new KeyframeGate();
    expect(g.shouldSegment(0, [])).toBe(true);
  });

  it("coasts when the tracked scene is unchanged", () => {
    const g = new KeyframeGate();
    g.shouldSegment(0, [one]);
    g.markRun(0, [one]);
    expect(g.shouldSegment(200, [one])).toBe(false);
  });

  it("forces a re-segment once a new object enters the tracked set", () => {
    const g = new KeyframeGate({ ...DEFAULT_GATE, maxSkipMs: 10_000 });
    g.markRun(0, [one]);
    expect(g.shouldSegment(200, two)).toBe(true);
  });

  it("forces a re-segment when the scene shifts a lot", () => {
    const g = new KeyframeGate({ ...DEFAULT_GATE, maxSkipMs: 10_000 });
    g.markRun(0, [one]);
    expect(g.shouldSegment(200, [moved])).toBe(true);
  });

  it("never goes longer than maxSkipMs without segmenting, even when static", () => {
    const g = new KeyframeGate();
    g.markRun(0, [one]);
    expect(g.shouldSegment(500, [one])).toBe(false);
    expect(g.shouldSegment(DEFAULT_GATE.maxSkipMs + 1, [one])).toBe(true);
  });

  it("ignores jitter inside the deadzone", () => {
    const g = new KeyframeGate({ ...DEFAULT_GATE, maxSkipMs: 10_000, deadzone: 0.5 });
    g.markRun(0, [one]);
    expect(g.shouldSegment(200, [moved])).toBe(false);
  });

  it("re-segments when the tracked set empties", () => {
    const g = new KeyframeGate({ ...DEFAULT_GATE, maxSkipMs: 10_000 });
    g.markRun(0, [one]);
    expect(g.shouldSegment(200, [])).toBe(true);
  });
});
