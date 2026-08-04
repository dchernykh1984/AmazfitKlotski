// Where everything sits on the watch face. Pure arithmetic, no Zepp OS, so the
// whole screen can be checked in unit tests.
//
// The board is drawn at a fixed cell size rather than scaled to the screen: the
// block faces are real pictures, and pictures cannot be stretched to a different
// number of pixels on every model without going soft. Both round targets are
// within a few percent of the 466px design, so the board is simply centred and
// the round caps above and below it carry the counter and the controls.
import { BOARD_COLS, BOARD_ROWS } from "./levels.js";
import { centeredBox } from "./round-geometry.js";

export const DESIGN_SIZE = 466;
export const CELL = 60;

// Pixels trimmed off each side of a cell, so neighbouring blocks read as separate
// pieces instead of one wall.
export const TILE_GAP = 2;

export const BOARD_EDGE = 4;
export const SCREEN_PADDING = 8;

// Round control buttons live in the margins beside the board and in the cap under
// it, where nothing ever covers them.
export const BUTTON_SIZE = 56;
export const BUTTON_GAP = 12;
export const WIDE_BUTTON = { w: 140, h: 44 };

// The move counter sits high in the round cap, where the screen has already
// narrowed; it only ever holds a couple of numbers, so it is kept well inside the
// chord rather than stretched to the width of the board.
export const COUNTER_HEIGHT = 36;
export const COUNTER_WIDTH = 200;

// The pixel size of a block that covers `cols` x `rows` cells.
export function tileSize(cols, rows) {
  return { w: cols * CELL - 2 * TILE_GAP, h: rows * CELL - 2 * TILE_GAP };
}

// Every box the page draws, for a screen of the given size.
export function screenLayout(screenSize) {
  const center = screenSize / 2;
  const width = BOARD_COLS * CELL;
  const height = BOARD_ROWS * CELL;
  const board = {
    x: Math.round(center - width / 2),
    y: Math.round(center - height / 2),
    w: width,
    h: height,
  };
  const buttonTop = Math.round(center - BUTTON_SIZE / 2);
  return {
    screenSize,
    board,
    // The counter sits in the round cap above the board, so it is only as wide as
    // the circle allows at that height.
    counter: centeredBox(
      screenSize,
      board.y - BUTTON_GAP - COUNTER_HEIGHT,
      COUNTER_HEIGHT,
      COUNTER_WIDTH,
      SCREEN_PADDING
    ),
    undo: {
      x: board.x - BUTTON_GAP - BUTTON_SIZE,
      y: buttonTop,
      w: BUTTON_SIZE,
      h: BUTTON_SIZE,
    },
    menu: {
      x: board.x + board.w + BUTTON_GAP,
      y: buttonTop,
      w: BUTTON_SIZE,
      h: BUTTON_SIZE,
    },
    restart: centeredBox(
      screenSize,
      board.y + board.h + BUTTON_GAP,
      WIDE_BUTTON.h,
      WIDE_BUTTON.w,
      SCREEN_PADDING
    ),
  };
}

// The pixel box of a block standing at cell (column, row) and covering cols x rows
// cells, inset so it does not touch its neighbours.
export function tileBox(board, column, row, cols, rows) {
  const size = tileSize(cols, rows);
  return {
    x: board.x + column * CELL + TILE_GAP,
    y: board.y + row * CELL + TILE_GAP,
    w: size.w,
    h: size.h,
  };
}

// The cell under a touch, or null when the touch missed the board. This is what
// turns a tap into a selected block.
export function cellAt(board, x, y) {
  if (x < board.x || y < board.y || x >= board.x + board.w || y >= board.y + board.h) {
    return null;
  }
  return {
    column: Math.floor((x - board.x) / CELL),
    row: Math.floor((y - board.y) / CELL),
  };
}

// The gap in the bottom wall the hero escapes through, drawn as a bright sill
// under the goal cells.
export function exitBox(board, goal, heroCols) {
  return {
    x: board.x + goal.x * CELL,
    y: board.y + board.h,
    w: heroCols * CELL,
    h: BOARD_EDGE,
  };
}
