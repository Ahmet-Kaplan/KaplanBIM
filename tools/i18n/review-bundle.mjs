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
// bulunamadı"; a file that will not parse or read is listed under "Okunamayan
// dosyalar". Nothing is ever quietly left out — an incomplete list that looks
// complete is worse than no list.
//
// Coverage is per namespace, not per key name. `actions.save` exists in `common`
// *and* in `editor`, and a Turkish `common.actions.save` says nothing about
// `editor.actions.save`: collapsing the two would report a missing editor string
// as translated. So every key is matched as `namespace\0key`, with the namespace
// read from the locale file on the Turkish side and from `ns:`, `useT('x')` /
// `useTranslation('x')`, else i18next's `defaultNS`, on the source side.
//
// The English comes from the source text, never from a second JSON file: the
// `t('key', 'English')` call is the single source of truth, so the tool reads
// `packages/*/src` and `apps/*/src` with `fs` and never imports them.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, readSourceFiles, readTrLocaleFiles } from "./locale-files.mjs";

/** The markers a reviewer scans for. */
export const MISSING_MARKER = "⚠️ eksik";
export const ORPHAN_MARKER = "⚠️ kaynakta bulunamadı";
export const EMPTY_MARKER = "⚠️ boş değer";

/** Written when there is no discoverable English default — a dash, never a guess. */
const NO_ENGLISH = "—";

/** i18next's `defaultNS` in `packages/bim-ui/src/i18n/index.ts`. */
export const DEFAULT_NAMESPACE = "common";

/** Qualifier inside a coverage id. A NUL byte cannot appear in a namespace or a key. */
const QUALIFIER = "\u0000";

/** `common` + `language.label` → one coverage id. */
export const qualify = (namespace, key) => `${namespace}${QUALIFIER}${key}`;

/** A coverage id back to its two halves. */
export function unqualify(id) {
  const at = id.indexOf(QUALIFIER);
  return at === -1 ? { namespace: DEFAULT_NAMESPACE, key: id } : { namespace: id.slice(0, at), key: id.slice(at + 1) };
}

/** Strings compared by code unit, not by locale: the bundle has to be byte-reproducible. */
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

// ---------------------------------------------------------------------------
// Reading the source text
// ---------------------------------------------------------------------------

const STRING_LITERAL = String.raw`(['"])((?:\\.|(?!\1)[^\\])*)\1`;

/** Where a `t(...)` call starts. */
const CALL_START = /\bt\s*\(/g;

/** `useT('editor')` / `useTranslation('editor')`: what a component's `t` resolves to. */
const NAMESPACE_DECLARATION = /\b(?:useTranslation|useT)\s*\(/g;

/** `ns: 'editor'` on one call, which beats the component's declaration. */
const NS_OPTION = new RegExp(String.raw`(?:^|[,{]\s*)ns\s*:\s*${STRING_LITERAL}`);
/** `defaultValue: 'English'` on one call. */
const DEFAULT_VALUE_OPTION = new RegExp(String.raw`(?:^|[,{]\s*)defaultValue\s*:\s*${STRING_LITERAL}`);

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
      const close = skipString(text, index);
      out += text.slice(index, close + 1);
      index = close + 1;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

/** Index of the quote that closes the literal opening at `start`, or the last index. */
function skipString(text, start) {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === "\\") {
      index += 2;
      continue;
    }
    if (text[index] === quote) return index;
    index += 1;
  }
  return text.length - 1;
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
 * The text between the parentheses opening at `openIndex`, strings skipped so a
 * `)` inside `t('k', 'Save (draft)')` cannot end the call early.
 */
function callArguments(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' || char === "'" || char === "`") {
      index = skipString(source, index);
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, index);
    }
  }
  return source.slice(openIndex + 1);
}

/** Every string literal in `text`, with the position it starts at. */
function literalsIn(text) {
  const literals = [];
  for (const match of text.matchAll(new RegExp(STRING_LITERAL, "g"))) literals.push({ at: match.index, body: match[2] });
  return literals;
}

/** True when the literal at `at` is a property value (`{ ns: 'editor' }`), not a positional argument. */
const isPropertyValue = (args, at) => /[A-Za-z_$][\w$]*\s*:\s*$/.test(args.slice(0, at));

/** The namespace a declaration names: a literal, `common` for `useT()`, `null` when it cannot be read. */
function declaredNamespace(args) {
  const literal = literalsIn(args)[0];
  if (literal !== undefined) return unescapeLiteral(literal.body);
  return args.trim() === "" ? DEFAULT_NAMESPACE : null;
}

/**
 * Every `t(...)` call in one source file, each bound to the namespace i18next
 * would use for it, with the English default where the call carries one.
 *
 * Namespace resolution, in order: an explicit `ns: 'x'` on the call; otherwise
 * the nearest preceding `useT('x')` / `useTranslation('x')` in the same file
 * (the hook is declared at the top of the component that calls `t`); otherwise
 * the nearest following one; otherwise `defaultNS`, which is `common` — that is
 * what i18next resolves, not a guess. A declaration whose argument is not a
 * string literal (`useTranslation(namespace)`) cannot be known statically, so
 * those calls fall back to `common` **and** count as uncertain: the report says
 * how many, rather than pretending.
 *
 * `calls` also holds the calls with no English default (a key read from a map, an
 * options-only call): those are genuinely in the source, so the bundle prints a
 * dash for their English instead of calling them orphaned.
 */
export function extractSource(text, { defaultNamespace = DEFAULT_NAMESPACE } = {}) {
  const source = stripComments(text);

  const declarations = [];
  for (const match of source.matchAll(NAMESPACE_DECLARATION)) {
    const openIndex = match.index + match[0].length - 1;
    declarations.push({ at: match.index, namespace: declaredNamespace(callArguments(source, openIndex)) });
  }

  /** The declaration nearest a call: before it for preference, after it if there is none before. */
  const namespaceAt = (at) => {
    const before = declarations.filter((declaration) => declaration.at < at).at(-1);
    if (before !== undefined) return before;
    return declarations[0];
  };

  const calls = [];
  let uncertain = 0;
  for (const match of source.matchAll(CALL_START)) {
    const args = callArguments(source, match.index + match[0].length - 1);
    const positional = literalsIn(args).filter((literal) => !isPropertyValue(args, literal.at));
    const key = unescapeLiteral(positional[0]?.body ?? "");
    if (!isKey(key)) continue;

    const explicitNamespace = NS_OPTION.exec(args);
    const defaultValue = DEFAULT_VALUE_OPTION.exec(args);
    const declaration = namespaceAt(match.index);
    let namespace;
    if (explicitNamespace !== null) {
      namespace = unescapeLiteral(explicitNamespace[2]);
    } else if (declaration === undefined) {
      namespace = defaultNamespace;
    } else if (declaration.namespace === null) {
      namespace = defaultNamespace;
      uncertain += 1;
    } else {
      namespace = declaration.namespace;
    }

    const english = defaultValue !== null ? unescapeLiteral(defaultValue[2]) : positional[1] === undefined ? undefined : unescapeLiteral(positional[1].body);
    calls.push({ namespace, key, english });
  }

  return { calls, namespaces: [...new Set(declarations.map((declaration) => declaration.namespace).filter((value) => value !== null))].sort(compare), uncertain };
}

/**
 * `[{ id, text }]` → every English default and every key in the repo, as
 * namespace-qualified coverage ids, plus how many calls could not be bound to a
 * namespace statically.
 */
export function collectSourceStrings(files) {
  const defaults = {};
  const keys = new Set();
  let uncertain = 0;
  for (const file of [...files].sort((left, right) => compare(left.id, right.id))) {
    const found = extractSource(file.text);
    uncertain += found.uncertain;
    for (const call of found.calls) {
      const id = qualify(call.namespace, call.key);
      keys.add(id);
      // First one wins; files are fed in sorted order, so "first" is a fact about
      // the repo, not about the file system.
      if (call.english !== undefined && !(id in defaults)) defaults[id] = call.english;
    }
  }
  return { defaults, keys: [...keys].sort(compare), uncertain };
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
 *
 * Exported so the guard tests can check that this flattening and the one in
 * `packages/bim-ui/__tests__/locale-files.ts` see the same corpus.
 */
export function flattenLocaleFiles(files, { kind = "locale" } = {}) {
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
      unreadable.push({ id: file.id, kind, error: file.parseError });
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
 * @param {Record<string, string>} [input.sourceStrings] coverage id (`common\u0000language.label`) → English
 * @param {Iterable<string>} [input.sourceKeys] every `t(...)` coverage id, including those with no English default
 * @param {readonly {id: string, error: string}[]} [input.sourceErrors] source files the scan could not read
 * @param {number} [input.uncertainNamespaces] calls whose namespace could not be read statically
 * @param {string} input.date `YYYY-MM-DD`; the CLI's clock is the only place today's date is read
 * @param {number} [input.stage]
 */
export function collectBundle({ files = [], sourceStrings = {}, sourceKeys, sourceErrors = [], uncertainNamespaces = 0, date, stage = 1 }) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`date must be YYYY-MM-DD, got ${String(date)}`);
  if (!Number.isInteger(stage) || stage < 1) throw new Error(`stage must be a positive integer, got ${String(stage)}`);

  const { entries, nonStrings, unreadable } = flattenLocaleFiles(files);
  const referenced = new Set([...Object.keys(sourceStrings), ...(sourceKeys ?? [])]);
  const knownEnglish = (namespace, key) => (Object.hasOwn(sourceStrings, qualify(namespace, key)) ? sourceStrings[qualify(namespace, key)] : undefined);

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

  const counts = { files: files.length, keys: 0, englishFound: 0, noEnglish: 0, empty: 0, missing: 0, orphaned: 0 };
  /** Namespace-qualified ids that actually carry Turkish text. */
  const translated = new Set();
  /** Namespace-qualified ids that have a `tr` row but no text in it. */
  const empty = new Set();

  const sections = [...namespaces.values()]
    .sort((left, right) => compare(left.namespace, right.namespace))
    .map((group) => ({
      namespace: group.namespace,
      files: [...group.files].sort(compare),
      rows: [...group.rows.values()]
        .sort((left, right) => compare(left.key, right.key))
        .map((row) => {
          const values = [...new Set(row.values.map((cell) => cell.value))];
          const id = qualify(group.namespace, row.key);
          const english = knownEnglish(group.namespace, row.key);
          // A key no `t(...)` call mentions may be dead, or reached through a map
          // the scan cannot see. Say so; never drop the row.
          const orphaned = !referenced.has(id);
          // No Turkish text is not a translation: the key stays a gap, and the
          // coverage table counts it as one.
          const hasText = values.some((value) => value.trim() !== "");
          if (hasText) translated.add(id);
          else {
            empty.add(id);
            counts.empty += 1;
          }
          counts.keys += 1;
          if (english === undefined) counts.noEnglish += 1;
          else counts.englishFound += 1;
          if (orphaned) counts.orphaned += 1;
          return { key: row.key, english, values, orphaned, empty: !hasText };
        }),
    }));

  const missing = [...referenced]
    .filter((id) => !translated.has(id))
    .map(unqualify)
    .map(({ namespace, key }) => ({
      namespace,
      key,
      english: knownEnglish(namespace, key) ?? null,
      // A row that exists but says nothing is a different defect from no row at
      // all, and the reviewer fixes it differently.
      marker: empty.has(qualify(namespace, key)) ? EMPTY_MARKER : MISSING_MARKER,
    }))
    .sort((left, right) => compare(left.namespace, right.namespace) || compare(left.key, right.key));
  counts.missing = missing.filter((entry) => entry.marker === MISSING_MARKER).length;

  return {
    date,
    stage,
    counts,
    uncertainNamespaces,
    sections,
    missing,
    nonStrings,
    // Source files the scan could not read belong in the same list as locale
    // files it could not parse: both are scope the report does not cover.
    unreadable: [...unreadable, ...sourceErrors.map((file) => ({ id: file.id, kind: "source", error: file.error }))],
  };
}

/** Escapes a value so a `|` or a newline cannot break out of its table cell. */
const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

const TABLE_HEAD = ["| Key | English | Türkçe |", "|-----|---------|--------|"];

const row = (key, english, turkish) => `| \`${key}\` | ${cell(english ?? NO_ENGLISH)} | ${cell(turkish)} |`;

/** One Turkish cell: the text, plus whatever the reviewer must know about it. */
function turkishCell({ values, orphaned, empty }) {
  const text = values.join(" · ");
  const marks = [];
  if (empty) marks.push(EMPTY_MARKER);
  if (values.length > 1) marks.push("⚠️ çakışan değer");
  if (orphaned) marks.push(ORPHAN_MARKER);
  return [text, ...marks].filter((part) => part !== "").join(" ");
}

/** The bundle model as the Markdown file a person reads. */
export function renderBundle({ date, stage, counts, uncertainNamespaces = 0, sections, missing, nonStrings, unreadable }) {
  const lines = [`# i18n İnceleme Paketi — Aşama ${stage}`, ""];
  lines.push(`- **Tarih / Date:** ${date}`, `- **Aşama / Stage:** ${stage}`, "");

  lines.push("## Kapsam (coverage)", "", "| Ölçü | Sayı |", "|------|------|");
  lines.push(`| tr dosyası | ${counts.files} |`);
  lines.push(`| tr anahtarı | ${counts.keys} |`);
  lines.push(`| — English varsayılanı bulundu | ${counts.englishFound} |`);
  lines.push(`| — English varsayılanı yok (\`${NO_ENGLISH}\`) | ${counts.noEnglish} |`);
  lines.push(`| — Boş değer (\`${EMPTY_MARKER}\`) | ${counts.empty} |`);
  lines.push(`| Eksik çeviri (\`${MISSING_MARKER}\`) | ${counts.missing} |`);
  lines.push(`| Şüpheli yetim (\`${ORPHAN_MARKER}\`) | ${counts.orphaned} |`);
  // Counted in the same table as everything else: a file the tool could not read,
  // a leaf that is not a string and a call whose namespace it could not resolve
  // are gaps in the scope, not silence.
  lines.push(`| Okunamayan dosya | ${unreadable.length} |`);
  lines.push(`| Dize olmayan yaprak | ${nonStrings.length} |`);
  lines.push(`| Ad alanı okunamayan çağrı (varsayılan \`${DEFAULT_NAMESPACE}\`) | ${uncertainNamespaces} |`);
  lines.push("");
  lines.push(`Anahtarlar ad alanına göre eşleştirilir: \`${DEFAULT_NAMESPACE}.actions.save\` dolu olsa da \`editor.actions.save\` eksikse aşağıda eksik görünür.`, "");

  if (sections.length === 0) {
    lines.push("İncelenecek tr dosyası yok: aşağıda listelenecek bir çeviri bulunamadı.", "");
  }

  for (const section of sections) {
    lines.push(`## \`${section.namespace}\``, "", `Dosyalar: ${section.files.map((file) => `\`${file}\``).join(", ")}`, "");
    lines.push(...TABLE_HEAD);
    for (const rowValue of section.rows) lines.push(row(rowValue.key, rowValue.english, turkishCell(rowValue)));
    lines.push("");
  }

  lines.push("## Çevrilmemiş anahtarlar (kaynakta var, tr yok ya da boş)", "");
  if (missing.length === 0) {
    lines.push(`Yok: kaynakta bulunan her anahtarın kendi ad alanında bir tr karşılığı var.`, "");
  } else {
    // Grouped by namespace so `editor.actions.save` cannot be mistaken for the
    // translated `common.actions.save`.
    for (const namespace of [...new Set(missing.map((entry) => entry.namespace))].sort(compare)) {
      lines.push(`### \`${namespace}\``, "");
      lines.push(...TABLE_HEAD);
      for (const entry of missing.filter((candidate) => candidate.namespace === namespace)) lines.push(row(entry.key, entry.english, entry.marker));
      lines.push("");
    }
  }

  if (unreadable.length > 0) {
    lines.push("## Okunamayan dosyalar", "", "Bu dosyaların anahtarları aşağıda **yok**: okunamadı ya da JSON geçersiz.", "");
    for (const file of unreadable) lines.push(`- \`${file.id}\` (${file.kind === "source" ? "kaynak" : "tr"}) — ${file.error}`);
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
  const scan = readSourceFiles(root);
  const source = collectSourceStrings(scan.files);
  const model = collectBundle({
    files: readTrLocaleFiles(root),
    sourceStrings: source.defaults,
    sourceKeys: source.keys,
    sourceErrors: scan.unreadable,
    uncertainNamespaces: source.uncertain,
    date,
    stage,
  });
  const target = options.out === undefined ? path.join(root, "docs", "i18n", "review", `${date}-stage-${stage}.md`) : path.resolve(process.cwd(), options.out);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderBundle(model));

  const { counts } = model;
  console.log(
    `wrote ${path.relative(root, target).split(path.sep).join("/")} — ${counts.keys} tr anahtarı, ${counts.missing} eksik, ${counts.empty} boş, ${counts.orphaned} şüpheli yetim` +
      (model.unreadable.length > 0 ? `, ${model.unreadable.length} okunamayan dosya` : "") +
      (model.nonStrings.length > 0 ? `, ${model.nonStrings.length} dize olmayan yaprak` : "") +
      (model.uncertainNamespaces > 0 ? `, ${model.uncertainNamespaces} ad alanı okunamayan çağrı` : ""),
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
