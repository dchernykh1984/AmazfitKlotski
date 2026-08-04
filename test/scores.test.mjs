import { describe, it, expect } from "vitest";
import {
  LEVEL_KEY,
  NO_RECORD,
  bestKey,
  hasRecord,
  normalizeMoves,
  updateBest,
} from "../lib/scores.js";
import { LEVELS } from "../lib/levels.js";

describe("storage keys", () => {
  it("gives every level its own record", () => {
    const keys = LEVELS.map((level) => bestKey(level.id));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(LEVEL_KEY);
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

describe("hasRecord", () => {
  it("knows the difference between no record and a finished game", () => {
    expect(hasRecord(undefined)).toBe(false);
    expect(hasRecord(0)).toBe(false);
    expect(hasRecord(1)).toBe(true);
  });
});

describe("updateBest", () => {
  it("sets the record on the first finish", () => {
    expect(updateBest(NO_RECORD, 120)).toEqual({ best: 120, isRecord: true });
  });

  it("keeps the shorter game", () => {
    expect(updateBest(120, 118)).toEqual({ best: 118, isRecord: true });
    expect(updateBest(120, 121)).toEqual({ best: 120, isRecord: false });
    expect(updateBest(120, 120)).toEqual({ best: 120, isRecord: false });
  });

  it("ignores a result that is not a real game", () => {
    expect(updateBest(120, 0)).toEqual({ best: 120, isRecord: false });
    expect(updateBest(120, -3)).toEqual({ best: 120, isRecord: false });
    expect(updateBest(NO_RECORD, "x")).toEqual({ best: NO_RECORD, isRecord: false });
  });

  it("recovers from a corrupt stored record", () => {
    expect(updateBest("nonsense", 90)).toEqual({ best: 90, isRecord: true });
  });
});
