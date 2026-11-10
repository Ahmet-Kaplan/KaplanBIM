/**
 * Locale parity guard: every Turkish locale file under `packages/<pkg>/locales/tr`
 * and `apps/<app>/locales/tr` must be in a state the UI can actually show.
 *
 * English is the source of truth and lives in the code (the i18next
 * `defaultValue`); this guard is what protects the Turkish side from the three
 * ways a later translation task goes wrong without anyone noticing:
 *
 *   1. a file that does not parse, so the whole namespace silently falls back to
 *      English,
 *   2. a key left as its own value (`"label": "label"`), which renders a key name
 *      in the interface,
 *   3. a value carrying an artifact of the tooling that wrote it (`undefined`,
 *      `null`, an unbalanced placeholder brace).
 *
 * It runs on every translation task, so it must fail on a real defect and must
 * not pass because it found nothing to check: the first test pins the corpus,
 * and the last one proves each check fires.
 */
import { flattenLocales, readTrLocaleFiles, type LocaleEntry } from "./locale-files";

const FILES = readTrLocaleFiles();
const CORPUS = flattenLocales(FILES);

/** A value that reads as tooling output rather than Turkish text. */
const ARTIFACT_LITERALS: readonly (readonly [RegExp, string])[] = [
  [/\bundefined\b/i, "the literal `undefined`"],
  [/\bnull\b/i, "the literal `null`"],
  [/\bNaN\b/, "the literal `NaN`"],
  [/\[object /, "an object stringified instead of translated"],
];

/**
 * Placeholders are fine (`"{n} eleman"`); a brace that does not pair with its
 * partner is a value that was cut or pasted mid-way, and i18next would render it
 * literally.
 */
function placeholderArtifact(value: string): string | undefined {
  if (value.includes("{}")) return "an empty placeholder";
  const opens = (value.match(/\{/g) ?? []).length;
  const closes = (value.match(/\}/g) ?? []).length;
  return opens === closes ? undefined : `unbalanced placeholder braces (${opens} \`{\`, ${closes} \`}\`)`;
}

/** Everything wrong with one translated string, as a message for the failure list. */
function valueDefects(entry: LocaleEntry): string[] {
  const defects: string[] = [];
  if (entry.value.trim() === "") {
    defects.push(`${entry.file} → ${entry.key}: the value is empty, so the UI shows nothing`);
  }
  for (const [pattern, description] of ARTIFACT_LITERALS) {
    if (pattern.test(entry.value)) {
      defects.push(`${entry.file} → ${entry.key}: ${JSON.stringify(entry.value)} contains ${description}`);
    }
  }
  const placeholder = placeholderArtifact(entry.value);
  if (placeholder !== undefined) {
    defects.push(`${entry.file} → ${entry.key}: ${JSON.stringify(entry.value)} has ${placeholder}`);
  }
  return defects;
}

/**
 * Exact match only. `"english": "English"` is deliberate — a language names
 * itself in its own language — while `"label": "label"` is an accident that ships
 * a key name to the screen.
 *
 * Case-insensitive equality was considered and rejected: this app is full of
 * acronyms and proper nouns whose Turkish is the English itself (`"pdf": "PDF"`,
 * `"ifc": "IFC"`, `"mep": "MEP"` — glossary §0.3), and flagging those would make
 * the guard cry wolf on correct strings. The narrow cost is that a value that is
 * only its key capitalised (`"label": "Label"`) is left to review.
 */
function keyAsValueDefects(entry: LocaleEntry): string[] {
  const leaf = entry.key.split(".").pop() ?? entry.key;
  const value = entry.value.trim();
  const offenders = [leaf, entry.key].filter((candidate) => value === candidate);
  return offenders.length === 0 ? [] : [`${entry.file} → ${entry.key}: the value is the key itself`];
}

test("the guard found the Turkish locale files it is meant to guard", () => {
  const ids = FILES.map((file) => file.id);

  // Without this, a broken walk (a renamed directory, a wrong `__dirname`) would
  // match nothing and every other assertion in this file would pass on an empty
  // corpus. `common.json` is the one Turkish file this kit always ships.
  expect(ids).toContain("packages/bim-ui/locales/tr/common.json");
  expect(ids.length).toBeGreaterThanOrEqual(1);

  // Same reasoning one level down: a file that parses to `{}` has no keys, so the
  // value guards would pass while the namespace renders English everywhere.
  const keyCounts = flattenLocales(FILES).entries.map((entry) => entry.file);
  for (const id of ids) {
    expect({ file: id, hasKeys: keyCounts.includes(id) }).toEqual({ file: id, hasKeys: true });
  }
});

test("every tr locale file is valid JSON", () => {
  const broken = FILES.filter((file) => file.parseError !== undefined).map(
    (file) => `${file.id}: ${file.parseError ?? "unknown parse error"}`,
  );
  expect(broken).toEqual([]);
});

test("every tr locale file is fully translated", () => {
  const defects = [
    ...CORPUS.nonStrings.map(
      (leaf) => `${leaf.file} → ${leaf.key}: a ${leaf.shape} where a translated string belongs`,
    ),
    ...CORPUS.entries.flatMap(valueDefects),
  ];
  expect(defects).toEqual([]);
});

test("no tr value equals its own key", () => {
  expect(CORPUS.entries.flatMap(keyAsValueDefects)).toEqual([]);
});

test("the guards catch the failures they exist for", () => {
  // A guard that never fires is worse than no guard: it reads green while a later
  // task ships "undefined" or a key name to the screen. These are the shapes it
  // must reject, and the Turkish text it must leave alone.
  const at = (key: string, value: string): LocaleEntry => ({ file: "locales/tr/test.json", key, value });
  const flagged = (entry: LocaleEntry): boolean => valueDefects(entry).length > 0;

  expect(flagged(at("a.undefinedArtifact", "undefined"))).toBe(true);
  expect(flagged(at("a.nullArtifact", "null"))).toBe(true);
  expect(flagged(at("a.nanArtifact", "NaN"))).toBe(true);
  expect(flagged(at("b.empty", ""))).toBe(true);
  expect(flagged(at("c.brace", "3 eleman {"))).toBe(true);
  expect(flagged(at("d.brace", "{n eleman"))).toBe(true);
  expect(flagged(at("e.emptyPlaceholder", "{}"))).toBe(true);

  expect(flagged(at("f.good", "Dil"))).toBe(false);
  expect(flagged(at("g.good", "{n} eleman"))).toBe(false);
  expect(flagged(at("h.good", "{m} içinden {n}"))).toBe(false);
  expect(flagged(at("i.good", "Salt okunur"))).toBe(false);

  expect(keyAsValueDefects(at("language.label", "label"))).toEqual([
    "locales/tr/test.json → language.label: the value is the key itself",
  ]);
  expect(keyAsValueDefects(at("language.label", "language.label"))).toHaveLength(1);
  expect(keyAsValueDefects(at("language.english", "English"))).toEqual([]);
  expect(keyAsValueDefects(at("format.pdf", "PDF"))).toEqual([]);
  expect(keyAsValueDefects(at("format.ifc", "IFC"))).toEqual([]);
  expect(keyAsValueDefects(at("language.label", "Dil"))).toEqual([]);
});
