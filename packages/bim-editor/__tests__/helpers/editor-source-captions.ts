/**
 * The editor's source, read the way `npm run i18n:review` reads it.
 *
 * One scanner, shared: `i18n-panels-chrome.test.tsx` (the dock panels and the
 * status bar) and `i18n-operator-messages.test.ts` (the operator's refusals, the
 * connection problems and the empty states) both need to know that a caption is
 * *still a `t('<key>', '<English>')` call in the component* — that is the half
 * that bites when someone reverts a caption to a literal, or adds a new one and
 * forgets the Turkish. A second scanner would be a second thing to keep honest.
 *
 * What it reads: every `.ts`/`.tsx` under `src/editor`, comments stripped, and
 * every call shaped `t('<key>', '<English>'`. The key is always a single-quoted
 * literal (the house style); the English may be single- or double-quoted, so a
 * caption that contains an apostrophe (`That's`, `isn't`) carries it verbatim
 * rather than as `\'`.
 */
import fs from "node:fs";
import path from "node:path";

/** The editor's source root: the tree the review tool scans for `t()` calls. */
export const EDITOR_SRC = path.join(__dirname, "..", "..", "src", "editor");

/** `t('<key>', '<English>'` — the shape every caption is written in. */
const CAPTION_CALL = /\bt\('([A-Za-z][\w.]*)',\s*(['"])((?:\\.|(?!\2)[^\\])*)\2/g;

/** One caption as the source writes it: the English the call sites hold, and how many call sites hold it. */
export interface SourceCaption {
  readonly english: string;
  readonly sites: number;
}

/** Every keyed caption in the editor's source: key → what the call sites say. */
export function editorSourceCaptions(): ReadonlyMap<string, SourceCaption> {
  const found = new Map<string, SourceCaption>();
  for (const file of sourceFiles(EDITOR_SRC)) {
    for (const match of stripComments(fs.readFileSync(file, "utf8")).matchAll(CAPTION_CALL)) {
      const [, key, , english] = match;
      if (key === undefined || english === undefined) continue;
      const seen = found.get(key);
      found.set(key, { english, sites: (seen?.sites ?? 0) + 1 });
    }
  }
  return found;
}

/** Every caption kept under `prefix` (`operator.`, `empty.` …), for the "nothing unlisted" half of a guard. */
export function captionsUnder(source: ReadonlyMap<string, SourceCaption>, prefixes: readonly string[]): string[] {
  return [...source.keys()].filter((key) => prefixes.some((prefix) => key.startsWith(prefix)));
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/u.test(entry.name) ? [full] : [];
  });
}

/**
 * Drops `//` and `/* … *\/` comments, keeping string literals intact — the same
 * reason `tools/i18n/review-bundle.mjs` does: the test files and the components'
 * docstrings quote `t('…')` examples in prose. Without this a comment would count
 * as a call site and the scan would go green over a reverted caption.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}
