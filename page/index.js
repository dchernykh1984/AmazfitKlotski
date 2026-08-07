import * as hmUI from "@zos/ui";
import { getLanguage } from "@zos/settings";
import {
  onGesture,
  offGesture,
  GESTURE_UP,
  GESTURE_DOWN,
  GESTURE_LEFT,
  GESTURE_RIGHT,
} from "@zos/interaction";
import { setPageBrightTime, resetPageBrightTime } from "@zos/display";
import { LocalStorage } from "@zos/storage";

import {
  DOWN,
  LEFT,
  RIGHT,
  UP,
  blockAt,
  createGame,
  isSolved,
  move,
  restart,
  undo,
} from "../lib/klotski.js";
import { FIRST_LEVEL, levelById, nextLevel, previousLevel } from "../lib/levels.js";
import { CONTROL_ART, assignArt } from "../lib/pieces.js";
import { cellAt, screenLayout, selectionBox, tileBox } from "../lib/layout.js";
import { centeredBox } from "../lib/round-geometry.js";
import { labelFor, languageFromZeppCode, levelLabel } from "../lib/i18n/index.js";
import {
  LEVEL_KEY,
  bestKey,
  bestTimeKey,
  hasRecord,
  normalizeMoves,
  updateBest,
} from "../lib/scores.js";
import { elapsedBetween, formatElapsed, normalizeElapsed } from "../lib/clock.js";
import { SCREEN_SIZE } from "../utils/config/device.js";
import {
  BRIGHT_TIME_MS,
  COLOR_ACCENT,
  COLOR_BACKGROUND,
  COLOR_BOARD,
  COLOR_BUTTON,
  COLOR_BUTTON_PRESSED,
  COLOR_EXIT,
  COLOR_MUTED,
  COLOR_SELECTION,
  COLOR_TEXT,
  COLOR_TRAY,
  PANEL_ALPHA,
} from "../utils/config/constants.js";

const LAYOUT = screenLayout(SCREEN_SIZE);
const BOARD = LAYOUT.board;
const TEXT = LAYOUT.text;

// A widget that failed to take a setting is not worth crashing a game over, and a
// watch that has no storage should still play - just without remembering. The
// in-memory copy keeps the records alive for the rest of the session.
const memory = {};

function readValue(storage, key) {
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      // Fall through to the in-memory copy.
    }
  }
  return memory[key];
}

function writeValue(storage, key, value) {
  memory[key] = value;
  if (storage) {
    try {
      storage.setItem(key, value);
    } catch {
      // The in-memory copy above still holds for this session.
    }
  }
}

// The wall clock, in milliseconds, or 0 when this watch has none to offer. A
// game played on a watch that cannot tell the time is still a game; it simply
// goes into the records without a duration.
function now() {
  try {
    const reading = Date.now();
    return isFinite(reading) && reading > 0 ? reading : 0;
  } catch {
    return 0;
  }
}

// How far a finger may travel and still count as a tap rather than the opening of
// a swipe: a third of a cell, which is smaller than any deliberate slide and
// larger than the wobble of a finger pressing down.
const TAP_SLOP = Math.max(6, Math.round(BOARD.cell / 3));

// Hook one event on a widget. Not every firmware wires touch up to every kind of
// widget, and one that does not must not take the page down with it, so a refusal
// is reported rather than thrown.
function bind(widget, name, callback) {
  try {
    widget.addEventListener(name, callback);
    return true;
  } catch {
    return false;
  }
}

// Hook a tap: a touch that goes down and comes up again in the same place. The
// pick has to wait for the release, because a swipe opens with a touch-down on
// whatever block the finger happens to land on - picking that one would quietly
// steal the swipe from the block the player actually chose.
//
// If a firmware refuses the release event, the pick falls back to the press. A
// game that occasionally picks up the wrong block is still a game; one that can
// never pick up any block at all is not.
function listen(widget, callback) {
  let start = null;
  const onRelease = bind(widget, hmUI.event.CLICK_UP, (info) => {
    const from = start;
    start = null;
    if (!from) {
      // No press was seen, so there is nothing to compare against.
      callback(info);
      return;
    }
    if (info && (Math.abs(info.x - from.x) > TAP_SLOP || Math.abs(info.y - from.y) > TAP_SLOP)) {
      // The finger travelled: that was a swipe, and the swipe belongs to whatever
      // block is already picked up.
      return;
    }
    callback(from);
  });
  const onPress = bind(widget, hmUI.event.CLICK_DOWN, (info) => {
    start = info || null;
    if (!onRelease) {
      callback(info);
    }
  });
  return onPress || onRelease;
}

// The swipes that slide a block, mapped to board directions. Everything else the
// screen sends is ignored.
function directionForGesture(gesture) {
  if (gesture === GESTURE_UP) {
    return UP;
  }
  if (gesture === GESTURE_DOWN) {
    return DOWN;
  }
  if (gesture === GESTURE_LEFT) {
    return LEFT;
  }
  if (gesture === GESTURE_RIGHT) {
    return RIGHT;
  }
  return null;
}

Page({
  state: {
    language: "en",
    levelId: FIRST_LEVEL,
    best: { moves: 0, time: 0 },
    screen: "start",
    game: null,
    art: [],
    selected: null,
    storage: null,
    // When the board opened, by the watch's clock. A game is timed from here to
    // the moment the hero is out - finish minus start, with nothing in between
    // stopping it.
    startedAt: 0,
    // The board whose record is on screen, which is its own thing: reading the
    // records is not choosing what to play next.
    recordsId: FIRST_LEVEL,
    destroyed: false,
    // Widgets, grouped by lifetime: the tray lives as long as the page, the block
    // tiles as long as a game, and the head-up display and the menus only as long
    // as the screen that owns them.
    tiles: [],
    selection: null,
    hud: [],
    counter: null,
    menu: [],
  },

  build() {
    try {
      this.state.language = languageFromZeppCode(getLanguage());
    } catch {
      // Some firmwares do not expose the setting; English rather than a blank
      // screen from a throw inside build().
    }

    try {
      this.state.storage = new LocalStorage();
    } catch {
      // No storage on this device: play on, remembering only for this session.
    }

    // Thinking time is quiet time, and a screen that blacks out mid-puzzle loses
    // the board. Handed back in onDestroy.
    try {
      setPageBrightTime({ brightTime: BRIGHT_TIME_MS });
    } catch {
      // Not fatal: the watch just keeps its own timeout.
    }

    this.state.levelId = levelById(readValue(this.state.storage, LEVEL_KEY)).id;
    this.readBest();

    this.drawTray();
    onGesture({ callback: (event) => this.onGesture(event) });
    this.showStart();
  },

  onDestroy() {
    this.state.destroyed = true;
    try {
      offGesture();
    } catch {
      // Nothing left to unhook.
    }
    try {
      resetPageBrightTime();
    } catch {
      // The setting is dropped with the page anyway.
    }
  },

  // ---------------------------------------------------------------- input ----

  // Swipes slide the selected block while a game is on, pick the board in the
  // start menu, and page through the records. Returning true swallows the
  // gesture: during a game that also blocks the system back-swipe, so sliding a
  // block to the right cannot quit the app by accident. The menus deliberately
  // let the right swipe through, which is how you leave - except the records,
  // which are a screen deeper, so there the right swipe only comes back out.
  onGesture(gesture) {
    if (this.state.destroyed) {
      return false;
    }

    if (this.state.screen === "playing") {
      const direction = directionForGesture(gesture);
      if (direction !== null) {
        this.slide(direction);
      }
      return true;
    }

    if (this.state.screen === "records") {
      if (gesture === GESTURE_RIGHT) {
        this.showStart();
      } else if (gesture === GESTURE_DOWN) {
        this.showRecords(nextLevel(this.state.recordsId).id);
      } else if (gesture === GESTURE_UP) {
        this.showRecords(previousLevel(this.state.recordsId).id);
      }
      return true;
    }

    if (gesture === GESTURE_RIGHT) {
      return false;
    }
    if (this.state.screen === "start") {
      if (gesture === GESTURE_DOWN) {
        this.chooseLevel(nextLevel(this.state.levelId).id);
      } else if (gesture === GESTURE_UP) {
        this.chooseLevel(previousLevel(this.state.levelId).id);
      }
    }
    return true;
  },

  // A tap picks the block a swipe will move. Tapping the same block again is a
  // natural thing to do halfway through sliding it along, so it keeps the block
  // rather than toggling the selection off and swallowing the next swipe.
  select(id) {
    if (this.state.screen !== "playing" || this.state.selected === id) {
      return;
    }
    this.state.selected = id;
    this.drawSelection();
  },

  // A tap that arrived at the board rather than at a tile: work out which cell it
  // landed in and pick whatever block is standing there.
  tapBoard(info) {
    if (!info || this.state.screen !== "playing" || !this.state.game) {
      return;
    }
    const cell = cellAt(BOARD, info.x, info.y);
    if (!cell) {
      return;
    }
    const block = blockAt(this.state.game, cell.column, cell.row);
    if (block) {
      this.select(block.id);
    }
  },

  slide(direction) {
    const game = this.state.game;
    const id = this.state.selected;
    if (!game || id === null || !move(game, id, direction)) {
      return;
    }
    this.drawTile(id);
    this.drawSelection();
    this.drawCounter();
    if (isSolved(game)) {
      this.showSolved();
    }
  },

  undoMove() {
    const game = this.state.game;
    if (this.state.screen !== "playing" || !game) {
      return;
    }
    const undone = undo(game);
    if (!undone) {
      return;
    }
    // Follow the block that came back, so the next swipe carries on from there.
    this.state.selected = undone.id;
    this.drawTile(undone.id);
    this.drawSelection();
    this.drawCounter();
  },

  // ---------------------------------------------------------------- screens ----

  showStart() {
    this.state.screen = "start";
    this.state.game = null;
    this.state.selected = null;
    this.clearTiles();
    this.setHudVisible(false);
    this.readBest();

    const level = levelById(this.state.levelId);
    this.drawMenu([
      { kind: "text", height: TEXT.title, color: COLOR_TEXT, text: this.text("title") },
      { kind: "gap", height: TEXT.gap },
      {
        kind: "button",
        height: TEXT.button,
        text: this.levelName(level),
        onClick: () => this.chooseLevel(nextLevel(this.state.levelId).id),
      },
      {
        kind: "text",
        height: TEXT.small,
        color: COLOR_MUTED,
        text: `${this.text("par")} ${level.par}   ${this.text("best")} ${this.bestText()}`,
      },
      { kind: "gap", height: TEXT.gap },
      {
        kind: "button",
        height: TEXT.button,
        text: this.text("play"),
        onClick: () => this.startGame(),
      },
      {
        kind: "button",
        height: TEXT.button,
        text: this.text("records"),
        onClick: () => this.showRecords(this.state.levelId),
      },
      { kind: "text", height: TEXT.hint, color: COLOR_MUTED, text: this.text("hint") },
    ]);
  },

  // Walk to another board and remember it, so the game reopens where it was left.
  // Each board keeps its own record, so that is reloaded too.
  chooseLevel(levelId) {
    this.state.levelId = levelId;
    writeValue(this.state.storage, LEVEL_KEY, levelId);
    this.showStart();
  },

  startGame() {
    this.clearMenu();
    this.state.screen = "playing";
    this.state.game = createGame(levelById(this.state.levelId));
    this.state.startedAt = now();
    this.state.selected = null;
    this.drawTiles();
    this.setHudVisible(true);
    this.drawSelection();
  },

  restartGame() {
    if (!this.state.game) {
      return;
    }
    this.clearMenu();
    this.state.screen = "playing";
    restart(this.state.game);
    // A board put back the way it started is a new game, and it is timed as one.
    this.state.startedAt = now();
    this.state.selected = null;
    this.drawTiles();
    this.setHudVisible(true);
    this.drawSelection();
  },

  // The menu covers the board rather than replacing it, so the position you are
  // thinking about is still there when you come back.
  showMenu() {
    if (this.state.screen !== "playing") {
      return;
    }
    this.state.screen = "menu";
    this.setHudVisible(false);
    this.drawMenu([
      {
        kind: "button",
        height: TEXT.button,
        text: this.text("resume"),
        onClick: () => this.resumeGame(),
      },
      { kind: "gap", height: TEXT.gap },
      {
        kind: "button",
        height: TEXT.button,
        text: this.text("levels"),
        onClick: () => this.showStart(),
      },
    ]);
  },

  resumeGame() {
    if (this.state.screen !== "menu") {
      return;
    }
    this.clearMenu();
    this.state.screen = "playing";
    this.setHudVisible(true);
  },

  showSolved() {
    this.state.screen = "solved";
    this.state.selected = null;
    this.drawSelection();
    this.setHudVisible(false);

    const moves = this.state.game.moves;
    const time = elapsedBetween(this.state.startedAt, now());
    const result = updateBest(this.state.best, { moves, time });
    this.state.best = result.best;
    if (result.isRecord) {
      this.writeBest(result.best);
    }

    this.drawMenu([
      { kind: "text", height: TEXT.title, color: COLOR_ACCENT, text: this.text("solved") },
      { kind: "gap", height: TEXT.gap },
      {
        kind: "text",
        height: TEXT.row,
        color: COLOR_TEXT,
        text: `${this.text("moves")} ${moves}`,
      },
      {
        kind: "text",
        height: TEXT.small,
        color: COLOR_MUTED,
        text: `${this.text("time")} ${formatElapsed(time, this.text("none"))}`,
      },
      {
        kind: "text",
        height: TEXT.small,
        color: result.isRecord ? COLOR_ACCENT : COLOR_MUTED,
        text: result.isRecord ? this.text("new_best") : `${this.text("best")} ${this.bestText()}`,
      },
      { kind: "gap", height: TEXT.gap },
      {
        kind: "button",
        height: TEXT.button,
        text: this.text("next"),
        onClick: () => this.playNextLevel(),
      },
      { kind: "gap", height: TEXT.gap },
      {
        kind: "button",
        height: TEXT.button,
        text: this.text("again"),
        onClick: () => this.restartGame(),
      },
    ]);
  },

  // One board's record per screen, paged with a swipe up or down and wrapping
  // round, so the whole ladder is reachable without a list that would not fit.
  // Reading the records leaves the chosen board alone.
  showRecords(levelId) {
    const level = levelById(levelId === undefined ? this.state.recordsId : levelId);
    this.state.screen = "records";
    this.state.recordsId = level.id;
    this.state.game = null;
    this.state.selected = null;
    this.clearTiles();
    this.setHudVisible(false);

    const record = this.recordFor(level.id);
    const solved = hasRecord(record);
    this.drawMenu([
      { kind: "text", height: TEXT.row, color: COLOR_ACCENT, text: this.levelName(level) },
      { kind: "gap", height: TEXT.gap },
      {
        kind: "text",
        height: TEXT.small,
        color: COLOR_TEXT,
        text: `${this.text("moves")} ${solved ? record.moves : this.text("none")}`,
      },
      {
        kind: "text",
        height: TEXT.small,
        color: COLOR_TEXT,
        text: `${this.text("time")} ${formatElapsed(record.time, this.text("none"))}`,
      },
      {
        kind: "text",
        height: TEXT.small,
        color: COLOR_MUTED,
        text: `${this.text("par")} ${level.par}`,
      },
      { kind: "gap", height: TEXT.gap },
      {
        kind: "button",
        height: TEXT.button,
        text: this.text("back"),
        onClick: () => this.showStart(),
      },
    ]);
  },

  playNextLevel() {
    this.state.levelId = nextLevel(this.state.levelId).id;
    writeValue(this.state.storage, LEVEL_KEY, this.state.levelId);
    this.readBest();
    this.startGame();
  },

  // ---------------------------------------------------------------- drawing ----

  // The black screen, the tray the blocks slide on and the gap they leave through.
  // Created once and kept for the life of the page: every screen is drawn on top.
  drawTray() {
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_SIZE,
      h: SCREEN_SIZE,
      color: COLOR_BACKGROUND,
    });
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: LAYOUT.tray.x,
      y: LAYOUT.tray.y,
      w: LAYOUT.tray.w,
      h: LAYOUT.tray.h,
      radius: LAYOUT.tray.radius,
      color: COLOR_TRAY,
    });
    const board = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: BOARD.x,
      y: BOARD.y,
      w: BOARD.w,
      h: BOARD.h,
      radius: LAYOUT.boardRadius,
      color: COLOR_BOARD,
    });
    // The board listens for taps as well as the tiles standing on it. Which of
    // the two a firmware delivers a touch to does not matter: both end up asking
    // for the same block, and picking the same block twice is a no-op.
    listen(board, (info) => this.tapBoard(info));
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: LAYOUT.gate.x,
      y: LAYOUT.gate.y,
      w: LAYOUT.gate.w,
      h: LAYOUT.gate.h,
      color: COLOR_EXIT,
    });
  },

  // One tappable tile per block. Blocks never overlap, so the order they are
  // created in does not matter - only the selection ring has to stay on top, and
  // it is always drawn last.
  drawTiles() {
    this.clearTiles();
    const game = this.state.game;
    if (!game) {
      return;
    }
    this.state.art = assignArt(game.blocks);
    for (let id = 0; id < game.blocks.length; id++) {
      this.state.tiles.push(this.createTile(id));
    }
  },

  // The portraits are cut for the 466px design and drawn scaled into whatever cell
  // this screen ended up with, so one set of files serves every round watch the
  // bundle ships for.
  createTile(id) {
    const block = this.state.game.blocks[id];
    const box = tileBox(BOARD, block.x, block.y, block.w, block.h);
    const tile = hmUI.createWidget(hmUI.widget.IMG, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      src: this.state.art[id],
      auto_scale: true,
      auto_scale_obj_fit: true,
    });
    listen(tile, () => this.select(id));
    return tile;
  },

  // A moved block is deleted and drawn again rather than nudged: it is one widget
  // per move, and it keeps the tile and the ring in a known order.
  drawTile(id) {
    if (this.state.tiles[id]) {
      hmUI.deleteWidget(this.state.tiles[id]);
    }
    this.state.tiles[id] = this.createTile(id);
  },

  // The gold ring around the selected block, always created after the tiles so it
  // is never painted over by one.
  drawSelection() {
    if (this.state.selection) {
      hmUI.deleteWidget(this.state.selection);
      this.state.selection = null;
    }
    const game = this.state.game;
    const id = this.state.selected;
    if (!game || id === null || this.state.screen !== "playing") {
      return;
    }
    const block = game.blocks[id];
    const tile = tileBox(BOARD, block.x, block.y, block.w, block.h);
    const ring = selectionBox(tile, LAYOUT.selection.margin);
    this.state.selection = hmUI.createWidget(hmUI.widget.STROKE_RECT, {
      x: ring.x,
      y: ring.y,
      w: ring.w,
      h: ring.h,
      radius: LAYOUT.selection.radius,
      line_width: LAYOUT.selection.width,
      color: COLOR_SELECTION,
    });
  },

  // The move counter, undo, restart and the menu. They only exist while a game is
  // actually being played, so they cannot be tapped through a menu covering them.
  setHudVisible(visible) {
    for (let i = 0; i < this.state.hud.length; i++) {
      hmUI.deleteWidget(this.state.hud[i]);
    }
    this.state.hud = [];
    this.clearCounter();
    if (!visible) {
      return;
    }

    this.drawCounter();
    this.state.hud.push(
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: LAYOUT.undo.x,
        y: LAYOUT.undo.y,
        w: LAYOUT.undo.w,
        h: LAYOUT.undo.h,
        normal_src: CONTROL_ART.undo.normal,
        press_src: CONTROL_ART.undo.press,
        click_func: () => this.undoMove(),
      })
    );
    this.state.hud.push(
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: LAYOUT.menu.x,
        y: LAYOUT.menu.y,
        w: LAYOUT.menu.w,
        h: LAYOUT.menu.h,
        normal_src: CONTROL_ART.menu.normal,
        press_src: CONTROL_ART.menu.press,
        click_func: () => this.showMenu(),
      })
    );
    this.state.hud.push(
      this.createButton(LAYOUT.restart, this.text("restart"), () => this.restartGame())
    );
  },

  // Moves so far against the shortest game possible. Recreated rather than
  // mutated, which happens once per move at human speed.
  drawCounter() {
    this.clearCounter();
    const game = this.state.game;
    if (!game || this.state.screen !== "playing") {
      return;
    }
    const text = `${game.moves} / ${game.level.par}`;
    this.state.counter = this.createText(LAYOUT.counter, TEXT.row, COLOR_TEXT, text);
  },

  // A vertical stack of texts and buttons, centred on the board under a dimmed
  // panel so it stays readable over a half-solved puzzle.
  drawMenu(items) {
    this.clearMenu();

    let height = 0;
    for (let i = 0; i < items.length; i++) {
      height += items[i].height;
    }
    const top = BOARD.y + Math.round((BOARD.h - height) / 2);

    this.state.menu.push(
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: BOARD.x,
        y: BOARD.y,
        w: BOARD.w,
        h: BOARD.h,
        radius: LAYOUT.boardRadius,
        color: COLOR_BACKGROUND,
        alpha: PANEL_ALPHA,
      })
    );

    let y = top;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "gap") {
        const box = centeredBox(SCREEN_SIZE, y, item.height, LAYOUT.menuWidth, 0);
        if (item.kind === "button") {
          this.state.menu.push(this.createButton(box, item.text, item.onClick));
        } else {
          this.state.menu.push(
            this.createText(box, Math.round(item.height * 0.76), item.color, item.text)
          );
        }
      }
      y += item.height;
    }
  },

  createText(box, size, color, text) {
    return hmUI.createWidget(hmUI.widget.TEXT, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      color,
      text_size: size,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
      text,
    });
  },

  createButton(box, text, onClick) {
    return hmUI.createWidget(hmUI.widget.BUTTON, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      radius: Math.round(box.h / 2),
      normal_color: COLOR_BUTTON,
      press_color: COLOR_BUTTON_PRESSED,
      color: COLOR_TEXT,
      text_size: Math.round(box.h * 0.44),
      text,
      click_func: onClick,
    });
  },

  // ---------------------------------------------------------------- teardown ----

  clearTiles() {
    for (let i = 0; i < this.state.tiles.length; i++) {
      if (this.state.tiles[i]) {
        hmUI.deleteWidget(this.state.tiles[i]);
      }
    }
    this.state.tiles = [];
    this.state.art = [];
    if (this.state.selection) {
      hmUI.deleteWidget(this.state.selection);
      this.state.selection = null;
    }
  },

  clearMenu() {
    for (let i = 0; i < this.state.menu.length; i++) {
      hmUI.deleteWidget(this.state.menu[i]);
    }
    this.state.menu = [];
  },

  clearCounter() {
    if (this.state.counter) {
      hmUI.deleteWidget(this.state.counter);
      this.state.counter = null;
    }
  },

  // ---------------------------------------------------------------- helpers ----

  // A board's record is two entries in storage - the moves and the clock - read
  // back as the one pair the rest of the code compares.
  readBest() {
    this.state.best = this.recordFor(this.state.levelId);
  },

  recordFor(levelId) {
    return {
      moves: normalizeMoves(readValue(this.state.storage, bestKey(levelId))),
      time: normalizeElapsed(readValue(this.state.storage, bestTimeKey(levelId))),
    };
  },

  writeBest(record) {
    writeValue(this.state.storage, bestKey(this.state.levelId), record.moves);
    writeValue(this.state.storage, bestTimeKey(this.state.levelId), record.time);
  },

  bestText() {
    return hasRecord(this.state.best) ? String(this.state.best.moves) : this.text("none");
  },

  // A board is called by its number: one word to translate, and a board added
  // later needs no new string at all.
  levelName(level) {
    return levelLabel(this.text("level"), level.id);
  },

  text(key) {
    return labelFor(this.state.language, key);
  },
});
