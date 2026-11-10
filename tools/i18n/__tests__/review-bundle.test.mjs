/**
 * @jest-environment node
 *
 * `npm run i18n:review` is the list a person reads at the end of every stage:
 * every Turkish string next to the English it replaces, with the untranslated
 * ones flagged. These tests pin the two things that make that list trustworthy —
 * nothing is silently dropped, and the same input always renders the same bytes —
 * and they pin the source scan that supplies the English column.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildBundle, collectBundle, collectSourceStrings, extractSource } from "../review-bundle.mjs";

const SCRIPT = resolve(__dirname, "../review-bundle.mjs");
const TR_COMMON = "packages/bim-ui/locales/tr/common.json";

/** A locale file as the shared reader reports it: parsed, or with the reason it is not. */
const localeFile = (id, json, parseError) => (parseError === undefined ? { id, json } : { id, json: undefined, parseError });

const bundle = (input) => buildBundle({ date: "2026-11-10", stage: 1, ...input });

describe("buildBundle", () => {
  it("lists every key with its English default and its Turkish value", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { language: { label: "Dil", merge: "Birleştir" } })],
      sourceStrings: { "language.label": "Language", "language.merge": "Merge" },
    });

    expect(markdown).toContain("| `language.label` | Language | Dil |");
    expect(markdown).toContain("| `language.merge` | Merge | Birleştir |");
  });

  it("marks a key with no Turkish value instead of dropping it", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil" })],
      sourceStrings: { "language.label": "Language", "ribbon.merge": "Merge" },
    });

    expect(markdown).toContain("| `ribbon.merge` | Merge | ⚠️ eksik |");
    // The translated key is still there: the warning adds a row, it does not replace one.
    expect(markdown).toContain("| `language.label` | Language | Dil |");
  });

  it("marks a Turkish key the source never mentions as not found in source", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil", "ghost.key": "Hayalet" })],
      sourceStrings: { "language.label": "Language" },
    });

    expect(markdown).toContain("| `ghost.key` | — | Hayalet ⚠️ kaynakta bulunamadı |");
  });

  it("renders the same bytes for the same date and stage", () => {
    const files = [
      localeFile("packages/bim-ui/locales/tr/common.json", { "language.label": "Dil" }),
      // Same namespace in two packages: the order the walk happens to find them
      // in may not leak into the file the person reads.
      localeFile("packages/bim-editor/locales/tr/common.json", { "language.label": "Etiket", "ribbon.merge": "Birleştir" }),
    ];
    const sourceStrings = { "language.label": "Language", "ribbon.merge": "Merge" };

    const once = bundle({ files, sourceStrings });
    const twice = bundle({ files, sourceStrings });
    const shuffled = bundle({ files: [...files].reverse(), sourceStrings: { "ribbon.merge": "Merge", "language.label": "Language" } });

    expect(once).toBe(twice);
    expect(shuffled).toBe(once);
    expect(once).toContain("2026-11-10");
    expect(once).toContain("Aşama 1");
  });

  it("produces a non-empty bundle holding a row for every key", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil", "language.merge": "Birleştir" })],
      sourceStrings: { "language.label": "Language", "language.merge": "Merge" },
    });

    expect(markdown.length).toBeGreaterThan(0);
    expect(markdown).toContain("| Key | English | Türkçe |");
    expect(markdown.match(/^\| `[^`]+` /gm)).toHaveLength(2);
  });

  it("reports a locale file it cannot parse instead of skipping it", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, undefined, "Unexpected end of JSON input")],
      sourceStrings: {},
    });

    expect(markdown).toContain("Okunamayan dosyalar");
    expect(markdown).toContain(TR_COMMON);
    expect(markdown).toContain("Unexpected end of JSON input");
    // The gap is in the scope table too, not only in a section further down.
    expect(markdown).toContain("| Okunamayan dosya | 1 |");
  });

  it("lists a leaf that is not a string instead of counting it as translated", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil", "ribbon.merge": null, "ribbon.split": ["a"] })],
      sourceStrings: { "language.label": "Language", "ribbon.merge": "Merge", "ribbon.split": "Split" },
    });

    expect(markdown).toContain("Dize olmayan yapraklar");
    expect(markdown).toContain("`ribbon.merge` (null)");
    expect(markdown).toContain("`ribbon.split` (array)");
    expect(markdown).toContain("| Dize olmayan yaprak | 2 |");
  });

  it("says so when there is nothing to review, rather than rendering nothing", () => {
    const markdown = bundle({ files: [], sourceStrings: {} });

    expect(markdown).toContain("| tr dosyası | 0 |");
    expect(markdown).toContain("İncelenecek tr dosyası yok");
  });

  it("counts the scope it rendered", () => {
    const { counts } = collectBundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil", "ghost.key": "Hayalet" })],
      sourceStrings: { "language.label": "Language", "ribbon.merge": "Merge" },
      date: "2026-11-10",
      stage: 1,
    });

    expect(counts).toEqual({ files: 1, keys: 2, englishFound: 1, noEnglish: 1, missing: 1, orphaned: 1 });
  });
});

describe("extractSource", () => {
  it("reads the English default from a t() call whatever the quote style", () => {
    const found = extractSource(`const a = t("language.label", "Language");\nconst b = t('ribbon.merge', 'Merge');`);

    expect(found.defaults).toEqual({ "language.label": "Language", "ribbon.merge": "Merge" });
    expect(found.keys).toEqual(["language.label", "ribbon.merge"]);
  });

  it("reads a defaultValue passed as options", () => {
    const found = extractSource(`t("ribbon.merge", { ns: "editor", defaultValue: "Merge" })`);

    expect(found.defaults).toEqual({ "ribbon.merge": "Merge" });
  });

  it("remembers a key used without an English default", () => {
    const found = extractSource(`t("ribbon.merge", { ns: "editor" })`);

    expect(found.keys).toEqual(["ribbon.merge"]);
    expect(found.defaults).toEqual({});
  });

  it("ignores t() examples written in comments", () => {
    const source = [
      "// Write t('some.key', 'English text') at the call site.",
      "/*",
      ' * t("other.key", "Other text")',
      " */",
      'const real = t("language.label", "Language");',
    ].join("\n");

    expect(extractSource(source).keys).toEqual(["language.label"]);
  });
});

describe("collectSourceStrings", () => {
  it("keeps the first English default it meets in file order", () => {
    const collected = collectSourceStrings([
      { id: "b.tsx", text: `t("ribbon.merge", "Merge")` },
      { id: "a.tsx", text: `t("ribbon.merge", "Merge walls")` },
    ]);

    expect(collected.defaults).toEqual({ "ribbon.merge": "Merge walls" });
    expect(collected.keys).toEqual(["ribbon.merge"]);
  });
});

describe("the CLI", () => {
  it("writes the review file to --out and reports the counts", () => {
    const directory = mkdtempSync(join(tmpdir(), "i18n-review-"));
    try {
      const out = join(directory, "review.md");
      const stdout = execFileSync(process.execPath, [SCRIPT, "--stage", "9", "--date", "2026-01-02", "--out", out], { encoding: "utf8" });
      const markdown = readFileSync(out, "utf8");

      expect(markdown).toContain("Aşama 9");
      expect(markdown).toContain("2026-01-02");
      expect(markdown).toContain("| Key | English | Türkçe |");
      expect(markdown).toMatch(/\| `language\.[a-z]+` \|/);
      expect(stdout).toContain(out);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
