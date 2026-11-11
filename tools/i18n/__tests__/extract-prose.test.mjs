/**
 * @jest-environment node
 *
 * The catalogue `npm run i18n:prose:extract` writes, and the two things about it a
 * person reading the review needs to be able to trust:
 *
 *  - every sentence the kernel and the packs write is in it, once, with the places
 *    it is written (a sentence that quietly falls out of the catalogue is a
 *    sentence no one will ever translate);
 *  - it says which templates the mechanism can match and which it cannot, because
 *    that difference is the coverage number the stage report quotes.
 *
 * The last test is the important one: it re-extracts the repository and compares the
 * bytes with the committed file, so a source change that is not followed by
 * `npm run i18n:prose:extract` fails here rather than shipping a stale key list.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildCatalog,
  catalogDocument,
  CATALOG_ID,
  extractLiterals,
  interpolationsOf,
  isNumericInterpolation,
  main,
  proseCoverage,
  readProseFiles,
  readTemplateMap,
  templateOf,
} from "../extract-prose.mjs";

const REPO_ROOT = resolve(__dirname, "../../..");
const COMMITTED = JSON.parse(readFileSync(join(REPO_ROOT, CATALOG_ID), "utf8"));

/** One source file as the reader hands it on. */
const file = (id, text) => ({ id, text });

describe("extractLiterals", () => {
  it("finds a refusal written positionally and the sentence fields", () => {
    const text = [
      'if (!el) refuse("element_not_found", "That block no longer exists.", [id]);',
      'const e = { code: "already_exists", message: "Level 3 is already used by another element" };',
      "const p = { problem: `A route needs at least ${2} points` };",
      'const s = { text: "Nothing to change: give at least one value" };',
    ].join("\n");
    const found = extractLiterals(text);
    expect(found.map((entry) => [entry.kind, entry.code, entry.body])).toEqual([
      ["refuse", "element_not_found", "That block no longer exists."],
      ["message", "already_exists", "Level 3 is already used by another element"],
      ["problem", undefined, "A route needs at least ${2} points"],
      ["text", undefined, "Nothing to change: give at least one value"],
    ]);
  });

  it("skips a sentence in a comment and a message that is an expression", () => {
    const text = [
      '/** Example: `message: "This is documentation, not a sentence"` */',
      'refuse("already_exists", "deleted" in el && el.deleted ? `${id} was removed` : `${id} is taken`, [id]);',
      'refuse("locked", "That is in a locked group", []);',
    ].join("\n");
    expect(extractLiterals(text).map((entry) => entry.body)).toEqual(["That is in a locked group"]);
  });

  it("keeps line numbers pointing at the line the sentence is on", () => {
    const text = ["// one", "// two", 'const e = { message: "Nothing to change: give at least one value" };'].join("\n");
    const [entry] = extractLiterals(text);
    expect(text.slice(0, entry.at).split("\n")).toHaveLength(3);
  });
});

describe("which templates the mechanism can match", () => {
  it("counts an interpolation that can only hold a number", () => {
    expect(isNumericInterpolation("command.revision")).toBe(true);
    expect(isNumericInterpolation("i + 1")).toBe(true);
    expect(isNumericInterpolation("members.length")).toBe(true);
    expect(isNumericInterpolation("sizeLabel(size)")).toBe(true);
  });

  it("does not count a name, a plural or a quoted word", () => {
    expect(isNumericInterpolation("g.entry.name")).toBe(false);
    expect(isNumericInterpolation('plural(n, "element")')).toBe(false);
    expect(isNumericInterpolation('n === 1 ? "is" : "are"')).toBe(false);
    expect(isNumericInterpolation("size.materialId")).toBe(false);
    // `c` is a class id here, not an index: a bare letter is never a number.
    expect(isNumericInterpolation("c")).toBe(false);
  });

  it("substitutes an interpolation so a numeric one lands on its own slot", () => {
    expect(templateOf("Revision ${command.revision} is not in the recent history").template).toBe(
      "Revision {0} is not in the recent history",
    );
    expect(templateOf("Nothing saved: ${why}. Disconnect the run.").matchable).toBe(false);
    expect(templateOf("That end is already connected").matchable).toBe(true);
  });

  it("reads an interpolation holding braces as one interpolation", () => {
    expect(interpolationsOf("a ${x ? { y: 1 } : {}} b")).toEqual(["x ? { y: 1 } : {}"]);
  });
});

describe("buildCatalog", () => {
  it("emits one row per distinct template with every place it is written", () => {
    const catalog = buildCatalog([
      file("a.ts", 'refuse("locked", "That is in a locked group", []);\nrefuse("locked", "That is in a locked group", []);'),
      file("b.ts", 'const e = { code: "locked", message: "That is in a locked group" };'),
      file("c.ts", 'refuse("in_use", "A model needs at least one phase.", []);'),
    ]);
    const [first, second] = catalog.templates;
    expect(catalog.totals).toEqual({ files: 3, literals: 4, labels: 0, templates: 2, matchable: 2, unmatchable: 0 });
    expect(first).toEqual({
      template: "That is in a locked group",
      count: 3,
      sources: ["a.ts:1", "a.ts:2", "b.ts:1"],
      codes: ["locked"],
      kinds: ["message", "refuse"],
      matchable: true,
    });
    expect(second.template).toBe("A model needs at least one phase.");
  });

  it("leaves a label out and counts it as one", () => {
    const catalog = buildCatalog([
      file("a.ts", 'const s = { text: "SHEET NUMBER" };\nconst t = { text: "doc.text" };'),
      file("b.ts", 'const u = { text: "Provide GFCI protection." };'),
    ]);
    expect(catalog.totals).toEqual({ files: 2, literals: 3, labels: 2, templates: 1, matchable: 1, unmatchable: 0 });
  });

  it("marks a template unmatchable when any way of writing it carries a name", () => {
    const catalog = buildCatalog([
      file("a.ts", 'refuse("already_exists", "That end is already connected", []);'),
      file("b.ts", 'refuse("already_exists", `That end of ${label} is already connected`, []);'),
    ]);
    expect(catalog.templates.map((row) => [row.template, row.matchable])).toEqual([
      ["That end is already connected", true],
      ["That end of {0} is already connected", false],
    ]);
  });
});

describe("proseCoverage", () => {
  it("reports the translated share of what can be matched, the tail, and reach", () => {
    const catalog = buildCatalog([
      file("a.ts", 'refuse("locked", "That is in a locked group", []);'),
      file("b.ts", 'const e = { code: "locked", message: `That end of ${label} is locked` };'),
    ]);
    const coverage = proseCoverage(catalog, { "That is in a locked group": "Bu kilitli bir grupta" });
    // The second sentence carries a name, so no template can key it: it is the tail,
    // counted, not hidden.
    expect(coverage).toEqual({
      templates: 2,
      templatesTranslated: 1,
      matchable: 1,
      matchableTranslated: 1,
      coded: 2,
      codedTranslated: 1,
      unmatchable: 1,
      top10: 1,
      top50: 1,
    });
  });
});

describe("the committed catalogue", () => {
  it("says what made it, and how big it is", () => {
    expect(COMMITTED.generatedBy).toBe("tools/i18n/extract-prose.mjs");
    expect(COMMITTED.totals.templates).toBe(COMMITTED.templates.length);
    expect(COMMITTED.totals.templates).toBeGreaterThan(500);
    // Nothing may be dropped silently: matched + unmatched is the whole catalogue.
    expect(COMMITTED.totals.matchable + COMMITTED.totals.unmatchable).toBe(COMMITTED.totals.templates);
  });

  it("keeps the preposition the unit `in` used to swallow", () => {
    // `in` is a unit *and* the commonest English preposition. Read as a unit it took the
    // preposition with it, and four sentences were catalogued as `{0} the library`,
    // `{0} this model`, `{2} your own words`, `{1} the export` — templates that no
    // longer say what happened, and that a translator would render as nonsense.
    //
    // Asserted as the four sentences, not as a pattern over every template: a determiner
    // after a slot is perfectly normal (`A wall branch is wider than its trunk`), so a
    // pattern would have to know which slot held an `in`, which is exactly the thing
    // that was wrong. `i18n-prose.test.ts` pins the normaliser directly.
    const templates = COMMITTED.templates.map((row) => row.template);
    expect(templates).toContain("There is no fitting type {0} in the library");
    expect(templates).toContain("No system {0} in this model.");
    expect(templates).toContain("Rule {0}'s title is {1} characters; keep it to {2} in your own words");
    expect(templates.some((template) => template.startsWith("{0} is {1} in the export"))).toBe(true);
    // The malformed forms are gone.
    expect(templates.filter((template) => /\{\d+\} (?:the library|this model\.)|keep it to \{\d+\} your own words|\{\d+\} the export/u.test(template))).toEqual([]);
  });

  it("is what the sources would produce right now", () => {
    const scratch = mkdtempSync(join(tmpdir(), "prose-catalog-"));
    try {
      const out = join(scratch, "prose-templates.json");
      expect(main(["--out", out], REPO_ROOT)).toBe(0);
      expect(JSON.parse(readFileSync(out, "utf8"))).toEqual(COMMITTED);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("has a Turkish map that is a subset of it, and reports coverage", () => {
    const map = readTemplateMap(REPO_ROOT);
    const known = new Set(COMMITTED.templates.map((row) => row.template));
    expect(Object.keys(map).filter((template) => !known.has(template))).toEqual([]);

    const coverage = proseCoverage(COMMITTED, map);
    // The numbers this pins are the ones the stage report quotes.
    expect(coverage.matchableTranslated).toBeGreaterThanOrEqual(0.8 * coverage.matchable);
    expect(coverage.templatesTranslated).toBeGreaterThanOrEqual(120);
    expect(coverage.unmatchable + coverage.matchable).toBe(coverage.templates);
  });

  it("read the same source tree the review tool reads", () => {
    // A walk that silently found nothing would leave every assertion above true on
    // an empty catalogue; `bim-kernel` always has refusals.
    const { files } = readProseFiles(REPO_ROOT);
    expect(files.map((entry) => entry.id)).toContain("packages/bim-kernel/src/part-commands.ts");
    expect(files.filter((entry) => entry.id.startsWith("packages/bim-pack-")).length).toBeGreaterThan(100);
    expect(catalogDocument(buildCatalog(files)).templates.length).toBe(COMMITTED.templates.length);
  });
});
