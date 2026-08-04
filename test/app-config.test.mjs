import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ICON_ART } from "../lib/pieces.js";
import { CELL } from "../lib/layout.js";
import { BOARD_COLS, BOARD_ROWS } from "../lib/levels.js";

const root = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const appJson = JSON.parse(readFileSync(root("app.json"), "utf8"));
const packageJson = JSON.parse(readFileSync(root("package.json"), "utf8"));

describe("app.json", () => {
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

  it("carries the same version as package.json", () => {
    // release-please bumps package.json; the release workflow copies the version
    // into app.json at build time. They must start out in step.
    expect(appJson.app.version.name).toBe(packageJson.version);
    const [major, minor, patch] = packageJson.version.split(".").map(Number);
    expect(appJson.app.version.code).toBe(major * 10000 + minor * 100 + patch);
  });

  it("declares an app name for every language it lists", () => {
    for (const locale of Object.keys(appJson.i18n)) {
      expect(appJson.i18n[locale].appName, locale).toBeTruthy();
    }
    expect(appJson.i18n[appJson.defaultLanguage]).toBeTruthy();
  });
});
