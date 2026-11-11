/**
 * The half the caption scan cannot see: English that never got a `t()` call.
 *
 * `editor-source-captions.ts` proves that every *written* caption is still a
 * `t('<key>', '<English>')` call with the English it has today. That is the half
 * that bites when someone reverts a caption. It is blind to the other half — a
 * sentence that was never keyed at all — and so is `npm run i18n:review`, which
 * counts written keys. Three defects shipped through that hole:
 *
 *   - `DrawingCanvas` said "Draw inside {view}'s frame…" raw at one site while the
 *     identical sentence was keyed as `canvas.drawInsideFrame` at another;
 *   - `NoteHandles` said "…You can edit it when they finish." raw while
 *     `canvas.lockedBy` existed for it;
 *   - both were invisible to every guard and to the review bundle.
 *
 * So this scanner works the other way round: it finds **user-visible English text
 * that is not inside a translator call**, and lists it. The two guards together
 * cover positive space (a keyed caption stays keyed) and negative space (no
 * caption escapes keying at all).
 *
 * What counts as user-visible:
 *
 *  - JSX children: bare text between `>` and `<`;
 *  - `<title>…</title>` contents (a hover tooltip a person reads);
 *  - the string attributes a screen shows: `aria-label`, `title`, `placeholder`;
 *  - template or plain literals handed to `label:`, `prompt:`, `desc:`,
 *    `description:`, `refusal:`, `note:`, `hint:`, `caption:`.
 *
 * What does not: comments, `className`, `data-testid`, `id`, `key`, `d=` SVG
 * path data, `KeyboardEvent.key` names, keyboard shortcuts, algorithm names,
 * `new Error(…)` developer text, format examples a person types verbatim
 * (a level named `L1`, a dimension prefix `MIN.`), and anything already inside a
 * `t(…)`/`tr(…)` call.
 */
import fs from "node:fs";
import path from "node:path";
import { captionsIn } from "./editor-source-captions";

/** One piece of English a person can read, and where it is. */
export interface VisibleEnglish {
  /** Repository-relative file path. */
  readonly file: string;
  /** 1-based line. */
  readonly line: number;
  /** What the screen shows. */
  readonly text: string;
  /** Which shape it was found in. */
  readonly kind: "jsx" | "title" | "attribute" | "argument";
}

/**
 * Text that is not a caption even though it looks like one.
 *
 * Deliberately small and explicit: an entry here is a claim that a person does
 * not read this as words of the interface. Anything that *is* words belongs in
 * `t()` instead.
 */
const NOT_CAPTIONS = new Set([
  // A DOM tag a component compares against (`target.tagName === 'SELECT'`).
  "SELECT",
  "INPUT",
  "TEXTAREA",
  "BUTTON",
  "SVG",
  // KeyboardEvent.key names.
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Enter",
  "Escape",
  "Delete",
  "Backspace",
  "Tab",
  "Space",
  "Shift",
  "Control",
  "Meta",
  "Alt",
  // Algorithm and format names.
  "SHA-256",
  "MD5",
  // Format examples a person types or reads as a glyph, not as prose.
  "MIN.",
  "CLR",
  "EEP",
  "L1",
  "KEYNOTES",
  // A keyboard shortcut hint.
  "C S",
  // A `Promise` return type read out of a doc example.
  "Promise",
]);

/**
 * A word-bearing candidate: prose, not code.
 *
 * Rejects a single identifier (`Promise`), and the shapes that come from a `>`
 * that closed something other than a tag: a ternary's `) : x ? (`, an index
 * `[a, b]`, a typed parameter `(client: number)`, a leading comma, a cast
 * `as Record`.
 */
const looksLikeWords = (text: string): boolean =>
  /[A-Za-z]{2,}/u.test(text) &&
  !/^[\w.$/-]+$/u.test(text) &&
  !/[\[\]]/u.test(text) &&
  !/\)\s*:|\?\s*\(|\b as [A-Z]/u.test(text) &&
  !/\([A-Za-z_]+:/u.test(text) &&
  !/^[,;)]/u.test(text);

/** Strip comments, keeping string literals (so a `t('…')` inside a string still counts). */
function stripComments(source: string): string {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 2;
      out += " ";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const close = skipString(source, index);
      out += source.slice(index, close + 1);
      index = close + 1;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

function skipString(text: string, start: number): number {
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

/**
 * Every character span a translator call covers: its key, its English default and
 * its values. A caption inside one of these is keyed, and this scanner leaves it
 * alone.
 */
function translatorSpans(source: string): readonly (readonly [number, number])[] {
  const spans: (readonly [number, number])[] = [];
  for (const match of source.matchAll(/\b(?:t|tr)\s*\(/gu)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let index = open;
    while (index < source.length) {
      const char = source[index];
      if (char === '"' || char === "'" || char === "`") {
        index = skipString(source, index) + 1;
        continue;
      }
      if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    spans.push([open, index]);
  }
  return spans;
}

/** The index of the `)` that closes the `(` at `open`. */
function matchingParen(source: string, open: number): number {
  let depth = 0;
  let index = open;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' || char === "'" || char === "`") {
      index = skipString(source, index) + 1;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return source.length - 1;
}

/** A call's arguments, split where the commas are not inside anything else. */
function splitTopLevel(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === '"' || char === "'" || char === "`") {
      const close = skipString(text, index);
      current += text.slice(index, close + 1);
      index = close + 1;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) {
      args.push(current);
      current = "";
      index += 1;
      continue;
    }
    current += char;
    index += 1;
  }
  args.push(current);
  return args;
}

const inside = (spans: readonly (readonly [number, number])[], at: number): boolean => spans.some(([start, end]) => at >= start && at <= end);

function lineOf(source: string, at: number): number {
  return source.slice(0, at).split("\n").length;
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/u.test(entry.name) ? [full] : [];
  });
}

/**
 * Every piece of user-visible English under `roots` that is not inside a
 * translator call, sorted by file and line.
 */
export function visibleEnglish(roots: readonly string[], root = path.join(__dirname, "..", "..")): VisibleEnglish[] {
  const found: VisibleEnglish[] = [];
  for (const dir of roots) {
    for (const file of sourceFiles(dir).sort()) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      const spans = translatorSpans(source);
      const id = path.relative(root, file).split(path.sep).join("/");

      const add = (at: number, text: string, kind: VisibleEnglish["kind"]): void => {
        const trimmed = text.trim();
        if (trimmed === "" || inside(spans, at)) return;
        if (NOT_CAPTIONS.has(trimmed)) return;
        if (!looksLikeWords(trimmed)) return;
        found.push({ file: id, line: lineOf(source, at), text: trimmed, kind });
      };

      // `<title>…</title>` first: its body is also a JSX child, and naming it a
      // tooltip reads better in the report. A title's words can sit in its text
      // *or* in a template literal inside an expression (`{`Snaps to the ${x}`}`),
      // so both are read.
      for (const match of source.matchAll(/<title>([\s\S]*?)<\/title>/gu)) {
        const body = match[1] ?? "";
        const at = (match.index ?? 0) + "<title>".length;
        if (!body.includes("{")) {
          add(at, body, "title");
          continue;
        }
        // Static text outside the expressions, then the strings inside them. A title
        // whose words come from a `t(…)` is keyed: its literals are skipped, and the
        // leftovers a non-greedy `{…}` strip leaves behind must not be reported.
        const keyed = /\b(?:t|tr)\s*\(/u.test(body);
        const outside = keyed ? "" : body.replace(/\{[\s\S]*?\}/gu, " ");
        if (/[A-Za-z]{2,}/u.test(outside)) add(at, outside, "title");
        for (const literal of body.matchAll(/`([^`]*)`|(?<![\w.])'([^'\\]*)'|(?<![\w.])"([^"\\]*)"/gu)) {
          const text = (literal[1] ?? literal[2] ?? literal[3] ?? "").replace(/\$\{[^}]*\}/gu, " ");
          // The literal's own position, so a `t('…')` inside the title is left alone.
          add(at + (literal.index ?? 0), text, "title");
        }
      }

      // JSX children: text between a tag's `>` and the next `<`.
      //
      // The `>` must be the one that *closes a tag*, or `useState<Foo>(null)` and an
      // arrow function's `=>` would make the code between them look like prose. A tag
      // opens with `</?Name` and closes at the first `>` outside its attributes.
      for (const match of source.matchAll(/<\/?([A-Za-z][\w.:-]*)([^<>]*)>/gu)) {
        const from = (match.index ?? 0) + match[0].length;
        const to = source.indexOf("<", from);
        if (to === -1) continue;
        const body = source.slice(from, to);
        if (!/[A-Za-z]{2,}/u.test(body)) continue;
        // An expression is code, not a caption: `{t('…')}`, `{error}`, `{labelText}`.
        if (/[{}]/u.test(body)) continue;
        // Code that happens to sit between a tag and the next one is not a caption.
        if (/[=;]|=>|&&|\|\||\breturn\b|\bconst\b|use[A-Z]/u.test(body)) continue;
        add(from, body, "jsx");
      }

      // The attributes a screen reads out: a plain string, and the strings inside an
      // expression (`aria-label={`Clear ${name}`}`, `title={canEdit ? '…' : …}`).
      // The key may be quoted (`attributes: { 'aria-label': 'Note text' }`), which is how
      // a ProseMirror editor names its region.
      for (const match of source.matchAll(/['"]?\b(aria-label|title|placeholder)['"]?\s*[:=]\s*(["'{])/gu)) {
        const at = match.index ?? 0;
        if (match[2] === '"') {
          const literal = /^"([^"]*)"/u.exec(source.slice(at + match[0].length - 1));
          add(at, literal?.[1] ?? "", "attribute");
          continue;
        }
        if (match[2] === "'") {
          const literal = /^'([^']*)'/u.exec(source.slice(at + match[0].length - 1));
          add(at, literal?.[1] ?? "", "attribute");
          continue;
        }
        const open = at + match[0].length - 1;
        const end = matchingParen(source, open);
        // `title` in this codebase is also a Radix attribute name inside a render prop:
        // only the strings a person reads are wanted, so a value made of class names is skipped.
        const expression = source.slice(open, end + 1);
        const isClassNameFactory = /className|cn\(/u.test(expression);
        for (const literal of expression.matchAll(/`([^`]*)`|'([^'\\]*)'|"([^"\\]*)"/gu)) {
          const text = (literal[1] ?? literal[2] ?? literal[3] ?? "").replace(/\$\{[^}]*\}/gu, " ");
          if (isClassNameFactory) continue;
          add(open + (literal.index ?? 0), text, "attribute");
        }
      }

      // Undo labels: the second argument of `send`/`submit`/`onCommit`/…, which is the
      // words the undo toast and the ribbon show. A caption a person reads, in a
      // position no `label:` scan can see.
      for (const call of source.matchAll(/\b(send|submit|onCommit|onStep|onTag|onTagsBatch|act|setQuick|setQuickCrop|onSave|onChange)\s*\(/gu)) {
        const open = (call.index ?? 0) + call[0].length - 1;
        const end = matchingParen(source, open);
        const args = splitTopLevel(source.slice(open + 1, end));
        const second = args[1];
        if (second === undefined) continue;
        const literal = /^\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*$/u.exec(second);
        if (!literal) continue;
        const text = (literal[2] ?? "").replace(/\$\{[^}]*\}/gu, " ");
        add(open, text, "argument");
      }

      // Literals handed to a field named like a caption.
      for (const match of source.matchAll(/\b(label|prompt|desc|description|refusal|note|hint|caption)\s*:\s*(["'`])((?:\\.|(?!\2)[^\\])*)\2/gu)) {
        const body = match[3] ?? "";
        if (body.includes("${")) {
          // A template's static words still count; its expressions do not.
          add(match.index ?? 0, body.replace(/\$\{[^}]*\}/gu, " "), "argument");
          continue;
        }
        add(match.index ?? 0, body, "argument");
      }
    }
  }
  return found.sort((left, right) => (left.file === right.file ? left.line - right.line : left.file < right.file ? -1 : 1));
}

/**
 * Keyed sentences that also appear unkeyed somewhere in the same trees.
 *
 * This is the check that catches a *second* site of a caption somebody already
 * keyed elsewhere (`canvas.drawInsideFrame`, `canvas.lockedBy`): the English is
 * the same words, so an unkeyed copy is a revert nobody had to write.
 */
export function unkeyedTwins(roots: readonly string[], captions = roots.map((dir) => captionsIn(dir))): VisibleEnglish[] {
  const english = new Set<string>();
  for (const source of captions) for (const caption of source.values()) english.add(caption.english);
  const normalize = (text: string): string => text.replace(/\s+/gu, " ").trim();
  const keyed = new Set([...english].map(normalize));
  return visibleEnglish(roots).filter((entry) => keyed.has(normalize(entry.text)));
}

/** A caption's English, for a message that names both halves. */
export function describe(entry: VisibleEnglish): string {
  return `${entry.file}:${entry.line} [${entry.kind}] ${JSON.stringify(entry.text)}`;
}
