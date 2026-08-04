// A breadth-first solver for Klotski boards, used by the tests to prove every
// bundled level is solvable and that its declared par really is the shortest
// possible number of moves.
//
// Blocks of the same kind are interchangeable - swapping two soldiers gives the
// same puzzle - so positions are keyed by the kind that covers each cell rather
// than by block identity. That collapses the search space of the classic board
// from millions of positions to tens of thousands.
import { DIRECTIONS, canMove, createGame, isSolved, move, undo } from "../../lib/klotski.js";

const KIND_CHARS = { hero: "H", guard: "G", general: "V", soldier: "S" };

export function positionKey(game) {
  const cells = new Array(game.cols * game.rows).fill(".");
  for (let i = 0; i < game.blocks.length; i++) {
    const block = game.blocks[i];
    for (let dy = 0; dy < block.h; dy++) {
      for (let dx = 0; dx < block.w; dx++) {
        cells[(block.y + dy) * game.cols + block.x + dx] = KIND_CHARS[block.kind];
      }
    }
  }
  return cells.join("");
}

function snapshot(game) {
  return game.blocks.map((block) => ({ x: block.x, y: block.y }));
}

function restore(game, positions) {
  for (let i = 0; i < positions.length; i++) {
    game.blocks[i].x = positions[i].x;
    game.blocks[i].y = positions[i].y;
  }
}

// The fewest single-cell moves that solve the level, or null when it cannot be
// solved at all. `limit` caps how many positions are expanded so a broken level
// fails the test instead of hanging it.
export function shortestSolution(level, limit = 400000) {
  const game = createGame(level);
  if (isSolved(game)) {
    return 0;
  }

  const start = snapshot(game);
  const seen = new Set([positionKey(game)]);
  let frontier = [start];
  let depth = 0;
  let expanded = 0;

  while (frontier.length > 0) {
    const next = [];
    depth++;
    for (let i = 0; i < frontier.length; i++) {
      restore(game, frontier[i]);
      const positions = frontier[i];
      expanded++;
      if (expanded > limit) {
        throw new Error(`solver gave up after ${limit} positions`);
      }
      for (let id = 0; id < game.blocks.length; id++) {
        for (let d = 0; d < DIRECTIONS.length; d++) {
          const direction = DIRECTIONS[d];
          if (!canMove(game, id, direction)) {
            continue;
          }
          move(game, id, direction);
          const key = positionKey(game);
          if (!seen.has(key)) {
            if (isSolved(game)) {
              return depth;
            }
            seen.add(key);
            next.push(snapshot(game));
          }
          undo(game);
          restore(game, positions);
        }
      }
    }
    frontier = next;
  }
  return null;
}

// How many distinct positions the level can reach. A level whose blocks are
// wedged has a tiny number here, which makes it a poor puzzle.
export function reachablePositions(level, limit = 400000) {
  const game = createGame(level);
  const start = snapshot(game);
  const seen = new Set([positionKey(game)]);
  const queue = [start];
  while (queue.length > 0) {
    const positions = queue.pop();
    restore(game, positions);
    if (seen.size > limit) {
      throw new Error(`solver gave up after ${limit} positions`);
    }
    for (let id = 0; id < game.blocks.length; id++) {
      for (let d = 0; d < DIRECTIONS.length; d++) {
        const direction = DIRECTIONS[d];
        if (!canMove(game, id, direction)) {
          continue;
        }
        move(game, id, direction);
        const key = positionKey(game);
        if (!seen.has(key)) {
          seen.add(key);
          queue.push(snapshot(game));
        }
        undo(game);
        restore(game, positions);
      }
    }
  }
  return seen.size;
}
