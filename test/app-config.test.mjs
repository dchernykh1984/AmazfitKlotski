import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ICON_ART } from "../lib/pieces.js";
import { CELL } from "../lib/layout.js";
import { BOARD_COLS, BOARD_ROWS } from "../lib/levels.js";
import { LABELS } from "../lib/i18n/labels.js";
import { LANGUAGES } from "../lib/i18n/index.js";

const root = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const appJson = JSON.parse(readFileSync(root("app.json"), "utf8"));
const packageJson = JSON.parse(readFileSync(root("package.json"), "utf8"));
const releaseWorkflow = readFileSync(root(".github/workflows/build-and-distribute.yml"), "utf8");

function versionParts(version) {
  return String(version)
    .split(".")
    .map((part) => Number(part));
}

// -1, 0 or 1, the way a comparator reads.
function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1;
    }
  }
  return 0;
}

describe("app.json", () => {
  it("carries the app id the game is registered under in the Zepp store", () => {
    // Registered as "Block Escape". An unregistered or placeholder id installs on
    // the watch but silently refuses to launch, so this one is pinned.
    expect(appJson.app.appId).toBe(1122455);
  });

  it("shows the store name on the start screen too", () => {
    for (const lang of LANGUAGES) {
      expect(LABELS[lang].title, lang).toBe(appJson.app.appName);
    }
    for (const locale of Object.keys(appJson.i18n)) {
      expect(appJson.i18n[locale].appName, locale).toBe(appJson.app.appName);
    }
  });

  it("is built for round screens only", () => {
    const platforms = appJson.targets.common.platforms;
    expect(platforms.length).toBeGreaterThan(0);
    for (const platform of platforms) {
      expect(platform.st, JSON.stringify(platform)).toBe("r");
    }
  });

  it("targets screens the fixed board actually fits on", () => {
    const diagonal = Math.sqrt((BOARD_COLS * CELL) ** 2 + (BOARD_ROWS * CELL) ** 2);
    for (const platform of appJson.targets.common.platforms) {
      expect(platform.dw, String(platform.dw)).toBeGreaterThanOrEqual(diagonal);
    }
  });

  it("registers the one page the app has", () => {
    expect(appJson.targets.common.module.page.pages).toEqual(["page/index"]);
  });

  it("uses the icon the artwork test checks", () => {
    expect(appJson.app.icon).toBe(ICON_ART);
  });

  it("asks only for the permissions the game uses", () => {
    expect(appJson.permissions.sort()).toEqual(["data:os.device.info", "device:os.local_storage"]);
  });

  it("keeps its version code in step with its version name", () => {
    // The store needs an ever-increasing integer next to the semver, and the
    // release build derives one from the other in exactly this way.
    expect(appJson.app.version.name).toMatch(/^\d+\.\d+\.\d+$/);
    const [major, minor, patch] = versionParts(appJson.app.version.name);
    expect(appJson.app.version.code).toBe(major * 10000 + minor * 100 + patch);
  });

  it("never runs ahead of the version release-please owns", () => {
    // package.json is the version of record: release-please bumps it and leaves
    // app.json alone, because its JSON updater reformats app.json in a way
    // Prettier rejects. So between a release PR being opened and the bundle being
    // built, app.json is legitimately a release behind - but it must never be in
    // front, which would ship a version that was never released.
    expect(compareVersions(appJson.app.version.name, packageJson.version)).toBeLessThanOrEqual(0);
  });

  it("is brought up to date by the release build", () => {
    // What makes the drift above safe: the workflow that builds the .zab writes
    // the package.json version into app.json first. Without that step a release
    // would ship the old version to the store.
    expect(releaseWorkflow).toContain(".app.version.name");
    expect(releaseWorkflow).toContain(".app.version.code");
    expect(releaseWorkflow).toContain("require('./package.json').version");
  });

  it("declares an app name for every language it lists", () => {
    for (const locale of Object.keys(appJson.i18n)) {
      expect(appJson.i18n[locale].appName, locale).toBeTruthy();
    }
    expect(appJson.i18n[appJson.defaultLanguage]).toBeTruthy();
  });
});
