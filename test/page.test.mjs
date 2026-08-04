import { describe, it, expect, afterEach, vi } from "vitest";
import { DOWN, LEFT, RIGHT, UP, createGame, move } from "../lib/klotski.js";
import { screenLayout, tileBox } from "../lib/layout.js";
import { LEVELS, levelById, nextLevel } from "../lib/levels.js";
import { LEVEL_KEY, bestKey } from "../lib/scores.js";
import { LABELS } from "../lib/i18n/labels.js";
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

async function boot(options = {}) {
  vi.resetModules();
  ui = await import("./stubs/zos-ui.mjs");
  interaction = await import("./stubs/zos-interaction.mjs");
  display = await import("./stubs/zos-display.mjs");
  storage = await import("./stubs/zos-storage.mjs");
  settings = await import("./stubs/zos-settings.mjs");

  for (const [key, value] of Object.entries(options.stored || {})) {
    storage.seed(key, value);
  }
  if (options.storageFails) {
    storage.fail(options.storageFails);
  }
  settings.setLanguage(options.language === undefined ? 2 : options.language);
  settings.setLanguageThrows(!!options.languageThrows);

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

// The stub device is 466px across, the same as the design.
const BOARD = screenLayout(466).board;

// The tiles are the buttons that carry a picture and no label. A tile that has
// moved is drawn again, so it changes place in the widget list: the only reliable
// way to find one is where it sits on the board.
function tiles() {
  return ui
    .buttons()
    .filter((button) => typeof button.props.normal_src === "string" && !button.props.text)
    .filter((button) => !/^(undo|menu)/.test(button.props.normal_src));
}

function tileAt(block) {
  const box = tileBox(BOARD, block.x, block.y, block.w, block.h);
  const found = tiles().find((tile) => tile.props.x === box.x && tile.props.y === box.y);
  if (!found) {
    throw new Error(`no tile at cell ${block.x},${block.y}`);
  }
  return found;
}

function counterText() {
  return ui.texts().find((text) => / \/ /.test(text)) || null;
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
    tileAt(shadow.blocks[step.id]).props.click_func();
    interaction.swipe(GESTURES[step.direction]);
    move(shadow, step.id, step.direction);
  }
  return line.length;
}

afterEach(() => {
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
    expect(ui.buttonWithText(en[`level_${LEVELS[2].id}`])).toBeTruthy();
  });

  it("falls back to the first board when the stored one is gone", async () => {
    await boot({ stored: { [LEVEL_KEY]: "a-board-from-an-older-version" } });
    expect(ui.buttonWithText(en[`level_${FIRST.id}`])).toBeTruthy();
  });

  it("still opens on a watch with no storage and no language setting", async () => {
    await boot({ storageFails: "construct", languageThrows: true });
    expect(ui.buttonWithText(en.play)).toBeTruthy();
  });

  it("still opens when storage refuses to be read", async () => {
    await boot({ storageFails: "read" });
    expect(ui.buttonWithText(en.play)).toBeTruthy();
    expect(ui.hasText(`${en.par} ${FIRST.par}   ${en.best} ${en.none}`)).toBe(true);
  });

  it("speaks the language the watch is set to", async () => {
    await boot({ language: 4 });
    expect(ui.buttonWithText(LABELS.ru.play)).toBeTruthy();
  });
});

describe("choosing a board", () => {
  it("walks the ladder with the level button and remembers the choice", async () => {
    await boot();
    press(en[`level_${FIRST.id}`]);
    expect(ui.buttonWithText(en[`level_${LEVELS[1].id}`])).toBeTruthy();
    expect(storage.stored()[LEVEL_KEY]).toBe(LEVELS[1].id);
  });

  it("walks it with swipes too, in both directions", async () => {
    await boot();
    interaction.swipe(GESTURE_DOWN);
    expect(ui.buttonWithText(en[`level_${LEVELS[1].id}`])).toBeTruthy();
    interaction.swipe(GESTURE_UP);
    expect(ui.buttonWithText(en[`level_${FIRST.id}`])).toBeTruthy();
    // Wrapping backwards from the first board lands on the last.
    interaction.swipe(GESTURE_UP);
    expect(ui.buttonWithText(en[`level_${LEVELS[LEVELS.length - 1].id}`])).toBeTruthy();
  });

  it("shows the par of the board, and no record until one is set", async () => {
    await boot();
    expect(ui.hasText(`${en.par} ${FIRST.par}   ${en.best} ${en.none}`)).toBe(true);
  });

  it("shows the record kept for that board", async () => {
    await boot({ stored: { [bestKey(FIRST.id)]: 42 } });
    expect(ui.hasText(`${en.par} ${FIRST.par}   ${en.best} 42`)).toBe(true);
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
    expect(counterText()).toBe(`0 / ${FIRST.par}`);
    expect(ui.buttonWithText(en.restart)).toBeTruthy();
    expect(ui.buttonWithText(en.play)).toBeNull();
    expect(ui.hasText(en.title)).toBe(false);
  });

  it("moves nothing until a block has been tapped", async () => {
    await boot();
    press(en.play);
    interaction.swipe(GESTURE_DOWN);
    expect(counterText()).toBe(`0 / ${FIRST.par}`);
  });

  it("slides the tapped block and counts the move", async () => {
    await boot();
    press(en.play);

    const soldier = firstOfKind(FIRST, "soldier");
    const before = tileAt(soldier).props.y;
    tileAt(soldier).props.click_func();
    interaction.swipe(GESTURE_DOWN);

    expect(counterText()).toBe(`1 / ${FIRST.par}`);
    expect(tileAt({ ...soldier, y: soldier.y + 1 }).props.y).toBeGreaterThan(before);
  });

  it("rings the block that was tapped, and only that one", async () => {
    await boot();
    press(en.play);

    const hero = firstOfKind(FIRST, "hero");
    const soldier = firstOfKind(FIRST, "soldier");
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(0);

    tileAt(hero).props.click_func();
    const onHero = ui.liveOfType(ui.widget.STROKE_RECT);
    expect(onHero.length).toBe(1);
    expect(onHero[0].props.y).toBe(tileAt(hero).props.y - 1);

    tileAt(soldier).props.click_func();
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
    tileAt(soldier).props.click_func();
    interaction.swipe(GESTURE_DOWN);
    const moved = { ...soldier, y: soldier.y + 1 };
    tileAt(moved).props.click_func();
    interaction.swipe(GESTURE_DOWN);
    expect(counterText()).toBe(`2 / ${FIRST.par}`);
    expect(ui.liveOfType(ui.widget.STROKE_RECT).length).toBe(1);
  });

  it("keeps the ring on top of the block after it has moved", async () => {
    await boot();
    press(en.play);

    const soldier = firstOfKind(FIRST, "soldier");
    tileAt(soldier).props.click_func();
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
    tileAt(firstOfKind(FIRST, "general")).props.click_func();
    interaction.swipe(GESTURE_UP);
    interaction.swipe(GESTURE_LEFT);
    interaction.swipe(GESTURE_RIGHT);
    expect(counterText()).toBe(`0 / ${FIRST.par}`);
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
    tileAt(soldier).props.click_func();
    interaction.swipe(GESTURE_DOWN);
    expect(counterText()).toBe(`1 / ${FIRST.par}`);

    pressIcon("undo.png");
    expect(counterText()).toBe(`0 / ${FIRST.par}`);
    expect(tileAt(soldier).props.y).toBe(before);

    // Undoing with nothing to take back is harmless.
    pressIcon("undo.png");
    expect(counterText()).toBe(`0 / ${FIRST.par}`);
  });

  it("puts the board back with restart", async () => {
    await boot();
    press(en.play);

    const soldier = firstOfKind(FIRST, "soldier");
    const before = tileAt(soldier).props.y;
    tileAt(soldier).props.click_func();
    interaction.swipe(GESTURE_DOWN);

    press(en.restart);
    expect(counterText()).toBe(`0 / ${FIRST.par}`);
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
    expect(counterText()).toBe(`0 / ${FIRST.par}`);
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

  it("keeps the shorter of two games", async () => {
    await boot({ stored: { [bestKey(FIRST.id)]: 3 } });
    press(en.play);
    playOut(FIRST.id);

    expect(ui.hasText(en.new_best)).toBe(false);
    expect(ui.hasText(`${en.best} 3`)).toBe(true);
    expect(storage.stored()[bestKey(FIRST.id)]).toBe(3);
  });

  it("still remembers the record for the session when storage refuses to write", async () => {
    await boot({ storageFails: "write" });
    press(en.play);
    const moves = playOut(FIRST.id);
    expect(ui.hasText(en.new_best)).toBe(true);

    press(en.again);
    playOut(FIRST.id);
    expect(ui.hasText(`${en.best} ${moves}`)).toBe(true);
  });

  it("moves on to the next board", async () => {
    await boot();
    press(en.play);
    playOut(FIRST.id);

    press(en.next);
    const second = nextLevel(FIRST.id);
    expect(counterText()).toBe(`0 / ${second.par}`);
    expect(tiles().length).toBe(second.blocks.length);
    expect(storage.stored()[LEVEL_KEY]).toBe(second.id);
  });

  it("plays the same board again", async () => {
    await boot();
    press(en.play);
    playOut(FIRST.id);

    press(en.again);
    expect(counterText()).toBe(`0 / ${FIRST.par}`);
    expect(ui.hasText(en.solved)).toBe(false);
    expect(tiles().length).toBe(FIRST.blocks.length);
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
    tileAt(soldier).props.click_func();
    for (let round = 0; round < 4; round++) {
      interaction.swipe(GESTURE_DOWN);
      interaction.swipe(GESTURE_UP);
    }
    // One extra widget: the selection ring, which nothing has taken off yet.
    expect(ui.live().length).toBe(afterStart + 1);
  });
});
