/**
 * The connection-types tree in two languages — the guard for
 * `src/editor/connection-types`.
 *
 * The tree is one picker: the connection types a trade's form offers, the starter
 * types a project does not have yet, and the row that says a saved designator is
 * no longer in the project. It was three unkeyed sites in one file (measured by
 * `i18n-negative-space.test.ts`, which now owns the tree); this file proves the
 * three things that guard cannot see:
 *
 *   1. **Every key has Turkish.** A `t('connectionTypes.…')` with no entry in
 *      `locales/tr/editor.json` shows English on a Turkish screen.
 *   2. **The English is unchanged.** The designator a row prints is the *data*
 *      (`e.designator`), the words around it are the key, and the Turkish keeps
 *      the parenthesis with the same words after it: `(projenin türlerinde yok)`.
 *   3. **A placeholder is `{{…}}`** on both sides, since the row's designator is
 *      printed by the component and the sentence only says what it is not.
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

/** The tree's own keys, read from the source rather than listed, so a caption added here is read. */
const treeKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith("connectionTypes."));

/** A caption written twice or more is pinned: "the key exists" alone stays green while one site reverts. */
const SITES: Readonly<Record<string, number>> = {};

interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // §2.3/§2.8: a connection is a bağlantı; the *type* a catalog entry carries is a tür.
  { key: "connectionTypes.pick", english: "Pick a connection type", turkish: "Bir bağlantı türü seçin" },
  {
    key: "connectionTypes.notInProject",
    english: "(not in the project's types)",
    turkish: "(projenin türlerinde yok)",
  },
  // §5.10's *starter* vocabulary (the library's starter packs): the same word, not *başlatıcı*.
  {
    key: "connectionTypes.starters",
    english: "Starter types (added with it, verify for permit work)",
    turkish: "Başlangıç türleri (onunla eklenir, ruhsat işi için doğrulayın)",
  },
];

test("the guard is looking at the picker's captions, not an empty list", () => {
  expect(treeKeys().length).toBeGreaterThanOrEqual(3);
});

test("every caption in the tree is still keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("every caption in the tree has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("no caption falls back to English", () => {
  expect(treeKeys().filter((key) => (TURKISH[key] ?? "").trim() === "")).toEqual([]);
});

test("no key is translated without a call site", () => {
  const written = new Set(treeKeys());
  expect(Object.keys(TURKISH).filter((key) => key.startsWith("connectionTypes.")).filter((key) => !written.has(key))).toEqual([]);
});

test("a placeholder on one side is on the other, and is never written with one brace", () => {
  const placeholders = (text: string): string[] => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  const wrong = treeKeys()
    .filter((key) => placeholders(source.get(key)?.english ?? "").join(",") !== placeholders(TURKISH[key] ?? "").join(","))
    .map((key) => `${key}: EN [${placeholders(source.get(key)?.english ?? "")}] TR [${placeholders(TURKISH[key] ?? "")}]`);
  expect(wrong).toEqual([]);
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

test("a row reads its designator in both languages, and the words around it change", () => {
  // The designator is data (`TS-3`, `1/2 in. CW`); §7 keeps its symbols as they are.
  const designator = "TS-3";
  expect(`${designator} ${TR("connectionTypes.notInProject", "(not in the project's types)", { ns: "editor" })}`).toBe(
    "TS-3 (projenin türlerinde yok)",
  );
  expect(`${designator} ${TR("connectionTypes.notInProject", "(not in the project's types)", { ns: "editor" })}`).not.toBe(
    `${designator} (projenin türlerinde yok`,
  );
});
