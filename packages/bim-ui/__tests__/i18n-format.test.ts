import { formatDate, formatNumber, formatQuantity, separatorsFor } from "../src/i18n/format";

test("tr uses comma decimal and dot thousands", () => {
  expect(formatNumber(12345.67, "tr")).toBe("12.345,67");
});
test("en keeps dot decimal and comma thousands", () => {
  expect(formatNumber(12345.67, "en")).toBe("12,345.67");
});
test("separatorsFor returns the profile values for tr", () => {
  expect(separatorsFor("tr")).toEqual({ decimal: ",", thousands: "." });
});
test("formatQuantity never translates the unit symbol", () => {
  expect(formatQuantity(12.5, "kVA", "tr")).toBe("12,5 kVA");
});
test("formatQuantity keeps CFM untranslated in tr", () => {
  expect(formatQuantity(400, "CFM", "tr")).toBe("400 CFM");
});
test("separatorsFor returns the profile values for en", () => {
  expect(separatorsFor("en")).toEqual({ decimal: ".", thousands: "," });
});
test("formatDate follows the language for a fixed UTC instant in en", () => {
  const options = { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" } as const;
  expect(formatDate(Date.UTC(2026, 0, 15), "en", options)).toBe("01/15/2026");
});
test("formatDate follows the language for a fixed UTC instant in tr", () => {
  const options = { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" } as const;
  expect(formatDate(new Date(Date.UTC(2026, 0, 15)), "tr", options)).toBe("15.01.2026");
});
