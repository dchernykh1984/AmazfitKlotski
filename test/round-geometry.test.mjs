import { describe, it, expect } from "vitest";
import { safeHalfWidth, safeLineWidth, centeredBox } from "../lib/round-geometry.js";

describe("safeHalfWidth", () => {
  it("is the full radius on the centre line and shrinks towards the edge", () => {
    expect(safeHalfWidth(100, 0)).toBe(100);
    expect(safeHalfWidth(100, 60)).toBeCloseTo(80, 6);
    expect(safeHalfWidth(100, 100)).toBe(0);
    expect(safeHalfWidth(100, 140)).toBe(0);
  });

  it("does not care which way up the offset is", () => {
    expect(safeHalfWidth(100, -60)).toBe(safeHalfWidth(100, 60));
  });
});

describe("safeLineWidth", () => {
  it("measures at the end of the line furthest from the centre", () => {
    const size = 466;
    const top = safeLineWidth(size, 60, 40, 0);
    const middle = safeLineWidth(size, 233, 40, 0);
    expect(middle).toBeGreaterThan(top);
    expect(middle).toBeCloseTo(2 * safeHalfWidth(233, 20), 6);
  });

  it("keeps the padding off both sides", () => {
    expect(safeLineWidth(466, 233, 40, 8)).toBeCloseTo(safeLineWidth(466, 233, 40, 0) - 16, 6);
  });

  it("never goes negative", () => {
    expect(safeLineWidth(466, 2, 40, 8)).toBe(0);
    expect(safeLineWidth(466, 464, 40, 8)).toBe(0);
  });
});

describe("centeredBox", () => {
  it("centres the box and honours the maximum width", () => {
    const box = centeredBox(466, 200, 40, 120, 8);
    expect(box.w).toBe(120);
    expect(box.x).toBe(Math.round((466 - 120) / 2));
    expect(box.y).toBe(200);
    expect(box.h).toBe(40);
  });

  it("narrows the box near the bezel", () => {
    const wide = centeredBox(466, 213, 40, 400, 8);
    const narrow = centeredBox(466, 20, 40, 400, 8);
    expect(narrow.w).toBeLessThan(wide.w);
  });

  it("keeps both top corners inside the circle", () => {
    const size = 466;
    const radius = size / 2;
    for (let top = 10; top < size - 50; top += 10) {
      const box = centeredBox(size, top, 40, 400, 8);
      for (const [x, y] of [
        [box.x, box.y],
        [box.x + box.w, box.y],
        [box.x, box.y + box.h],
        [box.x + box.w, box.y + box.h],
      ]) {
        const dx = x - radius;
        const dy = y - radius;
        expect(Math.sqrt(dx * dx + dy * dy), `top ${top}`).toBeLessThanOrEqual(radius);
      }
    }
  });
});
