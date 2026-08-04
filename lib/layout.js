// Where everything sits on the watch face. Pure arithmetic, no Zepp OS, so the
// whole screen can be checked in unit tests.
//
// The board is drawn to a 466px design and then scaled to the diameter of the
// screen it lands on. That matters more than it sounds: the store bundle Zeus
// builds from a round target carries packages for every round size it knows -
// 360, 416, 454, 466 and 480 - so a board pinned to one cell size would hang off
// the bezel on the smallest of them and leave the counter and the buttons with
// nowhere to go. Everything here is therefore a fraction of the screen, and the
// block pictures are drawn scaled to the cell rather than at their own size.
import { KINDS } from "./klotski.js";
import { BOARD_COLS, BOARD_ROWS, GOAL } from "./levels.js";
import { centeredBox } from "./round-geometry.js";

// The screen every measurement below is drawn for; any other size is this one
// scaled. A 466 watch therefore gets exactly the layout that was designed.
export const DESIGN_SIZE = 466;

// The cell of the design, and the smallest cell worth drawing a portrait in.
export const DESIGN_CELL = 60;
export const MIN_CELL = 24;

// Pixels trimmed off each side of a cell, so neighbouring blocks read as separate
// pieces instead of one wall.
export const DESIGN_TILE_GAP = 2;

// The tray the blocks slide in: how far its rim stands out past the cells, and how
// round its corners and the board's own corners are.
export const DESIGN_TRAY_MARGIN = 6;
export const DESIGN_TRAY_RADIUS = 14;

// The ring drawn around the selected block, just outside it.
export const DESIGN_SELECTION_MARGIN = 1;
export const DESIGN_SELECTION_RADIUS = 8;
export const DESIGN_SELECTION_WIDTH = 3;

export const DESIGN_SCREEN_PADDING = 8;

// Round control buttons live in the margins beside the board and in the cap under
// it, where nothing ever covers them.
export const DESIGN_BUTTON_SIZE = 56;
export const DESIGN_BUTTON_GAP = 12;
export const DESIGN_WIDE_BUTTON = { w: 140, h: 44 };

// The move counter sits high in the round cap, where the screen has already
// narrowed; it only ever holds a couple of numbers, so it is kept well inside the
// chord rather than stretched to the width of the board.
export const DESIGN_COUNTER = { w: 200, h: 36 };

// A menu is drawn on a panel over the board; its rows stop short of the panel's
// rounded corners.
export const DESIGN_MENU_INSET = 8;

// The type scale of the menus, and the smallest size still worth reading on a
// wrist.
export const DESIGN_TEXT = {
  title: 40,
  row: 30,
  small: 24,
  hint: 22,
  button: 46,
  gap: 10,
};
export const MIN_TEXT = 12;

// How much of the design fits on this screen.
export function scaleFor(screenSize) {
  return screenSize / DESIGN_SIZE;
}

function at(scale, value, minimum = 1) {
  return Math.max(minimum, Math.round(value * scale));
}

// The pixel size of a block that covers `cols` x `rows` cells.
export function tileSize(cell, gap, cols, rows) {
  return { w: cols * cell - 2 * gap, h: rows * cell - 2 * gap };
}

// Every box the page draws, for a screen of the given size. The board carries its
// own cell and gap, so a tile box can be worked out from the board alone.
export function screenLayout(screenSize) {
  const scale = scaleFor(screenSize);
  const center = screenSize / 2;
  const cell = Math.max(MIN_CELL, Math.round(DESIGN_CELL * scale));
  const gap = at(scale, DESIGN_TILE_GAP);
  const trayMargin = at(scale, DESIGN_TRAY_MARGIN);
  const trayRadius = at(scale, DESIGN_TRAY_RADIUS);
  const buttonSize = at(scale, DESIGN_BUTTON_SIZE);
  const buttonGap = at(scale, DESIGN_BUTTON_GAP);
  const padding = at(scale, DESIGN_SCREEN_PADDING);
  const counterHeight = at(scale, DESIGN_COUNTER.h);

  const width = BOARD_COLS * cell;
  const height = BOARD_ROWS * cell;
  const board = {
    x: Math.round(center - width / 2),
    y: Math.round(center - height / 2),
    w: width,
    h: height,
    cell,
    gap,
  };
  const buttonTop = Math.round(center - buttonSize / 2);

  return {
    screenSize,
    scale,
    board,
    padding,
    // The rim around the board, and the gap in it the hero leaves through: the
    // gate is drawn from the board's bottom edge right through the rim, so it
    // reads as a way out rather than a stripe.
    tray: {
      x: board.x - trayMargin,
      y: board.y - trayMargin,
      w: board.w + 2 * trayMargin,
      h: board.h + 2 * trayMargin,
      radius: trayRadius,
    },
    boardRadius: Math.max(1, trayRadius - trayMargin),
    gate: {
      x: board.x + GOAL.x * cell,
      y: board.y + board.h,
      w: KINDS.hero.w * cell,
      h: trayMargin,
    },
    selection: {
      margin: at(scale, DESIGN_SELECTION_MARGIN),
      radius: at(scale, DESIGN_SELECTION_RADIUS),
      width: at(scale, DESIGN_SELECTION_WIDTH),
    },
    // A menu covers the board exactly, and its rows sit inside that panel.
    menuWidth: board.w - 2 * at(scale, DESIGN_MENU_INSET),
    // The counter sits in the round cap above the board, so it is only as wide as
    // the circle allows at that height.
    counter: centeredBox(
      screenSize,
      board.y - buttonGap - counterHeight,
      counterHeight,
      at(scale, DESIGN_COUNTER.w),
      padding
    ),
    undo: {
      x: board.x - buttonGap - buttonSize,
      y: buttonTop,
      w: buttonSize,
      h: buttonSize,
    },
    menu: {
      x: board.x + board.w + buttonGap,
      y: buttonTop,
      w: buttonSize,
      h: buttonSize,
    },
    restart: centeredBox(
      screenSize,
      board.y + board.h + buttonGap,
      at(scale, DESIGN_WIDE_BUTTON.h),
      at(scale, DESIGN_WIDE_BUTTON.w),
      padding
    ),
    text: {
      title: at(scale, DESIGN_TEXT.title, MIN_TEXT),
      row: at(scale, DESIGN_TEXT.row, MIN_TEXT),
      small: at(scale, DESIGN_TEXT.small, MIN_TEXT),
      hint: at(scale, DESIGN_TEXT.hint, MIN_TEXT),
      button: at(scale, DESIGN_TEXT.button, MIN_TEXT),
      gap: at(scale, DESIGN_TEXT.gap),
    },
  };
}

// The pixel box of a block standing at cell (column, row) and covering cols x rows
// cells, inset so it does not touch its neighbours.
export function tileBox(board, column, row, cols, rows) {
  const size = tileSize(board.cell, board.gap, cols, rows);
  return {
    x: board.x + column * board.cell + board.gap,
    y: board.y + row * board.cell + board.gap,
    w: size.w,
    h: size.h,
  };
}

// The box the selection ring is drawn on, just outside the block's own box.
export function selectionBox(tile, margin) {
  return {
    x: tile.x - margin,
    y: tile.y - margin,
    w: tile.w + 2 * margin,
    h: tile.h + 2 * margin,
  };
}

// The cell under a touch, or null when the touch missed the board. This is how a
// tap on the tray is turned into the block that was under the finger.
export function cellAt(board, x, y) {
  if (x < board.x || y < board.y || x >= board.x + board.w || y >= board.y + board.h) {
    return null;
  }
  return {
    column: Math.floor((x - board.x) / board.cell),
    row: Math.floor((y - board.y) / board.cell),
  };
}

// The size the block pictures are stored at. They are drawn scaled to whatever
// cell this screen ended up with, but the files themselves are cut for the design.
export function nativeTileSize(cols, rows) {
  return tileSize(DESIGN_CELL, DESIGN_TILE_GAP, cols, rows);
}
