import { isMutinyLanguage, createI18n } from "../src/i18n";

test("isMutinyLanguage accepts only en and tr", () => {
  expect(isMutinyLanguage("en")).toBe(true);
  expect(isMutinyLanguage("tr")).toBe(true);
  expect(isMutinyLanguage("de")).toBe(false);
  expect(isMutinyLanguage(undefined)).toBe(false);
});

test("a missing tr key falls back to the English defaultValue, never the key", () => {
  const i18n = createI18n({ language: "tr", resources: { tr: { common: {} } } });
  expect(i18n.t("greet", { ns: "common", defaultValue: "Hello" })).toBe("Hello");
  expect(i18n.t("greet", { ns: "common", defaultValue: "Hello" })).not.toBe("greet");
});

test("a present tr key resolves to Turkish", () => {
  const i18n = createI18n({ language: "tr", resources: { tr: { common: { greet: "Merhaba" } } } });
  expect(i18n.t("greet", { ns: "common", defaultValue: "Hello" })).toBe("Merhaba");
});
