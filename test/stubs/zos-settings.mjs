// A stand-in for @zos/settings. getLanguage() returns the Zepp OS integer code
// for the device language; `2` is English. Tests can change it, and can make it
// throw, which some firmwares do.
let language = 2;
let throws = false;

export function getLanguage() {
  if (throws) {
    throw new Error("no language setting on this firmware");
  }
  return language;
}

export function setLanguage(code) {
  language = code;
}

export function setLanguageThrows(value) {
  throws = value;
}
