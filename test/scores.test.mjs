import { describe, it, expect } from "vitest";
import {
  LEVEL_KEY,
  NO_RECORD,
  bestKey,
  bestTimeKey,
  compareResults,
  hasRecord,
  isBetter,
  normalizeMoves,
  normalizeResult,
  updateBest,
} from "../lib/scores.js";
import { UNKNOWN } from "../lib/clock.js";
import { LEVELS } from "../lib/levels.js";

const result = (moves, time = UNKNOWN) => ({ moves, time });

describe("storage keys", () => {
  it("gives every board its own record", () => {
    const keys = LEVELS.map((level) => bestKey(level.id));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(LEVEL_KEY);
  });

  it("keeps the moves and the clock in separate entries", () => {
    for (const level of LEVELS) {
      expect(bestTimeKey(level.id), String(level.id)).not.toBe(bestKey(level.id));
    }
    const all = LEVELS.flatMap((level) => [bestKey(level.id), bestTimeKey(level.id)]);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain(LEVEL_KEY);
  });
});

describe("normalizeMoves", () => {
  it("reads a stored count, however the storage returned it", () => {
    expect(normalizeMoves(42)).toBe(42);
    expect(normalizeMoves("42")).toBe(42);
    expect(normalizeMoves(42.7)).toBe(42);
  });

  it("treats anything unusable as no record yet", () => {
    for (const value of [undefined, null, "", "abc", NaN, Infinity, -1, 0, {}]) {
      expect(normalizeMoves(value), String(value)).toBe(NO_RECORD);
    }
  });
});

describe("normalizeResult", () => {
  it("cleans up both halves of a result", () => {
    expect(normalizeResult({ moves: "42", time: "9000" })).toEqual({ moves: 42, time: 9000 });
    expect(normalizeResult({ moves: 42.9, time: 9000.9 })).toEqual({ moves: 42, time: 9000 });
  });

  it("throws the clock away when there is no result to time", () => {
    expect(normalizeResult({ moves: 0, time: 9000 })).toEqual({ moves: NO_RECORD, time: UNKNOWN });
    expect(normalizeResult(undefined)).toEqual({ moves: NO_RECORD, time: UNKNOWN });
    expect(normalizeResult(null)).toEqual({ moves: NO_RECORD, time: UNKNOWN });
  });

  it("keeps a result that was never timed", () => {
    expect(normalizeResult({ moves: 42 })).toEqual({ moves: 42, time: UNKNOWN });
    expect(normalizeResult({ moves: 42, time: "rubbish" })).toEqual({ moves: 42, time: UNKNOWN });
  });
});

describe("hasRecord", () => {
  it("knows the difference between no record and a finished game", () => {
    expect(hasRecord(undefined)).toBe(false);
    expect(hasRecord(result(0))).toBe(false);
    expect(hasRecord(result(1))).toBe(true);
    expect(hasRecord(result(1, 9000))).toBe(true);
  });
});

describe("compareResults", () => {
  it("puts the shorter game first", () => {
    expect(compareResults(result(118), result(120))).toBeLessThan(0);
    expect(compareResults(result(120), result(118))).toBeGreaterThan(0);
  });

  it("ignores the clock while the moves differ", () => {
    // A fast 120 is still worse than a slow 118: the puzzle is the point.
    expect(compareResults(result(118, 60 * 60 * 1000), result(120, 1000))).toBeLessThan(0);
  });

  it("breaks a tie on moves with the clock", () => {
    expect(compareResults(result(118, 4000), result(118, 9000))).toBeLessThan(0);
    expect(compareResults(result(118, 9000), result(118, 4000))).toBeGreaterThan(0);
    expect(compareResults(result(118, 4000), result(118, 4000))).toBe(0);
  });

  it("lets a timed game beat an untimed one on equal moves", () => {
    expect(compareResults(result(118, 9000), result(118))).toBeLessThan(0);
    expect(compareResults(result(118), result(118, 9000))).toBeGreaterThan(0);
  });

  it("cannot separate two untimed games on equal moves", () => {
    expect(compareResults(result(118), result(118))).toBe(0);
  });

  it("puts any real result ahead of no result at all", () => {
    expect(compareResults(result(400), undefined)).toBeLessThan(0);
    expect(compareResults(undefined, result(400))).toBeGreaterThan(0);
    expect(compareResults(undefined, undefined)).toBe(0);
  });

  it("orders a list the way a leaderboard would", () => {
    const games = [
      result(120, 1000),
      result(118),
      result(118, 9000),
      result(118, 4000),
      result(200, 10),
    ];
    expect(games.slice().sort(compareResults)).toEqual([
      result(118, 4000),
      result(118, 9000),
      result(118),
      result(120, 1000),
      result(200, 10),
    ]);
  });
});

describe("isBetter", () => {
  it("is compareResults with its mind made up", () => {
    expect(isBetter(result(1), result(2))).toBe(true);
    expect(isBetter(result(2), result(1))).toBe(false);
    expect(isBetter(result(1), result(1))).toBe(false);
    expect(isBetter(result(1, 5), result(1, 5))).toBe(false);
  });
});

describe("updateBest", () => {
  it("sets the record on the first finish", () => {
    expect(updateBest(undefined, result(120, 9000))).toEqual({
      best: { moves: 120, time: 9000 },
      isRecord: true,
    });
  });

  it("keeps the shorter game", () => {
    expect(updateBest(result(120, 9000), result(118, 20000)).isRecord).toBe(true);
    expect(updateBest(result(120, 9000), result(121, 10)).isRecord).toBe(false);
  });

  it("keeps the faster game when the moves are equal", () => {
    const kept = updateBest(result(120, 9000), result(120, 4000));
    expect(kept).toEqual({ best: { moves: 120, time: 4000 }, isRecord: true });
    expect(updateBest(result(120, 4000), result(120, 9000))).toEqual({
      best: { moves: 120, time: 4000 },
      isRecord: false,
    });
    expect(updateBest(result(120, 4000), result(120, 4000)).isRecord).toBe(false);
  });

  it("puts a clock on a record that never had one", () => {
    expect(updateBest(result(120), result(120, 9000))).toEqual({
      best: { moves: 120, time: 9000 },
      isRecord: true,
    });
  });

  it("does not lose a record to a game that was not one", () => {
    expect(updateBest(result(120, 9000), result(0, 10))).toEqual({
      best: { moves: 120, time: 9000 },
      isRecord: false,
    });
    expect(updateBest(result(120, 9000), undefined).best).toEqual({ moves: 120, time: 9000 });
  });

  it("recovers from a corrupt stored record", () => {
    expect(updateBest({ moves: "nonsense", time: "nonsense" }, result(90, 1000))).toEqual({
      best: { moves: 90, time: 1000 },
      isRecord: true,
    });
  });
});
