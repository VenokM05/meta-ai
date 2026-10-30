import { describe, expect, it } from "vitest";
import { DEFAULT_NARRATION, NarrationEngine, sentenceFor } from "../src/narration";
import { obj } from "./fixtures";

const chairMid = obj({ id: "c1", concept: "chair", label: "Chair", tier: "caution", distanceM: 2, distanceBand: "mid", bearingDeg: -30 });
const chairNear = obj({ id: "c1", concept: "chair", label: "Chair", tier: "caution", distanceM: 1, distanceBand: "near", bearingDeg: -30 });
const stairs = obj({ id: "s1", concept: "stairs", label: "Stairs", tier: "critical", distanceM: 3, distanceBand: "mid", urgency: 1100 });

function engine(overrides: Partial<typeof DEFAULT_NARRATION> = {}) {
  return new NarrationEngine({ ...DEFAULT_NARRATION, ...overrides });
}

describe("narration suppression", () => {
  it("says nothing on the very first frame an object appears", () => {
    const e = engine();
    expect(e.update([chairMid], 0)).toHaveLength(0);
  });

  it("announces an object once it has been tracked long enough", () => {
    const e = engine();
    e.update([chairMid], 0);
    const lines = e.update([chairMid], 500);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.trigger).toBe("new");
    expect(lines[0]!.text).toMatch(/chair/);
    expect(lines[0]!.text).toMatch(/slightly left|left/);
  });

  it("stays silent while a known object simply remains in view", () => {
    const e = engine();
    e.update([chairMid], 0);
    e.update([chairMid], 500);
    for (let t = 1000; t < 30_000; t += 500) {
      expect(e.update([chairMid], t)).toHaveLength(0);
    }
  });

  it("re-announces only when the object closes the distance", () => {
    const e = engine();
    e.update([chairMid], 0);
    e.update([chairMid], 500);
    e.update([chairMid], 10_000);
    const lines = e.update([chairNear], 11_000);
    expect(lines[0]?.trigger).toBe("approaching");
    expect(lines[0]?.text).toMatch(/^Moving closer/);
  });

  it("announces an object that left and came back", () => {
    const e = engine({ forgetAfterMs: 5_000 });
    e.update([chairMid], 0);
    e.update([chairMid], 500);
    e.update([], 2_000);
    e.update([], 4_000);
    e.update([chairMid], 10_000);
    const lines = e.update([chairMid], 10_500);
    expect(lines[0]?.trigger).toBe("reappeared");
  });

  it("does not retire an object that lost the line budget race", () => {
    // Two objects appear together and only one can speak. The loser must still get its
    // turn on a later frame rather than being silently retired forever.
    const second = obj({ id: "d1", concept: "doorway", label: "Doorway", tier: "informative", bearingDeg: 40, urgency: 120 });
    const e = engine({ maxLinesPerUpdate: 1 });
    e.update([chairMid, second], 0);
    const first = e.update([chairMid, second], 500);
    expect(first).toHaveLength(1);
    expect(first[0]!.concept).toBe("chair");

    // Both stay continuously present; the global throttle has now expired.
    const later = e.update([chairMid, second], 3_000);
    expect(later).toHaveLength(1);
    expect(later[0]!.concept).toBe("doorway");
  });
});

describe("narration priority", () => {
  it("puts a critical hazard ahead of an informative object", () => {
    const informative = obj({ id: "i1", concept: "cup_liquid", label: "Cup of liquid", tier: "informative", urgency: 120 });
    const e = engine({ maxLinesPerUpdate: 1 });
    e.update([informative, stairs], 0);
    const lines = e.update([informative, stairs], 500);
    expect(lines[0]!.tier).toBe("critical");
  });

  it("lets a hazard speak through the global throttle but not an ordinary object", () => {
    // Objects need two sightings before they are eligible to speak, so each new arrival
    // is fed a setup frame first. That debounce is the feature under test as much as the
    // throttle is.
    const e = engine({ minGapMs: 10_000 });
    e.update([chairMid], 0);
    e.update([chairMid], 100);
    e.update([chairMid, stairs], 200);
    const hazardLines = e.update([chairMid, stairs], 300);
    expect(hazardLines.some((l) => l.tier === "critical")).toBe(true);

    const e2 = engine({ minGapMs: 10_000 });
    e2.update([stairs], 0);
    e2.update([stairs], 100);
    const ordinary = obj({ id: "x", concept: "pole", label: "Pole", tier: "caution", bearingDeg: 45, urgency: 520 });
    e2.update([stairs, ordinary], 200);
    expect(e2.update([stairs, ordinary], 300).filter((l) => l.tier === "caution")).toHaveLength(0);
  });
});

describe("sentence construction", () => {
  it("collapses duplicates into a counted plural", () => {
    const a = obj({ id: "a", concept: "chair", label: "Chair", bearingDeg: 5, distanceM: 2 });
    const b = obj({ id: "b", concept: "chair", label: "Chair", bearingDeg: 6, distanceM: 2.2 });
    expect(sentenceFor([a, b])).toMatch(/^2 chairs/);
  });

  it("uses hedges rather than precise metres", () => {
    expect(sentenceFor([chairNear])).not.toMatch(/1\.0 m|metres/);
  });
});
