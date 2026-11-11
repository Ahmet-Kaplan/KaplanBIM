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
