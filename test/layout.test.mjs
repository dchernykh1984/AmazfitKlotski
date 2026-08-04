import { describe, it, expect } from "vitest";
import {
  BUTTON_SIZE,
  CELL,
  DESIGN_SIZE,
  SCREEN_PADDING,
  TILE_GAP,
  cellAt,
  exitBox,
  screenLayout,
  tileBox,
  tileSize,
} from "../lib/layout.js";
import { BOARD_COLS, BOARD_ROWS, GOAL, LEVELS } from "../lib/levels.js";
import { KINDS, createGame } from "../lib/klotski.js";

// The round targets the app is built for.
const ROUND_SIZES = [466, 480];

function insideScreen(size, box) {
  const radius = size / 2;
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  return corners.every(([x, y]) => {
    const dx = x - radius;
    const dy = y - radius;
    return Math.sqrt(dx * dx + dy * dy) <= radius - SCREEN_PADDING;
  });
}

describe("screenLayout", () => {
  it("centres a whole board of fixed cells", () => {
    for (const size of ROUND_SIZES) {
      const { board } = screenLayout(size);
      expect(board.w, String(size)).toBe(BOARD_COLS * CELL);
      expect(board.h, String(size)).toBe(BOARD_ROWS * CELL);
      expect(Math.abs(board.x + board.w / 2 - size / 2), String(size)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(board.y + board.h / 2 - size / 2), String(size)).toBeLessThanOrEqual(0.5);
    }
  });

  it("keeps the board inside the round screen", () => {
    for (const size of ROUND_SIZES) {
      expect(insideScreen(size, screenLayout(size).board), String(size)).toBe(true);
    }
  });

  it("keeps every control inside the round screen", () => {
    for (const size of ROUND_SIZES) {
      const layout = screenLayout(size);
      for (const name of ["counter", "undo", "menu", "restart"]) {
        expect(insideScreen(size, layout[name]), `${size}/${name}`).toBe(true);
      }
    }
  });

  it("never lets a control overlap the board", () => {
    for (const size of ROUND_SIZES) {
      const layout = screenLayout(size);
      const board = layout.board;
      for (const name of ["counter", "undo", "menu", "restart"]) {
        const box = layout[name];
        const overlaps =
          box.x < board.x + board.w &&
          box.x + box.w > board.x &&
          box.y < board.y + board.h &&
          box.y + box.h > board.y;
        expect(overlaps, `${size}/${name}`).toBe(false);
      }
    }
  });

  it("puts undo and the menu on opposite sides at the same height", () => {
    const layout = screenLayout(DESIGN_SIZE);
    expect(layout.undo.y).toBe(layout.menu.y);
    expect(layout.undo.w).toBe(BUTTON_SIZE);
    expect(layout.undo.x).toBeLessThan(layout.board.x);
    expect(layout.menu.x).toBeGreaterThan(layout.board.x + layout.board.w);
  });

  it("draws the same board on both round targets, only shifted", () => {
    const small = screenLayout(466);
    const large = screenLayout(480);
    expect(large.board.x - small.board.x).toBe(large.board.y - small.board.y);
    expect(large.board.w).toBe(small.board.w);
  });
});

describe("tileSize", () => {
  it("insets a block on every side", () => {
    expect(tileSize(1, 1)).toEqual({ w: CELL - 2 * TILE_GAP, h: CELL - 2 * TILE_GAP });
    expect(tileSize(2, 2)).toEqual({ w: 2 * CELL - 2 * TILE_GAP, h: 2 * CELL - 2 * TILE_GAP });
  });

  it("leaves a visible gap between neighbours", () => {
    const board = screenLayout(DESIGN_SIZE).board;
    const left = tileBox(board, 0, 0, 1, 1);
    const right = tileBox(board, 1, 0, 1, 1);
    expect(right.x - (left.x + left.w)).toBe(2 * TILE_GAP);
  });
});

describe("tileBox", () => {
  it("keeps every block of every level inside the board", () => {
    const board = screenLayout(DESIGN_SIZE).board;
    for (const level of LEVELS) {
      for (const block of createGame(level).blocks) {
        const box = tileBox(board, block.x, block.y, block.w, block.h);
        expect(box.x, level.id).toBeGreaterThanOrEqual(board.x);
        expect(box.y, level.id).toBeGreaterThanOrEqual(board.y);
        expect(box.x + box.w, level.id).toBeLessThanOrEqual(board.x + board.w);
        expect(box.y + box.h, level.id).toBeLessThanOrEqual(board.y + board.h);
      }
    }
  });
});

describe("cellAt", () => {
  it("maps a touch to the cell under it", () => {
    const board = screenLayout(DESIGN_SIZE).board;
    expect(cellAt(board, board.x + 1, board.y + 1)).toEqual({ column: 0, row: 0 });
    expect(cellAt(board, board.x + CELL, board.y + 2 * CELL)).toEqual({ column: 1, row: 2 });
    expect(cellAt(board, board.x + board.w - 1, board.y + board.h - 1)).toEqual({
      column: BOARD_COLS - 1,
      row: BOARD_ROWS - 1,
    });
  });

  it("returns null for a touch that missed the board", () => {
    const board = screenLayout(DESIGN_SIZE).board;
    expect(cellAt(board, board.x - 1, board.y)).toBeNull();
    expect(cellAt(board, board.x, board.y - 1)).toBeNull();
    expect(cellAt(board, board.x + board.w, board.y)).toBeNull();
    expect(cellAt(board, board.x, board.y + board.h)).toBeNull();
  });

  it("agrees with tileBox on every cell", () => {
    const board = screenLayout(DESIGN_SIZE).board;
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let column = 0; column < BOARD_COLS; column++) {
        const box = tileBox(board, column, row, 1, 1);
        expect(cellAt(board, box.x, box.y)).toEqual({ column, row });
        expect(cellAt(board, box.x + box.w - 1, box.y + box.h - 1)).toEqual({ column, row });
      }
    }
  });
});

describe("exitBox", () => {
  it("marks the gap in the bottom wall under the goal", () => {
    const board = screenLayout(DESIGN_SIZE).board;
    const exit = exitBox(board, GOAL, KINDS.hero.w);
    expect(exit.x).toBe(board.x + GOAL.x * CELL);
    expect(exit.w).toBe(KINDS.hero.w * CELL);
    expect(exit.y).toBe(board.y + board.h);
    expect(exit.x + exit.w).toBeLessThanOrEqual(board.x + board.w);
  });
});
