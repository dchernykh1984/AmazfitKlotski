import { describe, it, expect } from "vitest";
import {
  BUTTON_SIZE,
  CELL,
  DESIGN_SIZE,
  MENU_INSET,
  SCREEN_PADDING,
  SELECTION_MARGIN,
  TILE_GAP,
  TRAY_MARGIN,
  screenLayout,
  selectionBox,
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

  it("keeps the board and its tray inside the round screen", () => {
    for (const size of ROUND_SIZES) {
      const layout = screenLayout(size);
      expect(insideScreen(size, layout.board), String(size)).toBe(true);
      expect(insideScreen(size, layout.tray), String(size)).toBe(true);
    }
  });

  it("wraps the tray around the board", () => {
    for (const size of ROUND_SIZES) {
      const { board, tray } = screenLayout(size);
      expect(board.x - tray.x, String(size)).toBe(TRAY_MARGIN);
      expect(board.y - tray.y, String(size)).toBe(TRAY_MARGIN);
      expect(tray.x + tray.w - (board.x + board.w), String(size)).toBe(TRAY_MARGIN);
      expect(tray.y + tray.h - (board.y + board.h), String(size)).toBe(TRAY_MARGIN);
    }
  });

  it("cuts the gate through the tray under the goal", () => {
    for (const size of ROUND_SIZES) {
      const { board, tray, gate } = screenLayout(size);
      expect(gate.x, String(size)).toBe(board.x + GOAL.x * CELL);
      expect(gate.w, String(size)).toBe(KINDS.hero.w * CELL);
      // It starts where the board ends and reaches the outer edge of the tray, so
      // the rim really is open there.
      expect(gate.y, String(size)).toBe(board.y + board.h);
      expect(gate.y + gate.h, String(size)).toBe(tray.y + tray.h);
      expect(gate.x + gate.w, String(size)).toBeLessThanOrEqual(board.x + board.w);
    }
  });

  it("leaves room inside the menu panel for its rows", () => {
    for (const size of ROUND_SIZES) {
      const layout = screenLayout(size);
      expect(layout.menuWidth, String(size)).toBe(layout.board.w - 2 * MENU_INSET);
      expect(layout.menuWidth, String(size)).toBeLessThan(layout.board.w);
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

describe("selectionBox", () => {
  it("frames a block without covering it", () => {
    const board = screenLayout(DESIGN_SIZE).board;
    const tile = tileBox(board, 1, 0, 2, 2);
    const ring = selectionBox(tile);
    expect(ring.x).toBe(tile.x - SELECTION_MARGIN);
    expect(ring.y).toBe(tile.y - SELECTION_MARGIN);
    expect(ring.w).toBe(tile.w + 2 * SELECTION_MARGIN);
    expect(ring.h).toBe(tile.h + 2 * SELECTION_MARGIN);
  });

  it("stays inside the cells the block occupies", () => {
    const board = screenLayout(DESIGN_SIZE).board;
    // The ring may eat into the gap between blocks but must not reach the
    // neighbouring cell, or it would sit on top of another portrait.
    expect(SELECTION_MARGIN).toBeLessThanOrEqual(TILE_GAP);
    const ring = selectionBox(tileBox(board, 1, 1, 1, 1));
    expect(ring.x).toBeGreaterThanOrEqual(board.x + CELL);
    expect(ring.x + ring.w).toBeLessThanOrEqual(board.x + 2 * CELL);
  });
});
