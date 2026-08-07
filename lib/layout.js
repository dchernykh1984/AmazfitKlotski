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

// The records screen is the one screen with nothing behind it worth showing: it
// is paged, not played, so it drops the panel and uses the whole round face.
// That buys type half again as large as a menu row, and room to hang the boards
// on either side of this one at the top and the bottom, dimmed, so it is visible
// that the ladder goes on above and below. The vertical positions are fractions
// of the diameter rather than pixels of the design, because what has to hold on
// every screen is where these lines sit in the circle, not how far apart they
// are. Each line is then cut to the chord at its own height, which is what keeps
// the wide ones off the bezel.
export const DESIGN_RECORDS = {
  row: 34,
  neighbour: 26,
  gap: 16,
  backWidth: 196,
  aboveCenter: 0.13,
  blockCenter: 0.44,
  belowCenter: 0.75,
  backTop: 0.82,
};

// Moves, time and minimum: the three lines that make up one board's record.
export const RECORD_LINES = 3;

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

// The lines of the records screen, top to bottom: the board above dimmed, the
// board being read, its three figures, the board below dimmed, and the way out.
function recordsScreen(screenSize, scale, padding) {
  const title = at(scale, DESIGN_TEXT.title, MIN_TEXT);
  const row = at(scale, DESIGN_RECORDS.row, MIN_TEXT);
  const neighbour = at(scale, DESIGN_RECORDS.neighbour, MIN_TEXT);
  const gap = at(scale, DESIGN_RECORDS.gap);
  // Full width, so only the circle decides how wide a line may be.
  const line = (top, height, width) =>
    centeredBox(screenSize, top, height, width || screenSize, padding);

  const blockHeight = title + gap + RECORD_LINES * row;
  const blockTop = Math.round(screenSize * DESIGN_RECORDS.blockCenter - blockHeight / 2);
  const rows = [];
  for (let i = 0; i < RECORD_LINES; i++) {
    rows.push(line(blockTop + title + gap + i * row, row));
  }

  return {
    above: line(Math.round(screenSize * DESIGN_RECORDS.aboveCenter - neighbour / 2), neighbour),
    title: line(blockTop, title),
    rows,
    below: line(Math.round(screenSize * DESIGN_RECORDS.belowCenter - neighbour / 2), neighbour),
    back: line(
      Math.round(screenSize * DESIGN_RECORDS.backTop),
      at(scale, DESIGN_WIDE_BUTTON.h),
      at(scale, DESIGN_RECORDS.backWidth)
    ),
  };
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
  // The two round controls are the one thing here that does NOT scale. They are
  // buttons carrying a picture, and a Zepp OS button draws that picture at the
  // size of the file - there is no auto_scale on a button, which is exactly why
  // the block tiles had to become images. A box that shrank away from its icon
  // would leave the glyph hanging over the tray with part of it outside the area
  // that is actually tappable. There is room for a full-size control beside the
  // board on every screen the bundle ships for, so the box stays put.
  const buttonSize = DESIGN_BUTTON_SIZE;
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
    records: recordsScreen(screenSize, scale, padding),
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
