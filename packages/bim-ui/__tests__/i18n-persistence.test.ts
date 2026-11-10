/**
 * @jest-environment jsdom
 */
import {
  LANGUAGE_STORAGE_KEY,
  readLanguagePreference,
  resolveInitialLanguage,
  writeLanguagePreference,
} from "../src/i18n/persistence";

test("account preference wins over stored and navigator", () => {
  expect(resolveInitialLanguage({ account: "tr", stored: "en", navigator: "en-US" })).toBe("tr");
});

test("stored wins when there is no account preference", () => {
  expect(resolveInitialLanguage({ stored: "tr", navigator: "en-US" })).toBe("tr");
});

test("navigator tr-* resolves to tr", () => {
  expect(resolveInitialLanguage({ navigator: "tr-TR" })).toBe("tr");
});

test("unknown navigator falls back to en", () => {
  expect(resolveInitialLanguage({ navigator: "de-DE" })).toBe("en");
  expect(resolveInitialLanguage({})).toBe("en");
});

test("the preference is written under one key and read back as a language", () => {
  const storage = window.localStorage;
  storage.clear();
  expect(readLanguagePreference(storage)).toBeUndefined();

  writeLanguagePreference(storage, "tr");
  expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe("tr");
  expect(readLanguagePreference(storage)).toBe("tr");

  storage.clear();
});

test("a corrupted or absent store reads as no preference and never throws", () => {
  const storage = window.localStorage;
  storage.clear();
  storage.setItem(LANGUAGE_STORAGE_KEY, "de");
  expect(readLanguagePreference(storage)).toBeUndefined();

  storage.setItem(LANGUAGE_STORAGE_KEY, "");
  expect(readLanguagePreference(storage)).toBeUndefined();

  // SSR (no `window`) and a privacy mode that refuses `localStorage` both arrive here.
  expect(readLanguagePreference(undefined)).toBeUndefined();
  expect(() => writeLanguagePreference(undefined, "tr")).not.toThrow();

  storage.clear();
});

test("a store that throws on read or write is tolerated", () => {
  const refusing: Storage = {
    length: 0,
    clear: () => undefined,
    getItem: () => {
      throw new Error("SecurityError: localStorage is not available");
    },
    key: () => null,
    removeItem: () => undefined,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  expect(readLanguagePreference(refusing)).toBeUndefined();
  expect(() => writeLanguagePreference(refusing, "tr")).not.toThrow();
});
