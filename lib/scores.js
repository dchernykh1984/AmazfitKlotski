// Remembering the player's best game. Klotski is scored the other way round from
// most games - fewer moves is better - so "no record yet" cannot be zero, and
// every comparison here keeps that straight.

// The level the player last chose, so the app reopens where it was left.
export const LEVEL_KEY = "level";

// Best result per level: each board keeps its own record.
export function bestKey(levelId) {
  return `best.${levelId}`;
}

export const NO_RECORD = 0;

// A stored value turned into a move count. Anything missing, negative, fractional
// or not a number at all reads as "no record yet", so a corrupt storage entry
// cannot make a record impossible to beat.
export function normalizeMoves(value) {
  const moves = Number(value);
  if (!isFinite(moves) || moves <= 0) {
    return NO_RECORD;
  }
  return Math.floor(moves);
}

export function hasRecord(best) {
  return normalizeMoves(best) !== NO_RECORD;
}

// Fold a finished game into the record. A first finish always sets one; after
// that only a shorter game does.
export function updateBest(best, moves) {
  const current = normalizeMoves(best);
  const result = normalizeMoves(moves);
  if (result === NO_RECORD) {
    return { best: current, isRecord: false };
  }
  if (current === NO_RECORD || result < current) {
    return { best: result, isRecord: true };
  }
  return { best: current, isRecord: false };
}
