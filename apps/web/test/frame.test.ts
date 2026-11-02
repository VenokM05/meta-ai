import { describe, expect, it } from "vitest";
import { centerCrop } from "../src/lib/frame";

const ratio = (r: { sw: number; sh: number }) => r.sw / r.sh;

describe("centerCrop", () => {
  it("keeps the whole frame when the stream is already 9:16", () => {
    expect(centerCrop(720, 1280)).toEqual({ sx: 0, sy: 0, sw: 720, sh: 1280 });
  });

  it("crops a 16:9 phone stream to a centred portrait window", () => {
    const r = centerCrop(1920, 1080);
    expect(ratio(r)).toBeCloseTo(9 / 16, 6);
    expect(r.sh).toBe(1080);
    expect(r.sw).toBeCloseTo(607.5, 3);
    expect(r.sx).toBeCloseTo((1920 - 607.5) / 2, 3);
    expect(r.sy).toBe(0);
  });

  it("crops a 4:3 stream on the sides", () => {
    const r = centerCrop(640, 480);
    expect(ratio(r)).toBeCloseTo(9 / 16, 6);
    expect(r.sw).toBe(270);
    expect(r.sx).toBe(185);
  });

  it("crops a stream taller than 9:16 on the top and bottom", () => {
    const r = centerCrop(600, 1200);
    expect(ratio(r)).toBeCloseTo(9 / 16, 6);
    expect(r.sw).toBe(600);
    expect(r.sh).toBeCloseTo(600 / (9 / 16), 6);
    expect(r.sy).toBeCloseTo((1200 - 600 / (9 / 16)) / 2, 6);
  });

  it("returns an empty rect before metadata is available", () => {
    expect(centerCrop(0, 0)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });
});
