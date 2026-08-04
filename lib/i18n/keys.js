// Every string the watch screen can show, as a key. This is the contract each
// language table must satisfy: the locale-completeness unit test fails if a table
// is missing a key or carries one that is not here.
export const UI_KEYS = [
  "title",
  "play",
  "resume",
  "restart",
  "levels",
  "best",
  "par",
  "moves",
  "solved",
  "new_best",
  "next",
  "again",
  "none",
  "hint",
  "level_warmup",
  "level_sentries",
  "level_gateway",
  "level_crossing",
  "level_pincer",
  "level_huarong",
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

// The label key for a level id, so the level list needs no table of its own.
export function levelKey(levelId) {
  return `level_${levelId}`;
}
