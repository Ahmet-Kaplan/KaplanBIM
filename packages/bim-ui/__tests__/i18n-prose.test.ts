/**
 * Kernel and pack prose: an English sentence is normalised to a template with
 * `{0}`, `{1}` … slots, the template is looked up in `locales/tr/prose.json`, and
 * the slots are filled back in order. A template nobody translated comes out as
 * the English it went in as — never as a template name.
 *
 * Why a template map and not translated strings at the source: `CommandError`
 * carries a free-form English `message` (`packages/bim-kernel/src/command-core.ts`)
 * and `docs/ARCHITECTURE.md` requires those sentences to carry their numbers
 * ("Leg 3 is 0.51 ft long, but the elbow and transition there need 1.27 ft").
 * The kernel is the engine and may not import i18n, so the translation happens
 * where the sentence is shown.
 *
 * Two brace vocabularies live side by side, and this file keeps them apart:
 *
 *   `{{name}}`  i18next interpolation — filled by i18next from `t(key, english, values)`.
 *   `{0}`       this map's own slots — filled by `translateProse` from the numbers
 *               the normaliser took out of the English sentence.
 *
 * So a `prose.json` value legitimately contains `{0}`, and
 * `i18n-parity.test.ts` exempts exactly that namespace for exactly this reason;
 * a `{{name}}` in a prose value would never be filled (nothing calls i18next for
 * it) and is asserted absent here.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeProse, translateProse, type ProseLookup } from "../src/i18n/prose";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const CATALOG = path.join(REPO_ROOT, "docs/i18n/prose-templates.json");
const TR_PROSE = path.join(REPO_ROOT, "packages/bim-ui/locales/tr/prose.json");

interface CatalogEntry {
  readonly template: string;
  readonly count: number;
  readonly sources: readonly string[];
  readonly codes: readonly string[];
  readonly kinds: readonly string[];
  /** True when a `{n}` slot can key the sentence at runtime (see `tools/i18n/extract-prose.mjs`). */
  readonly matchable: boolean;
}

interface Catalog {
  readonly generatedBy: string;
  readonly templates: readonly CatalogEntry[];
}

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8")) as Catalog;
const trProse: Record<string, string> = JSON.parse(fs.readFileSync(TR_PROSE, "utf8")) as Record<string, string>;

/** A translator that knows one map; a template it does not know comes back undefined, as i18next's does. */
const fakeT = (map: Record<string, string>): ProseLookup => (template) => map[template];

const LEG = "Leg 3 is 0.51 ft long, but the elbow and transition there need 1.27 ft";
const LEG_KEY = "Leg {0} is {1} long, but the elbow and transition there need {2}";
const LEG_TR = "{0}. bacak {1} uzunluğunda, ama oradaki dirsek ve geçiş {2} gerektiriyor";

// ---------------------------------------------------------------------------
// The normaliser
// ---------------------------------------------------------------------------

test("normalizeProse replaces numbers and units with ordered slots", () => {
  const { template, slots } = normalizeProse(LEG);
  expect(template).toBe(LEG_KEY);
  expect(slots).toEqual(["3", "0.51 ft", "1.27 ft"]);
});

test("a unit wins over the bare number inside it, longest unit first", () => {
  // `ft` before `ft²` would leave the `²` outside the slot and no single template
  // could ever match the sentence at runtime.
  expect(normalizeProse("12 ft² of duct").slots).toEqual(["12 ft²"]);
  expect(normalizeProse("3 ft/100 ft").slots).toEqual(["3 ft", "100 ft"]);
  expect(normalizeProse("1500 m³/h").slots).toEqual(["1500 m³/h"]);
});

test("`in` is inches only where it is not a preposition", () => {
  // `in` is both a unit and the commonest English preposition. Read as a unit, it
  // swallowed the preposition and left a template that no longer says what happened:
  // `12 in the model` became `{0} the model`, and four kernel sentences were
  // catalogued that way (`There is no fitting type {0} the library`, `No system {0}
  // this model.`, `… keep it to {2} your own words`, `{0} is {1} the export, but …`).
  // The catalogue test in `tools/i18n` fails if one comes back.
  expect(normalizeProse("12 in the model")).toEqual({ template: "{0} in the model", slots: ["12"] });
  expect(normalizeProse("3 in the run")).toEqual({ template: "{0} in the run", slots: ["3"] });
  expect(normalizeProse("keep it to 40 in your own words")).toEqual({ template: "keep it to {0} in your own words", slots: ["40"] });
  // And the measurements, which must still absorb the unit with it.
  expect(normalizeProse("0.5 in. w.c.")).toEqual({ template: "{0} w.c.", slots: ["0.5 in."] });
  expect(normalizeProse("1,5 in per joint")).toEqual({ template: "{0} per joint", slots: ["1,5 in"] });
  expect(normalizeProse("12 in wide")).toEqual({ template: "{0} wide", slots: ["12 in"] });
});

test("a negative measurement keeps its sign and its unit", () => {
  expect(normalizeProse("-3 ft of pipe")).toEqual({ template: "{0} of pipe", slots: ["-3 ft"] });
  expect(normalizeProse("an offset of -0.25 in.")).toEqual({ template: "an offset of {0}", slots: ["-0.25 in."] });
});

test("a unit is not read out of a word", () => {
  // `m` is a unit, `m`+`iles` is a word: slicing `3 miles` into `3 m` would build a
  // template nothing can match and show `{0}iles of pipe` in the review bundle. The
  // number is still a slot — every number is — but the word is left whole.
  expect(normalizeProse("3 miles of pipe")).toEqual({ template: "{0} miles of pipe", slots: ["3"] });
});

test("dates and times become one slot, before the numbers inside them", () => {
  expect(normalizeProse("Saved 2026-11-10 at 14:35 by Ada")).toEqual({
    template: "Saved {0} at {1} by Ada",
    slots: ["2026-11-10", "14:35"],
  });
});

test("normalising a template changes nothing, so a lookup can be repeated", () => {
  // `{0}` holds a digit: without the guard, a second pass would rewrite it to `{{1}}`.
  expect(normalizeProse(LEG_KEY)).toEqual({ template: LEG_KEY, slots: [] });
});

test("a sentence with no number is its own template", () => {
  expect(normalizeProse("Something nobody translated")).toEqual({ template: "Something nobody translated", slots: [] });
});

// ---------------------------------------------------------------------------
// The lookup
// ---------------------------------------------------------------------------

test("translateProse fills slots in order", () => {
  const tr = { [LEG_KEY]: LEG_TR };
  expect(translateProse(LEG, "tr", fakeT(tr))).toBe("3. bacak 0.51 ft uzunluğunda, ama oradaki dirsek ve geçiş 1.27 ft gerektiriyor");
});

test("slot text keeps the separators the sentence came with (spec Ç-C(b), decided)", () => {
  // The kernel formats a number with `String(n)`; the packs use `toLocaleString("en-US")`.
  // So a slot arrives English-formatted — `1,500 VA`, `0.51 ft` — and the Turkish
  // sentence keeps it. Reformatting here would mean parsing a slot that is sometimes an
  // id, a revision or a date, at a layer with no unit or precision information; §7's
  // display profile owns that decision (task 3.4 report, §4, "what remains English").
  // Pinned, so the behaviour is a decision rather than drift.
  const tr = { "That is {0} long and carries {1}": "Bu {0} uzunluğunda ve {1} taşıyor" };
  expect(translateProse("That is 0.51 ft long and carries 1,500 VA", "tr", fakeT(tr))).toBe(
    "Bu 0.51 ft uzunluğunda ve 1,500 VA taşıyor",
  );
});

test("an unknown sentence is returned unchanged, never as a template key", () => {
  const english = "Something nobody translated";
  expect(translateProse(english, "tr", fakeT({}))).toBe(english);
});

test("English input is returned verbatim for language en", () => {
  expect(translateProse("Anything at all", "en", fakeT({ [LEG_KEY]: LEG_TR }))).toBe("Anything at all");
});

test("a translation the lookup returns as its own key counts as missing", () => {
  // i18next answers a missing key with the key; that is not a translation and
  // showing it would put the template on screen.
  expect(translateProse(LEG, "tr", (template) => template)).toBe(LEG);
});

test("a translation that would leave a slot unfilled falls back to the English sentence", () => {
  // A `{2}` with no third slot can only be a mistake in the map; the screen gets
  // the English instead of a raw brace.
  expect(translateProse("Only 4 here", "tr", fakeT({ "Only {0} here": "Yalnızca {1} burada" }))).toBe("Only 4 here");
});

// ---------------------------------------------------------------------------
// The shipped map
// ---------------------------------------------------------------------------

test("the extractor produced a catalogue big enough to be worth translating", () => {
  expect(catalog.templates.length).toBeGreaterThan(500);
  expect(catalog.generatedBy).toBe("tools/i18n/extract-prose.mjs");
});

test("every template the mechanism can match is translated, and the tail is counted", () => {
  // Two denominators, both measured here and both written into the report:
  //
  //  - `matchable`: the sentences a `{n}` slot can key at all — literal English, or
  //    English whose interpolations carry nothing but a number. This is the whole
  //    population the mechanism can ever translate, so the target is 100% of it.
  //  - `catalogue`: every literal the extractor found. The difference between the
  //    two is the tail that stays English: a sentence built from a *name*
  //    (`2 elements are in "Level 1"`) carries words that came from an
  //    interpolation, so the runtime text and the source template differ by whole
  //    words and no slot can stand in for them. A bigger map cannot close it; a
  //    kernel error code can.
  const matchable = catalog.templates.filter((entry) => entry.matchable);
  const refused = catalog.templates.filter((entry) => entry.codes.length > 0);
  const translated = (entries: readonly CatalogEntry[]): number => entries.filter((entry) => trProse[entry.template] !== undefined).length;
  const share = (part: number, whole: number): string => `${part}/${whole} (${whole === 0 ? "0.0" : ((part / whole) * 100).toFixed(1)}%)`;

  // The reach reading, printed with the rest: the target is met on what the mechanism
  // can key and *not* met on what a person meets most (the top 10 and top 50 by
  // frequency are all name-carrying, so no template can key them).
  const top = (count: number): number => translated(catalog.templates.slice(0, count));
  const report =
    `matchable ${share(translated(matchable), matchable.length)}, ` +
    `reach top10 ${top(10)}/10, top50 ${top(50)}/50, ` +
    `coded ${share(translated(refused), refused.length)}, ` +
    `catalogue ${share(translated(catalog.templates), catalog.templates.length)}`;

  // Pinned, not floored. A `>= 80%` floor let a regression from 241 to 193 pass, which
  // is 48 sentences losing their Turkish without a red test.
  expect({ report, matchable: translated(matchable), templates: translated(catalog.templates) }).toEqual({
    report,
    matchable: 241,
    templates: 241,
  });
  expect(matchable).toHaveLength(241);
});

test("no prose value carries an i18next placeholder or a slot its key does not have", () => {
  const defects: string[] = [];
  for (const [template, turkish] of Object.entries(trProse)) {
    if (turkish.includes("{{")) defects.push(`${JSON.stringify(template)}: the value has a {{placeholder}} nothing would fill`);
    const keySlots = new Set([...template.matchAll(/\{(\d+)\}/gu)].map((match) => match[1]));
    for (const match of turkish.matchAll(/\{+(\d+)\}+/gu)) {
      if (!keySlots.has(match[1])) defects.push(`${JSON.stringify(template)}: the value has {${match[1]}}, which the key does not`);
    }
    // Every slot of the sentence has to survive into the Turkish: dropping one
    // loses a number the person needs (a length, a count, a revision).
    for (const slot of keySlots) {
      if (!new RegExp(String.raw`\{${slot}\}`, "u").test(turkish)) defects.push(`${JSON.stringify(template)}: the value drops {${slot}}`);
    }
  }
  expect(defects).toEqual([]);
});

test("the six codes the session shows verbatim have Turkish sentences of their own", () => {
  // `model-session.ts` passes these six codes' kernel sentence straight to the
  // screen, so their sentences are the ones a Turkish reader used to meet in
  // English. A realistic sentence per code must come out of the map.
  const sentences: Record<string, string> = {
    has_dependents: '"Level 1" holds everything not in another group, so it can\'t be deleted. Rename it instead.',
    undo_refused: "Revision 12 is not in the recent history, so it can't be undone here",
    conflict: "Level 1 changed since your edit; undoing would overwrite that work.",
    already_exists: "That end is already connected",
    in_use: "A model needs at least one phase.",
    locked: "This element is locked so it can't slide while you trace. Unlock it first",
  };
  const untranslated = Object.entries(sentences)
    .filter(([, english]) => translateProse(english, "tr", (template) => trProse[template]) === english)
    .map(([code]) => code);
  // Not all six can be keyed by a template — a name in the middle of the sentence is
  // beyond any slot (the report says so, with the count). `refusalWords` in the
  // editor is what guarantees a Turkish sentence either way; this asserts the map
  // does its part wherever it can, and stays quiet where it cannot.
  expect(untranslated.length).toBeLessThanOrEqual(3);
  expect(translateProse(sentences.already_exists as string, "tr", (template) => trProse[template])).toBe("Bu uç zaten bağlı");
});

test("no raw slot or placeholder reaches the screen for a translated sentence", () => {
  const samples = [
    LEG,
    "Revision 12 is not in the recent history, so it can't be undone here",
    "Level 3 is already used by another element",
    "Your change wasn't saved. 2 elements are in \"Level 1\". Choose a group to move them to, then delete.",
  ];
  for (const english of samples) {
    const shown = translateProse(english, "tr", (template) => trProse[template]);
    if (shown === english) continue; // untranslated: the English it came in as, braces and all — none here.
    expect({ english, shown, leaked: /\{\{|\}\}|\{\d+\}/u.test(shown) }).toEqual({ english, shown, leaked: false });
  }
});

test("no translated template is orphaned from the catalogue", () => {
  // A key the extractor never emits is a translation nothing can reach: either the
  // sentence is gone or the extractor has to learn its shape. Both need a person.
  const known = new Set(catalog.templates.map((entry) => entry.template));
  expect(Object.keys(trProse).filter((template) => !known.has(template))).toEqual([]);
});
