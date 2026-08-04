import { describe, it, expect } from "vitest";
import {
  DIRECTIONS,
  DOWN,
  EMPTY,
  HERO,
  KINDS,
  LEFT,
  RIGHT,
  UP,
  canMove,
  createGame,
  isSolved,
  move,
  occupancy,
  restart,
  stepFor,
  undo,
} from "../lib/klotski.js";

// A tiny board with room to move, so the rules can be checked one step at a time:
//   H H .
//   H H .
//   S . .
const TOY = {
  id: "toy",
  par: 3,
  cols: 3,
  rows: 3,
  goal: { x: 1, y: 1 },
  blocks: [
    { kind: "hero", x: 0, y: 0 },
    { kind: "soldier", x: 0, y: 2 },
  ],
};

function gridOf(game) {
  const grid = occupancy(game);
  const rows = [];
  for (let y = 0; y < game.rows; y++) {
    rows.push(
      grid
        .slice(y * game.cols, y * game.cols + game.cols)
        .map((id) => (id === EMPTY ? "." : String(id)))
        .join("")
    );
  }
  return rows;
}

describe("createGame", () => {
  it("gives every block its footprint and an id equal to its index", () => {
    const game = createGame(TOY);
    expect(game.blocks[0]).toMatchObject({ id: 0, kind: HERO, x: 0, y: 0, w: 2, h: 2 });
    expect(game.blocks[1]).toMatchObject({ id: 1, kind: "soldier", w: 1, h: 1 });
    expect(game.heroId).toBe(0);
    expect(game.moves).toBe(0);
    expect(game.history).toEqual([]);
  });

  it("copies the level so the definition can be replayed", () => {
    const game = createGame(TOY);
    move(game, 0, RIGHT);
    expect(TOY.blocks[0]).toEqual({ kind: "hero", x: 0, y: 0 });
    expect(createGame(TOY).blocks[0].x).toBe(0);
  });

  it("knows every kind's footprint", () => {
    expect(KINDS.hero).toEqual({ w: 2, h: 2 });
    expect(KINDS.guard).toEqual({ w: 2, h: 1 });
    expect(KINDS.general).toEqual({ w: 1, h: 2 });
    expect(KINDS.soldier).toEqual({ w: 1, h: 1 });
  });
});

describe("occupancy", () => {
  it("marks every cell a block covers and leaves the rest empty", () => {
    expect(gridOf(createGame(TOY))).toEqual(["00.", "00.", "1.."]);
  });

  it("follows a block that has moved", () => {
    const game = createGame(TOY);
    move(game, 0, RIGHT);
    expect(gridOf(game)).toEqual([".00", ".00", "1.."]);
  });
});

describe("canMove", () => {
  it("allows a slide into free cells", () => {
    const game = createGame(TOY);
    expect(canMove(game, 0, RIGHT)).toBe(true);
    expect(canMove(game, 0, DOWN)).toBe(false);
  });

  it("refuses to leave the board", () => {
    const game = createGame(TOY);
    expect(canMove(game, 0, UP)).toBe(false);
    expect(canMove(game, 0, LEFT)).toBe(false);
    expect(canMove(game, 1, LEFT)).toBe(false);
    expect(canMove(game, 1, DOWN)).toBe(false);
  });

  it("refuses to walk through another block", () => {
    const game = createGame(TOY);
    expect(canMove(game, 1, UP)).toBe(false);
  });

  it("ignores the block's own cells when looking for room", () => {
    // A 2x2 hero moving right overlaps its own right hand column.
    const game = createGame(TOY);
    expect(canMove(game, 0, RIGHT)).toBe(true);
  });

  it("says no to an unknown block or a nonsense direction", () => {
    const game = createGame(TOY);
    expect(canMove(game, 99, RIGHT)).toBe(false);
    expect(canMove(game, 0, 42)).toBe(false);
    expect(stepFor(42)).toBeNull();
  });
});

describe("DIRECTIONS", () => {
  it("is the four ways a block can go, in a fixed order", () => {
    expect(DIRECTIONS).toEqual([UP, RIGHT, DOWN, LEFT]);
    const wedged = createGame({
      id: "wedged",
      par: 0,
      cols: 2,
      rows: 2,
      goal: { x: 0, y: 0 },
      blocks: [{ kind: "hero", x: 0, y: 0 }],
    });
    expect(DIRECTIONS.filter((direction) => canMove(wedged, 0, direction))).toEqual([]);
    const open = createGame({
      id: "open",
      par: 0,
      cols: 3,
      rows: 3,
      goal: { x: 0, y: 0 },
      blocks: [{ kind: "soldier", x: 1, y: 1 }],
    });
    expect(DIRECTIONS.filter((direction) => canMove(open, 0, direction))).toEqual(DIRECTIONS);
  });
});

describe("move", () => {
  it("slides one cell, counts the move and records it", () => {
    const game = createGame(TOY);
    expect(move(game, 0, RIGHT)).toBe(true);
    expect(game.blocks[0]).toMatchObject({ x: 1, y: 0 });
    expect(game.moves).toBe(1);
    expect(game.history).toEqual([{ id: 0, direction: RIGHT }]);
  });

  it("changes nothing when the move is illegal", () => {
    const game = createGame(TOY);
    expect(move(game, 0, LEFT)).toBe(false);
    expect(game.blocks[0]).toMatchObject({ x: 0, y: 0 });
    expect(game.moves).toBe(0);
    expect(game.history).toEqual([]);
  });
});

describe("undo", () => {
  it("puts the block back and takes the move off the counter", () => {
    const game = createGame(TOY);
    move(game, 0, RIGHT);
    expect(undo(game)).toEqual({ id: 0, direction: RIGHT });
    expect(game.blocks[0]).toMatchObject({ x: 0, y: 0 });
    expect(game.moves).toBe(0);
    expect(game.history).toEqual([]);
  });

  it("unwinds a whole game move by move", () => {
    const game = createGame(TOY);
    move(game, 0, RIGHT);
    move(game, 1, RIGHT);
    move(game, 0, DOWN);
    while (undo(game)) {
      // keep going
    }
    expect(gridOf(game)).toEqual(["00.", "00.", "1.."]);
    expect(game.moves).toBe(0);
  });

  it("returns null with nothing to take back", () => {
    expect(undo(createGame(TOY))).toBeNull();
  });
});

describe("restart", () => {
  it("puts every block back where the level starts", () => {
    const game = createGame(TOY);
    move(game, 0, RIGHT);
    move(game, 1, RIGHT);
    restart(game);
    expect(game.moves).toBe(0);
    expect(game.history).toEqual([]);
    expect(game.blocks.map((block) => [block.x, block.y])).toEqual(
      TOY.blocks.map((block) => [block.x, block.y])
    );
  });
});

describe("isSolved", () => {
  it("is true only once the hero reaches the goal", () => {
    const game = createGame(TOY);
    expect(isSolved(game)).toBe(false);
    move(game, 0, RIGHT);
    expect(isSolved(game)).toBe(false);
    move(game, 0, DOWN);
    expect(game.blocks[0]).toMatchObject({ x: 1, y: 1 });
    expect(isSolved(game)).toBe(true);
  });

  it("watches the hero and not some other block that reaches the goal", () => {
    //   H H .        the goal is (1, 2), which the soldier can reach first
    //   H H .
    //   . . .
    //   . S .
    const game = createGame({
      id: "decoy",
      par: 0,
      cols: 3,
      rows: 4,
      goal: { x: 1, y: 2 },
      blocks: [
        { kind: "hero", x: 0, y: 0 },
        { kind: "soldier", x: 1, y: 3 },
      ],
    });
    move(game, 1, UP);
    expect(game.blocks[1]).toMatchObject({ x: 1, y: 2 });
    expect(isSolved(game)).toBe(false);
  });
});
