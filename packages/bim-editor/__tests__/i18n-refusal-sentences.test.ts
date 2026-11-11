/**
 * The kernel's own sentences, on screen, in the language being drawn.
 *
 * A refusal arrives as `CommandError`: a code *and* a free-form English sentence
 * (`packages/bim-kernel/src/command-core.ts`). Most codes are said in the editor's
 * own words (`operatorMessage`), but six are passed through verbatim because the
 * kernel's sentence carries something the generic one cannot — which group, which
 * sheet, which revision. Those six reached the screen in English.
 *
 * `refusalWords` is the composition the session now uses at every refusal point:
 *
 *   1. the kernel's sentence, if a template can say it in Turkish
 *      (`translateProse`: numbers become `{0}` slots, the template comes from
 *      `locales/tr/prose.json`, the numbers go back in order);
 *   2. otherwise the translated sentence for the code — a Turkish sentence that
 *      says less, never an English one;
 *   3. in English, the kernel's sentence unchanged, because it is the source.
 *
 * What is proven here: every one of the six "kernel word" codes comes out Turkish
 * for a realistic sentence *and* for one no template can key; the specific sentence
 * wins when it can be translated; and no raw `{0}` or `{{…}}` ever reaches a screen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { refusalWords } from "../src/editor/operator-messages";
import { translateFor } from "./helpers/editor-i18n";

const TR = translateFor("tr");
const EN = translateFor("en");

/**
 * One realistic sentence per code the session shows verbatim, as the kernel composes
 * it: a name and a count in the middle of the English.
 */
const KERNEL_WORD_SENTENCES = {
  has_dependents: '2 elements are in "Level 1". Choose a group to move them to, then delete.',
  undo_refused: "You can only undo your own changes; Ada Lovelace made revision 12",
  conflict: 'Level 1 changed since your edit; undoing would overwrite that work.',
  already_exists: '"Level 1" already exists; choose a new id',
  in_use: '"Level 1" is locked. Unlock it before deleting it.',
  locked: "This element is locked so it can't slide while you trace. Unlock it first",
} as const;

test("the six codes the session shows verbatim come out Turkish", () => {
  const english = Object.entries(KERNEL_WORD_SENTENCES).filter(
    ([code, message]) => refusalWords(code as keyof typeof KERNEL_WORD_SENTENCES, message, "tr", TR) === message,
  );
  expect(english).toEqual([]);
});

test("a sentence a template can key is preferred to the generic one", () => {
  // `Revision {0} is not in the recent history…` is in the map: the person gets the
  // kernel's meaning *and* the revision number, not the shorter generic sentence.
  const shown = refusalWords("undo_refused", "Revision 12 is not in the recent history, so it can't be undone here", "tr", TR);
  expect(shown).toBe("Revizyon 12 son geçmişte yok, bu yüzden burada geri alınamaz");
  expect(shown).not.toBe(refusalWords("undo_refused", "an older kernel sentence", "tr", TR));
});

test("a sentence no template can key falls back to the translated code, never to English", () => {
  const shown = refusalWords("has_dependents", '2 elements are in "Level 1". Choose a group to move them to, then delete.', "tr", TR);
  // The generic sentence says less — and says it in Turkish, which is the point.
  expect(shown).toContain("Hiçbir şey silinmedi");
  expect(shown).not.toContain("elements");
});

test("English is answered with the kernel's own sentence, unchanged", () => {
  const message = "Revision 12 is not in the recent history, so it can't be undone here";
  expect(refusalWords("undo_refused", message, "en", EN)).toBe(message);
});

test("no raw slot or placeholder reaches the screen", () => {
  const leaked = Object.entries(KERNEL_WORD_SENTENCES)
    .map(([code, message]) => refusalWords(code as keyof typeof KERNEL_WORD_SENTENCES, message, "tr", TR))
    .filter((shown) => /\{\{|\}\}|\{\d+\}/u.test(shown));
  expect(leaked).toEqual([]);
});

// ---------------------------------------------------------------------------
// The same defect, one layer up: the editor's own "not connected" prose
// ---------------------------------------------------------------------------

test("the session and the surface say why editing is off in a translated sentence", () => {
  // These call sites hand a sentence back to a panel when there is no live session.
  // Written as a bare English literal they reached a Turkish screen as English — the
  // same complaint this file exists for, one layer above the kernel. Every one of
  // them is a `t('session.…', '…', { ns: 'editor' })` now, and this keeps it that way.
  const files = ["packages/bim-editor/src/editor/model-session.ts", "packages/bim-editor/src/editor/BuildingModelSurface.tsx"];
  const bare: string[] = [];
  for (const id of files) {
    for (const line of readFileSync(join(__dirname, "../../..", id), "utf8").split("\n")) {
      if (!line.includes("isn't connected")) continue;
      // A comment explaining the family is not a sentence on a screen.
      if (/^\s*(?:\*|\/\*|\/\/)/u.test(line)) continue;
      // `t('session.…', '…', { ns: 'editor' })`, with or without more values after it.
      if (/t\('session\.[A-Za-z]+', "[^"]*", \{ ns: 'editor'/u.test(line)) continue;
      bare.push(`${id}: ${line.trim()}`);
    }
  }
  expect(bare).toEqual([]);
});
