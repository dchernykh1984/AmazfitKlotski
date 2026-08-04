import { describe, it, expect } from "vitest";
import {
  DESIGN_CELL,
  DESIGN_SIZE,
  DESIGN_TILE_GAP,
  MIN_TEXT,
  cellAt,
  nativeTileSize,
  scaleFor,
  screenLayout,
  selectionBox,
  tileBox,
  tileSize,
} from "../lib/layout.js";
import { BOARD_COLS, BOARD_ROWS, GOAL, LEVELS } from "../lib/levels.js";
import { KINDS, createGame } from "../lib/klotski.js";
import { CONTROL_ART, allArt } from "../lib/pieces.js";

// Every round screen the store bundle Zeus builds actually carries a package for.
// The app.json target names 466 and 480, but Zeus expands a round target to every
// round size it knows, so the game has to hold together on all of these.
const SHIPPED_SIZES = [360, 416, 454, 466, 480];

function corners(box) {
  return [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
}

function worstCorner(size, box) {
  const radius = size / 2;
  return Math.max(...corners(box).map(([x, y]) => Math.hypot(x - radius, y - radius)));
}

function insideScreen(size, box, margin) {
  return worstCorner(size, box) <= size / 2 - margin;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const CONTROLS = ["counter", "undo", "menu", "restart"];

describe("the 466px design", () => {
  it("is drawn exactly as designed, unscaled", () => {
    const layout = screenLayout(DESIGN_SIZE);
    expect(scaleFor(DESIGN_SIZE)).toBe(1);
    expect(layout.board.cell).toBe(DESIGN_CELL);
    expect(layout.board.gap).toBe(DESIGN_TILE_GAP);
    expect(layout.board.w).toBe(BOARD_COLS * DESIGN_CELL);
    expect(layout.board.h).toBe(BOARD_ROWS * DESIGN_CELL);
  });
});

describe("every screen the bundle ships for", () => {
  it("scales the board with the screen", () => {
    let previous = 0;
    for (const size of SHIPPED_SIZES) {
      const { board } = screenLayout(size);
      expect(board.w, String(size)).toBe(BOARD_COLS * board.cell);
      expect(board.h, String(size)).toBe(BOARD_ROWS * board.cell);
      // A bigger watch gets a bigger board, never a smaller one.
      expect(board.cell, String(size)).toBeGreaterThanOrEqual(previous);
      previous = board.cell;
    }
  });

  it("centres the board", () => {
    for (const size of SHIPPED_SIZES) {
      const { board } = screenLayout(size);
      expect(Math.abs(board.x + board.w / 2 - size / 2), String(size)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(board.y + board.h / 2 - size / 2), String(size)).toBeLessThanOrEqual(0.5);
    }
  });

  it("keeps the board and its tray off the bezel", () => {
    for (const size of SHIPPED_SIZES) {
      const layout = screenLayout(size);
      expect(insideScreen(size, layout.board, layout.padding), `${size}/board`).toBe(true);
      expect(insideScreen(size, layout.tray, 0), `${size}/tray`).toBe(true);
    }
  });

  it("keeps every control on the screen and off the board", () => {
    for (const size of SHIPPED_SIZES) {
      const layout = screenLayout(size);
      for (const name of CONTROLS) {
        expect(insideScreen(size, layout[name], 0), `${size}/${name}`).toBe(true);
        expect(overlaps(layout[name], layout.board), `${size}/${name} over the board`).toBe(false);
      }
      // Nor may two controls land on top of each other.
      for (let i = 0; i < CONTROLS.length; i++) {
        for (let j = i + 1; j < CONTROLS.length; j++) {
          const a = layout[CONTROLS[i]];
          const b = layout[CONTROLS[j]];
          expect(overlaps(a, b), `${size}: ${CONTROLS[i]} over ${CONTROLS[j]}`).toBe(false);
        }
      }
    }
  });

  it("keeps the icon buttons at exactly the size their pictures are cut at", () => {
    // A button draws its picture at the size of the file, so this box may not
    // scale away from the art the way a tile's does: the glyph would spill over
    // the tray and part of it would stop being tappable.
    const icon = allArt().find((entry) => entry.file === CONTROL_ART.undo.normal);
    for (const size of SHIPPED_SIZES) {
      const layout = screenLayout(size);
      expect(layout.undo.w, `${size}/undo`).toBe(icon.size.w);
      expect(layout.undo.h, `${size}/undo`).toBe(icon.size.h);
      expect(layout.menu.w, `${size}/menu`).toBe(icon.size.w);
      expect(layout.menu.h, `${size}/menu`).toBe(icon.size.h);
    }
  });

  it("leaves every control big enough to hit and to read", () => {
    for (const size of SHIPPED_SIZES) {
      const layout = screenLayout(size);
      // A finger needs something to aim at, and the restart button carries a word.
      expect(layout.undo.w, `${size}/undo`).toBeGreaterThanOrEqual(40);
      expect(layout.menu.w, `${size}/menu`).toBeGreaterThanOrEqual(40);
      expect(layout.restart.w, `${size}/restart`).toBeGreaterThanOrEqual(90);
      expect(layout.restart.h, `${size}/restart`).toBeGreaterThanOrEqual(30);
      expect(layout.counter.w, `${size}/counter`).toBeGreaterThanOrEqual(90);
      expect(layout.counter.h, `${size}/counter`).toBeGreaterThanOrEqual(24);
    }
  });

  it("keeps the type readable and in proportion", () => {
    for (const size of SHIPPED_SIZES) {
      const { text } = screenLayout(size);
      for (const key of Object.keys(text)) {
        expect(text[key], `${size}/${key}`).toBeGreaterThanOrEqual(key === "gap" ? 1 : MIN_TEXT);
      }
      expect(text.title, String(size)).toBeGreaterThan(text.row);
      expect(text.row, String(size)).toBeGreaterThan(text.small);
    }
  });

  it("fits a whole menu inside the panel it is drawn on", () => {
    for (const size of SHIPPED_SIZES) {
      const layout = screenLayout(size);
      // The tallest menu the game draws: the solved screen.
      const stack =
        layout.text.title +
        layout.text.gap +
        layout.text.row +
        layout.text.small +
        layout.text.gap +
        layout.text.button +
        layout.text.gap +
        layout.text.button;
      expect(stack, `${size}/menu height`).toBeLessThanOrEqual(layout.board.h);
      expect(layout.menuWidth, `${size}/menu width`).toBeLessThan(layout.board.w);
      expect(layout.menuWidth, `${size}/menu width`).toBeGreaterThan(layout.board.w * 0.8);
    }
  });

  it("wraps the tray around the board and cuts the gate through it", () => {
    for (const size of SHIPPED_SIZES) {
      const { board, tray, gate } = screenLayout(size);
      const margin = board.x - tray.x;
      expect(margin, String(size)).toBeGreaterThan(0);
      expect(board.y - tray.y, String(size)).toBe(margin);
      expect(tray.x + tray.w - (board.x + board.w), String(size)).toBe(margin);
      expect(tray.y + tray.h - (board.y + board.h), String(size)).toBe(margin);

      expect(gate.x, String(size)).toBe(board.x + GOAL.x * board.cell);
      expect(gate.w, String(size)).toBe(KINDS.hero.w * board.cell);
      expect(gate.y, String(size)).toBe(board.y + board.h);
      expect(gate.y + gate.h, String(size)).toBe(tray.y + tray.h);
    }
  });

  it("keeps every block of every level inside the board", () => {
    for (const size of SHIPPED_SIZES) {
      const board = screenLayout(size).board;
      for (const level of LEVELS) {
        for (const block of createGame(level).blocks) {
          const box = tileBox(board, block.x, block.y, block.w, block.h);
          expect(box.x, `${size}/${level.id}`).toBeGreaterThanOrEqual(board.x);
          expect(box.y, `${size}/${level.id}`).toBeGreaterThanOrEqual(board.y);
          expect(box.x + box.w, `${size}/${level.id}`).toBeLessThanOrEqual(board.x + board.w);
          expect(box.y + box.h, `${size}/${level.id}`).toBeLessThanOrEqual(board.y + board.h);
          expect(box.w, `${size}/${level.id}`).toBeGreaterThan(0);
          expect(box.h, `${size}/${level.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("draws a tile close to the shape its picture was cut in", () => {
    // The pictures are scaled into the cell, so a tile that is a different shape
    // from its file would stretch the portrait out of true.
    for (const size of SHIPPED_SIZES) {
      const board = screenLayout(size).board;
      for (const kind of Object.keys(KINDS)) {
        const { w, h } = KINDS[kind];
        const drawn = tileBox(board, 0, 0, w, h);
        const native = nativeTileSize(w, h);
        const drawnRatio = drawn.w / drawn.h;
        const nativeRatio = native.w / native.h;
        expect(Math.abs(drawnRatio - nativeRatio), `${size}/${kind}`).toBeLessThan(0.06);
      }
    }
  });
});

describe("smaller screens keep the board playable", () => {
  it("never lets a cell get too small to see a portrait in", () => {
    for (const size of SHIPPED_SIZES) {
      expect(screenLayout(size).board.cell, String(size)).toBeGreaterThanOrEqual(40);
    }
  });

  it("leaves a cap above and below the board for the counter and the buttons", () => {
    for (const size of SHIPPED_SIZES) {
      const layout = screenLayout(size);
      const cap = (size - layout.board.h) / 2;
      expect(cap, String(size)).toBeGreaterThanOrEqual(layout.counter.h + 2 * layout.padding);
    }
  });
});

describe("tileSize", () => {
  it("insets a block on every side", () => {
    expect(tileSize(60, 2, 1, 1)).toEqual({ w: 56, h: 56 });
    expect(tileSize(60, 2, 2, 2)).toEqual({ w: 116, h: 116 });
    expect(tileSize(46, 2, 1, 2)).toEqual({ w: 42, h: 88 });
  });

  it("leaves a visible gap between neighbours", () => {
    for (const size of SHIPPED_SIZES) {
      const board = screenLayout(size).board;
      const left = tileBox(board, 0, 0, 1, 1);
      const right = tileBox(board, 1, 0, 1, 1);
      expect(right.x - (left.x + left.w), String(size)).toBe(2 * board.gap);
    }
  });
});

describe("nativeTileSize", () => {
  it("is the size the files are cut at, whatever the screen", () => {
    expect(nativeTileSize(2, 2)).toEqual({ w: 116, h: 116 });
    expect(nativeTileSize(1, 1)).toEqual({ w: 56, h: 56 });
    expect(nativeTileSize(1, 2)).toEqual({ w: 56, h: 116 });
    expect(nativeTileSize(2, 1)).toEqual({ w: 116, h: 56 });
  });
});

describe("cellAt", () => {
  it("maps a touch to the cell under it, on any screen", () => {
    for (const size of SHIPPED_SIZES) {
      const board = screenLayout(size).board;
      expect(cellAt(board, board.x + 1, board.y + 1), String(size)).toEqual({
        column: 0,
        row: 0,
      });
      expect(cellAt(board, board.x + board.cell, board.y + 2 * board.cell), String(size)).toEqual({
        column: 1,
        row: 2,
      });
      expect(cellAt(board, board.x + board.w - 1, board.y + board.h - 1), String(size)).toEqual({
        column: BOARD_COLS - 1,
        row: BOARD_ROWS - 1,
      });
    }
  });

  it("returns null for a touch that missed the board", () => {
    const board = screenLayout(DESIGN_SIZE).board;
    expect(cellAt(board, board.x - 1, board.y)).toBeNull();
    expect(cellAt(board, board.x, board.y - 1)).toBeNull();
    expect(cellAt(board, board.x + board.w, board.y)).toBeNull();
    expect(cellAt(board, board.x, board.y + board.h)).toBeNull();
  });

  it("agrees with tileBox on every cell", () => {
    for (const size of SHIPPED_SIZES) {
      const board = screenLayout(size).board;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let column = 0; column < BOARD_COLS; column++) {
          const box = tileBox(board, column, row, 1, 1);
          expect(cellAt(board, box.x, box.y), `${size}`).toEqual({ column, row });
          expect(cellAt(board, box.x + box.w - 1, box.y + box.h - 1), `${size}`).toEqual({
            column,
            row,
          });
        }
      }
    }
  });
});

describe("selectionBox", () => {
  it("frames a block without covering it", () => {
    const layout = screenLayout(DESIGN_SIZE);
    const tile = tileBox(layout.board, 1, 0, 2, 2);
    const ring = selectionBox(tile, layout.selection.margin);
    expect(ring.x).toBe(tile.x - layout.selection.margin);
    expect(ring.y).toBe(tile.y - layout.selection.margin);
    expect(ring.w).toBe(tile.w + 2 * layout.selection.margin);
    expect(ring.h).toBe(tile.h + 2 * layout.selection.margin);
  });

  it("stays inside the cells the block occupies, on every screen", () => {
    for (const size of SHIPPED_SIZES) {
      const layout = screenLayout(size);
      const board = layout.board;
      // The ring may eat into the gap between blocks but must not reach the
      // neighbouring cell, or it would sit on top of another portrait.
      expect(layout.selection.margin, String(size)).toBeLessThanOrEqual(board.gap);
      const ring = selectionBox(tileBox(board, 1, 1, 1, 1), layout.selection.margin);
      expect(ring.x, String(size)).toBeGreaterThanOrEqual(board.x + board.cell);
      expect(ring.x + ring.w, String(size)).toBeLessThanOrEqual(board.x + 2 * board.cell);
    }
  });
});
