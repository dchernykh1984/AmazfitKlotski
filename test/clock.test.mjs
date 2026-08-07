import { describe, it, expect } from "vitest";
import {
  MAX_ELAPSED,
  UNKNOWN,
  elapsedBetween,
  formatElapsed,
  isTimed,
  normalizeElapsed,
} from "../lib/clock.js";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe("elapsedBetween", () => {
  it("is finish minus start, and nothing else", () => {
    expect(elapsedBetween(1000, 5000)).toBe(4000);
    expect(elapsedBetween(1_700_000_000_000, 1_700_000_000_000 + 261 * SECOND)).toBe(261 * SECOND);
  });

  it("rounds to whole milliseconds", () => {
    expect(elapsedBetween(1000.2, 5000.9)).toBe(4001);
    expect(elapsedBetween(1000.9, 5000.2)).toBe(3999);
  });

  it("reports nothing when the game was never timed", () => {
    for (const [start, finish] of [
      [0, 5000],
      [1000, 0],
      [undefined, 5000],
      [1000, undefined],
      [null, null],
      ["", 5000],
      [NaN, 5000],
      [Infinity, 5000],
      [-1000, 5000],
    ]) {
      expect(elapsedBetween(start, finish), `${start} -> ${finish}`).toBe(UNKNOWN);
    }
  });

  it("reports nothing when the watch's clock moved backwards under us", () => {
    expect(elapsedBetween(5000, 1000)).toBe(UNKNOWN);
    expect(elapsedBetween(5000, 5000)).toBe(UNKNOWN);
  });

  it("stops growing at a length no real game reaches", () => {
    expect(elapsedBetween(1000, 1000 + 500 * HOUR)).toBe(MAX_ELAPSED);
    expect(MAX_ELAPSED).toBeGreaterThan(24 * HOUR);
  });
});

describe("normalizeElapsed", () => {
  it("reads a stored duration however the storage handed it back", () => {
    expect(normalizeElapsed(261000)).toBe(261000);
    expect(normalizeElapsed("261000")).toBe(261000);
    expect(normalizeElapsed(261000.7)).toBe(261000);
  });

  it("treats anything unusable as not timed", () => {
    for (const value of [undefined, null, "", "abc", NaN, Infinity, -1, 0, {}, []]) {
      expect(normalizeElapsed(value), JSON.stringify(value)).toBe(UNKNOWN);
    }
  });

  it("caps a stored duration the same way it caps a measured one", () => {
    expect(normalizeElapsed(500 * HOUR)).toBe(MAX_ELAPSED);
  });
});

describe("isTimed", () => {
  it("knows a real duration from a missing one", () => {
    expect(isTimed(1)).toBe(true);
    expect(isTimed(0)).toBe(false);
    expect(isTimed(undefined)).toBe(false);
    expect(isTimed("nonsense")).toBe(false);
  });
});

describe("formatElapsed", () => {
  it("writes minutes and seconds under an hour", () => {
    expect(formatElapsed(0 * MINUTE + 7 * SECOND)).toBe("0:07");
    expect(formatElapsed(4 * MINUTE + 21 * SECOND)).toBe("4:21");
    expect(formatElapsed(59 * MINUTE + 59 * SECOND)).toBe("59:59");
  });

  it("brings in the hours only once there are any", () => {
    expect(formatElapsed(HOUR)).toBe("1:00:00");
    expect(formatElapsed(HOUR + 4 * MINUTE + 21 * SECOND)).toBe("1:04:21");
    expect(formatElapsed(12 * HOUR)).toBe("12:00:00");
  });

  it("keeps seconds two digits so the number does not jitter", () => {
    expect(formatElapsed(MINUTE + 5 * SECOND)).toBe("1:05");
    expect(formatElapsed(HOUR + 5 * MINUTE + 5 * SECOND)).toBe("1:05:05");
  });

  it("throws away the part of a second", () => {
    expect(formatElapsed(4 * MINUTE + 21 * SECOND + 999)).toBe("4:21");
  });

  it("shows the placeholder for a game that was never timed", () => {
    expect(formatElapsed(UNKNOWN)).toBe("-");
    expect(formatElapsed(undefined)).toBe("-");
    expect(formatElapsed(0, "n/a")).toBe("n/a");
  });

  it("never grows past a length the screen can hold", () => {
    const longest = formatElapsed(MAX_ELAPSED);
    expect(longest).toBe("99:59:59");
    expect(formatElapsed(500 * HOUR)).toBe(longest);
    expect(longest.length).toBeLessThanOrEqual(8);
  });

  it("writes a duration for every second of the first two minutes", () => {
    // Cheap sweep: catches an off-by-one in the minute rollover, which is the
    // one place this arithmetic could plausibly be wrong.
    for (let second = 0; second <= 120; second++) {
      const expected = `${Math.floor(second / 60)}:${String(second % 60).padStart(2, "0")}`;
      const written = formatElapsed(second * SECOND);
      expect(written, `${second}s`).toBe(second === 0 ? "-" : expected);
    }
  });
});
