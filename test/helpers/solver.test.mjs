import { describe, it, expect } from "vitest";
import { createGame, isSolved, move } from "../../lib/klotski.js";
import { positionKey, shortestSolution, solutionMoves } from "./solver.mjs";

// Three cells wide, three tall, one hero and one soldier out of the way: the
// shortest way to bring the hero to (1, 1) is right, then down.
const TOY = {
  id: "toy",
  par: 2,
  cols: 3,
  rows: 3,
  goal: { x: 1, y: 1 },
  blocks: [
    { kind: "hero", x: 0, y: 0 },
    { kind: "soldier", x: 0, y: 2 },
  ],
};

const SOLVED = {
  id: "solved",
  par: 0,
  cols: 3,
  rows: 3,
  goal: { x: 0, y: 0 },
  blocks: [{ kind: "hero", x: 0, y: 0 }],
};

const STUCK = {
  id: "stuck",
  par: 0,
  cols: 2,
  rows: 3,
  goal: { x: 0, y: 1 },
  blocks: [
    { kind: "hero", x: 0, y: 0 },
    { kind: "soldier", x: 0, y: 2 },
    { kind: "soldier", x: 1, y: 2 },
  ],
};

describe("positionKey", () => {
  it("tells two different positions apart", () => {
    const game = createGame(TOY);
    const before = positionKey(game);
    move(game, 0, 1);
    expect(positionKey(game)).not.toBe(before);
  });

  it("treats blocks of the same kind as interchangeable", () => {
    const twoSoldiers = (a, b) => ({
      id: "pair",
      par: 0,
      cols: 3,
      rows: 1,
      goal: { x: 0, y: 0 },
      blocks: [
        { kind: "soldier", x: a, y: 0 },
        { kind: "soldier", x: b, y: 0 },
      ],
    });
    expect(positionKey(createGame(twoSoldiers(0, 1)))).toBe(
      positionKey(createGame(twoSoldiers(1, 0)))
    );
  });
});

describe("solutionMoves", () => {
  it("returns a line of moves that actually solves the level", () => {
    const line = solutionMoves(TOY);
    expect(line.length).toBe(2);
    const game = createGame(TOY);
    for (const step of line) {
      expect(move(game, step.id, step.direction), JSON.stringify(step)).toBe(true);
    }
    expect(isSolved(game)).toBe(true);
  });

  it("returns nothing to do for a level that starts solved", () => {
    expect(solutionMoves(SOLVED)).toEqual([]);
    expect(shortestSolution(SOLVED)).toBe(0);
  });

  it("returns null when the hero can never reach the goal", () => {
    expect(solutionMoves(STUCK)).toBeNull();
    expect(shortestSolution(STUCK)).toBeNull();
  });

  it("gives up loudly rather than searching forever", () => {
    expect(() => solutionMoves(TOY, 1)).toThrow(/gave up/);
  });
});
