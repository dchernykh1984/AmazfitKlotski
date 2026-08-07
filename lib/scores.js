// Remembering the player's best game. Klotski is scored the other way round from
// most games - fewer moves is better - so "no record yet" cannot be zero, and
// every comparison here keeps that straight.
//
// A result is a pair: the moves it took and how long it took. Moves decide the
// record; the clock only separates two games that took the same number of moves,
// because the puzzle is the point and the hurry is not. A game that was never
// timed still counts on moves, and loses a tie to one that was - otherwise an
// untimed game would sit at the top of a board forever, unbeatable except by
// playing it shorter.
import { UNKNOWN, normalizeElapsed } from "./clock.js";

// The level the player last chose, so the app reopens where it was left.
export const LEVEL_KEY = "level";

// Each board keeps its own record, under its own number. The two halves are
// stored apart rather than as one packed value: the watch's storage holds plain
// numbers, and two keys need no parsing and cannot half-decode.
export function bestKey(levelId) {
  return `best.${levelId}`;
}

export function bestTimeKey(levelId) {
  return `time.${levelId}`;
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

// A result, cleaned up: { moves, time }. `moves` of NO_RECORD means there is no
// result here at all, whatever the clock says.
export function normalizeResult(result) {
  const moves = normalizeMoves(result && result.moves);
  if (moves === NO_RECORD) {
    return { moves: NO_RECORD, time: UNKNOWN };
  }
  return { moves, time: normalizeElapsed(result && result.time) };
}

export function hasRecord(result) {
  return normalizeResult(result).moves !== NO_RECORD;
}

// Negative when the first result is the better one, positive when the second is,
// zero when there is nothing to choose between them. Fewer moves wins; on equal
// moves the shorter game wins; a game with no clock loses that tie-break, and
// two games with no clock are simply equal.
export function compareResults(left, right) {
  const a = normalizeResult(left);
  const b = normalizeResult(right);
  if (a.moves !== b.moves) {
    // A result that is not there at all is worse than any real one.
    if (a.moves === NO_RECORD) {
      return 1;
    }
    if (b.moves === NO_RECORD) {
      return -1;
    }
    return a.moves < b.moves ? -1 : 1;
  }
  if (a.moves === NO_RECORD) {
    return 0;
  }
  if (a.time === b.time) {
    return 0;
  }
  if (a.time === UNKNOWN) {
    return 1;
  }
  if (b.time === UNKNOWN) {
    return -1;
  }
  return a.time < b.time ? -1 : 1;
}

export function isBetter(candidate, current) {
  return compareResults(candidate, current) < 0;
}

// Fold a finished game into the record. A first finish always sets one; after
// that only a better result does.
export function updateBest(record, result) {
  const current = normalizeResult(record);
  const candidate = normalizeResult(result);
  if (candidate.moves === NO_RECORD) {
    return { best: current, isRecord: false };
  }
  if (isBetter(candidate, current)) {
    return { best: candidate, isRecord: true };
  }
  return { best: current, isRecord: false };
}
