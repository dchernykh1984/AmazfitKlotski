import { describe, it, expect } from "vitest";
import { LABELS } from "../lib/i18n/labels.js";
import { UI_KEYS, budgetFor, levelKey, MAX_LABEL, MAX_HINT } from "../lib/i18n/keys.js";
import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  labelFor,
  resolveLanguage,
  languageFromZeppCode,
} from "../lib/i18n/index.js";
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

  it("names every bundled level in every language", () => {
    for (const level of LEVELS) {
      expect(UI_KEYS, level.id).toContain(levelKey(level.id));
      for (const lang of LANGUAGES) {
        expect(LABELS[lang][levelKey(level.id)], `${lang}/${level.id}`).toBeTruthy();
      }
    }
  });
});

describe("resolveLanguage", () => {
  it("maps a device locale to a supported 2-letter language", () => {
    expect(resolveLanguage("ru-RU")).toBe("ru");
    expect(resolveLanguage("en_US")).toBe("en");
    expect(resolveLanguage("kk-KZ")).toBe("kk");
    expect(resolveLanguage("de")).toBe("de");
  });

  it("falls back to the default for unknown or empty locales", () => {
    expect(resolveLanguage("ja-JP")).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage("")).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
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
