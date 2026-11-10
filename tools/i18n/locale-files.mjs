// Reads the files the i18n review bundle is built from: the Turkish locale files
// and the source files that carry the English.
//
// Twin: `packages/bim-ui/__tests__/locale-files.ts` walks the same
// `packages/*/locales/tr` and `apps/*/locales/tr` directories for the guard
// tests. The walk is duplicated here on purpose — `npm run i18n:review` runs
// under plain `node` with no TypeScript loader, so it cannot import that `.ts`
// module, and a tool that reaches into another package's `__tests__` is a tool
// that breaks when the tests are reorganised. Change one walk, change the other:
// `packages/bim-ui/__tests__/i18n-parity.test.ts` fails if a locale file stops
// being readable, and this bundle lists it under "Okunamayan dosyalar".
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
 */
export function readSourceFiles(root = REPO_ROOT) {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push({ id: path.relative(root, full).split(path.sep).join("/"), text: fs.readFileSync(full, "utf8") });
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
  return files.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
