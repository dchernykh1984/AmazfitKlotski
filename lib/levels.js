// The bundled boards, written as the picture you actually see on the watch.
//
//   H  the hero, the 2x2 block that has to get out
//   G  a guard, lying down across two cells
//   V  a general, standing up across two cells
//   S  a soldier, one cell
//   .  a free cell
//
// Every board is the classic 4x5 frame with the exit under the two middle cells
// of the bottom row, so the hero is out once its top left corner reaches (1, 3).
// `par` is the shortest possible game in single-cell moves; the solver test
// recomputes each one, so a mistyped board or a wrong par fails the build.
import { KINDS } from "./klotski.js";

export const BOARD_COLS = 4;
export const BOARD_ROWS = 5;
export const GOAL = { x: 1, y: 3 };

const CHARS = { H: "hero", G: "guard", V: "general", S: "soldier" };

const LAYOUTS = [
  { id: "warmup", par: 7, art: ["VHHV", "VHHV", "VSSV", "V..V", "...."] },
  { id: "sentries", par: 17, art: ["VHHV", "VHHV", "VSSV", "VSSV", "...."] },
  { id: "gateway", par: 26, art: ["VHHV", "VHHV", "VGGV", "VS.V", "..S."] },
  { id: "crossing", par: 51, art: ["VHHV", "VHHV", "VGGV", "VSSV", "S..."] },
  { id: "pincer", par: 92, art: ["SHHS", "VHHV", "VGGV", "VSSV", "V..V"] },
  { id: "huarong", par: 116, art: ["VHHV", "VHHV", "VGGV", "VSSV", "S..S"] },
];

// Read a picture into blocks. A block is claimed at its top left cell, and every
// other cell it should cover has to carry the same character, so a typo in the
// art is an error rather than a quietly different board.
export function parseArt(art) {
  const rows = art.length;
  const cols = art[0].length;
  const taken = new Array(cols * rows).fill(false);
  const blocks = [];
  for (let y = 0; y < rows; y++) {
    if (art[y].length !== cols) {
      throw new Error(`row ${y} is ${art[y].length} cells wide, expected ${cols}`);
    }
    for (let x = 0; x < cols; x++) {
      const char = art[y][x];
      if (char === "." || taken[y * cols + x]) {
        continue;
      }
      const kind = CHARS[char];
      if (!kind) {
        throw new Error(`unknown block "${char}" at ${x},${y}`);
      }
      const size = KINDS[kind];
      if (x + size.w > cols || y + size.h > rows) {
        throw new Error(`${kind} at ${x},${y} hangs off the board`);
      }
      for (let dy = 0; dy < size.h; dy++) {
        for (let dx = 0; dx < size.w; dx++) {
          if (art[y + dy][x + dx] !== char) {
            throw new Error(`${kind} at ${x},${y} is not a full block`);
          }
          taken[(y + dy) * cols + x + dx] = true;
        }
      }
      blocks.push({ kind, x, y });
    }
  }
  return { cols, rows, blocks };
}

function build(layout) {
  const parsed = parseArt(layout.art);
  return {
    id: layout.id,
    par: layout.par,
    cols: parsed.cols,
    rows: parsed.rows,
    goal: GOAL,
    blocks: parsed.blocks,
  };
}

// Ordered easiest to hardest; the page walks this list.
export const LEVELS = LAYOUTS.map(build);

export const FIRST_LEVEL = LEVELS[0].id;

export function levelIndex(id) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (LEVELS[i].id === id) {
      return i;
    }
  }
  return -1;
}

// The level with this id, or the first one when the id is unknown - a stored
// choice from an older version must not leave the game with nothing to play.
export function levelById(id) {
  const index = levelIndex(id);
  return LEVELS[index === -1 ? 0 : index];
}

// The next board in the ladder, wrapping at the end so the list is a loop in
// both the menu and the "solved" screen.
export function nextLevel(id) {
  const index = levelIndex(id);
  return LEVELS[(index === -1 ? 0 : index + 1) % LEVELS.length];
}

export function previousLevel(id) {
  const index = levelIndex(id);
  const from = index === -1 ? 0 : index;
  return LEVELS[(from - 1 + LEVELS.length) % LEVELS.length];
}
