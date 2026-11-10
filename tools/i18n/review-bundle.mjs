#!/usr/bin/env node
// The TR/EN review list a person reads at the end of every stage: each Turkish
// string next to the English it replaces, with what is not translated flagged.
//
//   npm run i18n:review                                  # docs/i18n/review/<bugün>-stage-1.md
//   npm run i18n:review -- --stage 2 --date 2026-11-11
//   node tools/i18n/review-bundle.mjs --out /tmp/review.md
//
// It is also the coverage report. A key that has no Turkish is listed with
// "eksik"; a Turkish key the source never mentions is listed with "kaynakta
// bulunamadı"; a locale file that will not parse is listed under "Okunamayan
// dosyalar". Nothing is ever quietly left out — an incomplete list that looks
// complete is worse than no list.
//
// The English comes from the source text, never from a second JSON file: the
// `t('key', 'English')` call is the single source of truth, so the tool reads
// `packages/*/src` and `apps/*/src` with `fs` and never imports them.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, readSourceFiles, readTrLocaleFiles } from "./locale-files.mjs";

/** The three markers a reviewer scans for. */
export const MISSING_MARKER = "⚠️ eksik";
export const ORPHAN_MARKER = "⚠️ kaynakta bulunamadı";

/** Written when there is no discoverable English default — a dash, never a guess. */
const NO_ENGLISH = "—";

/** Strings compared by code unit, not by locale: the bundle has to be byte-reproducible. */
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

// ---------------------------------------------------------------------------
// Reading the source text
// ---------------------------------------------------------------------------

const STRING_ARGUMENT = String.raw`(['"])((?:\\.|(?!\1)[^\\])*)\1`;

/** `t('key', 'English')` — the positional form. */
const POSITIONAL_CALL = new RegExp(String.raw`\bt\s*\(\s*${STRING_ARGUMENT}\s*,\s*${STRING_ARGUMENT}`, "g");
/** `t('key', { ns: 'editor', defaultValue: 'English' })` — the options form. */
const OPTIONS_CALL = new RegExp(String.raw`\bt\s*\(\s*${STRING_ARGUMENT}\s*,\s*\{[^{}]*?defaultValue\s*:\s*${STRING_ARGUMENT}`, "g");
/** `t('key', …)`: any call, so a key used without an English default is still known. */
const ANY_CALL = new RegExp(String.raw`\bt\s*\(\s*${STRING_ARGUMENT}`, "g");

/**
 * Drops `//` and `/* … *\/` comments, keeping string literals intact.
 *
 * Not decoration: this file, `use-t.ts` and the i18n docs all *show* a
 * `t('some.key', 'English text')` example in prose. Without this, every such
 * example would arrive in the review list as an untranslated key, and a list
 * that cries wolf stops being read.
 */
export function stripComments(text) {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index += 2;
      out += " "; // keeps `a/*x*/b` from becoming the single token `ab`
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      out += char;
      index += 1;
      while (index < text.length) {
        const inner = text[index];
        out += inner;
        index += 1;
        if (inner === "\\") {
          if (index < text.length) {
            out += text[index];
            index += 1;
          }
          continue;
        }
        if (inner === quote) break;
      }
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

/** Turns a matched JS string literal body back into the text it stands for. */
function unescapeLiteral(body) {
  const SIMPLE = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" };
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, escape) => {
    if (escape.startsWith("u{")) return String.fromCodePoint(Number.parseInt(escape.slice(2, -1), 16));
    if (escape.length > 1 && escape.startsWith("u")) return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    if (escape.length > 1 && escape.startsWith("x")) return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    return SIMPLE[escape] ?? escape;
  });
}

/** A first argument is a key when it is a token, not a sentence: `ribbon.merge`, not `Merge walls`. */
const isKey = (candidate) => candidate.length > 0 && candidate.length <= 120 && !/\s/.test(candidate);

/**
 * Every `t(...)` key in one source file, with the English default where the
 * call carries one.
 *
 * `keys` also holds the calls with no English default (a key read from a map, an
 * options-only call): those are genuinely in the source, so the bundle prints a
 * dash for their English instead of calling them orphaned.
 */
export function extractSource(text) {
  const source = stripComments(text);
  const defaults = {};
  const keys = new Set();

  const remember = (key, english) => {
    if (!isKey(key)) return;
    keys.add(key);
    // First one wins; `collectSourceStrings` feeds files in sorted order, so
    // "first" is a fact about the repo, not about the file system.
    if (english !== undefined && !(key in defaults)) defaults[key] = unescapeLiteral(english);
  };

  for (const match of source.matchAll(POSITIONAL_CALL)) remember(unescapeLiteral(match[2]), match[4]);
  for (const match of source.matchAll(OPTIONS_CALL)) remember(unescapeLiteral(match[2]), match[4]);
  for (const match of source.matchAll(ANY_CALL)) remember(unescapeLiteral(match[2]), undefined);

  return { defaults, keys: [...keys].sort(compare) };
}

/** `[{ id, text }]` → every English default and every key in the repo, id sorted. */
export function collectSourceStrings(files) {
  const defaults = {};
  const keys = new Set();
  for (const file of [...files].sort((left, right) => compare(left.id, right.id))) {
    const found = extractSource(file.text);
    for (const [key, english] of Object.entries(found.defaults)) if (!(key in defaults)) defaults[key] = english;
    for (const key of found.keys) keys.add(key);
  }
  return { defaults, keys: [...keys].sort(compare) };
}

// ---------------------------------------------------------------------------
// The bundle
// ---------------------------------------------------------------------------

/** `packages/bim-ui/locales/tr/common.json` → `common`. */
const namespaceOf = (id) => path.basename(id, ".json");

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const shapeOf = (value) => (Array.isArray(value) ? "array" : value === null ? "null" : typeof value);

/**
 * Every locale file flattened to dotted keys, plus every leaf that is not a
 * string. The non-strings are collected rather than skipped: a `null` where a
 * translation belongs is a review item, not data to drop.
 */
function readLeaves(files) {
  const entries = [];
  const nonStrings = [];
  const unreadable = [];

  const walk = (file, namespace, value, prefix) => {
    if (typeof value === "string") {
      entries.push({ file, namespace, key: prefix, value });
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) walk(file, namespace, child, prefix === "" ? key : `${prefix}.${key}`);
      return;
    }
    nonStrings.push({ file, namespace, key: prefix, shape: shapeOf(value) });
  };

  for (const file of [...files].sort((left, right) => compare(left.id, right.id))) {
    if (file.parseError !== undefined) {
      unreadable.push({ id: file.id, error: file.parseError });
      continue; // listed under "Okunamayan dosyalar", not silently absent
    }
    walk(file.id, namespaceOf(file.id), file.json, "");
  }
  return { entries, nonStrings, unreadable };
}

/**
 * The bundle as data: what is translated, what is missing, what looks orphaned,
 * and the counts that say so. `renderBundle` turns it into Markdown; keeping the
 * two apart is what makes "same input, same output" a property that can be
 * checked.
 *
 * @param {object} input
 * @param {readonly {id: string, json?: unknown, parseError?: string}[]} input.files
 * @param {Record<string, string>} [input.sourceStrings] key → English default, from `t('key', 'English')`
 * @param {Iterable<string>} [input.sourceKeys] every `t(...)` key, including those with no English default
 * @param {string} input.date `YYYY-MM-DD`; the CLI's clock is the only place today's date is read
 * @param {number} [input.stage]
 */
export function collectBundle({ files = [], sourceStrings = {}, sourceKeys, date, stage = 1 }) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`date must be YYYY-MM-DD, got ${String(date)}`);
  if (!Number.isInteger(stage) || stage < 1) throw new Error(`stage must be a positive integer, got ${String(stage)}`);

  const { entries, nonStrings, unreadable } = readLeaves(files);
  const referenced = new Set([...Object.keys(sourceStrings), ...(sourceKeys ?? [])]);
  const knownEnglish = (key) => (Object.hasOwn(sourceStrings, key) ? sourceStrings[key] : undefined);

  // Group by namespace, then by key: two packages that both ship `common.json`
  // are one section, and a key that appears in both shows both values.
  const namespaces = new Map();
  for (const entry of entries) {
    if (!namespaces.has(entry.namespace)) namespaces.set(entry.namespace, { namespace: entry.namespace, files: new Set(), rows: new Map() });
    const group = namespaces.get(entry.namespace);
    group.files.add(entry.file);
    if (!group.rows.has(entry.key)) group.rows.set(entry.key, { key: entry.key, values: [] });
    group.rows.get(entry.key).values.push({ file: entry.file, value: entry.value });
  }

  const counts = { files: files.length, keys: 0, englishFound: 0, noEnglish: 0, missing: 0, orphaned: 0 };
  const translated = new Set();
  const sections = [...namespaces.values()]
    .sort((left, right) => compare(left.namespace, right.namespace))
    .map((group) => ({
      namespace: group.namespace,
      files: [...group.files].sort(compare),
      rows: [...group.rows.values()]
        .sort((left, right) => compare(left.key, right.key))
        .map((row) => {
          const values = [...new Set(row.values.map((cell) => cell.value))];
          const english = knownEnglish(row.key);
          // A key no `t(...)` call mentions may be dead, or reached through a map
          // the scan cannot see. Say so; never drop the row.
          const orphaned = !referenced.has(row.key);
          translated.add(row.key);
          counts.keys += 1;
          if (english === undefined) counts.noEnglish += 1;
          else counts.englishFound += 1;
          if (orphaned) counts.orphaned += 1;
          return { key: row.key, english, values, orphaned };
        }),
    }));

  const missing = [...referenced]
    .filter((key) => !translated.has(key))
    .sort(compare)
    .map((key) => ({ key, english: knownEnglish(key) ?? null }));
  counts.missing = missing.length;

  return { date, stage, counts, sections, missing, nonStrings, unreadable };
}

/** Escapes a value so a `|` or a newline cannot break out of its table cell. */
const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

const TABLE_HEAD = ["| Key | English | Türkçe |", "|-----|---------|--------|"];

const row = (key, english, turkish) => `| \`${key}\` | ${cell(english ?? NO_ENGLISH)} | ${cell(turkish)} |`;

/** One Turkish cell: the text, plus whatever the reviewer must know about it. */
function turkishCell({ values, orphaned }) {
  const text = values.join(" · ");
  const marks = [];
  if (values.some((value) => value.trim() === "")) marks.push("⚠️ boş değer");
  if (values.length > 1) marks.push("⚠️ çakışan değer");
  if (orphaned) marks.push(ORPHAN_MARKER);
  return [text, ...marks].filter((part) => part !== "").join(" ");
}

/** The bundle model as the Markdown file a person reads. */
export function renderBundle({ date, stage, counts, sections, missing, nonStrings, unreadable }) {
  const lines = [`# i18n İnceleme Paketi — Aşama ${stage}`, ""];
  lines.push(`- **Tarih / Date:** ${date}`, `- **Aşama / Stage:** ${stage}`, "");

  lines.push("## Kapsam (coverage)", "", "| Ölçü | Sayı |", "|------|------|");
  lines.push(`| tr dosyası | ${counts.files} |`);
  lines.push(`| tr anahtarı | ${counts.keys} |`);
  lines.push(`| — English varsayılanı bulundu | ${counts.englishFound} |`);
  lines.push(`| — English varsayılanı yok (\`${NO_ENGLISH}\`) | ${counts.noEnglish} |`);
  lines.push(`| Eksik çeviri (\`${MISSING_MARKER}\`) | ${counts.missing} |`);
  lines.push(`| Şüpheli yetim (\`${ORPHAN_MARKER}\`) | ${counts.orphaned} |`);
  // Counted in the same table as everything else: a file the tool could not read
  // and a leaf that is not a string are gaps in the scope, not silence.
  lines.push(`| Okunamayan dosya | ${unreadable.length} |`);
  lines.push(`| Dize olmayan yaprak | ${nonStrings.length} |`);
  lines.push("");

  if (sections.length === 0) {
    lines.push("İncelenecek tr dosyası yok: aşağıda listelenecek bir çeviri bulunamadı.", "");
  }

  for (const section of sections) {
    lines.push(`## \`${section.namespace}\``, "", `Dosyalar: ${section.files.map((file) => `\`${file}\``).join(", ")}`, "");
    lines.push(...TABLE_HEAD);
    for (const rowValue of section.rows) lines.push(row(rowValue.key, rowValue.english, turkishCell(rowValue)));
    lines.push("");
  }

  lines.push("## Çevrilmemiş anahtarlar (kaynakta var, tr yok)", "");
  if (missing.length === 0) {
    lines.push("Yok: kaynakta bulunan her anahtarın bir tr karşılığı var.", "");
  } else {
    lines.push(...TABLE_HEAD);
    for (const entry of missing) lines.push(row(entry.key, entry.english, MISSING_MARKER));
    lines.push("");
  }

  if (unreadable.length > 0) {
    lines.push("## Okunamayan dosyalar", "", "Bu dosyaların anahtarları aşağıda **yok**: JSON geçersiz.", "");
    for (const file of unreadable) lines.push(`- \`${file.id}\` — ${file.error}`);
    lines.push("");
  }

  if (nonStrings.length > 0) {
    lines.push("## Dize olmayan yapraklar", "", "Çeviri yerine dize olmayan bir değer var; çevrilmiş sayılmadı.", "");
    for (const leaf of nonStrings) lines.push(`- \`${leaf.file}\` → \`${leaf.key}\` (${leaf.shape})`);
    lines.push("");
  }

  return lines.join("\n");
}

/** The whole bundle in one call: model in, Markdown out. */
export function buildBundle(input) {
  return renderBundle(collectBundle(input));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `usage: node tools/i18n/review-bundle.mjs [--stage N] [--date YYYY-MM-DD] [--out PATH]

  --stage N            aşama numarası (default 1)
  --date YYYY-MM-DD    rapor tarihi (default: bugün)
  --out PATH           yazılacak dosya (default: docs/i18n/review/<date>-stage-<N>.md)`;

/** Today where the person reading the report is: a 00:30 review is today's, not yesterday's UTC. */
function today() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

/** `--flag value` and `--flag=value`; `undefined` when a flag is malformed (the caller prints usage). */
export function parseArguments(argv) {
  const options = { stage: undefined, date: undefined, out: undefined, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equals = argument.indexOf("=");
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    const inline = equals === -1 ? undefined : argument.slice(equals + 1);
    const value = () => {
      if (inline !== undefined) return inline;
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) return undefined;
      index += 1;
      return next;
    };

    if (flag === "--help" || flag === "-h") {
      options.help = true;
    } else if (flag === "--stage") {
      const raw = value();
      if (raw === undefined || !/^\d+$/.test(raw) || Number(raw) < 1) return undefined;
      options.stage = Number(raw);
    } else if (flag === "--date") {
      const raw = value();
      if (raw === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
      options.date = raw;
    } else if (flag === "--out") {
      const raw = value();
      if (raw === undefined || raw === "") return undefined;
      options.out = raw;
    } else {
      return undefined;
    }
  }
  return options;
}

/** Runs the tool; returns the process exit code. */
export function main(argv = process.argv.slice(2), root = REPO_ROOT) {
  const options = parseArguments(argv);
  if (options === undefined) {
    console.error(`${USAGE}\n`);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const date = options.date ?? today();
  const stage = options.stage ?? 1;
  const source = collectSourceStrings(readSourceFiles(root));
  const model = collectBundle({ files: readTrLocaleFiles(root), sourceStrings: source.defaults, sourceKeys: source.keys, date, stage });
  const target = options.out === undefined ? path.join(root, "docs", "i18n", "review", `${date}-stage-${stage}.md`) : path.resolve(process.cwd(), options.out);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderBundle(model));

  const { counts } = model;
  console.log(
    `wrote ${path.relative(root, target).split(path.sep).join("/")} — ${counts.keys} tr anahtarı, ${counts.missing} eksik, ${counts.orphaned} şüpheli yetim` +
      (model.unreadable.length > 0 ? `, ${model.unreadable.length} okunamayan dosya` : "") +
      (model.nonStrings.length > 0 ? `, ${model.nonStrings.length} dize olmayan yaprak` : ""),
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
