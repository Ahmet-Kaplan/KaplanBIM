// Reads the files the i18n review bundle is built from: the Turkish locale files
// and the source files that carry the English.
//
// Twin: `packages/bim-ui/__tests__/locale-files.ts` walks the same
// `packages/*/locales/tr` and `apps/*/locales/tr` directories for the guard
// tests, and that file points back here. The walk is duplicated on purpose —
// `npm run i18n:review` runs under plain `node` with no TypeScript loader, so it
// cannot import that `.ts` module, and a tool that reaches into another package's
// `__tests__` is a tool that breaks when the tests are reorganised. The
// duplication is held together by a test, not by a comment:
// `packages/bim-ui/__tests__/locale-walk-agreement.test.ts` asserts that both
// walkers see the same file ids and flatten them to the same keys and values, so
// a change to one walk that is not made to the other fails the suite.
import fs from "node:fs";
import path from "node:path";

/** `<repo>`: this file is `<repo>/tools/i18n/locale-files.mjs`. */
export const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

/** Where a package or app may keep its translations. */
const LOCALE_CONTAINERS = ["packages", "apps"];

/** Files that may hold a `t(...)` call. */
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const SOURCE_DIRECTORY = "src";

/** One translated-namespace file: repo-relative id, and either its JSON or why not. */
export function readTrLocaleFiles(root = REPO_ROOT) {
  /** `<dir>/<name>/locales/tr`, every package and app that has one. */
  const directoriesOf = () => {
    const directories = [];
    for (const container of LOCALE_CONTAINERS) {
      const containerPath = path.join(root, container);
      if (!fs.existsSync(containerPath)) continue;
      for (const entry of fs.readdirSync(containerPath, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const directory = path.join(containerPath, entry.name, "locales", "tr");
        if (fs.existsSync(directory)) directories.push(directory);
      }
    }
    return directories.sort();
  };

  const files = [];
  for (const directory of directoriesOf()) {
    const names = fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
    for (const name of names) {
      const full = path.join(directory, name);
      // A file that will not parse is reported, never skipped: an untranslated
      // key is a review item, and a hidden file is a review item nobody sees.
      const id = path.relative(root, full).split(path.sep).join("/");
      try {
        files.push({ id, json: JSON.parse(fs.readFileSync(full, "utf8")) });
      } catch (error) {
        files.push({ id, json: undefined, parseError: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return files;
}

/**
 * Every source file under `packages/<pkg>/src` and `apps/<app>/src`, id sorted,
 * so the caller can scan for `t(...)` calls without knowing the layout.
 *
 * A file or a directory that cannot be read is returned in `unreadable` rather
 * than thrown: one unreadable file must not cost the reviewer the whole report,
 * and a silently missing file is the failure this tool exists to prevent.
 */
export function readSourceFiles(root = REPO_ROOT, { readFile = (full) => fs.readFileSync(full, "utf8") } = {}) {
  const files = [];
  const unreadable = [];
  const idOf = (full) => path.relative(root, full).split(path.sep).join("/");
  const problem = (error) => (error instanceof Error ? error.message : String(error));

  const walk = (directory) => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      unreadable.push({ id: idOf(directory), error: problem(error) });
      return;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
        try {
          files.push({ id: idOf(full), text: readFile(full) });
        } catch (error) {
          unreadable.push({ id: idOf(full), error: problem(error) });
        }
      }
    }
  };
  for (const container of LOCALE_CONTAINERS) {
    const containerPath = path.join(root, container);
    if (!fs.existsSync(containerPath)) continue;
    for (const entry of fs.readdirSync(containerPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(containerPath, entry.name, SOURCE_DIRECTORY);
      if (fs.existsSync(directory)) walk(directory);
    }
  }
  return { files: files.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), unreadable };
}
