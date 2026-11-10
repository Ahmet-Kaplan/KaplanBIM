/**
 * @jest-environment node
 *
 * The two walks of the Turkish corpus must not drift: the guard tests read
 * `locales/tr` through `packages/bim-ui/__tests__/locale-files.ts`, while
 * `npm run i18n:review` reads it through `tools/i18n/locale-files.mjs`,
 * duplicated because a plain-`node` tool cannot load a TypeScript module. Two
 * walks that disagree about which files exist would let a guard pass on a corpus
 * the review bundle never sees (or the other way round) — the exact silent gap
 * both exist to prevent. So they are compared here, on the real repo, every run.
 *
 * A `.ts` test under `tools/`, like `tools/release/__tests__/versions.test.ts`:
 * the review tool is not part of the packages TypeScript project, so this file
 * imports the workspace walker without dragging `tools/` into `tsc`.
 */
import { flattenLocales, readTrLocaleFiles } from "../../../packages/bim-ui/__tests__/locale-files";
import { readTrLocaleFiles as readToolTrLocaleFiles } from "../locale-files.mjs";
import { flattenLocaleFiles } from "../review-bundle.mjs";

interface Leaf {
  readonly file: string;
  readonly key: string;
  readonly value: string;
}

/** `[file, key, value]`, sorted: order inside a file is not part of the agreement. */
const corpusOf = (entries: readonly Leaf[]): string[] =>
  entries.map((entry) => `${entry.file}\u0000${entry.key}\u0000${entry.value}`).sort();

describe("the two locale walks", () => {
  const guardFiles = readTrLocaleFiles();
  const toolFiles = readToolTrLocaleFiles();

  it("see the same locale files, in the same order", () => {
    expect(toolFiles.map((file) => file.id)).toEqual(guardFiles.map((file) => file.id));
  });

  it("agree on every key and every Turkish value", () => {
    const guard = flattenLocales(guardFiles);
    const tool = flattenLocaleFiles(toolFiles);

    expect(corpusOf(tool.entries)).toEqual(corpusOf(guard.entries));
    expect(tool.nonStrings.map((leaf) => `${leaf.file}\u0000${leaf.key}`).sort()).toEqual(guard.nonStrings.map((leaf) => `${leaf.file}\u0000${leaf.key}`).sort());
    expect(tool.unreadable).toEqual([]);
  });

  it("is comparing a corpus that exists", () => {
    // Without this, two walks that both found nothing would pass, which is the
    // vacuous-green failure both readers were written to avoid.
    expect(guardFiles.length).toBeGreaterThan(0);
    expect(guardFiles.some((file) => file.parseError === undefined)).toBe(true);
    expect(flattenLocales(guardFiles).entries.length).toBeGreaterThan(0);
  });
});
