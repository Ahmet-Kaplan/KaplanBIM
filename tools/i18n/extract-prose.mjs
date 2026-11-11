#!/usr/bin/env node
// The English sentences the kernel and the trade packs write, as the templates
// `packages/bim-ui/src/i18n/prose.ts` looks Turkish up by.
//
//   npm run i18n:prose:extract
//
// Why this exists: `CommandError` carries a free-form English `message`
// (`packages/bim-kernel/src/command-core.ts`) and the kernel may not import i18n.
// `translateProse` normalises a sentence at runtime and looks the template up in
// `packages/bim-ui/locales/tr/prose.json`. This tool reads the same sources and
// builds that key list, with the *same* normaliser the runtime uses — not a second
// implementation of it — so the key a translator writes and the key the screen
// looks up can never drift apart.
//
// Three things this file reports and never hides:
//
//   • The sentences written as object fields (`message:`, `text:`, `problem:`).
//   • The sentences written positionally as `refuse("code", "…")`. Scanning only
//     the fields would miss every refusal the editor shows: `has_dependents`,
//     `undo_refused`, `locked` and friends are all positional.
//   • Which templates the mechanism can actually match, and why the rest cannot be
//     matched by any map. A sentence built from a name — `2 elements are in
//     "Level 1"` — carries words that came from an interpolation, so the runtime
//     text and the source template differ by whole words, and no `{0}` slot can
//     stand in for them. Those stay English (see the report this tool prints).
//
// **Two blind spots, measured, not fixed here** (task 3.4 report, round 4):
//
//   1. **The per-file helpers are not read.** This tool knows the engine's
//      `refuse(code, message, ids)`; a file that wraps it for itself is invisible. The shapes
//      found so far, all with the sentence elsewhere in the argument list:
//        • `fail(message, ids, code)` — `annotation/text-note-commands.ts`,
//          `commands/views.ts:700`, `commands/view3d.ts` (166 call sites);
//        • `refusal(message, ids, code)` — `commands/views.ts:1725`, used for `in_use` at
//          `:1704`;
//        • and whatever the next file invents, which is why this is a rule and not a list.
//      Lost with them: both pinned-sheet-item refusals (`commands/views.ts:1518,1595`), the
//      "has no free N-pole space left" one (`connections/commands.ts:253`), and every real
//      sheet family (`commands/views.ts:1390,1704`).
//   2. A template literal nested inside `${…}` ends the literal early: `` `${a} x ${b ? `c` : ""}` ``.
//      Two `refuse("in_use", …)` sites are lost that way (`connections/commands.ts:253`,
//      `catalog/commands.ts:145`).
//
// A prototype scan with both handled finds **26 `in_use` sites against the 19 measured**, and
// **143 further templates, 89 of them matchable** — i.e. 89 sentences that would need Turkish
// before the numbers could claim them. So the gap is a task of its own (report, deferral
// list); until then the counts this tool prints are "measured", not "all".

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT } from "./locale-files.mjs";
import { normalizeProse } from "../../packages/bim-ui/src/i18n/prose.ts";

/** Files written by this tool; the review bundle and the guard tests read it. */
export const CATALOG_ID = "docs/i18n/prose-templates.json";

/** How it was written, so the file says what made it. */
export const GENERATED_BY = "tools/i18n/extract-prose.mjs";

/** The object fields that carry a sentence a person reads. */
export const PROSE_FIELDS = ["message", "text", "problem"];

/** Where the sentences live: the engine, and every trade pack (the brief names both). */
export function proseSourceDirectories(root = REPO_ROOT) {
  const directories = [path.join(root, "packages", "bim-kernel", "src")];
  const packages = path.join(root, "packages");
  for (const entry of fs.readdirSync(packages, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith("bim-pack-")) directories.push(path.join(packages, entry.name, "src"));
  }
  return directories.filter((directory) => fs.existsSync(directory)).sort();
}

/** Every `.ts`/`.tsx` file under those directories, repo-relative and sorted. */
export function readProseFiles(root = REPO_ROOT) {
  const files = [];
  const unreadable = [];
  const walk = (directory) => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      unreadable.push({ id: path.relative(root, directory).split(path.sep).join("/"), error: String(error) });
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const id = path.relative(root, full).split(path.sep).join("/");
      try {
        files.push({ id, text: fs.readFileSync(full, "utf8") });
      } catch (error) {
        unreadable.push({ id, error: String(error) });
      }
    }
  };
  for (const directory of proseSourceDirectories(root)) walk(directory);
  return { files: files.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)), unreadable };
}

// ---------------------------------------------------------------------------
// Reading one source file
// ---------------------------------------------------------------------------



/** `refuse("code", "…")`: how the kernel states a refusal, and the shape a field scan misses. */
// The message has to *be* the literal — `(?=\s*[,)])` — or a call whose message is an
// expression (`"deleted" in el ? … : …`) would be catalogued as the sentence `deleted`.
const REFUSE_CALL = /(?<![\w$.])refuse\s*\(\s*(['"])([^'"]*)\1\s*,\s*(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")(?=\s*[,)])/g;

/** Every `refuse(` call, so the run can say how many messages were expressions instead of sentences. */
const REFUSE_ANY = /(?<![\w$.])refuse\s*\(/g;

/**
 * One JS string literal as written, by quote. A backtick literal may hold
 * `${…}` and newlines, so the escape-or-something-that-is-not-the-quote rule is
 * written out rather than borrowed from a shared `(['"])…\1`, which would make the
 * back-reference point at the outer capture group and match nothing.
 */
const QUOTED_LITERAL = ["'(?:\\\\[\\s\\S]|[^'\\\\])*'", '"(?:\\\\[\\s\\S]|[^"\\\\])*"', "`(?:\\\\[\\s\\S]|[^`\\\\])*`"].join("|");

/** `message: "…"`, `text: \`…\``, `problem: "…"` — a sentence written as an object field. */
const MESSAGE_FIELD = `(?<![\\w$.])(?:${PROSE_FIELDS.join("|")})\\s*:\\s*(`;

const FIELD_LITERAL = new RegExp(`${MESSAGE_FIELD}${QUOTED_LITERAL})`, "g");

/**
 * `code: "already_exists"`, the refusal code a `message:` field belongs to.
 *
 * The name has to look like a kernel error code (`lower_snake_case`). Packs also use
 * `code:` for other things — a citation object carries `code: "FHWA HEC-22, Urban
 * Drainage Design Manual"` and `code: "Air balance"` — and counting those as refusal
 * codes made the report's "coded sentences" figure a count of *citations* as well.
 */
const CODE_FIELD = /(?<![\w$.])code\s*:\s*(['"])([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*)\1/g;

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

/** The text a literal stands for: delimiters off, escapes resolved. */
function literalBody(literal) {
  return unescapeLiteral(literal.slice(1, -1));
}

/**
 * Every `${…}` in a template literal, with the expression it holds.
 *
 * Braces are counted, not searched for: `${a ? { x: 1 } : {}}` is one
 * interpolation, and cutting it at the first `}` would mangle the sentence.
 */
export function interpolationsOf(body) {
  const found = [];
  let at = body.indexOf("${");
  while (at !== -1) {
    let depth = 0;
    let index = at + 1;
    for (; index < body.length; index += 1) {
      if (body[index] === "{") depth += 1;
      else if (body[index] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    found.push(body.slice(at + 2, index));
    at = body.indexOf("${", index + 1);
  }
  return found;
}

/**
 * Expressions whose value is *only* a number, so the runtime text keeps the same
 * words and only the digits change — exactly what a `{n}` slot stands for.
 *
 * Deliberately a short, readable list rather than a clever guess: a template
 * wrongly called matchable would sit in the coverage denominator forever as a
 * hole nobody can fill, and a translator would keep trying.
 */
const NUMERIC_EXPRESSION = /(?:^|[.[(])(?:revision|count|length|size|index|number|position|offset|total|qty|quantity|width|height|depth|elevation|amount|price|rate|percent|ratio|capacity|accepted|requested|minutes|hours|days|limit)(?:$|[.[(]|ly)/i;

/** A property whose name says it holds a number: the last link of the chain decides. */
const NUMERIC_FIELD = /^[A-Za-z_$][\w$]*$/;

/** True when the interpolation can only put characters where a `{n}` slot goes. */
export function isNumericInterpolation(expression) {
  const expr = expression.trim();
  if (expr === "") return false;
  // `i + 1`, `n * 2`, `row.count - 1`: arithmetic, so characters where a slot goes.
  if (/^[\w$.]+(?:\s*[+\-*/]\s*[\w$.]+)+$/u.test(expr)) return true;
  if (/^[-\d\s+*/().]+$/u.test(expr) && /\d/u.test(expr)) return true;
  // A quoted or pluralised expression is words by construction.
  if (/['"`]|\bplural\s*\(|\.join\(|\.map\(/.test(expr)) return false;
  if (/sizeLabel\s*\(/.test(expr)) return true; // "12 in", "1.5 ft": a unit and a number
  // A member chain counts only by its last link: `size.materialId` is an id, not a
  // size, and reading it as a number would claim a template nothing can match.
  // No bare single letter counts: `i` is often an index, but `c` is a class id and
  // `k` a kind, and a template wrongly called matchable is a hole nobody can fill.
  const last = expr.split(".").at(-1) ?? "";
  if (!NUMERIC_FIELD.test(last)) return false;
  return NUMERIC_EXPRESSION.test(last);
}

/**
 * One literal as the catalogue describes it: the template, whether the mechanism
 * can match it, and the words it was written with.
 *
 * An interpolation is replaced by `0` before normalising, so a numeric one lands
 * on a `{n}` slot of its own; `normalizeProse` then hands the slots out in
 * document order exactly as it will at runtime.
 */
export function templateOf(body, { interpolations = interpolationsOf(body) } = {}) {
  let substituted = "";
  let cursor = 0;
  for (const expression of interpolations) {
    const at = body.indexOf("${", cursor);
    substituted += `${body.slice(cursor, at)}0`;
    cursor = at + 2 + expression.length + 1;
  }
  substituted += body.slice(cursor);
  // No interpolation is matchable by definition; one textual interpolation makes
  // the whole template unreachable, because the runtime text carries that word.
  const matchable = interpolations.every((expression) => isNumericInterpolation(expression));
  return { template: normalizeProse(substituted).template, matchable };
}

/**
 * A `text:` field that is a label, not a sentence: `SHEET NUMBER`, `OPEN END`, `J`,
 * `ATS`, `doc.text`. Neither shape is prose — no template key would help it, and
 * counting it would make the catalogue's denominator a measure of how many diagram
 * labels and field paths the packs happen to have.
 *
 * Counted in `totals.labels` rather than dropped in silence.
 */
export function isLabel(body) {
  // `SHEET NUMBER`, `OPEN END`, `J`: no lowercase letter anywhere.
  if (/^[^\p{Ll}]*$/u.test(body)) return true;
  // `doc.text`, `missing`, `reason`: one lowercase token, which is a field path or a
  // key in a data structure, not a sentence about the model.
  return /^[a-z][a-z0-9_.]*$/u.test(body);
}

/** The `code: "x"` in the object literal that holds `at`, if there is one. */
function enclosingCode(text, at) {
  let depth = 0;
  let start = -1;
  for (let index = at; index >= 0; index -= 1) {
    if (text[index] === "}") depth += 1;
    else if (text[index] === "{") {
      if (depth === 0) {
        start = index;
        break;
      }
      depth -= 1;
    }
  }
  if (start === -1) return undefined;
  const end = text.indexOf("}", at);
  const scope = text.slice(start, end === -1 ? text.length : end);
  const match = CODE_FIELD.exec(scope);
  return match === null ? undefined : match[2];
}

/**
 * The source with its comments blanked out, **character for character**.
 *
 * Two things depend on that: a `message: "…"` example written in a doc comment must
 * not enter the catalogue (this repo's own files show several), and the catalogue
 * cites `file:line`, which only means something if positions survive. The review
 * tool's stripper drops characters instead, which is right for its job and wrong
 * for this one.
 */
export function blankComments(text) {
  const blank = (slice) => slice.replace(/[^\n]/g, " ");
  let out = "";
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "/" && next === "/") {
      const end = text.indexOf("\n", index);
      const stop = end === -1 ? text.length : end;
      out += blank(text.slice(index, stop));
      index = stop;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(index, stop));
      index = stop;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      let cursor = index + 1;
      while (cursor < text.length) {
        if (text[cursor] === "\\") cursor += 2;
        else if (text[cursor] === char) break;
        else cursor += 1;
      }
      out += text.slice(index, cursor + 1);
      index = cursor + 1;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

/**
 * Every sentence one file writes, with the field or refusal code it came from.
 *
 * Comments are blanked first: this file, the kernel's docs and half the packs
 * *show* an example `message: "…"` in prose, and a catalogue full of documentation
 * examples is a catalogue nobody trusts.
 */
export function extractLiterals(text) {
  const source = blankComments(text);
  const found = [];
  for (const match of source.matchAll(REFUSE_CALL)) {
    found.push({ literal: match[3], kind: "refuse", code: match[2], at: match.index });
  }
  for (const match of source.matchAll(FIELD_LITERAL)) {
    const field = /([\w$]+)\s*:/u.exec(match[0])?.[1];
    found.push({ literal: match[1], kind: field ?? "message", code: enclosingCode(source, match.index), at: match.index });
  }
  return found.map((entry) => ({ ...entry, body: literalBody(entry.literal) })).filter((entry) => entry.body.trim() !== "");
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

/** A line number for a `sources` entry: "where do I change this sentence?". */
function lineAt(text, at) {
  let line = 1;
  for (let index = 0; index < at && index < text.length; index += 1) if (text[index] === "\n") line += 1;
  return line;
}

/**
 * The whole catalogue: one row per distinct template, with every place it is
 * written and every refusal code that can produce it.
 *
 * Sorted by how often the sentence is written, then by the template itself, so the
 * file is byte-reproducible and the most-used sentences are at the top — which is
 * the order a translator should work in.
 */
export function buildCatalog(files) {
  const rows = new Map();
  let literals = 0;
  let labels = 0;
  for (const file of files) {
    for (const entry of extractLiterals(file.text)) {
      literals += 1;
      if (isLabel(entry.body)) {
        labels += 1;
        continue;
      }
      const { template, matchable } = templateOf(entry.body, { interpolations: interpolationsOf(entry.body) });
      const row = rows.get(template) ?? { template, count: 0, sources: [], codes: [], kinds: [], matchable };
      row.count += 1;
      // A sentence is only matchable if every way it is written is: one textual
      // interpolation anywhere makes the template unreachable.
      row.matchable &&= matchable;
      const source = `${file.id}:${lineAt(file.text, entry.at)}`;
      if (!row.sources.includes(source)) row.sources.push(source);
      if (entry.code !== undefined && !row.codes.includes(entry.code)) row.codes.push(entry.code);
      if (!row.kinds.includes(entry.kind)) row.kinds.push(entry.kind);
      rows.set(template, row);
    }
  }
  const templates = [...rows.values()].sort((left, right) => right.count - left.count || (left.template < right.template ? -1 : left.template > right.template ? 1 : 0));
  for (const row of templates) {
    row.sources.sort();
    row.codes.sort();
    row.kinds.sort();
  }
  return {
    templates,
    totals: {
      files: files.length,
      literals,
      labels,
      templates: templates.length,
      matchable: templates.filter((row) => row.matchable).length,
      unmatchable: templates.filter((row) => !row.matchable).length,
    },
  };
}

/** The file `npm run i18n:prose:extract` writes. Deterministic: same sources, same bytes. */
export function catalogDocument(catalog) {
  return {
    generatedBy: GENERATED_BY,
    // Stated in the file, because the algorithm is the contract between the
    // translator's key and the runtime's lookup.
    algorithm: "numbers, number+unit and dates become {0}, {1} … in document order; see packages/bim-ui/src/i18n/prose.ts",
    totals: catalog.totals,
    templates: catalog.templates,
  };
}

/**
 * What the shipped Turkish map covers, measured — never asserted.
 *
 * Four readings, because one number would flatter the work:
 *
 *   • `matchable` — the templates a `{0}` slot can key at all. This is the population
 *     the mechanism can translate, and the target is stated against it;
 *   • `templates` — the whole catalogue. The difference from `matchable` is the tail
 *     no template can key (see the file header);
 *   • `coded` — templates that carry an error code, i.e. the sentences a refusal can
 *     reach the screen with. Not "refusals": a coded sentence can also be a citation
 *     the packs attach to a rule;
 *   • `top10` / `top50` — how much of what a person meets *most* is covered. The
 *     catalogue is in frequency order, so this is reach, not breadth. It is the
 *     honest reading of "the templates that reach the screen", and it is low: the
 *     most-repeated sentences are the ones that name things.
 */
export function proseCoverage(catalog, map) {
  const translated = (rows) => rows.filter((row) => Object.hasOwn(map, row.template)).length;
  const matchable = catalog.templates.filter((row) => row.matchable);
  const coded = catalog.templates.filter((row) => row.codes.length > 0);
  return {
    templates: catalog.templates.length,
    templatesTranslated: translated(catalog.templates),
    matchable: matchable.length,
    matchableTranslated: translated(matchable),
    coded: coded.length,
    codedTranslated: translated(coded),
    unmatchable: catalog.templates.length - matchable.length,
    top10: translated(catalog.templates.slice(0, 10)),
    top50: translated(catalog.templates.slice(0, 50)),
  };
}

/** Reads the Turkish map the widget looks templates up in. */
export function readTemplateMap(root = REPO_ROOT) {
  const full = path.join(root, "packages", "bim-ui", "locales", "tr", "prose.json");
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    return {};
  }
}

/** Runs the tool; returns the process exit code. */
export function main(argv = process.argv.slice(2), root = REPO_ROOT) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`usage: node --import tsx tools/i18n/extract-prose.mjs [--out PATH]\n\n  --out PATH   write the catalogue somewhere else (default: ${CATALOG_ID})`);
    return 0;
  }
  const outIndex = argv.indexOf("--out");
  const target = outIndex === -1 ? path.join(root, CATALOG_ID) : path.resolve(process.cwd(), argv[outIndex + 1] ?? "");

  const scan = readProseFiles(root);
  const catalog = buildCatalog(scan.files);
  const document = catalogDocument(catalog);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);

  const coverage = proseCoverage(catalog, readTemplateMap(root));
  const percent = (part, whole) => (whole === 0 ? "0.0" : ((part / whole) * 100).toFixed(1));
  console.log(
    `${path.relative(root, target).split(path.sep).join("/")} — ${catalog.totals.templates} şablon ` +
      `(${catalog.totals.literals} cümle, ${catalog.totals.files} dosya)`,
  );
  console.log(
    `  eşlenebilir (matchable) ${coverage.matchable}: çevrildi ${coverage.matchableTranslated} (${percent(coverage.matchableTranslated, coverage.matchable)}%) — hedef ≥ %80`,
  );
  console.log(`  şablon eşlenemez ${coverage.unmatchable}: ad/çoğul interpolasyonu taşıyor, İngilizce kalır`);
  console.log(
    `  tüm katalog ${coverage.templatesTranslated}/${coverage.templates} (${percent(coverage.templatesTranslated, coverage.templates)}%)`,
  );
  console.log(`  kodlu cümleler ${coverage.codedTranslated}/${coverage.coded} (${percent(coverage.codedTranslated, coverage.coded)}%)`);
  console.log(
    `  erişim (en sık): ilk 10 ${coverage.top10}/10, ilk 50 ${coverage.top50}/50 — hedef ≥ %80 BURADA TUTMUYOR`,
  );
  if (scan.unreadable.length > 0) {
    console.log(`  okunamayan ${scan.unreadable.length} dosya:`);
    for (const file of scan.unreadable) console.log(`    ${file.id} — ${file.error}`);
  }
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
