/**
 * The English half of the locale parity guard: every English default in the repo
 * must be written the way i18next and React read it.
 *
 * English is the source of truth — the `defaultValue` in the `t()` call — and it is
 * also what a person reads whenever a `tr` value is missing. Two defects shipped
 * through a `tr`-only guard, because neither is visible in Turkish:
 *
 *   1. **Single braces.** `'give the keynote {key}'` in `DrawingCanvas.tsx` and
 *      `keynotes.ts`. i18next interpolates `{{ }}` only (`docs/i18n/glossary.md` §8),
 *      so English users read `give the keynote {key}` in the undo label.
 *   2. **HTML entities.** Seven electrical captions wrote `&apos;` in a `t()` default —
 *      `'Check each row&apos;s load class'`. React decodes an entity in JSX text and
 *      never in a JS string, so moving a caption from `<FieldDescription>` into `t()`
 *      carried the entity to the screen.
 *
 * It lives here rather than in `packages/bim-ui/__tests__/i18n-parity.test.ts` — the
 * `tr` half — because the English is read by `review-bundle.mjs`'s scanner, and a
 * package may not import from `tools/` (`permitzip-mutinybim-oss/no-closed-or-copyleft-import`).
 * One scanner, no second opinion to drift: this checks exactly what
 * `npm run i18n:review` prints under English.
 *
 * A `.mjs` test, like `review-bundle.test.mjs` beside it, so it loads the plain-ESM
 * tool with no TypeScript in the way.
 */
import { readSourceFiles } from "../locale-files.mjs";
import { extractSource, unqualify } from "../review-bundle.mjs";

/**
 * Every English default **at every call site**, with the file that writes it.
 *
 * Not one per key: `collectSourceStrings` keeps the first call site it meets for a
 * key (files sorted), which is right for a review table — one row per key — and
 * wrong for a guard, because a second call site that rewrote the sentence into
 * `{key}` would be invisible behind the first. Two call sites write
 * `keynote.undo.giveKey`, and that is exactly how the single-brace version survived.
 */
export const ENGLISH_SITES = readSourceFiles().files.flatMap((file) =>
  extractSource(file.text)
    .calls.filter((call) => call.english !== undefined)
    .map((call) => ({ file: file.id, id: `${call.namespace}\u0000${call.key}`, english: call.english })),
);

/** A value that reads as tooling output rather than English text. */
const ARTIFACT_LITERALS = [
  [/\bundefined\b/i, "the literal `undefined`"],
  [/\bnull\b/i, "the literal `null`"],
  [/\bNaN\b/, "the literal `NaN`"],
  [/\[object /, "an object stringified instead of translated"],
];

/**
 * The `tr` side's brace rule, unchanged: everything except a well-formed `{{…}}`
 * pair renders literally. The defect is in the delimiters, not in the language.
 */
function singleBraceArtifact(value) {
  const withoutPlaceholders = value.replace(/\{\{[^{}]*\}\}/gu, "");
  if (!/[{}]/.test(withoutPlaceholders)) return undefined;
  return "a single-brace placeholder; i18next only interpolates `{{ }}` (docs/i18n/glossary.md §8), so it would render literally";
}

/** `{{}}` interpolates a nameless key: never intended, and it slips past the brace rule. */
function emptyPlaceholderArtifact(value) {
  return /\{\{\s*\}\}/u.test(value) ? "an empty placeholder" : undefined;
}

/**
 * An HTML entity in a string: `&apos;`, `&quot;`, `&#39;`, `&nbsp;` …
 *
 * Not a style question. React decodes an entity in JSX text and never in a JS
 * string, so the same sentence reads `row's` in JSX and `row&apos;s` in a `t()`
 * default — which is what happened to seven captions when they moved.
 */
function htmlEntityArtifact(value) {
  const match = /&(?:apos|quot|amp|lt|gt|nbsp|#\d+|#[xX][0-9a-fA-F]+);/u.exec(value);
  return match === null ? undefined : `the HTML entity ${match[0]}, which React decodes in JSX but not in a string`;
}

/**
 * The English defaults that show a brace to the person on purpose.
 *
 * Two schedule-surface helps print formula syntax — `PZ.GasDemandBtuh({own.mbh})`,
 * `{own.mbh} * 1000` — and the brace is the point of the sentence: nobody
 * interpolates it, so `{{ }}` would be wrong and would empty the example. No shape
 * rule can tell those from a placeholder, so each one is named here: adding an entry
 * is a decision, and the default is to flag.
 */
export const LITERAL_BRACE_ENGLISH = new Set(["schedules\u0000save.formulaHelp", "schedules\u0000builder.formulaHint"]);

/** Everything wrong with one English default, as a message for the failure list. */
export function englishDefaultDefects(id, value, file = "") {
  const { namespace, key } = unqualify(id);
  const where = `${file === "" ? "" : `${file} → `}${namespace} → ${key}`;
  const defects = [];
  if (value.trim() === "") defects.push(`${where}: the English default is empty, so the UI shows nothing`);
  for (const [pattern, description] of ARTIFACT_LITERALS) {
    if (pattern.test(value)) defects.push(`${where}: ${JSON.stringify(value)} contains ${description}`);
  }
  const entity = htmlEntityArtifact(value);
  if (entity !== undefined) defects.push(`${where}: ${JSON.stringify(value)} carries ${entity}`);
  if (LITERAL_BRACE_ENGLISH.has(id)) return defects;
  const placeholder = singleBraceArtifact(value) ?? emptyPlaceholderArtifact(value);
  if (placeholder !== undefined) defects.push(`${where}: ${JSON.stringify(value)} has ${placeholder}`);
  return defects;
}

test("the guard found the English defaults it is meant to guard", () => {
  // Without this, a scanner that read nothing would make every rule below vacuous,
  // and English would look clean because it was never looked at.
  expect(ENGLISH_SITES.length).toBeGreaterThan(3000);
  expect(ENGLISH_SITES.filter((site) => site.id === "editor\u0000ribbon.tab.views").map((site) => site.english)).toContain("Views");
  // The key with two call sites is the one that shipped the defect: both are read.
  expect(new Set(ENGLISH_SITES.filter((site) => site.id === "editor\u0000keynote.undo.giveKey").map((site) => site.file)).size).toBe(2);
});

test("every English default is written the way i18next and React read it", () => {
  const defects = ENGLISH_SITES.flatMap((site) => englishDefaultDefects(site.id, site.english, site.file));
  expect(defects).toEqual([]);
});

test("the guards catch the failures they exist for", () => {
  const flagged = (id, value) => englishDefaultDefects(id, value).length > 0;

  // The two shapes that shipped: the placeholder English users read, and the entity.
  expect(flagged("editor\u0000keynote.undo.giveKey", "give the keynote {key}")).toBe(true);
  expect(flagged("editor\u0000keynote.undo.giveKey", "give the keynote {{key}}")).toBe(false);
  expect(flagged("editor\u0000a.apos", "Check each row&apos;s load class")).toBe(true);
  expect(flagged("editor\u0000a.apos", "Check each row's load class")).toBe(false);
  expect(flagged("editor\u0000a.quote", "Choose the unit&quot;s panel")).toBe(true);
  expect(flagged("editor\u0000a.nbsp", "Already have one&nbsp;")).toBe(true);
  expect(flagged("editor\u0000a.numeric", "Row &#39;A&#39;")).toBe(true);
  expect(flagged("editor\u0000a.amp", "Walls &amp; columns")).toBe(true);
  // A plain `&` is text, not an entity.
  expect(flagged("editor\u0000a.amp", "Walls & columns")).toBe(false);

  // The `tr` side's rules travel with it, unchanged.
  expect(flagged("editor\u0000a.undefinedArtifact", "undefined")).toBe(true);
  expect(flagged("editor\u0000a.nullArtifact", "null")).toBe(true);
  expect(flagged("editor\u0000a.empty", "")).toBe(true);
  expect(flagged("editor\u0000a.emptyPlaceholder", "{{}}")).toBe(true);
  expect(flagged("editor\u0000a.mixed", "{{m}} of {n}")).toBe(true);
  expect(flagged("editor\u0000a.stray", "{{n}} items {")).toBe(true);
  expect(flagged("editor\u0000a.two", "{{x}} of {{y}}")).toBe(false);

  // The two formula helps show a brace on purpose, and the allowlist is keyed, not
  // shaped: the same sentence under another key is still a defect.
  expect(flagged("schedules\u0000save.formulaHelp", "How formulas call it, e.g. PZ.GasDemandBtuh({own.mbh}).")).toBe(false);
  expect(flagged("schedules\u0000builder.formulaHint", "Use fields in braces, like {own.mbh} * 1000.")).toBe(false);
  expect(flagged("editor\u0000save.formulaHelp", "Use fields in braces, like {own.mbh} * 1000.")).toBe(true);
  // An allowlisted key still answers to every other rule.
  expect(flagged("schedules\u0000save.formulaHelp", "Firm&apos;s formulas, e.g. PZ.X({a.b})")).toBe(true);
});
