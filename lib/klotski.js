// The rules of Klotski (Huarong Dao), free of any Zepp OS dependency so they are
// unit tested and the page only has to draw what these functions decide.
//
// The board is a grid of columns and rows holding rectangular blocks. A block
// slides one cell at a time, up, down, left or right, into free cells; it never
// rotates and never leaves the board. The puzzle is solved when the single 2x2
// hero block reaches the goal cell in front of the exit.
//
// Every move is one cell. A player who drags a block across two cells therefore
// spends two moves, which is what the on-screen counter and the level par both
// count.

export const HERO = "hero";
export const GUARD = "guard";
export const GENERAL = "general";
export const SOLDIER = "soldier";

// Block footprints in cells. The kind is also what the page uses to pick the art.
export const KINDS = {
  [HERO]: { w: 2, h: 2 },
  [GUARD]: { w: 2, h: 1 },
  [GENERAL]: { w: 1, h: 2 },
  [SOLDIER]: { w: 1, h: 1 },
};

export const UP = 0;
export const RIGHT = 1;
export const DOWN = 2;
export const LEFT = 3;

export const DIRECTIONS = [UP, RIGHT, DOWN, LEFT];

// dx, dy per direction, indexed by the constants above.
const STEPS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

export function stepFor(direction) {
  return STEPS[direction] || null;
}

// An empty cell holds this instead of a block id.
export const EMPTY = -1;

// A playable game from a level definition. The level itself is never touched, so
// the same definition can be replayed and compared against.
export function createGame(level) {
  const blocks = level.blocks.map((block, index) => ({
    id: index,
    kind: block.kind,
    x: block.x,
    y: block.y,
    w: KINDS[block.kind].w,
    h: KINDS[block.kind].h,
  }));
  return {
    level,
    cols: level.cols,
    rows: level.rows,
    blocks,
    heroId: blocks.findIndex((block) => block.kind === HERO),
    moves: 0,
    history: [],
  };
}

// Start the same level over. Cheaper and simpler than rebuilding every widget:
// the page keeps its block widgets and just repaints them where this puts them.
export function restart(game) {
  for (let i = 0; i < game.blocks.length; i++) {
    game.blocks[i].x = game.level.blocks[i].x;
    game.blocks[i].y = game.level.blocks[i].y;
  }
  game.moves = 0;
  game.history = [];
}

// The grid of block ids, EMPTY where nothing stands. Rebuilt on demand: a 4x5
// board is twenty cells, far cheaper than keeping a copy in sync.
export function occupancy(game) {
  const grid = new Array(game.cols * game.rows).fill(EMPTY);
  for (let i = 0; i < game.blocks.length; i++) {
    const block = game.blocks[i];
    for (let dy = 0; dy < block.h; dy++) {
      for (let dx = 0; dx < block.w; dx++) {
        grid[(block.y + dy) * game.cols + block.x + dx] = block.id;
      }
    }
  }
  return grid;
}

// The block covering a cell, or null. This is how a tap on the board is turned
// into a selection.
export function blockAt(game, column, row) {
  if (column < 0 || row < 0 || column >= game.cols || row >= game.rows) {
    return null;
  }
  const id = occupancy(game)[row * game.cols + column];
  return id === EMPTY ? null : game.blocks[id];
}

export function blockById(game, id) {
  return game.blocks[id] || null;
}

// Whether a block can slide one cell in a direction: the cells it would move
// into must be on the board and either free or covered by the block itself.
export function canMove(game, id, direction) {
  const block = game.blocks[id];
  const step = stepFor(direction);
  if (!block || !step) {
    return false;
  }
  const x = block.x + step.dx;
  const y = block.y + step.dy;
  if (x < 0 || y < 0 || x + block.w > game.cols || y + block.h > game.rows) {
    return false;
  }
  const grid = occupancy(game);
  for (let dy = 0; dy < block.h; dy++) {
    for (let dx = 0; dx < block.w; dx++) {
      const occupant = grid[(y + dy) * game.cols + x + dx];
      if (occupant !== EMPTY && occupant !== block.id) {
        return false;
      }
    }
  }
  return true;
}

// The directions a block can slide right now, in UP, RIGHT, DOWN, LEFT order.
export function legalDirections(game, id) {
  const directions = [];
  for (let i = 0; i < DIRECTIONS.length; i++) {
    if (canMove(game, id, DIRECTIONS[i])) {
      directions.push(DIRECTIONS[i]);
    }
  }
  return directions;
}

// Slide a block one cell and record it, so undo can take it back. Returns true
// when the board changed, which is the page's cue to redraw that one block.
export function move(game, id, direction) {
  if (!canMove(game, id, direction)) {
    return false;
  }
  const block = game.blocks[id];
  const step = stepFor(direction);
  block.x += step.dx;
  block.y += step.dy;
  game.moves++;
  game.history.push({ id, direction });
  return true;
}

// Take back the last move. The move counter goes back with it: undo is a way to
// think, not a way to score.
export function undo(game) {
  const last = game.history.pop();
  if (!last) {
    return null;
  }
  const block = game.blocks[last.id];
  const step = stepFor(last.direction);
  block.x -= step.dx;
  block.y -= step.dy;
  game.moves--;
  return last;
}

// The hero is out when it sits on the goal cell, which is the square just inside
// the exit at the bottom of the board.
export function isSolved(game) {
  const hero = game.blocks[game.heroId];
  return !!hero && hero.x === game.level.goal.x && hero.y === game.level.goal.y;
}
