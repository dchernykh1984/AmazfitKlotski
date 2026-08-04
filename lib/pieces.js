// Which picture goes on which block.
//
// The faces are details of a Qing dynasty album of Peking opera characters (see
// docs/ASSETS.md): the hero is the commander, the guard is the general lying
// across the board, and the four standing generals and four foot soldiers each
// get their own portrait so a board of ten blocks never looks like ten copies of
// the same tile.
import { GENERAL, GUARD, HERO, KINDS, SOLDIER } from "./klotski.js";
import { DESIGN_BUTTON_SIZE, nativeTileSize } from "./layout.js";

export const TILE_ART = {
  [HERO]: ["hero.png"],
  [GUARD]: ["guard.png"],
  [GENERAL]: ["general-1.png", "general-2.png", "general-3.png", "general-4.png"],
  [SOLDIER]: ["soldier-1.png", "soldier-2.png", "soldier-3.png", "soldier-4.png"],
};

// The file for the n-th block of a kind, counting from zero in board order. A
// board with more blocks of a kind than there are portraits starts over from the
// first one.
export function artFor(kind, ordinal) {
  const art = TILE_ART[kind];
  if (!art) {
    return null;
  }
  const index = Math.abs(Math.floor(ordinal)) % art.length;
  return art[index];
}

// Hand every block in a game its picture, in board order.
export function assignArt(blocks) {
  const counters = {};
  return blocks.map((block) => {
    const seen = counters[block.kind] || 0;
    counters[block.kind] = seen + 1;
    return artFor(block.kind, seen);
  });
}

// The pixel size each kind's picture is stored at. The watch scales it to whatever
// cell the screen ended up with, so this is the resolution the art is cut for, not
// the size it is drawn at; the asset test holds the files to it.
export function artSize(kind) {
  const size = KINDS[kind];
  return size ? nativeTileSize(size.w, size.h) : null;
}

// The two round buttons in the margins beside the board. Each needs a resting and
// a pressed picture: Zepp OS only honours a button's images when both are given.
const CONTROL_SIZE = { w: DESIGN_BUTTON_SIZE, h: DESIGN_BUTTON_SIZE };

export const CONTROL_ART = {
  undo: { normal: "undo.png", press: "undo-press.png" },
  menu: { normal: "menu.png", press: "menu-press.png" },
};

// The app icon, drawn from the same album as the hero's portrait.
export const ICON_ART = "icon.png";
export const ICON_SIZE = { w: 248, h: 248 };

// Every picture the app ships and the size each one has to be, so a test can hold
// the files themselves to it.
export function allArt() {
  const files = [];
  const kinds = Object.keys(TILE_ART);
  for (let i = 0; i < kinds.length; i++) {
    const art = TILE_ART[kinds[i]];
    for (let j = 0; j < art.length; j++) {
      files.push({ kind: kinds[i], file: art[j], size: artSize(kinds[i]) });
    }
  }
  const controls = Object.keys(CONTROL_ART);
  for (let i = 0; i < controls.length; i++) {
    files.push({ kind: controls[i], file: CONTROL_ART[controls[i]].normal, size: CONTROL_SIZE });
    files.push({ kind: controls[i], file: CONTROL_ART[controls[i]].press, size: CONTROL_SIZE });
  }
  files.push({ kind: "icon", file: ICON_ART, size: ICON_SIZE });
  return files;
}
