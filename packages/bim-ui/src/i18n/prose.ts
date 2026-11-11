/**
 * The kernel's and the packs' own English sentences, in Turkish.
 *
 * `CommandError` carries a free-form English `message`
 * (`packages/bim-kernel/src/command-core.ts`) and `docs/ARCHITECTURE.md` requires
 * those sentences to spell their numbers out ("Leg 3 is 0.51 ft long, but the
 * elbow and transition there need 1.27 ft"). The kernel is the engine: it may not
 * import i18n, and rewriting its ~700 refusal sentences into codes is a change to
 * the model format, not a translation. So the sentence is translated here, where
 * it is shown:
 *
 *   1. `normalizeProse` takes the numbers out of the English and replaces them
 *      with slots, in the order they appear: `Leg {0} is {1} long, … {2}`.
 *   2. `translateProse` looks that template up in `locales/tr/prose.json` and
 *      puts the numbers back, in the same order.
 *   3. A template nobody translated comes out as the English it went in as.
 *      Never a template, never a key: a person reading a refusal gets a sentence.
 *
 * **Two brace vocabularies, deliberately apart.**
 *
 * - `{{name}}` is i18next interpolation: filled by i18next from
 *   `t('key', 'English', { name })` for the strings this kit's namespaces carry.
 * - `{0}` is *this* map's slot: filled by `translateProse` below from the text
 *   `normalizeProse` took out of the English sentence. i18next never sees these
 *   keys (they are read from a plain JSON map, not from a namespace), and i18next's
 *   `{{ }}` delimiters mean `{0}` would be left alone even if it did.
 *
 * So `locales/tr/prose.json` is the one Turkish file whose values legitimately
 * contain `{0}`, and `__tests__/i18n-parity.test.ts` exempts exactly that
 * namespace, for exactly that reason. A `{{name}}` in a prose value would never be
 * filled by anyone, so the guards forbid one.
 */
// Read as data, not as an i18next namespace: a template never goes through `t()` by
// key, so i18next's interpolation, key separators (a template may contain a full stop)
// and namespace loading are all out of the picture.
//
// **Cost, before the map grows:** this import puts the whole map in every bundle that
// imports the kit, `en` included — 37 KB of JSON today (~28 KB gzipped with the rest
// of the kit). A map several times this size should become a dynamic `import()` behind
// the first untranslated sentence, or a per-language asset; today the size is smaller
// than the logic that would defer it.
import trProseMap from "../../locales/tr/prose.json";
import type { MutinyLanguage } from "./index";

/**
 * A template lookup: the normalised English key in, its Turkish out, or
 * `undefined` when this map has not translated it.
 *
 * i18next's `TFunction` and the editor's `Translate` both satisfy this, so a host
 * that keeps its own prose map can pass its own. Answering with the template
 * itself — which is what i18next does for a key it does not know — counts as "not
 * translated"; see `translateProse`.
 */
export type ProseLookup = (template: string) => string | undefined | null;

/** What `normalizeProse` found: the sentence with slots, and the text each slot held. */
export interface NormalizedProse {
  /** The English with its numbers replaced by `{0}`, `{1}` …, in document order. */
  readonly template: string;
  /** The text behind each slot, in the same order, ready to be put back. */
  readonly slots: readonly string[];
}

/**
 * Unit symbols, longest first so a short unit never swallows a long one: `ft²`
 * must win over `ft`, `m³/h` over `m³` over `m`.
 *
 * Glossary §7 keeps these symbols untranslated, so the same characters come back
 * in the Turkish sentence; only the number in front of them changes.
 */
const UNITS: readonly string[] = [
  "ft²",
  "ft³",
  "in²",
  "in³",
  "m²",
  "m³",
  "mm²",
  "mm³",
  "L/s",
  "m³/h",
  "CFM",
  "gpm",
  "fpm",
  "kVA",
  "kPa",
  "psi",
  "gal",
  "yd",
  "ft",
  "in.",
  "in",
  "km",
  "cm",
  "mm",
  "kg",
  "lb",
  "min",
  "kW",
  "VA",
  "Pa",
  "°C",
  "°F",
  "W",
  "A",
  "V",
  "m",
  "L",
  "s",
  "h",
  "°",
].sort((left, right) => right.length - left.length);

/**
 * The words that make `in` a preposition rather than inches: `12 in the model`
 * holds twelve of something *in* the model, not twelve inches.
 *
 * A closed list of determiners, not a general "followed by a word" rule, because
 * `1,5 in per joint` and `12 in wide` *are* inches and a general rule would refuse
 * them. The two directions are not equally bad: a wrongly absorbed `in` keeps the
 * word inside the slot (the sentence still reads back identically, and the template
 * is merely odd), while a wrongly rejected one drops a measurement into the prose.
 */
const DETERMINERS = "the|a|an|this|that|these|those|its|their|your|our|my|his|her";

/**
 * One unit as the regex spells it: the symbol, then the guards that keep it from
 * eating the sentence around it.
 *
 * Every unit carries `(?![\p{L}\d])` so it is not read out of a word (`3 miles` is
 * not `3 m` + `iles`). `in` carries a second one — `(?!\s+<determiner>)` — because it
 * is also an English preposition: without it `12 in the model` became the slot
 * `12 in` and the template `{0} the model`, which deleted the preposition from four
 * catalogue sentences — `There is no fitting type {0} the library`, `No system {0}
 * this model.`, `… keep it to {2} your own words`, `{0} is {1} the export, but …`.
 * `tools/i18n/__tests__/extract-prose.test.mjs` fails if one comes back.
 */
function unitPattern(unit: string): string {
  const symbol = unit.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  // `String.raw` is not decoration: in a plain template literal `\p{L}` loses its
  // backslash and becomes the character class `[p{L}d]`, and `\b` becomes a backspace.
  if (unit !== "in") return String.raw`${symbol}(?![\p{L}\d])`;
  return String.raw`${symbol}(?![\p{L}\d])(?!\s+(?:${DETERMINERS})\b)`;
}

/** Every unit as one regex alternation, longest symbol first. */
const UNIT_PATTERN = UNITS.map(unitPattern).join("|");

/**
 * A date, a date and time, or a time. Read before the numbers inside it, so
 * `2026-11-10` is one slot and not three, and `14:35` is not `14` and `35`.
 */
const DATE_OR_TIME =
  String.raw`\d{4}-\d{2}-\d{2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?` +
  String.raw`|\d{1,2}\/\d{1,2}\/\d{2,4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?` +
  String.raw`|\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp]\.?[Mm]\.?)?`;

/** A number with its unit: one slot, because the unit is half of what the number means. */
// The number part has to contain a digit: `[\d.,]+` alone would match the comma of
// "it is, so the point's" and swallow the comma and the leading `s` of `so` as
// "a distance in seconds". The leading `-?` takes a negative measurement (`-3 ft`)
// with its unit instead of leaving the unit behind in the sentence text, and each
// unit's trailing guards come from `unitPattern`.
const NUMBER_WITH_UNIT = String.raw`-?[\d.,]*\d[\d.,]*\s*(?:${UNIT_PATTERN})`;

/** A number on its own: a count, an id, a revision. */
const BARE_NUMBER = String.raw`-?\d+(?:[.,]\d+)?`;

/**
 * One pass, three shapes, in document order — which is the whole point. Replacing
 * "units first, then bare numbers" in separate passes would hand the slots out in
 * pass order, so `Leg 3 is 0.51 ft` would number the length `{0}` and the leg
 * `{1}`: a template no runtime sentence can ever match.
 *
 * `(?<!\{)…(?!\})` keeps an existing slot out of the next pass, so normalising a
 * template is a no-op and a lookup can be repeated safely. Each unit's guards — the
 * word guard, and `in`'s extra determiner guard — are spelled out in `unitPattern`.
 */
const TOKEN = new RegExp(String.raw`(?<!\{)(?:${DATE_OR_TIME}|${NUMBER_WITH_UNIT}|${BARE_NUMBER})(?!\})`, "gu");

/**
 * The English sentence as a template plus the numbers it carried.
 *
 * Pure and language-independent: the same function keys the map and reads it, so a
 * sentence can only miss because nobody translated it — never because the two
 * sides disagreed about where the numbers were.
 */
export function normalizeProse(english: string): NormalizedProse {
  const slots: string[] = [];
  const template = english.replace(TOKEN, (match: string) => `{${slots.push(match) - 1}}`);
  return { template, slots };
}

/**
 * The Turkish with its slots filled, or `undefined` when it wants a slot this
 * sentence does not have. A `{2}` with no third number can only be a mistake in the
 * map, and a raw brace on screen is worse than the English sentence.
 */
function fillSlots(translation: string, slots: readonly string[]): string | undefined {
  let missing = false;
  const filled = translation.replace(/\{(\d+)\}/gu, (whole: string, index: string) => {
    const value = slots[Number(index)];
    if (value === undefined) {
      missing = true;
      return whole;
    }
    return value;
  });
  return missing ? undefined : filled;
}

/**
 * One kernel or pack sentence, in the language being drawn.
 *
 * `en` is answered with the sentence it was given, without a lookup: English is
 * the source of truth and the map is Turkish.
 *
 * @param english the sentence as the kernel or a pack wrote it
 * @param language the language on screen
 * @param t the template map (the shipped one is `trProse`)
 */
export function translateProse(english: string, language: MutinyLanguage, t: ProseLookup): string {
  if (language !== "tr") return english;
  const { template, slots } = normalizeProse(english);
  const translation = t(template);
  // An empty answer and an answer that is its own key are both "not translated":
  // i18next hands back the key for a template it has never seen.
  if (translation === undefined || translation === null || translation === "" || translation === template) return english;
  return fillSlots(translation, slots) ?? english;
}

/**
 * The shipped template map: `template` → Turkish, exactly as
 * `tools/i18n/extract-prose.mjs` keys them.
 *
 * Exported so a test (or a review tool) can ask what is translated without going
 * through a translator, and so a host can compose its own lookup over it.
 */
export const proseTemplates: Readonly<Record<string, string>> = trProseMap as Record<string, string>;

/** `translateProse`'s lookup over the shipped map. */
export const trProse: ProseLookup = (template: string): string | undefined => proseTemplates[template];
