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

const FILES = readTrLocaleFiles();
const ENTRIES = flattenLocales(FILES).entries;

test("the guard found the Turkish strings it is meant to guard", () => {
  // Without this, a broken walk would leave every rule below scanning an empty
  // corpus and reporting green — the exact failure mode the rules exist to prevent.
  expect(FILES.map((file) => file.id)).toContain("packages/bim-ui/locales/tr/common.json");
  expect(ENTRIES.length).toBeGreaterThan(0);
});

/**
 * §8. A count — a numeral or a count placeholder — then a noun-shaped word ending
 * in the plural suffix -lar/-ler.
 *
 * `\p{L}` rather than `\w`: "3 modüller" has to be caught too, and `\w` stops at
 * `ü`. The suffix must *end* the word, so words such as "kontrol" never reach the
 * check at all, and the short list below holds the nouns that genuinely end in
 * -lar/-ler without being plural.
 *
 * Known, accepted limit: the check reads word *shape*, not part of speech, so a
 * verb form that happens to end in -lar/-ler ("3 yuvarlar") fires. Do not "fix"
 * that with a Turkish morphological analyser; a false alarm is cheaper than the
 * untranslated plural this guard exists for.
 */
const NON_PLURAL_TAIL_WORDS: ReadonlySet<string> = new Set(["dolar", "kiler", "popüler"]);

/** Words that end the noun phrase a count governs, so the scan stops there. */
const PHRASE_BREAK_WORDS: ReadonlySet<string> = new Set(["ve", "ile", "veya", "tüm", "bütün", "hep"]);

/**
 * Punctuation ends the clause: in "3 kat, 5 oda" the plural of one count must not
 * be read into the other. Braces are not punctuation here — `{n}` is the count.
 */
const CLAUSE_BREAK = /[.,;:!?()"“”'‘’/\\|\n\r\t]+/u;

/** A word that *is* a count: "3", "{n}", "$3", "₺3". */
const COUNT_WORD = /^[$₺€£]?(?:\d+|\{[\p{L}\d_.]*\})$/u;

/** `{ n }` is the same placeholder as `{n}`, and the tokenizer splits on spaces. */
function normalisePlaceholders(value: string): string {
  return value.replace(/\{\s*([\p{L}\d_.]+)\s*\}/gu, "{$1}");
}

/** The word without the quotes or punctuation glued to it. */
function bareWord(word: string): string {
  return word.replace(/^[^\p{L}]+/u, "").replace(/[^\p{L}]+$/u, "");
}

/**
 * The countable words §8 forbids, e.g. `["3 elemanlar"]` for "3 seçili elemanlar".
 *
 * Every word after a count is checked, not just the one beside it: the drift §8
 * names is the pair "{n} selected" / "{n} elements" collapsing into
 * "{n} seçili elemanlar", where an adjective sits between the count and the plural.
 *
 * A connective ends the phrase a count governs ("3 kat ve tüm pencereler"), but not
 * the clause: a later count starts a new phrase ("{n} eleman ve {m} katlar"), and
 * that second one still has to be checked.
 */
function pluralEndings(value: string): string[] {
  const findings: string[] = [];
  for (const clause of normalisePlaceholders(value).split(CLAUSE_BREAK)) {
    let count: string | undefined;
    for (const word of clause.split(/\s+/u).filter((word) => word !== "")) {
      if (COUNT_WORD.test(word)) {
        count = word;
        continue;
      }
      if (count === undefined) continue;
      const bare = bareWord(word);
      const lower = bare.toLocaleLowerCase("tr");
      if (PHRASE_BREAK_WORDS.has(lower)) {
        count = undefined;
        continue;
      }
      if (!/(?:lar|ler)$/u.test(lower)) continue;
      if (NON_PLURAL_TAIL_WORDS.has(lower)) continue;
      findings.push(`${count} ${bare}`);
    }
  }
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

  // §8: an adjective between the count and the plural. This is the drift the
  // glossary's own rows allow — "{n} selected" + "{n} elements" becoming
  // "{n} seçili elemanlar" — so looking at the word beside the count is not enough.
  expect(pluralEndings("3 seçili elemanlar")).toEqual(["3 elemanlar"]);
  expect(pluralEndings("{n} seçili elemanlar")).toEqual(["{n} elemanlar"]);
  expect(pluralDefects([at("selection.summary", "{n} seçili elemanlar")])).toHaveLength(1);

  // §8: a second count after a connective is its own phrase, and is still checked.
  // Before this case existed the scan stopped at "ve" and reported green.
  expect(pluralEndings("{n} eleman ve {m} katlar")).toEqual(["{m} katlar"]);
  expect(pluralEndings("{n} eleman ve 3 katlar")).toEqual(["3 katlar"]);
  expect(pluralEndings("{n} eleman ve {m} kat")).toEqual([]);

  // §8: count shapes that are not a bare numeral.
  expect(pluralEndings("{ n } elemanlar")).toEqual(["{n} elemanlar"]);
  expect(pluralEndings("$3 elemanlar")).toEqual(["$3 elemanlar"]);
  expect(pluralEndings("₺3 katlar")).toEqual(["₺3 katlar"]);

  // §8: the correct Turkish the guard must leave alone.
  expect(pluralEndings("3 eleman")).toEqual([]);
  expect(pluralEndings("3 seçili eleman")).toEqual([]);
  expect(pluralEndings("{n} eleman")).toEqual([]);
  expect(pluralEndings("{n} seçili eleman")).toEqual([]);
  expect(pluralEndings("3 kontrol")).toEqual([]);
  expect(pluralEndings("3 dolar")).toEqual([]);
  expect(pluralEndings("Henüz yok")).toEqual([]); // §8 row, no count at all
  expect(pluralEndings("Tüm katlar")).toEqual([]); // plural with no numeral is correct
  expect(pluralEndings("{m} içinden {n}")).toEqual([]);
  expect(pluralEndings("3 kat, 5 oda")).toEqual([]); // the comma ends the clause
  expect(pluralEndings("3 kat ve tüm pencereler")).toEqual([]); // a connective ends the phrase
  expect(pluralEndings("$3 eleman")).toEqual([]);
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
