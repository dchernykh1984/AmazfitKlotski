import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allArt } from "../lib/pieces.js";

const ASSET_DIR = fileURLToPath(new URL("../assets/common.r/", import.meta.url));
const CREDITS = fileURLToPath(new URL("../docs/ASSETS.md", import.meta.url));

// A PNG starts with an 8 byte signature and then the IHDR chunk, whose first two
// fields are the width and the height as big-endian 32 bit integers.
function pngSize(path) {
  const bytes = readFileSync(path);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!bytes.subarray(0, 8).equals(signature)) {
    throw new Error(`${path} is not a PNG`);
  }
  if (bytes.subarray(12, 16).toString("latin1") !== "IHDR") {
    throw new Error(`${path} has no IHDR chunk`);
  }
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

const art = allArt();

describe("the shipped artwork", () => {
  for (const entry of art) {
    it(`${entry.file} is ${entry.size.w}x${entry.size.h}`, () => {
      // Zepp OS draws an image at the size it was saved at, so a file that does
      // not match its box would sit crooked in its cell or overlap a neighbour.
      expect(pngSize(ASSET_DIR + entry.file)).toEqual(entry.size);
    });
  }

  it("ships nothing the app does not draw", () => {
    const declared = art.map((entry) => entry.file).sort();
    expect(readdirSync(ASSET_DIR).sort()).toEqual(declared);
  });

  it("stays small enough to bundle", () => {
    let total = 0;
    for (const entry of art) {
      const bytes = readFileSync(ASSET_DIR + entry.file).length;
      expect(bytes, entry.file).toBeLessThan(200 * 1024);
      total += bytes;
    }
    expect(total).toBeLessThan(400 * 1024);
  });
});

describe("asset credits", () => {
  const credits = readFileSync(CREDITS, "utf8");

  it("names every file that came from somewhere else", () => {
    for (const entry of art) {
      expect(credits, entry.file).toContain(entry.file);
    }
  });

  it("states the licence of the sourced artwork", () => {
    expect(credits).toContain("CC0");
    expect(credits).toContain("creativecommons.org/publicdomain/zero/1.0");
  });
});
