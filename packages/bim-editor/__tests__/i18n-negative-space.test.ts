/**
 * The other half of the caption guard: English that never got a `t()` call.
 *
 * `i18n-panels-chrome`, `i18n-views-sheets` and `i18n-operator-messages` prove
 * that every caption somebody *wrote* is still keyed. None of them can see a
 * sentence that was never keyed at all — that is how a raw "Draw inside {view}'s
 * frame…" and a raw "You can edit it when they finish." shipped beside their own
 * keyed twins, and why `npm run i18n:review` still said "0 missing".
 *
 * `helpers/editor-visible-english.ts` scans the same trees for user-visible
 * English (JSX children, `<title>` tooltips, `aria-label`/`title`/`placeholder`,
 * and literals handed to `label:`/`prompt:`/`refusal:`/…) that is *not* inside a
 * `t(…)` call, and the work stays enumerable here: a new one fails this file with
 * its file and line.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, unkeyedTwins, visibleEnglish } from "./helpers/editor-visible-english";

const EDITOR_SRC = path.join(__dirname, "..", "src", "editor");

/** The two trees this stage owns: every drawing surface a person spends time in. */
const OWNED = [path.join(EDITOR_SRC, "views-sheets"), path.join(EDITOR_SRC, "orientation")];

test("no user-visible English in views-sheets or orientation sits outside a translator", () => {
  const found = visibleEnglish(OWNED);
  // Printed, not counted: the point of this guard is that the work is enumerable.
  expect(found.map(describe)).toEqual([]);
});

test("no keyed sentence has an unkeyed twin in these trees", () => {
  // The same English in two places, one of them raw, is a revert nobody had to write.
  expect(unkeyedTwins(OWNED).map(describe)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Each hole in the scanner, closed — proved with a planted violation
// ---------------------------------------------------------------------------

/**
 * The scanner's own test: a fake source tree with one caption in each shape the
 * guard must catch. Written through `fs` into a temporary directory and read back
 * by the same `visibleEnglish`, so a narrowing of the scanner fails here before it
 * can go quiet on the real tree.
 */
const PLANTED = `'use client'
import { toast, setError } from 'x'

export function Planted({ view, key, selectionLabel }: { view: { name: string }; key: string; selectionLabel: string | null }) {
  toast('A toast that nobody keyed')
  toast.error('An error toast that nobody keyed')
  setError('A refusal that nobody keyed')
  notify('Pick a wall, or two points along it')
  const label = ['move the note', 'a wall'][0]
  return (
    <div>
      <p>Press {key} to finish the drawing</p>
      <span>Rename this sheet; it keeps its history</span>
      <b>{selectionLabel ?? 'Nothing selected'}</b>
      <i>Cancel</i>
      <button aria-label={\`Clear \${view.name}\`}>x</button>
      <title>{canEdit()}Drag this corner</title>
    </div>
  )
}

function canEdit(): string {
  return \`Crop box \${1} × \${2} ft. Release to save, Esc to cancel.\`
}
`;

test("the scanner reports every caption shape a person can ship, with its line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "visible-english-"));
  fs.writeFileSync(path.join(dir, "Planted.tsx"), PLANTED);
  const found = visibleEnglish([dir], dir).map((entry) => `${entry.kind}:${entry.text}`);
  fs.rmSync(dir, { recursive: true, force: true });

  const wanted = [
      // 1. call-argument strings
      "argument:A toast that nobody keyed",
      "argument:An error toast that nobody keyed",
      "argument:A refusal that nobody keyed",
      "argument:Pick a wall, or two points along it",
      // 2. a single capitalised word
      "jsx:Cancel",
      // 3. a JSX child that interpolates: the words around the expression
      "jsx:Press",
      "jsx:to finish the drawing",
      // 4. a caption with a semicolon in it
      "jsx:Rename this sheet; it keeps its history",
      // 5. a brace-aware attribute expression, and a child expression's literal
      "attribute:Clear",
      "jsx:Nothing selected",
      // a template returned through a helper
      "argument:Crop box × ft. Release to save, Esc to cancel.",
  ];
  for (const caption of wanted) expect(found).toContain(caption);
});
