import { formatNumber, formatQuantity, separatorsFor } from "../src/i18n/format";

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
