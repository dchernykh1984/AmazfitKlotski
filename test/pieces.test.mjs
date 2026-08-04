import { describe, it, expect } from "vitest";
import { GENERAL, GUARD, HERO, KINDS, SOLDIER, createGame } from "../lib/klotski.js";
import { TILE_ART, allArt, artFor, artSize, assignArt } from "../lib/pieces.js";
import { tileSize } from "../lib/layout.js";
import { LEVELS } from "../lib/levels.js";

describe("TILE_ART", () => {
  it("has a picture for every kind of block", () => {
    for (const kind of Object.keys(KINDS)) {
      expect(TILE_ART[kind], kind).toBeTruthy();
      expect(TILE_ART[kind].length, kind).toBeGreaterThan(0);
    }
  });

  it("uses each file once", () => {
    const files = allArt().map((entry) => entry.file);
    expect(new Set(files).size).toBe(files.length);
  });

  it("has as many portraits as the busiest board has blocks of a kind", () => {
    const most = {};
    for (const level of LEVELS) {
      const counts = {};
      for (const block of level.blocks) {
        counts[block.kind] = (counts[block.kind] || 0) + 1;
      }
      for (const kind of Object.keys(counts)) {
        most[kind] = Math.max(most[kind] || 0, counts[kind]);
      }
    }
    for (const kind of Object.keys(most)) {
      expect(TILE_ART[kind].length, kind).toBeGreaterThanOrEqual(most[kind]);
    }
  });
});

describe("artFor", () => {
  it("walks the portraits of a kind in order", () => {
    expect(artFor(GENERAL, 0)).toBe(TILE_ART[GENERAL][0]);
    expect(artFor(GENERAL, 3)).toBe(TILE_ART[GENERAL][3]);
    expect(artFor(HERO, 0)).toBe(TILE_ART[HERO][0]);
  });

  it("starts over rather than running out", () => {
    expect(artFor(SOLDIER, TILE_ART[SOLDIER].length)).toBe(TILE_ART[SOLDIER][0]);
    expect(artFor(GUARD, 5)).toBe(TILE_ART[GUARD][0]);
    expect(artFor(SOLDIER, -1)).toBe(TILE_ART[SOLDIER][1]);
  });

  it("returns null for something that is not a block", () => {
    expect(artFor("dragon", 0)).toBeNull();
  });
});

describe("assignArt", () => {
  it("gives the blocks of a kind different portraits", () => {
    for (const level of LEVELS) {
      const blocks = createGame(level).blocks;
      const art = assignArt(blocks);
      expect(art.length, level.id).toBe(blocks.length);
      const byKind = {};
      blocks.forEach((block, index) => {
        byKind[block.kind] = byKind[block.kind] || [];
        byKind[block.kind].push(art[index]);
      });
      for (const kind of Object.keys(byKind)) {
        expect(new Set(byKind[kind]).size, `${level.id}/${kind}`).toBe(byKind[kind].length);
      }
    }
  });

  it("names a file for every block", () => {
    for (const level of LEVELS) {
      for (const file of assignArt(createGame(level).blocks)) {
        expect(file, level.id).toMatch(/\.png$/);
      }
    }
  });
});

describe("artSize", () => {
  it("matches the pixel box the block is drawn in", () => {
    for (const kind of Object.keys(KINDS)) {
      expect(artSize(kind), kind).toEqual(tileSize(KINDS[kind].w, KINDS[kind].h));
    }
  });

  it("returns null for something that is not a block", () => {
    expect(artSize("dragon")).toBeNull();
  });
});
