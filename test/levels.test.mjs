import { describe, it, expect } from "vitest";
import {
  BOARD_COLS,
  BOARD_ROWS,
  FIRST_LEVEL,
  GOAL,
  LEVELS,
  levelById,
  levelIndex,
  nextLevel,
  parseArt,
  previousLevel,
} from "../lib/levels.js";
import { KINDS, createGame, isSolved, occupancy, EMPTY } from "../lib/klotski.js";
import { shortestSolution } from "./helpers/solver.mjs";

describe("parseArt", () => {
  it("reads a picture into blocks claimed at their top left cell", () => {
    const parsed = parseArt(["VHHV", "VHHV", "V..V", "V..V", "GGSS"]);
    expect(parsed.cols).toBe(4);
    expect(parsed.rows).toBe(5);
    expect(parsed.blocks).toEqual([
      { kind: "general", x: 0, y: 0 },
      { kind: "hero", x: 1, y: 0 },
      { kind: "general", x: 3, y: 0 },
      { kind: "general", x: 0, y: 2 },
      { kind: "general", x: 3, y: 2 },
      { kind: "guard", x: 0, y: 4 },
      { kind: "soldier", x: 2, y: 4 },
      { kind: "soldier", x: 3, y: 4 },
    ]);
  });

  it("rejects a block that is not the right shape", () => {
    expect(() => parseArt(["HH.", "H..", "..."])).toThrow(/not a full block/);
    expect(() => parseArt(["V..", "...", "..."])).toThrow(/not a full block/);
  });

  it("rejects a block that hangs off the board", () => {
    expect(() => parseArt(["..H", "..H", "..."])).toThrow(/hangs off the board/);
    expect(() => parseArt(["...", "...", "..V"])).toThrow(/hangs off the board/);
  });

  it("rejects an unknown character and a ragged picture", () => {
    expect(() => parseArt(["X..", "...", "..."])).toThrow(/unknown block/);
    expect(() => parseArt(["...", "..", "..."])).toThrow(/cells wide/);
  });

  it("rejects a board with no cells at all", () => {
    expect(() => parseArt([])).toThrow(/at least one cell/);
    expect(() => parseArt([""])).toThrow(/at least one cell/);
    expect(() => parseArt(undefined)).toThrow(/at least one cell/);
  });
});

describe("the bundled levels", () => {
  it("all use the classic frame and exit", () => {
    for (const level of LEVELS) {
      expect(level.cols, level.id).toBe(BOARD_COLS);
      expect(level.rows, level.id).toBe(BOARD_ROWS);
      expect(level.goal, level.id).toEqual(GOAL);
    }
  });

  it("are numbered 1, 2, 3 ... in the order they are played", () => {
    // The number is the board's whole name and its storage key, so it has to be
    // its position in the ladder and nothing else.
    expect(LEVELS.map((level) => level.id)).toEqual(LEVELS.map((_, index) => index + 1));
  });

  it("keeps the boards that already own a number exactly where they are", () => {
    // A board's number is the key its record is stored under, so the numbers may
    // only ever be handed out at the end of the list. Appending a seventh board
    // is fine and this test stays green; inserting one between these six, or
    // swapping two of them, hands one board's record to another - and that is
    // what this catches. The shortest possible game is the board's fingerprint:
    // the solver recomputes each one from the art in the "par" tests below, so a
    // board cannot match this list without being the board it claims to be.
    expect(LEVELS.slice(0, 6).map((level) => level.par)).toEqual([7, 17, 26, 51, 92, 116]);
  });

  it("have unique ids", () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("start unsolved, with the hero somewhere above the goal", () => {
    for (const level of LEVELS) {
      const game = createGame(level);
      expect(isSolved(game), level.id).toBe(false);
      expect(game.blocks[game.heroId].y, level.id).toBeLessThan(level.goal.y);
    }
  });

  it("hold exactly one hero and leave room to move", () => {
    for (const level of LEVELS) {
      const heroes = level.blocks.filter((block) => block.kind === "hero");
      expect(heroes.length, level.id).toBe(1);
      const covered = level.blocks.reduce(
        (sum, block) => sum + KINDS[block.kind].w * KINDS[block.kind].h,
        0
      );
      expect(covered, level.id).toBeLessThan(level.cols * level.rows);
    }
  });

  it("never overlap two blocks or hang one off the board", () => {
    for (const level of LEVELS) {
      const game = createGame(level);
      const grid = occupancy(game);
      let filled = 0;
      for (const id of grid) {
        if (id !== EMPTY) {
          filled++;
        }
      }
      const covered = level.blocks.reduce(
        (sum, block) => sum + KINDS[block.kind].w * KINDS[block.kind].h,
        0
      );
      expect(filled, level.id).toBe(covered);
      for (const block of game.blocks) {
        expect(block.x >= 0 && block.x + block.w <= level.cols, level.id).toBe(true);
        expect(block.y >= 0 && block.y + block.h <= level.rows, level.id).toBe(true);
      }
    }
  });

  it("leave the goal free of the hero at the start", () => {
    for (const level of LEVELS) {
      const hero = level.blocks.find((block) => block.kind === "hero");
      expect(hero.x === level.goal.x && hero.y === level.goal.y, level.id).toBe(false);
    }
  });

  it("climb in difficulty", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].par, LEVELS[i].id).toBeGreaterThan(LEVELS[i - 1].par);
    }
  });
});

// The solver is a breadth-first search over every reachable position, so this is
// proof rather than a spot check: a board that cannot be solved, or a par that is
// off by even one move, fails here.
describe("par", () => {
  for (const level of LEVELS) {
    it(`${level.id} is solvable in exactly ${level.par} moves`, { timeout: 120000 }, () => {
      expect(shortestSolution(level)).toBe(level.par);
    });
  }
});

describe("walking the level list", () => {
  it("starts at the first level", () => {
    expect(FIRST_LEVEL).toBe(LEVELS[0].id);
    expect(levelIndex(FIRST_LEVEL)).toBe(0);
  });

  it("wraps around in both directions", () => {
    const last = LEVELS[LEVELS.length - 1];
    expect(nextLevel(last.id).id).toBe(LEVELS[0].id);
    expect(previousLevel(LEVELS[0].id).id).toBe(last.id);
    expect(nextLevel(LEVELS[0].id).id).toBe(LEVELS[1].id);
    expect(previousLevel(LEVELS[1].id).id).toBe(LEVELS[0].id);
  });

  it("treats an unknown id as the first level", () => {
    expect(levelIndex("gone")).toBe(-1);
    expect(levelById("gone").id).toBe(LEVELS[0].id);
    expect(levelById(undefined).id).toBe(LEVELS[0].id);
    expect(nextLevel("gone").id).toBe(LEVELS[0].id);
    expect(previousLevel("gone").id).toBe(LEVELS[LEVELS.length - 1].id);
    // A board number that does not exist yet - the watch may have been left on a
    // board that a later version removed, or an earlier one never had.
    expect(levelById(LEVELS.length + 1).id).toBe(LEVELS[0].id);
    expect(levelById(0).id).toBe(LEVELS[0].id);
  });

  it("recognises a board number that storage handed back as text", () => {
    // Zepp OS storage gives back whatever it feels like: "3" is the same board
    // as 3, and reading it as a miss would silently reset the player's choice.
    for (const level of LEVELS) {
      expect(levelById(String(level.id)).id, String(level.id)).toBe(level.id);
      expect(levelIndex(String(level.id)), String(level.id)).toBe(level.id - 1);
    }
    expect(nextLevel("1").id).toBe(LEVELS[1].id);
    expect(previousLevel("2").id).toBe(LEVELS[0].id);
  });

  it("refuses a number that only looks like one", () => {
    expect(levelIndex(1.5)).toBe(-1);
    expect(levelIndex("1.5")).toBe(-1);
    expect(levelIndex(null)).toBe(-1);
    expect(levelIndex("")).toBe(-1);
    expect(levelIndex([])).toBe(-1);
  });
});
