// A stand-in for @zos/storage. Real watches differ: some have no storage at all
// (the constructor throws) and a full one can refuse a write, so the stub can be
// told to fail at each of those points and the page has to keep playing anyway.
let store = new Map();
let failOn = { construct: false, read: false, write: false };

export class LocalStorage {
  constructor() {
    if (failOn.construct) {
      throw new Error("no storage on this device");
    }
  }

  getItem(key) {
    if (failOn.read) {
      throw new Error("storage read failed");
    }
    return store.has(key) ? store.get(key) : undefined;
  }

  setItem(key, value) {
    if (failOn.write) {
      throw new Error("storage write failed");
    }
    store.set(key, value);
  }
}

// ------------------------------------------------------------ test helpers ----

export function reset() {
  store = new Map();
  failOn = { construct: false, read: false, write: false };
}

export function fail(where, value = true) {
  failOn[where] = value;
}

export function stored() {
  return Object.fromEntries(store);
}

export function seed(key, value) {
  store.set(key, value);
}
