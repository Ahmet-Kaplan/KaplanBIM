/**
 * Glossary guard: `docs/i18n/glossary.md` is binding, and this is what makes it
 * binding. Every translation task runs this file, so a term that drifts is caught
 * where it is written, not in review.
 *
 * Three rules, each with its section in the glossary:
 *
 *   §8   Turkish has no plural suffix after a numeral: "3 eleman", never
 *        "3 elemanlar"; the same holds for a placeholder count, "{n} eleman".
 *   §2.3 "Space" is *mekan*, never *alan* — *alan* is reserved for "area".
 *   §2.4 "Sheet" is *pafta*, never *tablo* (§9/Ç3: a sheet is a drawing sheet,
 *        an electronic table is not the same thing).
 *
 * The corpus is nearly empty today, so each rule also carries a self-test of its
 * detector: the guard is proven able to fail before it is trusted to pass.
 */
import { flattenLocales, readTrLocaleFiles, type LocaleEntry } from "./locale-files";

const ENTRIES = flattenLocales(readTrLocaleFiles()).entries;

/**
 * §8. A numeral, then a word ending in the plural suffix -lar/-ler.
 *
 * `\p{L}` rather than `\w`: "3 modüller" has to be caught too, and `\w` stops at
 * `ü`. The suffix must *end* the word, so words such as "kontrol" never reach the
 * check at all, and the short list below holds the nouns that genuinely end in
 * -lar/-ler without being plural.
 */
const NON_PLURAL_TAIL_WORDS: ReadonlySet<string> = new Set(["dolar", "kiler", "popüler"]);

/** A numeral followed by a noun: the shape §8 regulates. */
const NUMBER_THEN_WORD = /(\d+)\s+(\p{L}+)/gu;

/** A count placeholder followed by a noun — "{n} elemanlar" is the same mistake. */
const PLACEHOLDER_THEN_WORD = /(\{\s*[\p{L}\d_.]+\s*\})\s+(\p{L}+)/gu;

/** The countable noun that follows the number, human readable, when §8 is broken. */
function pluralEndings(value: string): string[] {
  const findings: string[] = [];
  const collect = (count: string | undefined, word: string | undefined): void => {
    if (word === undefined) return;
    const lower = word.toLocaleLowerCase("tr");
    if (!/(?:lar|ler)$/u.test(lower)) return;
    if (NON_PLURAL_TAIL_WORDS.has(lower)) return;
    findings.push(`${count ?? "?"} ${word}`);
  };
  for (const match of value.matchAll(NUMBER_THEN_WORD)) collect(match[1], match[2]);
  for (const match of value.matchAll(PLACEHOLDER_THEN_WORD)) collect(match[1], match[2]);
  return findings;
}

/** §2.3, §2.4 and §9/Ç3: a key says "space"/"sheet", the value uses the other word. */
const SPACE_KEY = /space/i;
const SHEET_KEY = /sheet/i;

/**
 * "Workspace" is a different English word and its Turkish is "çalışma alanı", so
 * the space rule leaves it alone; likewise "spreadsheet" is an electronic table,
 * not a drawing sheet. A guard that fires on a correct translation teaches people
 * to ignore it.
 */
const WORKSPACE_KEY = /workspace/i;
const SPREADSHEET_KEY = /spreadsheet/i;

/** Left-anchored only, so "alan" matches "alanı" but not the "alan" inside "balansman". */
const AREA_WORD = /(?<!\p{L})alan/iu;
const TABLE_WORD = /(?<!\p{L})tablo/iu;

/** The §2.3 violations in a corpus: a space key whose value says "alan". */
function spaceDefects(entries: readonly LocaleEntry[]): string[] {
  return entries
    .filter((entry) => SPACE_KEY.test(entry.key) && !WORKSPACE_KEY.test(entry.key))
    .filter((entry) => AREA_WORD.test(entry.value))
    .map((entry) => `${entry.file} → ${entry.key}: ${JSON.stringify(entry.value)} says "alan"; §2.3 space is "mekan"`);
}

/** The §2.4 violations in a corpus: a sheet key whose value says "tablo". */
function sheetDefects(entries: readonly LocaleEntry[]): string[] {
  return entries
    .filter((entry) => SHEET_KEY.test(entry.key) && !SPREADSHEET_KEY.test(entry.key))
    .filter((entry) => TABLE_WORD.test(entry.value))
    .map((entry) => `${entry.file} → ${entry.key}: ${JSON.stringify(entry.value)} says "tablo"; §2.4 sheet is "pafta"`);
}

/** The §8 violations in a corpus: a count followed by a plural suffix. */
function pluralDefects(entries: readonly LocaleEntry[]): string[] {
  return entries.flatMap((entry) =>
    pluralEndings(entry.value).map(
      (ending) => `${entry.file} → ${entry.key}: ${JSON.stringify(entry.value)} carries the plural "${ending}"; §8`,
    ),
  );
}

test("tr never renders a plural suffix after a number (§8)", () => {
  expect(pluralDefects(ENTRIES)).toEqual([]);
});

test("space is translated as mekan, never alan (§2.3)", () => {
  expect(spaceDefects(ENTRIES)).toEqual([]);
});

test("sheet is translated as pafta, never tablo (§2.4, §9/Ç3)", () => {
  expect(sheetDefects(ENTRIES)).toEqual([]);
});

test("the guards catch the wording the glossary forbids, and only that", () => {
  const at = (key: string, value: string): LocaleEntry => ({ file: "locales/tr/test.json", key, value });
  const corpus = (): readonly LocaleEntry[] => [at("placeholder", "x")];

  // §8: rejected shapes.
  expect(pluralEndings("3 elemanlar")).toEqual(["3 elemanlar"]);
  expect(pluralEndings("2 seçililer")).toEqual(["2 seçililer"]);
  expect(pluralEndings("3 modüller")).toEqual(["3 modüller"]);
  expect(pluralEndings("{n} elemanlar")).toEqual(["{n} elemanlar"]);
  expect(pluralDefects([at("selection.count", "3 elemanlar")])).toHaveLength(1);

  // §8: the correct Turkish the guard must leave alone.
  expect(pluralEndings("3 eleman")).toEqual([]);
  expect(pluralEndings("{n} eleman")).toEqual([]);
  expect(pluralEndings("3 kontrol")).toEqual([]);
  expect(pluralEndings("3 dolar")).toEqual([]);
  expect(pluralEndings("Tüm katlar")).toEqual([]); // plural with no numeral is correct
  expect(pluralEndings("{m} içinden {n}")).toEqual([]);
  expect(pluralDefects(corpus())).toEqual([]);

  // §2.3: space → mekan, never alan.
  expect(spaceDefects([at("panel.spaceLabel", "Alan etiketi")])).toHaveLength(1);
  expect(spaceDefects([at("panel.space", "Mekan")])).toEqual([]);
  expect(spaceDefects([at("panel.workspace", "Çalışma alanı")])).toEqual([]); // different English word
  expect(spaceDefects([at("panel.area", "Alan")])).toEqual([]); // "area" really is alan
  expect(spaceDefects([at("panel.spaceBalancing", "Balansman")])).toEqual([]); // "alan" mid-word

  // §2.4: sheet → pafta, never tablo.
  expect(sheetDefects([at("view.sheetName", "Tablo adı")])).toHaveLength(1);
  expect(sheetDefects([at("view.sheetName", "Pafta adı")])).toEqual([]);
  expect(sheetDefects([at("export.spreadsheet", "Elektronik tablo")])).toEqual([]); // an actual table
  expect(sheetDefects([at("schedule.table", "Tablo")])).toEqual([]); // "schedule" is not "sheet"
});
