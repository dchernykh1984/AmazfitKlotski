// How long a game took, and how to write that on a watch face. Pure arithmetic,
// no Zepp OS and no clock of its own: the page reads the time and hands the two
// stamps in here, which is what makes any of this testable.
//
// A game is timed from the moment the board opens to the moment the hero is out,
// and nothing in between stops the clock. That is deliberate: a rule like "the
// clock pauses in the menu" only invites the player to think in the menu, and
// pausing it while the screen sleeps would need the watch to agree with itself
// about when a game is really being played. Finish minus start is a rule anyone
// can hold in their head.

export const UNKNOWN = 0;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// A game longer than this is not a game any more - a watch left in a drawer, or a
// clock that jumped. It is still recorded, but it stops growing here so the
// record screen never has to draw a number that does not fit.
export const MAX_ELAPSED = 100 * HOUR - SECOND;

// The milliseconds between two readings of the clock, or UNKNOWN when there is
// nothing sensible to report. A missing stamp means the game was not timed at
// all; a finish before its start means the watch's clock moved under us, and a
// negative duration would be worse than none.
export function elapsedBetween(startedAt, finishedAt) {
  const start = Number(startedAt);
  const finish = Number(finishedAt);
  if (!isFinite(start) || !isFinite(finish) || start <= 0 || finish <= 0) {
    return UNKNOWN;
  }
  const elapsed = Math.round(finish - start);
  if (elapsed <= 0) {
    return UNKNOWN;
  }
  return Math.min(elapsed, MAX_ELAPSED);
}

// A stored duration turned back into milliseconds. Anything missing, negative,
// fractional or not a number at all reads as "not timed", so a corrupt entry
// cannot make a record impossible to beat.
export function normalizeElapsed(value) {
  const elapsed = Number(value);
  if (!isFinite(elapsed) || elapsed <= 0) {
    return UNKNOWN;
  }
  return Math.min(Math.floor(elapsed), MAX_ELAPSED);
}

export function isTimed(elapsed) {
  return normalizeElapsed(elapsed) !== UNKNOWN;
}

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

// A duration as a watch would write it: "4:21" for a few minutes, "1:04:21" once
// it runs past the hour. Seconds are always two digits so the number does not
// jitter as it counts; the leading field never is, because "04:21" reads like a
// timestamp rather than a length. An untimed game gets the placeholder the
// screen uses everywhere else.
export function formatElapsed(elapsed, placeholder = "-") {
  const total = normalizeElapsed(elapsed);
  if (total === UNKNOWN) {
    return placeholder;
  }
  const seconds = Math.floor(total / SECOND) % 60;
  const minutes = Math.floor(total / MINUTE) % 60;
  const hours = Math.floor(total / HOUR);
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}
