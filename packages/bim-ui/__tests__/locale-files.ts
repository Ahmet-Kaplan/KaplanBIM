/**
 * Reads the Turkish locale files the i18n guard tests check.
 *
 * English never lives in a file: it is the i18next `defaultValue` written at the
 * call site. Turkish lives in `locales/tr/<namespace>.json` next to the code
 * that shows it, in every package and app, so the guards have to walk the repo.
 *
 * Not a `.test.ts` file: jest only picks up `*.test.*`, and both guards import
 * this reader instead of each growing its own copy of the walk.
 */
import fs from "node:fs";
import path from "node:path";

/** `<repo>`: `__dirname` is `<repo>/packages/bim-ui/__tests__`. */
export const REPO_ROOT = path.resolve(__dirname, "../../..");

/** Where a package or app may keep its translations. */
const LOCALE_CONTAINERS = ["packages", "apps"] as const;

export interface LocaleFile {
  /** Repo-relative POSIX path, e.g. `packages/bim-ui/locales/tr/common.json`. */
  readonly id: string;
  /** The parsed file, or `undefined` when the file is not valid JSON. */
  readonly json: unknown;
  /** Why the file did not parse. Present only when `json` is `undefined`. */
  readonly parseError?: string;
}

/** Every `<dir>/<name>/locales/tr` directory under `packages/` and `apps/`. */
function trLocaleDirectories(): string[] {
  const directories: string[] = [];
  for (const container of LOCALE_CONTAINERS) {
    const containerPath = path.join(REPO_ROOT, container);
    if (!fs.existsSync(containerPath)) continue;
    for (const entry of fs.readdirSync(containerPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(containerPath, entry.name, "locales", "tr");
      if (fs.existsSync(directory)) directories.push(directory);
    }
  }
  return directories.sort();
}

/**
 * Every `locales/tr/*.json` file in the repo, parsed. A file that is not valid JSON
 * — or cannot be read at all — is returned with `parseError` rather than thrown, so
 * one broken file reports itself instead of hiding the rest of the corpus.
 */
export function readTrLocaleFiles(): LocaleFile[] {
  const files: LocaleFile[] = [];
  for (const directory of trLocaleDirectories()) {
    const names = fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
    for (const name of names) {
      const full = path.join(directory, name);
      const id = path.relative(REPO_ROOT, full).split(path.sep).join("/");
      try {
        files.push({ id, json: JSON.parse(fs.readFileSync(full, "utf8")) as unknown });
      } catch (error) {
        files.push({ id, json: undefined, parseError: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return files;
}

/** One translated string: dotted key path in, Turkish text out. */
export interface LocaleEntry {
  /** Repo-relative file the string came from. */
  readonly file: string;
  /** Dotted key path inside that file, e.g. `language.label`. */
  readonly key: string;
  /** The Turkish text. */
  readonly value: string;
}

/** A leaf that is not a translated string (a number, a boolean, an array, `null`). */
export interface NonStringLeaf {
  readonly file: string;
  readonly key: string;
  /** How the leaf was written, for the failure message. */
  readonly shape: string;
}

export interface LocaleCorpus {
  readonly entries: readonly LocaleEntry[];
  readonly nonStrings: readonly NonStringLeaf[];
}

/**
 * Flattens every parsed file into dotted-key entries.
 *
 * Non-string leaves are collected instead of skipped: a `null` or a nested array
 * where a translation belongs is a defect the guards must report, not data they
 * may quietly drop.
 */
export function flattenLocales(files: readonly LocaleFile[]): LocaleCorpus {
  const entries: LocaleEntry[] = [];
  const nonStrings: NonStringLeaf[] = [];

  const walk = (file: string, value: unknown, prefix: string): void => {
    if (typeof value === "string") {
      entries.push({ file, key: prefix, value });
      return;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) {
        walk(file, child, prefix === "" ? key : `${prefix}.${key}`);
      }
      return;
    }
    nonStrings.push({ file, key: prefix, shape: Array.isArray(value) ? "array" : value === null ? "null" : typeof value });
  };

  for (const file of files) {
    if (file.parseError !== undefined) continue; // the parse test reports it
    walk(file.id, file.json, "");
  }
  return { entries, nonStrings };
}
