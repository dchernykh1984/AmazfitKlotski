// A stand-in for @zos/device. The screen size is read once, when the page's
// device module is first imported, so tests that want another size have to reset
// the module registry - see test/page.test.mjs.
let info = { width: 466, height: 466 };

export function getDeviceInfo() {
  return { ...info };
}

export function setDeviceInfo(next) {
  info = { ...next };
}
