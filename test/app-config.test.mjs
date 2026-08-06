import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ICON_ART } from "../lib/pieces.js";
import { screenLayout } from "../lib/layout.js";
import { LABELS } from "../lib/i18n/labels.js";
import { LANGUAGES } from "../lib/i18n/index.js";

const root = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const appJson = JSON.parse(readFileSync(root("app.json"), "utf8"));
const releaseWorkflow = readFileSync(root(".github/workflows/build-and-distribute.yml"), "utf8");

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

  it("lays out cleanly on every screen it names", () => {
    // Zeus expands a round target to every round size it knows, so the bundle
    // reaches watches this list does not name; those are covered in the layout
    // test. This one holds the sizes the target itself declares.
    for (const platform of appJson.targets.common.platforms) {
      const layout = screenLayout(platform.dw);
      const radius = platform.dw / 2;
      const corner = Math.max(
        Math.hypot(layout.tray.x - radius, layout.tray.y - radius),
        Math.hypot(layout.tray.x + layout.tray.w - radius, layout.tray.y + layout.tray.h - radius)
      );
      expect(corner, String(platform.dw)).toBeLessThanOrEqual(radius);
      expect(layout.board.cell, String(platform.dw)).toBeGreaterThan(0);
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

  it("is brought up to date by the release build", () => {
    // The two version numbers themselves are app-version.test.mjs's business.
    // What belongs here is that the workflow building the .zab still runs the
    // sync first: without that step a release would ship the old version to the
    // store, however well the script works on its own.
    expect(releaseWorkflow).toContain("npm run version:sync");
  });

  it("declares an app name for every language it lists", () => {
    for (const locale of Object.keys(appJson.i18n)) {
      expect(appJson.i18n[locale].appName, locale).toBeTruthy();
    }
    expect(appJson.i18n[appJson.defaultLanguage]).toBeTruthy();
  });
});
