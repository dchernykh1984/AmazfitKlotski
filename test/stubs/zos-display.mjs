// A stand-in for @zos/display. The page asks for a long screen timeout while it
// is open and hands it back on the way out; the test checks both happen.
let brightTime = null;
let resets = 0;

export function setPageBrightTime(options) {
  brightTime = options ? options.brightTime : null;
}

export function resetPageBrightTime() {
  brightTime = null;
  resets++;
}

// ------------------------------------------------------------ test helpers ----

export function currentBrightTime() {
  return brightTime;
}

export function resetCount() {
  return resets;
}

export function reset() {
  brightTime = null;
  resets = 0;
}
