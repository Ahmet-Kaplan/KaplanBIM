/**
 * @jest-environment node
 *
 * `npm run i18n:review` is the list a person reads at the end of every stage:
 * every Turkish string next to the English it replaces, with the untranslated
 * ones flagged. These tests pin the things that make that list trustworthy —
 * nothing is silently dropped, coverage is measured per namespace (a Turkish
 * `common.actions.save` says nothing about `editor.actions.save`), and the same
 * input always renders the same bytes — and they pin the source scan that
 * supplies the English column.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readSourceFiles } from "../locale-files.mjs";
import { buildBundle, collectBundle, collectSourceStrings, DEFAULT_NAMESPACE, extractSource, proseReport, qualify } from "../review-bundle.mjs";

const SCRIPT = resolve(__dirname, "../review-bundle.mjs");
const TR_COMMON = "packages/bim-ui/locales/tr/common.json";
const TR_EDITOR = "packages/bim-editor/locales/tr/editor.json";
const PROSE_MAP = "packages/bim-ui/locales/tr/prose.json";

/** A locale file as the shared reader reports it: parsed, or with the reason it is not. */
const localeFile = (id, json, parseError) => (parseError === undefined ? { id, json } : { id, json: undefined, parseError });

/** Source-side truth: `[namespace, key]` and `[namespace, key, "English"]` pairs, as the scan reports them. */
const source = (...pairs) => ({
  sourceStrings: Object.fromEntries(pairs.filter(([, , english]) => english !== undefined).map(([namespace, key, english]) => [qualify(namespace, key), english])),
  sourceKeys: pairs.map(([namespace, key]) => qualify(namespace, key)),
});

const bundle = (input) => buildBundle({ date: "2026-11-10", stage: 1, ...input });

describe("buildBundle", () => {
  it("lists every key with its English default and its Turkish value", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { language: { label: "Dil", merge: "Birleştir" } })],
      ...source(["common", "language.label", "Language"], ["common", "language.merge", "Merge"]),
    });

    expect(markdown).toContain("| `language.label` | Language | Dil |");
    expect(markdown).toContain("| `language.merge` | Merge | Birleştir |");
  });

  it("marks a key with no Turkish value instead of dropping it", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil" })],
      ...source(["common", "language.label", "Language"], ["common", "ribbon.merge", "Merge"]),
    });

    expect(markdown).toContain("| `ribbon.merge` | Merge | ⚠️ eksik |");
    // The translated key is still there: the warning adds a row, it does not replace one.
    expect(markdown).toContain("| `language.label` | Language | Dil |");
  });

  it("marks a Turkish key the source never mentions as not found in source", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil", "ghost.key": "Hayalet" })],
      ...source(["common", "language.label", "Language"]),
    });

    expect(markdown).toContain("| `ghost.key` | — | Hayalet ⚠️ kaynakta bulunamadı |");
  });

  it("reports a key missing from the namespace the source asks for, not from the repo at large", () => {
    // `actions.save` exists twice: translated in `common`, not started in `editor`.
    // A key-name-only match sees the first and calls the second done.
    const model = collectBundle({
      files: [localeFile(TR_COMMON, { "actions.save": "Kaydet" }), localeFile(TR_EDITOR, { "actions.cancel": "İptal" })],
      ...source(["common", "actions.save", "Save"], ["editor", "actions.save", "Save"], ["editor", "actions.cancel", "Cancel"]),
      date: "2026-11-10",
      stage: 1,
    });
    const markdown = buildBundle({
      files: [localeFile(TR_COMMON, { "actions.save": "Kaydet" }), localeFile(TR_EDITOR, { "actions.cancel": "İptal" })],
      ...source(["common", "actions.save", "Save"], ["editor", "actions.save", "Save"], ["editor", "actions.cancel", "Cancel"]),
      date: "2026-11-10",
      stage: 1,
    });

    expect(model.counts.missing).toBe(1);
    expect(model.missing).toEqual([{ namespace: "editor", key: "actions.save", english: "Save", marker: "⚠️ eksik" }]);
    // And the reviewer reads it under the namespace it belongs to.
    expect(markdown).toContain("### `editor`");
    expect(markdown).toContain("| `actions.save` | Save | ⚠️ eksik |");
  });

  it("counts an empty Turkish value as a gap, not as translated", () => {
    const model = collectBundle({
      files: [localeFile(TR_COMMON, { "language.label": "" })],
      ...source(["common", "language.label", "Language"]),
      date: "2026-11-10",
      stage: 1,
    });
    const markdown = buildBundle({
      files: [localeFile(TR_COMMON, { "language.label": "" })],
      ...source(["common", "language.label", "Language"]),
      date: "2026-11-10",
      stage: 1,
    });

    expect(model.counts.empty).toBe(1);
    expect(model.counts.missing).toBe(0);
    expect(markdown).toContain("| `language.label` | Language | ⚠️ boş değer |");
    expect(markdown).toContain("| — Boş değer (`⚠️ boş değer`) | 1 |");
    // The gap list carries it too: a reviewer reading only that section still sees it.
    expect(markdown).toContain("### `common`");
  });

  it("renders the same bytes for the same date and stage", () => {
    const files = [
      localeFile("packages/bim-ui/locales/tr/common.json", { "language.label": "Dil" }),
      // Same namespace in two packages: the order the walk happens to find them
      // in may not leak into the file the person reads.
      localeFile("packages/bim-editor/locales/tr/common.json", { "language.label": "Etiket", "ribbon.merge": "Birleştir" }),
    ];
    const pairs = [["common", "language.label", "Language"], ["common", "ribbon.merge", "Merge"]];

    const once = bundle({ files, ...source(...pairs) });
    const twice = bundle({ files, ...source(...pairs) });
    const shuffled = bundle({ files: [...files].reverse(), ...source(...[...pairs].reverse()) });

    expect(once).toBe(twice);
    expect(shuffled).toBe(once);
    expect(once).toContain("2026-11-10");
    expect(once).toContain("Aşama 1");
  });

  it("produces a non-empty bundle holding a row for every key", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil", "language.merge": "Birleştir" })],
      ...source(["common", "language.label", "Language"], ["common", "language.merge", "Merge"]),
    });

    expect(markdown.length).toBeGreaterThan(0);
    expect(markdown).toContain("| Key | English | Türkçe |");
    expect(markdown.match(/^\| `[^`]+` /gm)).toHaveLength(2);
  });

  it("reports a locale file it cannot parse instead of skipping it", () => {
    const markdown = bundle({ files: [localeFile(TR_COMMON, undefined, "Unexpected end of JSON input")], ...source() });

    expect(markdown).toContain("Okunamayan dosyalar");
    expect(markdown).toContain(TR_COMMON);
    expect(markdown).toContain("Unexpected end of JSON input");
    // The gap is in the scope table too, not only in a section further down.
    expect(markdown).toContain("| Okunamayan dosya | 1 |");
  });

  it("reports a source file it could not read instead of losing the report", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil" })],
      ...source(["common", "language.label", "Language"]),
      sourceErrors: [{ id: "packages/bim-ui/src/broken.tsx", error: "EACCES: permission denied" }],
    });

    expect(markdown).toContain("| Okunamayan dosya | 1 |");
    expect(markdown).toContain("`packages/bim-ui/src/broken.tsx` (kaynak) — EACCES: permission denied");
    // The rest of the report still exists.
    expect(markdown).toContain("| `language.label` | Language | Dil |");
  });

  it("lists a leaf that is not a string instead of counting it as translated", () => {
    const markdown = bundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil", "ribbon.merge": null, "ribbon.split": ["a"] })],
      ...source(["common", "language.label", "Language"], ["common", "ribbon.merge", "Merge"], ["common", "ribbon.split", "Split"]),
    });

    expect(markdown).toContain("Dize olmayan yapraklar");
    expect(markdown).toContain("`ribbon.merge` (null)");
    expect(markdown).toContain("`ribbon.split` (array)");
    expect(markdown).toContain("| Dize olmayan yaprak | 2 |");
  });

  it("says so when there is nothing to review, rather than rendering nothing", () => {
    const markdown = bundle({ files: [], ...source() });

    expect(markdown).toContain("| tr dosyası | 0 |");
    expect(markdown).toContain("İncelenecek tr dosyası yok");
  });

  it("counts the scope it rendered", () => {
    const { counts } = collectBundle({
      files: [localeFile(TR_COMMON, { "language.label": "Dil", "ghost.key": "Hayalet" })],
      ...source(["common", "language.label", "Language"], ["common", "ribbon.merge", "Merge"]),
      date: "2026-11-10",
      stage: 1,
    });

    expect(counts).toEqual({ files: 1, keys: 2, englishFound: 1, noEnglish: 1, empty: 0, missing: 1, orphaned: 1 });
  });

  it("discloses calls whose namespace could not be read", () => {
    const markdown = bundle({ files: [localeFile(TR_COMMON, { "language.label": "Dil" })], ...source(["common", "language.label", "Language"]), uncertainNamespaces: 3 });

    expect(markdown).toContain("| Ad alanı okunamayan çağrı (varsayılan `common`) | 3 |");
  });

  it("says how a key present in two files is judged", () => {
    // `""` in one package and a real string in another is a value conflict, not a
    // missing translation; the report has to state that rule instead of leaving a
    // reviewer to infer it from a cell that lost its `boş değer` mark.
    const model = collectBundle({
      files: [localeFile("packages/bim-ui/locales/tr/common.json", { "language.label": "" }), localeFile("packages/bim-editor/locales/tr/common.json", { "language.label": "Etiket" })],
      ...source(["common", "language.label", "Language"]),
      date: "2026-11-10",
      stage: 1,
    });
    const markdown = buildBundle({
      files: [localeFile("packages/bim-ui/locales/tr/common.json", { "language.label": "" }), localeFile("packages/bim-editor/locales/tr/common.json", { "language.label": "Etiket" })],
      ...source(["common", "language.label", "Language"]),
      date: "2026-11-10",
      stage: 1,
    });

    expect(model.counts.empty).toBe(0);
    expect(markdown).toContain("| `language.label` | Language | Etiket · (boş) ⚠️ çakışan değer |");
    expect(markdown).toContain("en az bir dosyada metin varsa çevrilmiş sayılır");
  });
});

describe("the prose coverage table", () => {
  const catalog = {
    templates: [
      { template: "Revision {0} is not in the recent history, so it can't be undone here", codes: ["undo_refused"], matchable: true },
      { template: "That end is already connected", codes: ["already_exists"], matchable: true },
      { template: "That end of {0} is already connected", codes: ["already_exists"], matchable: false },
    ],
  };

  it("counts what the map covers against what the mechanism can match, and the tail", () => {
    const report = proseReport(catalog, { "That end is already connected": "Bu uç zaten bağlı" });
    expect(report).toEqual({
      templates: 3,
      templatesTranslated: 1,
      matchable: 2,
      matchableTranslated: 1,
      refusals: 3,
      refusalsTranslated: 1,
      unmatchable: 1,
      untranslatedMatchable: ["Revision {0} is not in the recent history, so it can't be undone here"],
    });
  });

  it("renders the denominators it counted, and never as a bare percentage", () => {
    const markdown = buildBundle({
      files: [localeFile(PROSE_MAP, { "That end is already connected": "Bu uç zaten bağlı" })],
      proseKeys: ["That end is already connected"],
      prose: proseReport(catalog, { "That end is already connected": "Bu uç zaten bağlı" }),
      date: "2026-11-10",
      stage: 3,
    });
    expect(markdown).toContain("| Eşlenebilir şablon (**hedef ≥ %80**) | 1 | 2 | 50.0% |");
    expect(markdown).toContain("| Tüm katalog | 1 | 3 | 33.3% |");
    expect(markdown).toContain("| — Şablon eşlenemez (ad/çoğul interpolasyonu) | — | 1 | — |");
    // The sentence nobody translated is listed, not merely subtracted.
    expect(markdown).toContain("Revision {0} is not in the recent history");
  });

  it("does not call a prose template orphaned, because the catalogue is its reference", () => {
    const model = collectBundle({
      files: [localeFile(PROSE_MAP, { "That end is already connected": "Bu uç zaten bağlı" })],
      proseKeys: ["That end is already connected"],
      date: "2026-11-10",
      stage: 3,
    });
    expect(model.counts.orphaned).toBe(0);
    // And it stays out of the missing list: only the matchable tail can be translated.
    expect(model.counts.missing).toBe(0);
  });
});

describe("extractSource", () => {
  it("reads the English default from a t() call whatever the quote style", () => {
    const found = extractSource(`const a = t("language.label", "Language");\nconst b = t('ribbon.merge', 'Merge');`);

    expect(found.calls).toEqual([
      { namespace: "common", key: "language.label", english: "Language" },
      { namespace: "common", key: "ribbon.merge", english: "Merge" },
    ]);
  });

  it("reads a defaultValue passed as options", () => {
    const found = extractSource(`t("ribbon.merge", { ns: "editor", defaultValue: "Merge" })`);

    expect(found.calls).toEqual([{ namespace: "editor", key: "ribbon.merge", english: "Merge" }]);
  });

  it("remembers a key used without an English default", () => {
    const found = extractSource(`t("ribbon.merge", { ns: "editor" })`);

    expect(found.calls).toEqual([{ namespace: "editor", key: "ribbon.merge", english: undefined }]);
  });

  it("binds a call to the hook the component declared", () => {
    const found = extractSource(`function Ribbon() {\n  const t = useT("editor");\n  return <button>{t("ribbon.merge", "Merge")}</button>;\n}`);

    expect(found.calls).toEqual([{ namespace: "editor", key: "ribbon.merge", english: "Merge" }]);
  });

  it("binds each component in a file to its own hook", () => {
    const found = extractSource(
      [
        'function A() { const t = useT("editor"); return t("a.one", "One"); }',
        'function B() { const t = useTranslation("schedules"); return t("b.two", "Two"); }',
      ].join("\n"),
    );

    expect(found.calls.map((call) => [call.namespace, call.key])).toEqual([
      ["editor", "a.one"],
      ["schedules", "b.two"],
    ]);
  });

  it("does not bind a call to a hook declared after it", () => {
    // The reproduced over-report: a bare `t` at module scope above a later
    // component's `useT('editor')` is not an editor string. Binding it there made
    // the bundle flag a translated `common` key as `⚠️ eksik` under `editor`.
    const found = extractSource(["const label = t('common.title', 'Title');", "function Editor(){ const t = useT('editor'); return t('editor.title', 'Title'); }"].join("\n"));

    expect(found.calls.map((call) => [call.namespace, call.key])).toEqual([
      ["common", "common.title"],
      ["editor", "editor.title"],
    ]);
    expect(found.uncertain).toBe(0);
  });

  it("does not resolve an instance call through a component's hook", () => {
    const found = extractSource(`function Editor(){ const t = useT("editor"); i18n.t("settings.title", "Title"); return null; }`);

    expect(found.calls).toEqual([{ namespace: "common", key: "settings.title", english: "Title" }]);
  });

  it("lets an explicit ns win over the component's hook", () => {
    const found = extractSource(`function A() { const t = useT("editor"); return t("web.only", "Only", { ns: "web" }); }`);

    expect(found.calls).toEqual([{ namespace: "web", key: "web.only", english: "Only" }]);
  });

  it("counts a hook whose namespace is not a literal, and falls back to the default", () => {
    const found = extractSource(`function A({ ns }) { const t = useT(ns); return t("a.one", "One"); }`);

    expect(found.uncertain).toBe(1);
    expect(found.calls).toEqual([{ namespace: "common", key: "a.one", english: "One" }]);
  });

  it("ignores t() examples written in comments", () => {
    const source = [
      "// Write t('some.key', 'English text') at the call site.",
      "/*",
      ' * t("other.key", "Other text")',
      " */",
      'const real = t("language.label", "Language");',
    ].join("\n");

    expect(extractSource(source).calls.map((call) => call.key)).toEqual(["language.label"]);
  });

  it("does not mistake a parenthesised English string for the end of the call", () => {
    const found = extractSource(`t("ribbon.merge", "Merge (draft)", { ns: "editor" })`);

    expect(found.calls).toEqual([{ namespace: "editor", key: "ribbon.merge", english: "Merge (draft)" }]);
  });
});

describe("collectSourceStrings", () => {
  it("keeps the first English default it meets in file order", () => {
    const collected = collectSourceStrings([
      { id: "b.tsx", text: `t("ribbon.merge", "Merge")` },
      { id: "a.tsx", text: `t("ribbon.merge", "Merge walls")` },
    ]);

    expect(collected.defaults).toEqual({ [qualify("common", "ribbon.merge")]: "Merge walls" });
    expect(collected.keys).toEqual([qualify("common", "ribbon.merge")]);
  });

  it("keeps the same key name apart in different namespaces", () => {
    const collected = collectSourceStrings([
      { id: "a.tsx", text: `const t = useT("common"); t("actions.save", "Save");` },
      { id: "b.tsx", text: `const t = useT("editor"); t("actions.save", "Save");` },
    ]);

    expect(collected.keys).toEqual([qualify("common", "actions.save"), qualify("editor", "actions.save")]);
    expect(collected.defaults[qualify("common", "actions.save")]).toBe("Save");
    expect(collected.defaults[qualify("editor", "actions.save")]).toBe("Save");
  });

  it("reports the default namespace as the one i18next would use", () => {
    expect(DEFAULT_NAMESPACE).toBe("common");
  });
});

describe("readSourceFiles", () => {
  it("reports a source file it cannot read instead of throwing", () => {
    const root = mkdtempSync(join(tmpdir(), "i18n-source-"));
    try {
      mkdirSync(join(root, "packages", "p", "src"), { recursive: true });
      writeFileSync(join(root, "packages", "p", "src", "a.ts"), "export const x = 1;");
      const scan = readSourceFiles(root, {
        readFile: () => {
          throw new Error("EACCES: permission denied");
        },
      });

      expect(scan.files).toEqual([]);
      expect(scan.unreadable).toEqual([{ id: "packages/p/src/a.ts", error: "EACCES: permission denied" }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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
