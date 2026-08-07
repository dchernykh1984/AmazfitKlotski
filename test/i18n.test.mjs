import { describe, it, expect } from "vitest";
import { LABELS } from "../lib/i18n/labels.js";
import {
  UI_KEYS,
  budgetFor,
  levelLabel,
  MAX_LABEL,
  MAX_LEVEL_LABEL,
  MAX_HINT,
} from "../lib/i18n/keys.js";
import { LANGUAGES, DEFAULT_LANGUAGE, labelFor, languageFromZeppCode } from "../lib/i18n/index.js";
import { LEVELS } from "../lib/levels.js";

// The language list mirrors the sibling AmazfitSerpent and AmazfitRaceStats apps:
// the ten Zepp OS exposes as device languages, plus Kazakh.
const EXPECTED_LANGUAGES = ["en", "ru", "de", "fr", "it", "es", "pt", "nl", "pl", "cs", "kk"];

describe("locale completeness", () => {
  it("ships exactly the agreed language list", () => {
    expect([...LANGUAGES].sort()).toEqual([...EXPECTED_LANGUAGES].sort());
  });

  it("includes the default language", () => {
    expect(LANGUAGES).toContain(DEFAULT_LANGUAGE);
  });

  it("defines exactly the UI key set in every language", () => {
    const expected = [...UI_KEYS].sort();
    for (const lang of LANGUAGES) {
      expect(Object.keys(LABELS[lang]).sort(), lang).toEqual(expected);
    }
  });

  it("has a non-empty string within budget for every key in every language", () => {
    for (const lang of LANGUAGES) {
      for (const key of UI_KEYS) {
        const label = LABELS[lang][key];
        expect(typeof label, `${lang}/${key}`).toBe("string");
        expect(label.length, `${lang}/${key} '${label}'`).toBeGreaterThan(0);
        expect(label.length, `${lang}/${key} '${label}'`).toBeLessThanOrEqual(budgetFor(key));
      }
    }
  });

  it("gives the hint a wider budget than the words on buttons", () => {
    expect(budgetFor("hint")).toBe(MAX_HINT);
    expect(budgetFor("play")).toBe(MAX_LABEL);
    expect(MAX_HINT).toBeGreaterThan(MAX_LABEL);
  });

  it("names every bundled level in every language, from one word and a number", () => {
    // Boards are numbered, so a board needs no string of its own - which is the
    // point: adding a seventh board costs nothing in eleven languages.
    for (const level of LEVELS) {
      for (const lang of LANGUAGES) {
        const label = levelLabel(LABELS[lang].level, level.id);
        expect(label, `${lang}/${level.id}`).toContain(String(level.id));
        expect(label, `${lang}/${level.id}`).toContain(LABELS[lang].level);
        expect(label.length, `${lang}/${level.id} '${label}'`).toBeLessThanOrEqual(MAX_LEVEL_LABEL);
      }
    }
  });

  it("leaves room for the number after the word", () => {
    expect(MAX_LEVEL_LABEL).toBeGreaterThan(MAX_LABEL);
    // Even a hundred boards in, the label still fits its button.
    for (const lang of LANGUAGES) {
      expect(levelLabel(LABELS[lang].level, 100).length, lang).toBeLessThanOrEqual(MAX_LEVEL_LABEL);
    }
  });

  it("carries no leftover per-board names", () => {
    for (const key of UI_KEYS) {
      expect(key, key).not.toMatch(/^level_/);
    }
  });
});

describe("languageFromZeppCode", () => {
  it("maps the Zepp OS integer language codes we translate", () => {
    expect(languageFromZeppCode(2)).toBe("en");
    expect(languageFromZeppCode(4)).toBe("ru");
    expect(languageFromZeppCode(22)).toBe("cs");
  });

  it("falls back to the default for codes we do not translate", () => {
    expect(languageFromZeppCode(0)).toBe(DEFAULT_LANGUAGE);
    expect(languageFromZeppCode(999)).toBe(DEFAULT_LANGUAGE);
    expect(languageFromZeppCode(undefined)).toBe(DEFAULT_LANGUAGE);
  });
});

describe("labelFor", () => {
  it("returns the localized string for a supported language", () => {
    expect(labelFor("ru", "play")).toBe(LABELS.ru.play);
    expect(labelFor("kk", "solved")).toBe(LABELS.kk.solved);
  });

  it("falls back to English, then to the raw key", () => {
    expect(labelFor("ja", "play")).toBe(LABELS.en.play);
    expect(labelFor("en", "not_a_key")).toBe("not_a_key");
  });
});
