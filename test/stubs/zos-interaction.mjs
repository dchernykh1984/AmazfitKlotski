// A stand-in for @zos/interaction: it keeps the page's gesture callback so a test
// can swipe, and records whether the page unhooked it again.
export const GESTURE_UP = "GESTURE_UP";
export const GESTURE_DOWN = "GESTURE_DOWN";
export const GESTURE_LEFT = "GESTURE_LEFT";
export const GESTURE_RIGHT = "GESTURE_RIGHT";

let callback = null;

export function onGesture(options) {
  callback = options && options.callback ? options.callback : null;
}

export function offGesture() {
  callback = null;
}

// ------------------------------------------------------------ test helpers ----

export function swipe(gesture) {
  if (!callback) {
    throw new Error("nothing is listening for gestures");
  }
  return callback(gesture);
}

export function isListening() {
  return callback !== null;
}

export function reset() {
  callback = null;
}
