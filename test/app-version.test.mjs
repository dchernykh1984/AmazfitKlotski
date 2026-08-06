import { afterEach, describe, it, expect } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { syncedAppJson, versionCode } from "../scripts/sync-app-version.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => JSON.parse(readFileSync(join(ROOT, file), "utf8"));

describe("versionCode", () => {
  it("packs a semver into one integer", () => {
    expect(versionCode("0.0.1")).toBe(1);
    expect(versionCode("0.3.1")).toBe(301);
    expect(versionCode("1.0.0")).toBe(10000);
    expect(versionCode("2.14.7")).toBe(21407);
  });

  // The store refuses an upload whose code is not above the last one, so the
  // ordering has to survive every bump, including the ones that carry.
  it("grows with every version bump, without exception", () => {
    const ordered = [
      "0.0.1",
      "0.0.99",
      "0.1.0",
      "0.1.1",
      "0.9.99",
      "0.10.0",
      "0.99.99",
      "1.0.0",
      "1.0.1",
      "2.0.0",
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(versionCode(ordered[i]), ordered[i] + " after " + ordered[i - 1]).toBeGreaterThan(
        versionCode(ordered[i - 1])
      );
    }
  });

  // Two digits each is all the packing has room for. Going quiet here would ship
  // a code that sorts below one already in the store, and the store would reject
  // the upload with nothing to explain it.
  it("refuses a version it cannot pack rather than wrapping round", () => {
    expect(() => versionCode("0.100.0")).toThrow(/under 100/);
    expect(() => versionCode("0.0.100")).toThrow(/under 100/);
    expect(versionCode("0.99.99")).toBe(9999);
  });

  it("refuses anything that is not a plain three-part version", () => {
    for (const bad of ["1.2", "1.2.3.4", "v1.2.3", "1.2.3-rc.1", "", "next"]) {
      expect(() => versionCode(bad), bad).toThrow();
    }
  });
});

describe("writing the version into app.json", () => {
  const APP = readFileSync(join(ROOT, "app.json"), "utf8");

  // A version app.json cannot already be sitting at, so a bump always moves both
  // lines. A fixed one would come round on the release PR that bumps the project
  // to it: the name would already match, only the code would move, and that
  // release's own CI would go red over the arithmetic being right.
  const AHEAD = `${Number(JSON.parse(APP).app.version.name.split(".")[0]) + 1}.2.3`;

  it("puts both numbers in", () => {
    const written = JSON.parse(syncedAppJson(APP, "1.2.3"));
    expect(written.app.version).toEqual({ name: "1.2.3", code: 10203 });
  });

  // The file is edited by hand and read in diffs, so a version bump has to show
  // up as the two lines it is - not as a reformat of the whole document.
  it("changes nothing else about the file", () => {
    const written = syncedAppJson(APP, AHEAD);
    const before = APP.split("\n");
    const after = written.split("\n");

    expect(after.length).toBe(before.length);
    const changed = after.filter((line, i) => line !== before[i]);
    expect(changed.length).toBe(2);
    expect(changed.join(" ")).toContain(AHEAD);
  });

  it("leaves everything but the version untouched", () => {
    const before = JSON.parse(APP);
    const after = JSON.parse(syncedAppJson(APP, "9.9.9"));
    expect(after.app.appId).toBe(before.app.appId);
    expect(after.app.appName).toBe(before.app.appName);
    expect(after.targets).toEqual(before.targets);
    expect(after.permissions).toEqual(before.permissions);
  });

  it("is idempotent", () => {
    const once = syncedAppJson(APP, "1.2.3");
    expect(syncedAppJson(once, "1.2.3")).toBe(once);
  });
});

// Everything above imports two helpers; neither npm script is made of only
// those. A check that always succeeds, or a sync that never writes the file,
// leaves every test above green and still ships the previous release's number
// to the store - so the script is run here as the release runs it, as a process
// with an exit code. Against a throwaway copy: it writes the app.json next to
// itself, and that must never be this repository's.
describe("running the script", () => {
  const sandboxes = [];

  afterEach(() => {
    while (sandboxes.length > 0) {
      rmSync(sandboxes.pop(), { recursive: true, force: true });
    }
  });

  // The two files the script reads, and nothing else it needs.
  function sandbox(releaseVersion, appName, appCode) {
    const dir = mkdtempSync(join(tmpdir(), "app-version-"));
    sandboxes.push(dir);
    mkdirSync(join(dir, "scripts"));
    cpSync(join(ROOT, "scripts/sync-app-version.mjs"), join(dir, "scripts/sync-app-version.mjs"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: releaseVersion }) + "\n");
    const app = read("app.json");
    app.app.version = { code: appCode, name: appName };
    writeFileSync(join(dir, "app.json"), JSON.stringify(app, null, 2) + "\n");
    return dir;
  }

  const run = (dir, ...args) =>
    spawnSync(process.execPath, [join(dir, "scripts/sync-app-version.mjs"), ...args], {
      encoding: "utf8",
    });

  const versionIn = (dir) => JSON.parse(readFileSync(join(dir, "app.json"), "utf8")).app.version;

  it("fails the check when the two files name different versions", () => {
    const failed = run(sandbox("0.3.0", "0.2.1", 201), "--check");
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("version:sync");
  });

  it("checks without writing, even when the check fails", () => {
    const dir = sandbox("0.3.0", "0.2.1", 201);
    run(dir, "--check");
    expect(versionIn(dir)).toEqual({ code: 201, name: "0.2.1" });
  });

  // The state release-please leaves on a release PR: it wrote the name and
  // cannot compute the code. Failing here would block every release.
  it("passes the check when only the code is a release behind", () => {
    expect(run(sandbox("0.2.2", "0.2.2", 201), "--check").status).toBe(0);
  });

  // What the release build is for, and what nothing else now checks: the bundle
  // it packs carries the code belonging to the name, however stale app.json was.
  it("writes both numbers when it is not checking", () => {
    const dir = sandbox("0.2.2", "0.2.2", 201);
    expect(run(dir).status).toBe(0);
    expect(versionIn(dir)).toEqual({ code: 202, name: "0.2.2" });
  });

  it("stops the build rather than shipping a version it cannot pack", () => {
    expect(run(sandbox("0.100.0", "0.99.0", 9900)).status).not.toBe(0);
  });
});

describe("the versions this repo actually ships", () => {
  // What the store and the watch show has to be the version that was released.
  // Only the name: release-please writes that into app.json when it opens a
  // release PR, and the code is recomputed from it at build time.
  it("says the same version in app.json as in package.json", () => {
    expect(read("app.json").app.version.name).toBe(read("package.json").version);
  });

  // Not the code, deliberately. release-please writes the name when it opens a
  // release PR and cannot compute the code, so on that one commit the code is
  // still the previous release's - and the build recomputes it before the bundle
  // is made. Asserting on it here would fail every release PR's own CI.
  it("has a code that at least parses as one", () => {
    const version = read("app.json").app.version;
    expect(Number.isInteger(version.code)).toBe(true);
    expect(version.code).toBeGreaterThan(0);
    expect(versionCode(version.name)).toBeGreaterThanOrEqual(version.code);
  });

  it("still has the registered store identity", () => {
    const app = read("app.json").app;
    expect(app.appId).toBe(1122455);
    expect(app.appName).toBe("Block Escape");
  });
});
