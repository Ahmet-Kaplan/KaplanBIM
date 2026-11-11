/**
 * The half the caption scan cannot see: English that never got a `t()` call.
 *
 * `editor-source-captions.ts` proves that every *written* caption is still a
 * `t('<key>', '<English>')` call with the English it has today. That is the half
 * that bites when someone reverts a caption. It is blind to the other half — a
 * sentence that was never keyed at all — and so is `npm run i18n:review`, which
 * counts written keys. Defects shipped through that hole:
 *
 *   - `DrawingCanvas` said "Draw inside {view}'s frame…" raw at one site while the
 *     identical sentence was keyed as `canvas.drawInsideFrame` twenty lines later;
 *   - `NoteHandles` said "…You can edit it when they finish." raw while
 *     `canvas.lockedBy` existed for it;
 *   - `ParameterInput`, `CalloutFields` and `use-crop-3d` kept raw labels because
 *     the scan only looked at JSX text, attributes and three `label:` shapes.
 *
 * So this scanner works the other way round: it finds **user-visible English text
 * that is not inside a translator call**, and lists it. The two guards together
 * cover positive space (a keyed caption stays keyed) and negative space (no
 * caption escapes keying at all).
 *
 * ## What it reads
 *
 *  - **JSX children**: the literal segments between a tag's `>` and the next `<`,
 *    split at each `{…}` so `<p>Press {key} to finish</p>` yields "Press" and
 *    "to finish" rather than being skipped whole;
 *  - **`<title>…</title>`** contents, including the static words of a template
 *    literal inside the title;
 *  - **`aria-label` / `title` / `placeholder`**: a plain string, the strings inside
 *    an expression, and the quoted-key form a ProseMirror editor uses
 *    (`attributes: { 'aria-label': 'Note text' }`);
 *  - **literals handed to a `label:`/`prompt:`/`desc:`/`description:`/`refusal:`/
 *    `note:`/`hint:`/`caption:` field**, wherever they sit in the value;
 *  - **every string inside the arguments of the calls that speak**: `toast(…)`,
 *    `toast.error/success/info/warning/message(…)`, `setError(…)`, `notify(…)`,
 *    `onRefused(…)`, `setStatus(…)`, `setMessage(…)`, `setProblem(…)`,
 *    `setBusy(…)`, `setLoading(…)`, `hint(…)`, `onHint(…)`, `setRefusal(…)`;
 *  - **undo labels**: every string inside the arguments of `send`/`submit`/
 *    `onCommit`/`onStep`/`onTag`/`onTagsBatch`/`act`/`setQuick`/`setQuickCrop`/
 *    `onSave`/`onChange` — the words the undo toast and the ribbon show. Read
 *    recursively, so a ternary, a helper call or an interpolation in there is
 *    found too.
 *
 * A candidate's *text* is the literal's own words, with each `${…}` / `{…}`
 * replaced by a space: an interpolation is code, the words around it are not.
 *
 * ## What it never reports, and why
 *
 *  - anything inside a `t(…)`/`tr(…)` span — that is the keyed half;
 *  - comments (a docstring may quote a caption), and `import`/`export` lines;
 *  - `className`, `cn(…)`, `data-testid`, `testId`, `id`, `key`, `role`, `type`,
 *    `name`: machine names, never read aloud (a template id such as
 *    `` `ribbon-${tabId}-ventilation` `` reads as words once its interpolation is
 *    cut out, and is not a caption);
 *  - `d="M0 0…"` SVG path data and other geometry attributes;
 *  - `KeyboardEvent.key` values (`ArrowLeft`, `Enter`, `Escape`) — key names, not
 *    captions, and the same in every language;
 *  - keyboard shortcut glyphs (`C S`), algorithm names (`SHA-256`, `MD5`), DOM tag
 *    names a component compares against (`SELECT`, `INPUT`, `TEXTAREA`), and format
 *    examples a person types verbatim (`MIN.`, `CLR`, `EEP`, `L1`, `KEYNOTES`);
 *  - `new Error(…)` developer text and `console.*` payloads: never on a screen;
 *  - a value that is one identifier (`Promise`, `DarkMode`), a CAST (`as Record`),
 *    an index (`[a, b]`), a typed parameter (`(client: number)`), or a ternary's
 *    `) : x ? (` — the shape a `>` inside code produces.
 *
 * Every exclusion above is either a *symbol* (not words) or a place a person does
 * not read. Anything that is words on a screen belongs in `t()`.
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
 * Text that is not a caption even though it looks like one: DOM tag names, key
 * names, shortcut glyphs, algorithm names and format examples a person types.
 */
const NOT_CAPTIONS = new Set([
  "SELECT",
  "INPUT",
  "TEXTAREA",
  "BUTTON",
  "SVG",
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
  "SHA-256",
  "MD5",
  "MIN.",
  "CLR",
  "EEP",
  "L1",
  "KEYNOTES",
  "C S",
  "Promise",
  // `window.open(…, '_blank', 'noopener,noreferrer')`: a browser feature list.
  "noopener,noreferrer",
]);

/** The calls whose string arguments a person reads. */
const SPEAKING_CALLS = [
  "toast",
  "toast\\.(?:error|success|info|warning|message|loading|dismiss)",
  "setError",
  "notify",
  "onRefused",
  "setStatus",
  "setMessage",
  "setProblem",
  "setBusy",
  "setLoading",
  "hint",
  "onHint",
  "setRefusal",
];

/** The calls whose second argument is an undo label: `send(cmd, 'move the note')`. */
const UNDO_CALLS = ["send", "submit", "onCommit", "onStep", "onTag", "onTagsBatch", "act", "setQuick", "setQuickCrop"];

/** The field names whose value is a caption, wherever it sits. */
const CAPTION_FIELDS = "label|prompt|desc|description|refusal|note|hint|caption";

/**
 * Is this literal prose a person reads, rather than CSS, a transform, an id or a
 * module path? Used by the file-wide sweep, which has no surrounding shape to lean
 * on, so it judges the words alone.
 */
const looksLikeProse = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === "use client") return false;
  // CSS, SVG transforms, urls, colours, template syntax, code punctuation.
  if (/--|\bvar\(|\burl\(|rotate\(|matrix\(|translate|color-mix|srgb|\dpx\b|\drem\b|#\w|%|[{}<>\\=;|@]/u.test(trimmed)) return false;
  // A module specifier, a path, a token id.
  if (/^[@./]/u.test(trimmed) || trimmed.includes("/")) return false;
  // Three or more hyphenated tokens is a class list (`bm-coord-anim`, `draft-preview`).
  if ((trimmed.match(/[A-Za-z0-9]+-[A-Za-z0-9]+/gu) ?? []).length >= 2) return false;
  // A media query, a font stack, a file name, a stored id: not words on a screen.
  if (/prefers-|sans-serif|monospace|\bserif\b|\.pdf|\.png|\.csv/u.test(trimmed)) return false;
  if (/^[a-z][\w.:-]*$/u.test(trimmed)) return false;
  // At least two words of two letters, and it must end as words do.
  const words = trimmed.match(/[A-Za-z]{2,}/gu) ?? [];
  if (words.length < 2) return false;
  if (!/[A-Za-z).!?'”’]$/u.test(trimmed)) return false;
  return true;
};

/**
 * A word-bearing candidate: prose, not code.
 *
 * A single capitalised word counts (`'Cancel'`, `'Move'`, `'Undo'`): it is the most
 * common caption there is, and rejecting it is how a whole class of labels stayed
 * English. A candidate whose interpolation was cut out (`place ` from
 * `` `place ${view.name}` ``) counts too, because what is left is words.
 */
const looksLikeWords = (text: string): boolean => {
  const trimmed = text.trim();
  if (!/[A-Za-z]{2,}/u.test(trimmed)) return false;
  // One identifier, camelCase, hyphenated or dotted: `Promise`, `DarkMode`, `detail-end`,
  // `working_angle`, `t.rich`. A single capitalised word is the exception — that is the
  // most common caption there is (`Cancel`, `Move`, `Rev`, `Date`, `Up`).
  if (/^[A-Za-z_$][\w$-]*(?:\.[A-Za-z_$][\w$-]*)*$/u.test(trimmed) && !/^[A-Z][a-z]{1,}$/u.test(trimmed)) return false;
  if (/[\[\]]/u.test(trimmed)) return false;
  if (/\)\s*:|\?\s*\(|\b as [A-Z]/u.test(trimmed)) return false;
  if (/\([A-Za-z_]+:/u.test(trimmed)) return false;
  // A segment that begins with code punctuation is the tail of an expression, not prose.
  if (/^[,;):}\])}>+=&|?]/u.test(trimmed)) return false;
  // A function signature or a call leaked into a child segment.
  if (/\bfunction\b|\bprops\./u.test(trimmed)) return false;
  // A path, a url, a css token or a bare number is not prose.
  if (/^(?:\.{0,2}\/|https?:|--?[\w-]+$)/u.test(trimmed)) return false;
  return true;
};

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
 * The index of the bracket that closes the one at `open`, counting `(`, `{` and `[`
 * together — an `aria-label={`…`}` or `{a ? {…} : …}` closes at its own `}`, and a
 * scanner that counts only `(` runs on into the next function and loses the text.
 */
function matchingBracket(source: string, open: number): number {
  const opening = source[open];
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : ")";
  let depth = 0;
  let index = open;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' || char === "'" || char === "`") {
      index = skipString(source, index) + 1;
      continue;
    }
    if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) return char === closing ? index : index;
    }
    index += 1;
  }
  return source.length - 1;
}

/** Every character span a translator call covers: its key, its English and its values. */
function translatorSpans(source: string): readonly (readonly [number, number])[] {
  const spans: (readonly [number, number])[] = [];
  for (const match of source.matchAll(/\b(?:t|tr)\s*\(/gu)) {
    const open = match.index + match[0].length - 1;
    spans.push([open, matchingBracket(source, open)]);
  }
  return spans;
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

/** A literal found in the source: its absolute offset and the words it shows. */
interface Literal {
  readonly at: number;
  readonly text: string;
}

/**
 * Every string or template literal between two offsets, with each `{…}`/`${…}`
 * replaced by a space: an interpolation is code, the words around it are not.
 */
function literalsBetween(source: string, from: number, to: number): readonly Literal[] {
  const out: Literal[] = [];
  let index = from;
  while (index < to) {
    const char = source[index];
    if (char === '"' || char === "'" || char === "`") {
      const close = skipString(source, index);
      const raw = source.slice(index + 1, close);
      out.push({ at: index, text: raw.replace(/\$\{[^}]*\}/gu, " ") });
      index = close + 1;
      continue;
    }
    index += 1;
  }
  return out;
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

/**
 * Every JSX tag in the source, as `[start, end]`: the `<` that opens it and the `>`
 * that closes it, with its attributes walked quote- and brace-aware so an arrow
 * function's `>` or a `{…}` object does not end the tag early.
 */
function jsxTags(source: string): readonly (readonly [number, number])[] {
  const tags: (readonly [number, number])[] = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] !== "<") {
      index += 1;
      continue;
    }
    const next = source[index + 1] ?? "";
    if (!/[A-Za-z/]/u.test(next)) {
      index += 1;
      continue;
    }
    let cursor = index + 1;
    let depth = 0;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === '"' || char === "'" || char === "`") {
        cursor = skipString(source, cursor) + 1;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
      cursor += 1;
    }
    if (cursor >= source.length) break;
    tags.push([index, cursor]);
    index = cursor + 1;
  }
  return tags;
}

/**
 * A JSX child's words: the runs of text between its `{…}` expressions, each with a
 * balanced brace walk so an object literal inside the expression does not end it
 * early. `Press {key} to finish` gives "Press " and " to finish".
 */
function literalSegments(body: string): readonly { readonly at: number; readonly text: string }[] {
  const segments: { at: number; text: string }[] = [];
  let runStart = 0;
  let index = 0;
  while (index < body.length) {
    const char = body[index];
    if (char !== "{") {
      index += 1;
      continue;
    }
    if (index > runStart) segments.push({ at: runStart, text: body.slice(runStart, index) });
    let depth = 0;
    while (index < body.length) {
      const inner = body[index];
      if (inner === '"' || inner === "'" || inner === "`") {
        index = skipString(body, index) + 1;
        continue;
      }
      if (inner === "{") depth += 1;
      else if (inner === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    index += 1;
    runStart = index;
  }
  if (runStart < body.length) segments.push({ at: runStart, text: body.slice(runStart) });
  return segments;
}

/** The call spans whose arguments hold captions, as `[open, close]`. */
function callSpans(source: string, names: readonly string[]): readonly (readonly [number, number])[] {
  const pattern = new RegExp(String.raw`\b(?:${names.join("|")})\s*\(`, "gu");
  const spans: (readonly [number, number])[] = [];
  for (const match of source.matchAll(pattern)) {
    const open = match.index + match[0].length - 1;
    spans.push([open, matchingBracket(source, open)]);
  }
  return spans;
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
      const speaking = callSpans(source, SPEAKING_CALLS);
      const undoing = callSpans(source, UNDO_CALLS);
      const id = path.relative(root, file).split(path.sep).join("/");

      const add = (at: number, text: string, kind: VisibleEnglish["kind"]): void => {
        const trimmed = text.replace(/\s+/gu, " ").trim();
        if (trimmed === "" || inside(spans, at)) return;
        if (NOT_CAPTIONS.has(trimmed)) return;
        if (!looksLikeWords(trimmed)) return;
        found.push({ file: id, line: lineOf(source, at), text: trimmed, kind });
      };

      // `<title>…</title>`: a hover tooltip a person reads. Its words sit in the text
      // *or* in a template literal inside an expression (`{`Snaps to the ${x}`}`), so
      // both are read — and a title whose words come from `t(…)` contributes nothing.
      for (const match of source.matchAll(/<title>([\s\S]*?)<\/title>/gu)) {
        const body = match[1] ?? "";
        const at = (match.index ?? 0) + "<title>".length;
        for (const literal of literalsBetween(body, 0, body.length)) add(at + literal.at, literal.text, "title");
        if (!body.includes("{")) add(at, body, "title");
      }

      // JSX children: the literal segments between a tag's closing `>` and the next
      // tag, split at each `{…}` so an interpolating child is read rather than
      // skipped. The tag's end is found by walking its attributes brace- and
      // quote-aware: a regex cannot, because `=>` inside an attribute is a `>`.
      for (const [tagStart, tagEnd] of jsxTags(source)) {
        const to = source.indexOf("<", tagEnd + 1);
        if (to === -1) continue;
        const body = source.slice(tagEnd + 1, to);
        if (!/[A-Za-z]{2,}/u.test(body)) continue;
        // Code that happens to sit between a tag and the next one is not a caption.
        if (/\breturn\b|\bconst\b|use[A-Z]|=>|&&|\|\|/u.test(body)) continue;
        // A `;` or a `=` inside prose ("Rename this sheet; it keeps its history") is a
        // sentence, not code — only an assignment or an arrow is code.
        if (/(?<![=!<>])=(?!=)/u.test(body)) continue;
        for (const segment of literalSegments(body)) {
          if (!/[A-Za-z]{2,}/u.test(segment.text)) continue;
          void tagStart;
          add(tagEnd + 1 + segment.at, segment.text, "jsx");
        }
        for (const expression of body.matchAll(/\{[\s\S]*?\}/gu)) {
          const open = tagEnd + 1 + (expression.index ?? 0);
          const close = matchingBracket(source, open);
          for (const literal of literalsBetween(source, open, close + 1)) add(literal.at, literal.text, "jsx");
        }
      }

      // The attributes a screen reads out: a plain string, the strings inside an
      // expression, and a quoted key (`attributes: { 'aria-label': 'Note text' }`).
      for (const match of source.matchAll(/['"]?\b(aria-label|title|placeholder)['"]?\s*[:=]\s*(["'{])/gu)) {
        const at = match.index ?? 0;
        const marker = at + match[0].length - 1;
        if (match[2] !== "{") {
          const literal = literalsBetween(source, marker, marker + 1)[0];
          add(at, literal?.text ?? "", "attribute");
          continue;
        }
        const end = matchingBracket(source, marker);
        for (const literal of literalsBetween(source, marker, end + 1)) add(literal.at, literal.text, "attribute");
      }

      // A field named like a caption, wherever in the value its words sit.
      for (const match of source.matchAll(new RegExp(String.raw`\b(?:${CAPTION_FIELDS})\s*:\s*`, "gu"))) {
        const at = (match.index ?? 0) + match[0].length;
        const literal = literalsBetween(source, at, Math.min(at + 1, source.length))[0];
        if (literal !== undefined) {
          add(literal.at, literal.text, "argument");
          continue;
        }
        // A ternary or a helper here: read every string up to the end of the value.
        let end = at;
        while (end < source.length && !/[\n,]/u.test(source[end] ?? "")) end += 1;
        for (const inner of literalsBetween(source, at, end)) add(inner.at, inner.text, "argument");
      }

      // The calls that speak, and the calls that take an undo label: every string in
      // their arguments, so a ternary, a helper or an interpolation is found too.
      for (const [open, close] of speaking) {
        for (const literal of literalsBetween(source, open, close)) {
          // A translator call inside these arguments is keyed already.
          if (inside(spans, literal.at)) continue;
          add(literal.at, literal.text, "argument");
        }
      }
      // Every literal anywhere in the file that reads as prose. A caption can reach a
      // screen through a helper's return value, a `return \`…\`` or a variable that a
      // child draws — none of which the shapes above can see. Contexts a person never
      // reads are skipped: an import, a class list, a test id, a console tag, a
      // developer `Error`, a `d=` path.
      for (const literal of literalsBetween(source, 0, source.length)) {
        if (inside(spans, literal.at)) continue;
        const lineStart = source.lastIndexOf("\n", literal.at) + 1;
        const line = source.slice(lineStart, source.indexOf("\n", literal.at) === -1 ? source.length : source.indexOf("\n", literal.at));
        if (/\b(?:className|cn|data-testid|testId|console\.|import |from |require\(|new Error|aria-|role=|data-|d=|id=|key=|type=|name=|href=|stroke|fill|style=|Math\.|JSON\.|process\.|localStorage|sessionStorage)\b/u.test(line)) continue;
        if (/^\s*(?:export |import )/u.test(line)) continue;
        if (!looksLikeProse(literal.text)) continue;
        add(literal.at, literal.text, "argument");
      }

      for (const [open, close] of undoing) {
        // Only the second argument: `send(command, 'the words')`. The first is a
        // command object full of ids and enum values.
        const second = splitTopLevel(source.slice(open + 1, close))[1];
        if (second === undefined) continue;
        const offset = open + 1 + source.slice(open + 1, close).indexOf(second);
        for (const literal of literalsBetween(source, offset, offset + second.length)) {
          if (inside(spans, literal.at)) continue;
          add(literal.at, literal.text, "argument");
        }
      }
    }
  }
  const seen = new Set<string>();
  const unique = found.filter((entry) => {
    const id = `${entry.file}:${entry.line}:${entry.text}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return unique.sort((left, right) => (left.file === right.file ? left.line - right.line : left.file < right.file ? -1 : 1));
}

/** Curly apostrophes and straight ones are the same word: compared, not shipped. */
const sameWords = (text: string): string => text.replace(/\s+/gu, " ").replace(/[’‘]/gu, "'").trim();

/**
 * Keyed sentences that also appear unkeyed somewhere in the same trees.
 *
 * This is the check that catches a *second* site of a caption somebody already
 * keyed elsewhere (`canvas.drawInsideFrame`, `canvas.lockedBy`): the English is the
 * same words, so an unkeyed copy is a revert nobody had to write. The comparison
 * folds curly and straight apostrophes, since a copy can differ by that alone.
 */
export function unkeyedTwins(roots: readonly string[], captions = roots.map((dir) => captionsIn(dir))): VisibleEnglish[] {
  const english = new Set<string>();
  for (const source of captions) for (const caption of source.values()) english.add(sameWords(caption.english));
  return visibleEnglish(roots).filter((entry) => english.has(sameWords(entry.text)));
}

/** A caption's file, line, shape and words, as the failure message shows them. */
export function describe(entry: VisibleEnglish): string {
  return `${entry.file}:${entry.line} [${entry.kind}] ${JSON.stringify(entry.text)}`;
}
