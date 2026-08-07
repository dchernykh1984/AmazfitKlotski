import { describe, it, expect, afterEach, vi } from "vitest";
import { DOWN, LEFT, RIGHT, UP, createGame, move } from "../lib/klotski.js";
import { screenLayout, tileBox } from "../lib/layout.js";
import { LEVELS, levelById, nextLevel } from "../lib/levels.js";
import { LEVEL_KEY, bestKey, bestTimeKey } from "../lib/scores.js";
import { formatElapsed } from "../lib/clock.js";
import { assignArt } from "../lib/pieces.js";
import { LABELS } from "../lib/i18n/labels.js";
import { levelLabel } from "../lib/i18n/keys.js";
import { GESTURE_DOWN, GESTURE_LEFT, GESTURE_RIGHT, GESTURE_UP } from "./stubs/zos-interaction.mjs";
import { solutionMoves } from "./helpers/solver.mjs";

// The watch page is a Zepp OS `Page({...})` call made when the module loads, and
// it reads the screen size, the language and the storage on the way in. So each
// test gets a fresh module graph: the stubs are imported from that same graph,
// which is what lets a test seed the storage the page will find and then look at
// the widgets it drew.
let ui;
let interaction;
let display;
let storage;
let settings;
let page = null;
let screenSize = 466;

async function boot(options = {}) {
  vi.resetModules();
  ui = await import("./stubs/zos-ui.mjs");
  interaction = await import("./stubs/zos-interaction.mjs");
  display = await import("./stubs/zos-display.mjs");
  storage = await import("./stubs/zos-storage.mjs");
  settings = await import("./stubs/zos-settings.mjs");
  const device = await import("./stubs/zos-device.mjs");

  // The page reads the screen size once, as it loads, so it has to be set before
  // the import below - which is exactly why every boot starts a fresh graph.
  screenSize = options.screenSize || 466;
  device.setDeviceInfo({ width: screenSize, height: screenSize });

  for (const [key, value] of Object.entries(options.stored || {})) {
    storage.seed(key, value);
  }
  if (options.storageFails) {
    storage.fail(options.storageFails);
  }
  settings.setLanguage(options.language === undefined ? 2 : options.language);
  settings.setLanguageThrows(!!options.languageThrows);
  for (const name of options.refuseEvents || []) {
    ui.refuseEvent(name);
  }

  page = null;
  globalThis.Page = (config) => {
    page = config;
    return config;
  };
  await import("../page/index.js");
  if (options.build !== false) {
    page.build();
  }
  return page;
}

const GESTURES = {
  [UP]: GESTURE_UP,
  [DOWN]: GESTURE_DOWN,
  [LEFT]: GESTURE_LEFT,
  [RIGHT]: GESTURE_RIGHT,
};

const en = LABELS.en;
const FIRST = LEVELS[0];

// A board is labelled by its number, the same way the page builds it.
function levelName(level, table = en) {
  return levelLabel(table.level, level.id);
}

function press(text) {
  const button = ui.buttonWithText(text);
  if (!button) {
    throw new Error(`no button reading "${text}" on screen; texts: ${ui.texts().join(", ")}`);
  }
  button.props.click_func();
}

function pressIcon(src) {
  const button = ui.buttons().find((candidate) => candidate.props.normal_src === src);
  if (!button) {
    throw new Error(`no ${src} button on screen`);
  }
  button.props.click_func();
}

function board() {
  return screenLayout(screenSize).board;
}

// The tiles are the scaled pictures on the board. A tile that has moved is drawn
// again, so it changes place in the widget list: the only reliable way to find
// one is where it sits on the board.
function tiles() {
  return ui.liveOfType(ui.widget.IMG);
}

function tileAt(block) {
  const box = tileBox(board(), block.x, block.y, block.w, block.h);
  const found = tiles().find((tile) => tile.props.x === box.x && tile.props.y === box.y);
  if (!found) {
    throw new Error(`no tile at cell ${block.x},${block.y}`);
  }
  return found;
}

// Tap a widget the way a finger does: down and up again in the same place.
function tap(widget, info) {
  const at = info || { x: widget.props.x + 1, y: widget.props.y + 1 };
  const press = ui.handlerFor(widget, ui.event.CLICK_DOWN);
  const release = ui.handlerFor(widget, ui.event.CLICK_UP);
  if (!press && !release) {
    throw new Error(`widget ${widget.id} (${widget.type}) is not listening for taps`);
  }
  if (press) {
    press(at);
  }
  if (release) {
    release(at);
  }
}

// Put a finger down on a widget and take it up somewhere else, which is how a
// swipe begins and ends.
function dragFrom(widget, from, to) {
  const press = ui.handlerFor(widget, ui.event.CLICK_DOWN);
  const release = ui.handlerFor(widget, ui.event.CLICK_UP);
  if (press) {
    press(from);
  }
  if (release) {
    release(to);
  }
}

function boardWidget() {
  return ui.live().find((w) => w.type === ui.widget.FILL_RECT && w.props.w === board().w);
}

function tapTile(block) {
  tap(tileAt(block));
}

// The counter is the one place a bare number is drawn: how many moves have been
// spent, with nothing to measure it against.
function counterText() {
  return ui.texts().find((text) => /^\d+$/.test(text)) || null;
}

function firstOfKind(level, kind) {
  return createGame(level).blocks.find((block) => block.kind === kind);
}

// Play a whole board by asking the solver for a shortest line and tapping and
// swiping it, exactly as a very good player would. A copy of the game is kept in
// step with the screen so each block can be found where it now stands.
function playOut(levelId) {
  const level = levelById(levelId);
  const shadow = createGame(level);
  const line = solutionMoves(level);
  for (const step of line) {
    tapTile(shadow.blocks[step.id]);
    interaction.swipe(GESTURES[step.direction]);
    move(shadow, step.id, step.direction);
  }
  return line.length;
}

// The page reads Date.now() when a board opens and again when it is solved. The
// test owns that clock, so a game can be made to take any length at all without
// waiting for it.
let clock = 0;
const realDateNow = Date.now;

function setClock(ms) {
  clock = ms;
  Date.now = () => clock;
}

function tick(ms) {
  clock += ms;
}

afterEach(() => {
  Date.now = realDateNow;
  delete globalThis.Page;
});

describe("opening the app", () => {
  it("draws the start menu and nothing that belongs to a game", async () => {
    await boot();

    expect(ui.hasText(en.title)).toBe(true);
    expect(ui.buttonWithText(en.play)).toBeTruthy();
    expect(ui.hasText(en.hint)).toBe(true);
    expect(counterText()).toBeNull();
    expect(ui.buttonWithText(en.restart)).toBeNull();
    expect(tiles().length).toBe(0);
  });

  it("keeps the screen awake and hands the setting back when it closes", async () => {
    const app = await boot();
    expect(display.currentBrightTime()).toBeGreaterThan(60000);
    expect(interaction.isListening()).toBe(true);

    app.onDestroy();
    expect(display.resetCount()).toBe(1);
    expect(interaction.isListening()).toBe(false);
  });

  it("opens on the board that was played last", async () => {
    await boot({ stored: { [LEVEL_KEY]: LEVELS[2].id } });
    expect(ui.buttonWithText(levelName(LEVELS[2]))).toBeTruthy();
  });

  it("falls back to the first board when the stored one is gone", async () => {
    await boot({ stored: { [LEVEL_KEY]: "a-board-from-an-older-version" } });
    expect(ui.buttonWithText(levelName(FIRST))).toBeTruthy();
  });

  it("still opens on a watch with no storage and no language setting", async () => {
    await boot({ storageFails: "construct", languageThrows: true });
    expect(ui.buttonWithText(en.play)).toBeTruthy();
  });

  it("still opens when storage refuses to be read", async () => {
    await boot({ storageFails: "read" });
    expect(ui.buttonWithText(en.play)).toBeTruthy();
    expect(ui.buttonWithText(levelName(FIRST))).toBeTruthy();
  });

  it("speaks the language the watch is set to", async () => {
    await boot({ language: 4 });
    expect(ui.buttonWithText(LABELS.ru.play)).toBeTruthy();
  });
});

describe("choosing a board", () => {
  it("walks the ladder with the level button and remembers the choice", async () => {
    await boot();
    press(levelName(FIRST));
    expect(ui.buttonWithText(levelName(LEVELS[1]))).toBeTruthy();
    expect(storage.stored()[LEVEL_KEY]).toBe(LEVELS[1].id);
  });

  it("walks it with swipes too, in both directions", async () => {
    await boot();
    interaction.swipe(GESTURE_DOWN);
    expect(ui.buttonWithText(levelName(LEVELS[1]))).toBeTruthy();
    interaction.swipe(GESTURE_UP);
    expect(ui.buttonWithText(levelName(FIRST))).toBeTruthy();
    // Wrapping backwards from the first board lands on the last.
    interaction.swipe(GESTURE_UP);
    expect(ui.buttonWithText(levelName(LEVELS[LEVELS.length - 1]))).toBeTruthy();
  });

  it("says nothing about par or records - those live on their own screen", async () => {
    // The picker used to carry "Par 116  Best 132", which read like a move
    // allowance. A board is a number and a button now.
    await boot({ stored: { [bestKey(FIRST.id)]: 42 } });
    for (const text of ui.texts()) {
      expect(text, text).not.toContain(String(FIRST.par));
      expect(text, text).not.toContain("42");
    }
    expect(ui.buttonWithText(en.records)).toBeTruthy();
  });

  it("lets a swipe to the right out of the menu", async () => {
    await boot();
    expect(interaction.swipe(GESTURE_RIGHT)).toBe(false);
  });
});

describe("playing", () => {
  it("puts one tile on the board for every block, and the controls around it", async () => {
    await boot();
    press(en.play);

    expect(tiles().length).toBe(FIRST.blocks.length);
    // Every block wears its own portrait: a board of blank tiles is not a board.
    expect(tiles().map((tile) => tile.props.src)).toEqual(assignArt(createGame(FIRST).blocks));
    expect(counterText()).toBe("0");
    expect(ui.buttonWithText(en.restart)).toBeTruthy();
    expect(ui.buttonWithText(en.play)).toBeNull();
    expect(ui.hasText(en.title)).toBe(false);
  });

  it("moves nothing until a block has been tapped", async () => {
    await boot();
    press(en.play);
    interaction.swipe(GESTURE_DOWN);
    expect(counterText()).toBe("0");
  });

  it("slides the tapped block and counts the move", async () => {
    await boot();
    press(en.play);

    const soldier = firstOfKind(FIRST, "soldier");
    const before = tileAt(soldier).props.y;
    tapTile(soldier);
    interaction.swipe(GESTURE_DOWN);

    expect(counterText()).toBe("1");
    expect(tileAt({ ...soldier, y: soldier.y + 1 }).props.y).toBeGreaterThan(before);
  });

  it("rings the block that was tapped, and only that one", async () => {
    await boot();
    press(en.play);

    const hero = firstOfKind(FIRST, "hero");
    const soldier = firstOfKind(FIRST, "soldier");
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(0);

    tapTile(hero);
    const onHero = ui.liveOfType(ui.widget.STROKE_RECT);
    expect(onHero.length).toBe(1);
    expect(onHero[0].props.y).toBe(tileAt(hero).props.y - 1);

    tapTile(soldier);
    const onSoldier = ui.liveOfType(ui.widget.STROKE_RECT);
    expect(onSoldier.length).toBe(1);
    expect(onSoldier[0].props.y).toBe(tileAt(soldier).props.y - 1);
  });

  it("keeps the block when it is tapped again mid-slide", async () => {
    await boot();
    press(en.play);

    // Tapping the block you are already pushing must not quietly let it go, or
    // the swipe that follows does nothing at all.
    const soldier = firstOfKind(FIRST, "soldier");
    tapTile(soldier);
    interaction.swipe(GESTURE_DOWN);
    const moved = { ...soldier, y: soldier.y + 1 };
    tapTile(moved);
    interaction.swipe(GESTURE_DOWN);
    expect(counterText()).toBe("2");
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(1);
  });

  it("keeps the ring on top of the block after it has moved", async () => {
    await boot();
    press(en.play);

    const soldier = firstOfKind(FIRST, "soldier");
    tapTile(soldier);
    interaction.swipe(GESTURE_DOWN);

    // A block that moves is drawn again, which would put it over the ring; the
    // ring has to be drawn again after it, or it would end up behind the tile.
    const moved = tileAt({ ...soldier, y: soldier.y + 1 });
    const rings = ui.liveOfType(ui.widget.STROKE_RECT);
    expect(rings.length).toBe(1);
    expect(rings[0].id).toBeGreaterThan(moved.id);
    expect(rings[0].props.y).toBe(moved.props.y - 1);
  });

  it("refuses a move that would leave the board or cross another block", async () => {
    await boot();
    press(en.play);

    // The general standing in the top left corner cannot go up or left, and the
    // hero is beside it.
    tapTile(firstOfKind(FIRST, "general"));
    interaction.swipe(GESTURE_UP);
    interaction.swipe(GESTURE_LEFT);
    interaction.swipe(GESTURE_RIGHT);
    expect(counterText()).toBe("0");
  });

  it("swallows swipes so a slide cannot back out of the app", async () => {
    await boot();
    press(en.play);
    expect(interaction.swipe(GESTURE_RIGHT)).toBe(true);
  });

  it("takes a move back with undo, and the move off the counter", async () => {
    await boot();
    press(en.play);

    const soldier = firstOfKind(FIRST, "soldier");
    const before = tileAt(soldier).props.y;
    tapTile(soldier);
    interaction.swipe(GESTURE_DOWN);
    expect(counterText()).toBe("1");

    pressIcon("undo.png");
    expect(counterText()).toBe("0");
    expect(tileAt(soldier).props.y).toBe(before);

    // Undoing with nothing to take back is harmless.
    pressIcon("undo.png");
    expect(counterText()).toBe("0");
  });

  it("puts the board back with restart", async () => {
    await boot();
    press(en.play);

    const soldier = firstOfKind(FIRST, "soldier");
    const before = tileAt(soldier).props.y;
    tapTile(soldier);
    interaction.swipe(GESTURE_DOWN);

    press(en.restart);
    expect(counterText()).toBe("0");
    expect(tileAt(soldier).props.y).toBe(before);
    expect(tiles().length).toBe(FIRST.blocks.length);
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(0);
  });
});

describe("the in-game menu", () => {
  it("hides the controls behind it and gives them back on resume", async () => {
    await boot();
    press(en.play);

    pressIcon("menu.png");
    expect(ui.buttonWithText(en.resume)).toBeTruthy();
    expect(ui.buttonWithText(en.restart)).toBeNull();
    expect(counterText()).toBeNull();

    press(en.resume);
    expect(ui.buttonWithText(en.resume)).toBeNull();
    expect(counterText()).toBe("0");
  });

  it("goes back to the board list, leaving no tiles behind", async () => {
    await boot();
    press(en.play);

    pressIcon("menu.png");
    press(en.levels);

    expect(ui.buttonWithText(en.play)).toBeTruthy();
    expect(tiles().length).toBe(0);
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(0);
  });
});

describe("solving a board", () => {
  it("ends the game, reports the moves and records the result", async () => {
    await boot();
    press(en.play);

    const moves = playOut(FIRST.id);
    expect(moves).toBe(FIRST.par);

    expect(ui.hasText(en.solved)).toBe(true);
    expect(ui.hasText(`${en.moves} ${moves}`)).toBe(true);
    expect(ui.hasText(en.new_best)).toBe(true);
    expect(storage.stored()[bestKey(FIRST.id)]).toBe(moves);
    expect(counterText()).toBeNull();
    expect(ui.buttonWithText(en.restart)).toBeNull();
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(0);
  });

  it("times the game from the moment the board opened", async () => {
    setClock(1_700_000_000_000);
    await boot();
    // Thinking on the start screen is not part of the game.
    tick(90_000);
    press(en.play);
    tick(261_000);
    const moves = playOut(FIRST.id);

    expect(ui.hasText(`${en.time} 4:21`)).toBe(true);
    expect(storage.stored()[bestTimeKey(FIRST.id)]).toBe(261_000);
    expect(storage.stored()[bestKey(FIRST.id)]).toBe(moves);
  });

  it("counts the whole time the board was open, menus and all", async () => {
    setClock(1_700_000_000_000);
    await boot();
    press(en.play);

    // Finish minus start: wandering off to the menu and back does not stop it.
    tick(60_000);
    pressIcon("menu.png");
    tick(3_600_000);
    press(en.resume);
    tick(60_000);
    playOut(FIRST.id);

    expect(ui.hasText(`${en.time} 1:02:00`)).toBe(true);
    expect(storage.stored()[bestTimeKey(FIRST.id)]).toBe(3_720_000);
  });

  it("starts the clock again when the board is restarted", async () => {
    setClock(1_700_000_000_000);
    await boot();
    press(en.play);
    tick(600_000);
    press(en.restart);
    tick(61_000);
    playOut(FIRST.id);

    expect(ui.hasText(`${en.time} 1:01`)).toBe(true);
    expect(storage.stored()[bestTimeKey(FIRST.id)]).toBe(61_000);
  });

  it("times the next board from its own start", async () => {
    setClock(1_700_000_000_000);
    await boot();
    press(en.play);
    tick(30_000);
    playOut(FIRST.id);
    press(en.next);

    const second = nextLevel(FIRST.id);
    tick(15_000);
    playOut(second.id);
    expect(ui.hasText(`${en.time} 0:15`)).toBe(true);
    expect(storage.stored()[bestTimeKey(second.id)]).toBe(15_000);
  });

  it("still plays and still records on a watch with no clock", async () => {
    // Date.now() that never moves: every game takes no time at all, so nothing
    // is timed - but the moves are still a record.
    setClock(1_700_000_000_000);
    await boot();
    press(en.play);
    const moves = playOut(FIRST.id);

    expect(ui.hasText(`${en.time} ${en.none}`)).toBe(true);
    expect(storage.stored()[bestKey(FIRST.id)]).toBe(moves);
    expect(storage.stored()[bestTimeKey(FIRST.id)]).toBe(0);
  });

  it("writes the time in the same words the clock module uses", async () => {
    setClock(1_700_000_000_000);
    await boot();
    press(en.play);
    tick(3_723_000);
    playOut(FIRST.id);
    expect(ui.hasText(`${en.time} ${formatElapsed(3_723_000)}`)).toBe(true);
  });

  it("keeps the shorter of two games", async () => {
    await boot({ stored: { [bestKey(FIRST.id)]: 3 } });
    press(en.play);
    playOut(FIRST.id);

    expect(ui.hasText(en.new_best)).toBe(false);
    expect(storage.stored()[bestKey(FIRST.id)]).toBe(3);
  });

  it("still remembers the record for the session when storage refuses to write", async () => {
    setClock(1_700_000_000_000);
    await boot({ storageFails: "write" });
    press(en.play);
    tick(60_000);
    const moves = playOut(FIRST.id);
    expect(ui.hasText(en.new_best)).toBe(true);

    // The same number of moves but slower, so the standing record holds - and it
    // is still there to hold, even though nothing could be written down.
    press(en.again);
    tick(120_000);
    playOut(FIRST.id);
    // Not being told this is a record is the proof the first one is still
    // remembered: nothing was written down, so it can only have come from the
    // session's own copy.
    expect(ui.hasText(en.new_best)).toBe(false);
    expect(moves).toBe(FIRST.par);
  });

  it("takes the record when the same game is played faster", async () => {
    setClock(1_700_000_000_000);
    await boot();
    press(en.play);
    tick(120_000);
    const moves = playOut(FIRST.id);
    expect(storage.stored()[bestTimeKey(FIRST.id)]).toBe(120_000);

    press(en.again);
    tick(60_000);
    playOut(FIRST.id);

    expect(ui.hasText(en.new_best)).toBe(true);
    expect(storage.stored()[bestKey(FIRST.id)]).toBe(moves);
    expect(storage.stored()[bestTimeKey(FIRST.id)]).toBe(60_000);
  });

  it("leaves the record alone when the same game is played slower", async () => {
    setClock(1_700_000_000_000);
    await boot();
    press(en.play);
    tick(60_000);
    playOut(FIRST.id);

    press(en.again);
    tick(120_000);
    playOut(FIRST.id);

    expect(ui.hasText(en.new_best)).toBe(false);
    expect(storage.stored()[bestTimeKey(FIRST.id)]).toBe(60_000);
  });

  it("moves on to the next board", async () => {
    await boot();
    press(en.play);
    playOut(FIRST.id);

    press(en.next);
    const second = nextLevel(FIRST.id);
    expect(counterText()).toBe("0");
    expect(tiles().length).toBe(second.blocks.length);
    expect(storage.stored()[LEVEL_KEY]).toBe(second.id);
  });

  it("plays the same board again", async () => {
    await boot();
    press(en.play);
    playOut(FIRST.id);

    press(en.again);
    expect(counterText()).toBe("0");
    expect(ui.hasText(en.solved)).toBe(false);
    expect(tiles().length).toBe(FIRST.blocks.length);
  });

  it("ignores taps on the board once it is solved", async () => {
    await boot();
    press(en.play);
    playOut(FIRST.id);

    // The tiles are still there under the panel; tapping one must not start
    // selecting blocks on a game that is over.
    tap(tiles()[0]);
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(0);
    expect(ui.hasText(en.solved)).toBe(true);
  });

  // The whole loop, over the longest board there is: 116 taps and swipes, a tile
  // redrawn on every one of them, and the record written at the end.
  it(
    "sees a 116 move game through from the first tap to the record",
    { timeout: 120000 },
    async () => {
      const hardest = LEVELS[LEVELS.length - 1];
      await boot({ stored: { [LEVEL_KEY]: hardest.id } });
      press(en.play);

      const moves = playOut(hardest.id);
      expect(moves).toBe(hardest.par);
      expect(ui.hasText(`${en.moves} ${hardest.par}`)).toBe(true);
      expect(storage.stored()[bestKey(hardest.id)]).toBe(hardest.par);
      expect(tiles().length).toBe(hardest.blocks.length);
    }
  );
});

// The store bundle carries a package for every round size Zeus knows, not just the
// two the target names, so the game has to be playable on all of them.
describe("every round screen the bundle ships for", () => {
  for (const size of [360, 416, 454, 466, 480]) {
    it(`plays a whole board on a ${size}px watch`, async () => {
      await boot({ screenSize: size });
      press(en.play);

      const layout = screenLayout(size);
      expect(tiles().length).toBe(FIRST.blocks.length);
      // Every tile is drawn scaled into its cell rather than at the size of its
      // file, and the board never reaches past the bezel.
      for (const tile of tiles()) {
        expect(tile.props.auto_scale, `${size}: auto_scale`).toBe(true);
        expect(tile.props.w, `${size}: tile width`).toBeGreaterThan(0);
        expect(tile.props.x, `${size}: tile x`).toBeGreaterThanOrEqual(layout.board.x);
        expect(tile.props.x + tile.props.w, `${size}: tile right`).toBeLessThanOrEqual(
          layout.board.x + layout.board.w
        );
      }

      expect(playOut(FIRST.id)).toBe(FIRST.par);
      expect(ui.hasText(en.solved), String(size)).toBe(true);
      expect(storage.stored()[bestKey(FIRST.id)], String(size)).toBe(FIRST.par);
    });
  }

  it("draws a bigger board on a bigger watch", async () => {
    await boot({ screenSize: 360 });
    press(en.play);
    const small = tiles()[0].props.w;

    await boot({ screenSize: 480 });
    press(en.play);
    expect(tiles()[0].props.w).toBeGreaterThan(small);
  });
});

describe("picking up a block", () => {
  it("works when the tap lands on the tile", async () => {
    await boot();
    press(en.play);
    tapTile(firstOfKind(FIRST, "soldier"));
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(1);
  });

  it("works when the tap lands on the board underneath instead", async () => {
    await boot();
    press(en.play);

    // Not every firmware delivers a touch to the picture on top, so the board
    // listens too and works out which cell was hit.
    const soldier = firstOfKind(FIRST, "soldier");
    const box = tileBox(board(), soldier.x, soldier.y, soldier.w, soldier.h);
    tap(boardWidget(), { x: box.x + 4, y: box.y + 4 });

    const rings = ui.liveOfType(ui.widget.STROKE_RECT);
    expect(rings.length).toBe(1);
    expect(rings[0].props.y).toBe(box.y - screenLayout(screenSize).selection.margin);
  });

  it("ignores a tap on an empty cell", async () => {
    await boot();
    press(en.play);

    const empty = tileBox(board(), 1, 4, 1, 1);
    tap(boardWidget(), { x: empty.x + 4, y: empty.y + 4 });
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(0);
  });

  it("survives both paths firing for one tap", async () => {
    await boot();
    press(en.play);

    // A firmware that delivers the touch to the tile and to the board would pick
    // the same block twice; that has to be a no-op, not a deselection.
    const soldier = firstOfKind(FIRST, "soldier");
    const box = tileBox(board(), soldier.x, soldier.y, soldier.w, soldier.h);
    tapTile(soldier);
    tap(boardWidget(), { x: box.x + 4, y: box.y + 4 });

    interaction.swipe(GESTURE_DOWN);
    expect(counterText()).toBe("1");
  });

  it("does not let the start of a swipe steal the block that was picked up", async () => {
    await boot();
    press(en.play);

    // Pick up the soldier, then start a swipe with the finger over the hero. The
    // touch that opens a swipe must not change what is picked up, or the wrong
    // block slides and the counter charges the player for it.
    const hero = firstOfKind(FIRST, "hero");
    const soldier = firstOfKind(FIRST, "soldier");
    tapTile(soldier);

    const from = tileBox(board(), hero.x, hero.y, hero.w, hero.h);
    dragFrom(
      tileAt(hero),
      { x: from.x + 4, y: from.y + 4 },
      { x: from.x + 4, y: from.y + 4 + board().cell }
    );
    interaction.swipe(GESTURE_DOWN);

    // The soldier moved, not the hero the finger happened to land on.
    expect(counterText()).toBe("1");
    expect(tileAt({ ...soldier, y: soldier.y + 1 })).toBeTruthy();
    expect(tileAt(hero)).toBeTruthy();
  });

  it("still picks a block up on a watch that has no release event", async () => {
    // Some firmware wires up the press but not the release. Selecting on the
    // press is worse - a swipe can steal the pick - but it is still a playable
    // game, where refusing to select anything would not be.
    await boot({ refuseEvents: ["CLICK_UP"] });
    press(en.play);

    const soldier = firstOfKind(FIRST, "soldier");
    const tile = tileAt(soldier);
    ui.handlerFor(tile, ui.event.CLICK_DOWN)({ x: tile.props.x + 2, y: tile.props.y + 2 });
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(1);

    interaction.swipe(GESTURE_DOWN);
    expect(counterText()).toBe("1");
  });
});

describe("the records", () => {
  async function openRecords(options = {}) {
    await boot(options);
    press(en.records);
  }

  function shown() {
    return {
      level: ui.texts().find((text) => text.startsWith(en.level)) || null,
      moves: ui.texts().find((text) => text.startsWith(en.moves)) || null,
      time: ui.texts().find((text) => text.startsWith(en.time)) || null,
      par: ui.texts().find((text) => text.startsWith(en.par)) || null,
    };
  }

  it("opens on the board the start screen was showing", async () => {
    await openRecords({ stored: { [LEVEL_KEY]: LEVELS[2].id } });
    expect(shown().level).toBe(levelName(LEVELS[2]));
    expect(ui.buttonWithText(en.back)).toBeTruthy();
  });

  it("shows the record, the clock and the shortest game possible", async () => {
    await openRecords({
      stored: {
        [bestKey(FIRST.id)]: 12,
        [bestTimeKey(FIRST.id)]: 261_000,
      },
    });

    expect(shown().moves).toBe(`${en.moves} 12`);
    expect(shown().time).toBe(`${en.time} 4:21`);
    expect(shown().par).toBe(`${en.par} ${FIRST.par}`);
  });

  it("leaves gaps for a board that has never been solved", async () => {
    await openRecords();
    expect(shown().moves).toBe(`${en.moves} ${en.none}`);
    expect(shown().time).toBe(`${en.time} ${en.none}`);
    // The shortest game possible is a property of the board, so it is there from
    // the start - it is the one number that does not wait for a player.
    expect(shown().par).toBe(`${en.par} ${FIRST.par}`);
  });

  it("shows the moves of a record that was set before the game had a clock", async () => {
    await openRecords({ stored: { [bestKey(FIRST.id)]: 12 } });
    expect(shown().moves).toBe(`${en.moves} 12`);
    expect(shown().time).toBe(`${en.time} ${en.none}`);
  });

  it("pages through every board and wraps round, in both directions", async () => {
    await openRecords();
    expect(shown().level).toBe(levelName(FIRST));

    for (let step = 1; step < LEVELS.length; step++) {
      interaction.swipe(GESTURE_DOWN);
      expect(shown().level, `down ${step}`).toBe(levelName(LEVELS[step]));
    }
    // Round the end and back to the first board.
    interaction.swipe(GESTURE_DOWN);
    expect(shown().level).toBe(levelName(FIRST));
    // And the other way, off the front and onto the last.
    interaction.swipe(GESTURE_UP);
    expect(shown().level).toBe(levelName(LEVELS[LEVELS.length - 1]));
  });

  it("carries each board's own record as it pages", async () => {
    await openRecords({
      stored: {
        [bestKey(FIRST.id)]: 9,
        [bestTimeKey(FIRST.id)]: 61_000,
        [bestKey(LEVELS[1].id)]: 40,
        [bestTimeKey(LEVELS[1].id)]: 3_723_000,
      },
    });

    expect(shown().moves).toBe(`${en.moves} 9`);
    expect(shown().time).toBe(`${en.time} 1:01`);

    interaction.swipe(GESTURE_DOWN);
    expect(shown().moves).toBe(`${en.moves} 40`);
    expect(shown().time).toBe(`${en.time} 1:02:03`);
    expect(shown().par).toBe(`${en.par} ${LEVELS[1].par}`);
  });

  it("does not change which board is about to be played", async () => {
    await openRecords({ stored: { [LEVEL_KEY]: FIRST.id } });
    interaction.swipe(GESTURE_DOWN);
    interaction.swipe(GESTURE_DOWN);

    press(en.back);
    expect(ui.buttonWithText(levelName(FIRST))).toBeTruthy();
    expect(storage.stored()[LEVEL_KEY]).toBe(FIRST.id);
  });

  it("comes back to the start screen, by button and by swiping right", async () => {
    await openRecords();
    press(en.back);
    expect(ui.buttonWithText(en.play)).toBeTruthy();

    press(en.records);
    // A swipe right goes back a screen rather than out of the app: the records
    // are one level deeper than the menu that lets you leave.
    expect(interaction.swipe(GESTURE_RIGHT)).toBe(true);
    expect(ui.buttonWithText(en.play)).toBeTruthy();
  });

  it("shows a record that was just set", async () => {
    setClock(1_700_000_000_000);
    await boot();
    press(en.play);
    tick(261_000);
    const moves = playOut(FIRST.id);

    // Back out of the solved board to the start screen, then into the records.
    press(en.again);
    pressIcon("menu.png");
    press(en.levels);
    press(en.records);

    expect(shown().moves).toBe(`${en.moves} ${moves}`);
    expect(shown().time).toBe(`${en.time} 4:21`);
  });

  it("leaves no tiles or game behind it", async () => {
    await boot();
    press(en.play);
    // Reachable from the start screen, so a game has to be put away first; this
    // is the same clean-up the level list does.
    pressIcon("menu.png");
    press(en.levels);
    press(en.records);

    expect(tiles().length).toBe(0);
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(0);
    expect(counterText()).toBeNull();
  });
});

describe("the screen it leaves behind", () => {
  it("never grows a pile of widgets as the screens come and go", async () => {
    await boot();
    const afterStart = ui.live().length;

    for (let round = 0; round < 3; round++) {
      press(en.play);
      pressIcon("menu.png");
      press(en.levels);
      expect(ui.live().length, `round ${round}`).toBe(afterStart);
    }
  });

  it("never grows one while a board is being played, either", async () => {
    await boot();
    press(en.play);
    const afterStart = ui.live().length;

    const soldier = firstOfKind(FIRST, "soldier");
    tapTile(soldier);
    for (let round = 0; round < 4; round++) {
      interaction.swipe(GESTURE_DOWN);
      interaction.swipe(GESTURE_UP);
    }
    // One extra widget: the selection ring, which nothing has taken off yet.
    expect(ui.live().length).toBe(afterStart + 1);
  });
});
