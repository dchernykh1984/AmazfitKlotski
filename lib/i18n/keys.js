// Every string the watch screen can show, as a key. This is the contract each
// language table must satisfy: the locale-completeness unit test fails if a table
// is missing a key or carries one that is not here.
export const UI_KEYS = [
  "title",
  "play",
  "resume",
  "restart",
  "levels",
  "level",
  "best",
  "par",
  "moves",
  "time",
  "solved",
  "new_best",
  "next",
  "again",
  "none",
  "records",
  "back",
  "hint",
];

// The on-watch character budgets. Everything is drawn on a round screen with no
// auto-shrinking, so a label that overruns its box is simply clipped. `hint` is a
// full sentence under the start menu and gets a wider allowance than the words
// that sit on buttons and beside the counter.
export const MAX_LABEL = 12;
export const MAX_HINT = 22;
export const LONG_KEYS = ["hint"];

export function budgetFor(key) {
  return LONG_KEYS.indexOf(key) === -1 ? MAX_LABEL : MAX_HINT;
}

// A board is named by its number, so the word and the number are two separate
// things joined at the last moment: "Level" plus 6. That is one string to
// translate instead of one per board, and a board added later needs none.
export function levelLabel(word, levelId) {
  return `${word} ${levelId}`;
}

// The widest a level label may get once its number is on the end. Numbers are
// short, but the word in front of them still has to leave room for one.
export const MAX_LEVEL_LABEL = MAX_LABEL + 4;
