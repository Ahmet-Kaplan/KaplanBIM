/**
 * The graph tree in two languages — the guard for `src/editor/graph`.
 *
 * The tree is one section of the Inspector: the requirements graph's two
 * questions for the selected element ("Why is this here?" and "What depends on
 * this"), its "and N more" line, and Record a decision for a space or a zone. It
 * was seven unkeyed sites in one file; `i18n-negative-space.test.ts` proves it is
 * now zero and owns the tree. This file proves what that guard cannot:
 *
 *   1. **Every key has Turkish**, and §0.7's rule holds: a heading is a question
 *      addressed politely (*Bu neden burada?* — the same words the checklist's
 *      decision form already uses), not an imperative bark.
 *   2. **The English is unchanged**, character for character: the apostrophe in
 *      "couldn't" is the straight one the JSX wrote, and the graph's own sentences
 *      (`answer.empty`, each `item.cause`) are data that still reads as it is.
 *   3. **The undo label is one sentence per action** (`record {{key}} for {{name}}`),
 *      not a verb glued to an untranslated noun.
 */
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";
import { editorResources } from "../src/editor/i18n/resources";

const TR = translateFor("tr");

/** The editor's Turkish, flattened to the dotted keys the call sites use. */
function flatten(node: unknown, prefix = ""): Record<string, string> {
  if (typeof node === "string") return { [prefix]: node };
  if (typeof node !== "object" || node === null) return {};
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>(
    (out, [key, value]) => Object.assign(out, flatten(value, prefix === "" ? key : `${prefix}.${key}`)),
    {},
  );
}

const TURKISH = flatten((editorResources.tr as Record<string, unknown> | undefined)?.editor);

const treeKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith("graph."));

/** `graph.why` is the section's `aria-label` and its heading: the same sentence, so pinned at two. */
const SITES: Readonly<Record<string, number>> = {
  "graph.why": 2,
};

interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // The question the section asks, and the one §5.18's decision form answers.
  { key: "graph.why", english: "Why is this here?", turkish: "Bu neden burada?" },
  { key: "graph.depends", english: "What depends on this", turkish: "Buna bağlı olanlar" },
  {
    key: "graph.cannotRead",
    english: "The code studies couldn't be read for this: {{reason}}",
    turkish: "Kod çalışmaları bunun için okunamadı: {{reason}}",
  },
  // §2.4: a decision is a karar; the button records one, and the undo says which.
  { key: "graph.record", english: "Record a decision", turkish: "Bir karar kaydet" },
  { key: "graph.recordFor", english: "Record a decision for {{name}}", turkish: "{{name}} için bir karar kaydet" },
  {
    key: "graph.recordUndo",
    english: "record {{key}} for {{name}}",
    turkish: "{{name}} için {{key}} kararını kaydet",
  },
  // §8: a number is followed by a singular noun, and the count is a placeholder.
  { key: "graph.andMore", english: "and {{count}} more", turkish: "ve {{count}} tane daha" },
];

const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "graph.cannotRead": { reason: "grafik okunamadı" },
  "graph.recordFor": { name: "Mutfak" },
  "graph.recordUndo": { key: "kullanım", name: "Mutfak" },
  "graph.andMore": { count: 3 },
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

test("the guard is looking at this tree's captions, not an empty list", () => {
  expect(treeKeys().length).toBeGreaterThanOrEqual(7);
});

test("every caption is still keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
  // The straight apostrophe the JSX wrote as `&apos;` is not a curly one: the English
  // is the same sentence, character for character.
  expect(source.get("graph.cannotRead")?.english).not.toContain("\u2019");
});

test("every caption has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("no caption falls back to English, and no key is translated without a call site", () => {
  const written = new Set(treeKeys());
  expect(treeKeys().filter((key) => (TURKISH[key] ?? "").trim() === "")).toEqual([]);
  expect(Object.keys(TURKISH).filter((key) => key.startsWith("graph.")).filter((key) => !written.has(key))).toEqual([]);
});

test("a placeholder on one side is on the other, and is never written with one brace", () => {
  const placeholders = (text: string): string[] => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  expect(
    treeKeys()
      .filter((key) => placeholders(source.get(key)?.english ?? "").join(",") !== placeholders(TURKISH[key] ?? "").join(","))
      .map((key) => `${key}: EN [${placeholders(source.get(key)?.english ?? "")}] TR [${placeholders(TURKISH[key] ?? "")}]`),
  ).toEqual([]);
  expect(
    treeKeys()
      .filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(TURKISH[key] ?? ""))
      .map((key) => key),
  ).toEqual([]);
});

test("a caption written in more than one place is pinned at that count", () => {
  const source = editorSourceCaptions();
  const keys = new Set(treeKeys());
  for (const [key, sites] of Object.entries(SITES)) {
    expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites });
  }
  expect(
    [...source.entries()]
      .filter(([key, caption]) => keys.has(key) && caption.sites > 1 && SITES[key] === undefined)
      .map(([key, caption]) => `${key}: ${caption.sites}`),
  ).toEqual([]);
});

test("a caption reads the way a call site fills it, in both languages", () => {
  for (const caption of CAPTIONS) {
    const values = VALUES[caption.key];
    expect({ key: caption.key, text: TR(caption.key, caption.english, { ...values, ns: "editor" }) }).toEqual({
      key: caption.key,
      text: fill(caption.turkish, values),
    });
  }
});

test("§8: the sentence keeps its singular noun after a number", () => {
  expect(TR("graph.andMore", "and {{count}} more", { ns: "editor", count: 1 })).toBe("ve 1 tane daha");
  expect(TR("graph.andMore", "and {{count}} more", { ns: "editor", count: 4 })).toBe("ve 4 tane daha");
});
